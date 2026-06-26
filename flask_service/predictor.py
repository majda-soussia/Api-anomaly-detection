"""
predictor.py
------------
Classe HybridPredictor : encapsule le chargement des artéfacts ML et la
logique de prédiction hybride Autoencoder + Isolation Forest.

Pipeline de preprocessing (ordre EXACT imposé par le cahier des charges) :
    1. imputer.transform(X)                -> gère les NaN
    2. clip('quality_degradation', bounds)  -> clipping avec bounds sauvegardés
    3. scaler.transform(X)                  -> normalisation (StandardScaler)
    4. autoencoder.predict(X) -> MSE        -> comparé à threshold
    5. isolation_forest.score_samples(X)    -> comparé au seuil IF

Règle de décision hybride asymétrique (validée par le superviseur) :
    - AE=True  ET IF=True   -> "CRITICAL"  (signal ultra fiable, action immédiate)
    - AE=True  ET IF=False  -> "WARNING"   (l'AE seul détecte un signal,
                                             on ne l'annule jamais : IF rate 8/34
                                             pannes donc il ne doit JAMAIS
                                             pouvoir effacer une alerte de l'AE)
    - AE=False (peu importe IF)            -> "NORMAL"  (l'AE est le décideur
                                             principal grâce à son excellent
                                             recall ; si l'AE ne flag pas,
                                             on considère qu'il n'y a pas
                                             d'anomalie)
"""

import json
import logging
import os
import pickle
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np

logger = logging.getLogger("hybrid_predictor")


class MissingFeatureError(Exception):
    """Levée quand une ou plusieurs features attendues sont absentes de la requête."""

    def __init__(self, missing_features: list[str]):
        self.missing_features = missing_features
        super().__init__(f"Features manquantes: {missing_features}")


class ArtifactLoadError(Exception):
    """Levée quand un artéfact (modèle, scaler, etc.) ne peut pas être chargé."""
    pass


class HybridPredictor:
    """
    Charge les artéfacts ML une seule fois (au démarrage de l'app) et expose
    une méthode predict() qui applique tout le pipeline hybride.
    """

    def __init__(
        self,
        base_dir: str | None = None,
        ml_dir: str = "ml",
        data_dir: str = "data",
        metadata_filename: str | None = None,
        autoencoder_filename: str | None = None,
        isolation_forest_filename: str | None = None,
        scaler_filename: str | None = None,
        imputer_filename: str | None = None,
        clip_bounds_filename: str | None = None,
    ):
        self.base_dir = base_dir or os.path.dirname(os.path.abspath(__file__))
        self.ml_dir = os.path.join(self.base_dir, ml_dir)
        self.data_dir = os.path.join(self.base_dir, data_dir)

        # Noms de fichiers configurables : priorité à l'argument explicite,
        # puis à la variable d'environnement, puis au nom par défaut.
        # Permet de pointer vers des artéfacts qui ne suivent pas la
        # convention de nommage standard (ex: "auto_scaler.pkl" au lieu de
        # "scaler.pkl") sans modifier le code.
        self.metadata_filename = metadata_filename or os.getenv(
            "ARTIFACT_METADATA_FILENAME", "autoencoder_metadata.json"
        )
        self.autoencoder_filename = autoencoder_filename or os.getenv(
            "ARTIFACT_AUTOENCODER_FILENAME", "autoencoder_model.keras"
        )
        self.isolation_forest_filename = isolation_forest_filename or os.getenv(
            "ARTIFACT_ISOLATION_FOREST_FILENAME", "isolation_forest_unsupervised.pkl"
        )
        self.scaler_filename = scaler_filename or os.getenv(
            "ARTIFACT_SCALER_FILENAME", "auto_scaler.pkl"
        )
        self.imputer_filename = imputer_filename or os.getenv(
            "ARTIFACT_IMPUTER_FILENAME", "imputer.pkl"
        )
        self.clip_bounds_filename = clip_bounds_filename or os.getenv(
            "ARTIFACT_CLIP_BOUNDS_FILENAME", "auto_clip_bounds.pkl"
        )

        # Artéfacts (None tant que load_artifacts() n'a pas été appelée)
        self.autoencoder: Any = None
        self.isolation_forest: Any = None
        self.scaler: Any = None
        self.imputer: Any = None
        self.clip_bounds: dict | None = None
        self.metadata: dict | None = None

        self.feature_names: list[str] = []
        self.ae_threshold: float = 0.0
        self.quality_degradation_idx: int | None = None
        self.clip_column_indices: dict[str, int] = {}

        self._loaded = False

    # ------------------------------------------------------------------ #
    # Chargement des artéfacts (appelé une seule fois au startup)
    # ------------------------------------------------------------------ #
    def load_artifacts(self) -> None:
        """Charge tous les artéfacts depuis le disque. Lève ArtifactLoadError si un fichier manque."""
        try:
            self.metadata = self._load_json(
                os.path.join(self.ml_dir, self.metadata_filename), self.metadata_filename
            )
            self.feature_names = self.metadata["features"]
            self.ae_threshold = float(self.metadata["threshold"])

            # La/les colonne(s) à clipper sont lues dynamiquement depuis
            # metadata["preprocessing"]["clip_columns"] (présent dans le vrai
            # autoencoder_metadata.json). Fallback sur "quality_degradation"
            # si la section "preprocessing" est absente (ancien format).
            preprocessing_cfg = self.metadata.get("preprocessing", {})
            clip_columns = preprocessing_cfg.get("clip_columns", ["quality_degradation"])

            self.clip_column_indices: dict[str, int] = {}
            for col in clip_columns:
                if col in self.feature_names:
                    self.clip_column_indices[col] = self.feature_names.index(col)
                else:
                    logger.warning(
                        "Colonne à clipper '%s' absente de la liste de features : ignorée.", col
                    )

            # Conservé pour compatibilité (utilisé par l'ancien code single-column)
            self.quality_degradation_idx = self.clip_column_indices.get("quality_degradation")

            # TensorFlow / Keras importé ici (lazy) pour accélérer le démarrage
            # si jamais seule la partie santé/metadata est testée.
            from tensorflow import keras

            self.autoencoder = self._load_pickle_or_keras(
                os.path.join(self.ml_dir, self.autoencoder_filename),
                self.autoencoder_filename,
                loader=keras.models.load_model,
            )

            self.isolation_forest = self._unwrap_model(
                self._load_pickle(
                    os.path.join(self.data_dir, self.isolation_forest_filename), self.isolation_forest_filename
                ),
                self.isolation_forest_filename,
                required_method="score_samples",
            )
            # Scaler et clip_bounds extraits directement du .pkl IF (CORRECT)
            _if_raw = self._load_pickle(
                os.path.join(self.data_dir, self.isolation_forest_filename),
                self.isolation_forest_filename,
            )
            if isinstance(_if_raw, dict):
                self.isolation_forest = self._unwrap_model(
                    _if_raw, self.isolation_forest_filename, "score_samples"
                )
                self.scaler = _if_raw.get("scaler")
                self.clip_bounds = _if_raw.get("clip_bounds")
                logger.info("Scaler et clip_bounds extraits du .pkl IF.")
            else:
                self.isolation_forest = _if_raw
                self.scaler = self._unwrap_model(
                    self._load_pickle(
                        os.path.join(self.data_dir, self.scaler_filename), self.scaler_filename
                    ),
                    self.scaler_filename,
                    required_method="transform",
                )
                self.clip_bounds = self._load_pickle(
                    os.path.join(self.data_dir, self.clip_bounds_filename), self.clip_bounds_filename
                )

            # ← TOUJOURS chargé, que ce soit dict ou pas
            self.imputer = self._unwrap_model(
                self._load_pickle(
                    os.path.join(self.data_dir, self.imputer_filename), self.imputer_filename
                ),
                self.imputer_filename,
                required_method="transform",
            )
                    

            self._loaded = True
            logger.info(
                "Artéfacts chargés avec succès (%d features, threshold AE=%.6f).",
                len(self.feature_names),
                self.ae_threshold,
            )
        except ArtifactLoadError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ArtifactLoadError(f"Échec du chargement des artéfacts: {exc}") from exc

    @staticmethod
    def _unwrap_model(obj: Any, label: str, required_method: str) -> Any:
        """
        Certains .pkl ne contiennent pas l'estimateur sklearn directement,
        mais un dict-wrapper du type {"model": <estimator>, "metadata": ...}
        ou {"isolation_forest": <estimator>, ...} (selon l'outil d'export
        utilisé pendant l'entraînement).

        Cette fonction détecte ce cas et retourne l'estimateur réel, identifié
        comme l'objet du dict qui possède la méthode `required_method`
        (ex: "score_samples" pour IsolationForest, "transform" pour
        Scaler/Imputer).

        Si `obj` possède déjà la méthode, il est retourné inchangé.
        """
        if hasattr(obj, required_method):
            return obj

        if isinstance(obj, dict):
            logger.warning(
                "%s: l'objet chargé est un dict (clés: %s), pas un estimateur direct. "
                "Recherche de l'estimateur réel à l'intérieur...",
                label, list(obj.keys()),
            )
            # 1. Essai sur les noms de clés usuels
            common_keys = [
                "model", "estimator", "clf", "isolation_forest", "scaler",
                "imputer", "transformer", "pipeline",
            ]
            for key in common_keys:
                if key in obj and hasattr(obj[key], required_method):
                    logger.info("%s: estimateur trouvé sous la clé '%s'.", label, key)
                    return obj[key]

            # 2. Sinon, on parcourt toutes les valeurs du dict et on prend la
            #    première qui possède la méthode requise.
            for key, value in obj.items():
                if hasattr(value, required_method):
                    logger.info("%s: estimateur trouvé sous la clé '%s' (recherche générique).", label, key)
                    return value

            raise ArtifactLoadError(
                f"{label}: aucun objet dans le dict ne possède la méthode '{required_method}'. "
                f"Clés disponibles: {list(obj.keys())}. "
                f"Vérifie manuellement la structure de ce fichier .pkl."
            )

        raise ArtifactLoadError(
            f"{label}: l'objet chargé ({type(obj)}) ne possède pas la méthode "
            f"'{required_method}' et n'est pas un dict-wrapper reconnu."
        )

    @staticmethod
    def _load_json(path: str, label: str) -> dict:
        if not os.path.exists(path):
            raise ArtifactLoadError(f"Artéfact manquant: {label} (chemin attendu: {path})")
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def _load_pickle(path: str, label: str) -> Any:
        if not os.path.exists(path):
            raise ArtifactLoadError(f"Artéfact manquant: {label} (chemin attendu: {path})")
        with open(path, "rb") as f:
            return pickle.load(f)

    @staticmethod
    def _load_pickle_or_keras(path: str, label: str, loader) -> Any:
        if not os.path.exists(path):
            raise ArtifactLoadError(f"Artéfact manquant: {label} (chemin attendu: {path})")
        return loader(path)

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ------------------------------------------------------------------ #
    # Preprocessing
    # ------------------------------------------------------------------ #
    def _validate_and_order_features(self, payload: dict) -> np.ndarray:
        """Vérifie que toutes les features attendues sont présentes et les ordonne."""
        missing = [f for f in self.feature_names if f not in payload]
        if missing:
            raise MissingFeatureError(missing)

        ordered_values = [payload[f] for f in self.feature_names]
        return np.array(ordered_values, dtype=np.float64).reshape(1, -1)

    @staticmethod
    def _extract_lower_upper(bounds: Any) -> tuple[float, float]:
        """
        Extrait (lower, upper) d'un objet bounds, quel que soit son format
        de sérialisation. clip_bounds.pkl peut avoir été sauvegardé sous
        plusieurs formes selon l'outil/la version utilisée pour l'entraînement :

            a) dict   : {"lower": x, "upper": y}
            b) tuple  : (x, y)
            c) list   : [x, y]
            d) ndarray: np.array([x, y])

        Lève ValueError si le format n'est reconnu dans aucun cas.
        """
        if isinstance(bounds, dict):
            if "lower" in bounds and "upper" in bounds:
                return float(bounds["lower"]), float(bounds["upper"])
            # Certains exports utilisent min/max plutôt que lower/upper
            if "min" in bounds and "max" in bounds:
                return float(bounds["min"]), float(bounds["max"])
            raise ValueError(f"Dict de bounds sans clés reconnues: {list(bounds.keys())}")

        if isinstance(bounds, (tuple, list, np.ndarray)):
            if len(bounds) != 2:
                raise ValueError(f"Bounds de longueur {len(bounds)} attendu 2 (lower, upper).")
            return float(bounds[0]), float(bounds[1])

        raise ValueError(f"Format de clip_bounds non reconnu: {type(bounds)}")

    def _get_bounds_for_column(self, col: str) -> tuple[float, float]:
        """
        Récupère (lower, upper) pour une colonne donnée, en gérant les deux
        structures possibles de clip_bounds.pkl :
          - bounds globaux (une seule colonne à clipper) : le fichier
            contient directement (lower, upper) ou {"lower":..,"upper":..}
          - bounds par colonne : le fichier est un dict {col_name: bounds, ...}
        """
        cb = self.clip_bounds

        # Cas "par colonne" : le fichier est un dict dont les clés sont des
        # noms de features connus.
        if isinstance(cb, dict) and col in cb:
            return self._extract_lower_upper(cb[col])

        # Sinon, on suppose que le fichier entier représente les bounds
        # d'une seule colonne (cas le plus fréquent : un seul clip_column).
        return self._extract_lower_upper(cb)

    def preprocess(self, X: np.ndarray) -> np.ndarray:
    # 1. Imputation
        X_imputed = self.imputer.transform(X)

        # 2. Clipping
        if self.clip_bounds is not None and self.clip_column_indices:
            for col, idx in self.clip_column_indices.items():
                try:
                    lower, upper = self._get_bounds_for_column(col)
                except ValueError as exc:
                    logger.error(
                        "Impossible d'extraire les bounds de clipping pour '%s': %s. "
                        "Clipping ignoré pour cette colonne.", col, exc,
                    )
                    continue
                X_imputed[:, idx] = np.clip(X_imputed[:, idx], lower, upper)

        # 3. Normalisation
        X_scaled = self.scaler.transform(X_imputed)

        # DEBUG TEMPORAIRE — à retirer après vérification
        logger.info(
            "DEBUG preprocess: X_raw[0][:3]=%s | X_scaled[0][:3]=%s | mean=%.4f std=%.4f",
            X_imputed[0][:3].tolist(),
            X_scaled[0][:3].tolist(),
            float(np.mean(np.abs(X_scaled))),
            float(np.std(X_scaled)),
        )

        return X_scaled

    # ------------------------------------------------------------------ #
    # Prédiction
    # ------------------------------------------------------------------ #
    def _autoencoder_score(self, X_scaled: np.ndarray) -> float:
        """Calcule le MSE de reconstruction de l'Autoencoder."""

        # DEBUG TEMPORAIRE — retire ces 4 lignes après vérification
        logger.info("DEBUG X_scaled shape: %s", X_scaled.shape)
        logger.info("DEBUG X_scaled mean=%.4f std=%.4f min=%.4f max=%.4f",
                    float(np.mean(X_scaled)), float(np.std(X_scaled)),
                    float(np.min(X_scaled)), float(np.max(X_scaled)))

        reconstruction = self.autoencoder.predict(X_scaled, verbose=0)
        mse = float(np.mean(np.square(X_scaled - reconstruction)))
        return mse

    def _isolation_forest_score(self, X_scaled: np.ndarray) -> tuple[float, bool]:
        """
        Calcule le score Isolation Forest et le flag binaire.

        score_samples renvoie des valeurs où PLUS BAS = PLUS ANORMAL.
        On normalise en [0, 1] (1 = anormal) pour la réponse API en utilisant
        une transformation sigmoïde centrée sur 0, et on utilise directement
        .predict() (qui renvoie -1 pour anomalie, 1 pour normal) pour le flag,
        car c'est la méthode officielle de sklearn pour la décision binaire.
        """
        raw_score = float(self.isolation_forest.score_samples(X_scaled)[0])
        label = int(self.isolation_forest.predict(X_scaled)[0])  # -1 = anomalie, 1 = normal
        flag = label == -1

        # Normalisation du score brut (~ -0.7 à -0.3 typiquement) vers [0, 1]
        # pour rester cohérent avec le format de réponse attendu (ex: 0.61).
        normalized_score = 1.0 / (1.0 + np.exp(10 * (raw_score + 0.5)))
        normalized_score = float(np.clip(normalized_score, 0.0, 1.0))

        return normalized_score, flag

    @staticmethod
    def _decide(ae_flag: bool, if_flag: bool) -> str:
        """Règle de décision hybride asymétrique validée par le superviseur."""
        if ae_flag and if_flag:
            return "CRITICAL"
        if ae_flag and not if_flag:
            return "WARNING"
        return "NORMAL"

    @staticmethod
    def _confidence(ae_score: float, ae_threshold: float, ae_flag: bool, if_flag: bool) -> float:
        """
        Score de confiance heuristique dans [0, 1].

        Principe : on mesure à quel point le score AE est loin de son
        threshold (plus il est loin, plus on est confiant dans le flag AE),
        puis on ajuste selon l'accord/désaccord avec Isolation Forest :
        - accord (CRITICAL ou NORMAL avec IF qui confirmerait) -> bonus de confiance
        - désaccord (WARNING) -> la confiance reflète surtout l'incertitude
          du WARNING, donc elle est plafonnée plus bas.

        NOTE: cette formule est une heuristique raisonnable mais n'est pas
        spécifiée dans le cahier des charges d'origine. Ajuste-la si ton
        équipe a une définition métier différente de "confidence".
        """
        # Distance relative au threshold, bornée à [0, 1]
        if ae_threshold > 0:
            distance_ratio = abs(ae_score - ae_threshold) / ae_threshold
        else:
            distance_ratio = abs(ae_score - ae_threshold)
        ae_distance_conf = float(np.clip(distance_ratio, 0.0, 1.0))

        base_confidence = 0.5 + 0.5 * ae_distance_conf

        if ae_flag and if_flag:
            # Les deux modèles sont d'accord -> haute confiance
            confidence = min(1.0, base_confidence + 0.10)
        elif ae_flag and not if_flag:
            # Désaccord (WARNING) -> confiance modérée, plafonnée
            confidence = min(0.75, base_confidence)
        else:
            # NORMAL : confiance basée sur la marge sous le threshold
            confidence = base_confidence

        return round(float(np.clip(confidence, 0.0, 1.0)), 4)

    def predict(self, payload: dict) -> dict:
        """
        Pipeline complet : validation -> preprocessing -> AE -> IF -> décision.
        Retourne un dict prêt à être injecté dans schemas.PredictResponse.
        """
        if not self._loaded:
            raise ArtifactLoadError("Le HybridPredictor n'a pas encore chargé ses artéfacts.")

        start = time.perf_counter()

        X = self._validate_and_order_features(payload)
        X_scaled = self.preprocess(X)

        ae_score = self._autoencoder_score(X_scaled)
        ae_flag = ae_score > self.ae_threshold

        if_score, if_flag = self._isolation_forest_score(X_scaled)

        decision = self._decide(ae_flag, if_flag)
        confidence = self._confidence(ae_score, self.ae_threshold, ae_flag, if_flag)

        elapsed_ms = (time.perf_counter() - start) * 1000.0

        result = {
            "autoencoder_score": round(ae_score, 6),
            "autoencoder_flag": ae_flag,
            "autoencoder_threshold": self.ae_threshold,
            "isolation_forest_score": round(if_score, 6),
            "isolation_forest_flag": if_flag,
            "decision": decision,
            "confidence": confidence,
            "processing_time_ms": round(elapsed_ms, 3),
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

        logger.info(
            "Prédiction: ae_score=%.6f ae_flag=%s if_score=%.6f if_flag=%s decision=%s time=%.2fms",
            ae_score, ae_flag, if_score, if_flag, decision, elapsed_ms,
        )

        return result