"""
main.py
-------
Microservice FastAPI exposant le système hybride de détection d'anomalies
(Deep Autoencoder + Isolation Forest) sur les API mobiles.

Endpoints:
    POST /predict   -> exécute le pipeline hybride et retourne la décision
    GET  /health    -> vérifie que tous les artéfacts sont chargés
    GET  /metadata  -> infos sur le modèle (threshold, métriques, version)

Le service tourne sur le port 8001 (le backend Node.js tourne sur 3000 et
appelle ce service en HTTP, CORS est donc activé).
"""

import logging
import os
from contextlib import asynccontextmanager

# IMPORTANT : ce bloc doit s'exécuter AVANT les imports de schemas/predictor,
# car schemas.py lit ARTIFACTS_BASE_DIR au moment de l'import (au chargement
# du module) pour construire dynamiquement PredictRequest. En fixant la
# variable d'environnement ici, on garantit que schemas.py et predictor.py
# résolvent exactement le même chemin vers les artéfacts, peu importe l'ordre
# d'import.
#
# Les artéfacts ML vivent dans API_LOGS/ML et API_LOGS/data, soit un niveau
# au-dessus de ce service (API_LOGS/flask_service/). Surchargeable via
# variables d'environnement si la structure de dossiers change :
#   ARTIFACTS_BASE_DIR, ML_ARTIFACTS_DIR, DATA_ARTIFACTS_DIR,
#   ARTIFACT_METADATA_FILENAME, ARTIFACT_AUTOENCODER_FILENAME,
#   ARTIFACT_ISOLATION_FOREST_FILENAME, ARTIFACT_SCALER_FILENAME,
#   ARTIFACT_IMPUTER_FILENAME, ARTIFACT_CLIP_BOUNDS_FILENAME.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../API_LOGS
os.environ.setdefault("ARTIFACTS_BASE_DIR", _PROJECT_ROOT)
os.environ.setdefault("ML_ARTIFACTS_DIR", "ML")
os.environ.setdefault("DATA_ARTIFACTS_DIR", "data")

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from predictor import ArtifactLoadError, HybridPredictor, MissingFeatureError
from schemas import HealthResponse, MetadataResponse, PredictRequest, PredictResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("main")

predictor = HybridPredictor(
    base_dir=os.environ["ARTIFACTS_BASE_DIR"],
    ml_dir=os.environ["ML_ARTIFACTS_DIR"],
    data_dir=os.environ["DATA_ARTIFACTS_DIR"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    logger.info("Démarrage du service : chargement des artéfacts ML...")
    try:
        predictor.load_artifacts()
    except ArtifactLoadError as exc:
        # On ne lève pas d'exception bloquante : le service démarre quand
        # même pour que /health reste interrogeable et explique le problème,
        # mais /predict renverra une 503 explicite.
        logger.error("Échec du chargement des artéfacts au démarrage: %s", exc)
    yield
    # --- shutdown ---
    logger.info("Arrêt du service.")


app = FastAPI(
    title="Hybrid Anomaly Detection Microservice",
    description="Autoencoder (décideur principal) + Isolation Forest (qualificateur de sévérité)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS activé : le backend Node.js (port 3000) appelle ce service (port 8001)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # à restreindre en prod (ex: ["http://localhost:3000"])
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(MissingFeatureError)
async def missing_feature_handler(request: Request, exc: MissingFeatureError):
    """Retourne HTTP 422 avec le(s) nom(s) de feature(s) manquante(s)."""
    logger.warning("Requête rejetée: features manquantes %s", exc.missing_features)
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Features manquantes dans la requête.",
            "missing_features": exc.missing_features,
        },
    )


@app.exception_handler(ArtifactLoadError)
async def artifact_load_error_handler(request: Request, exc: ArtifactLoadError):
    logger.error("Erreur d'artéfact: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"detail": f"Service indisponible: {exc}"},
    )


@app.post("/predict", response_model=PredictResponse)
async def predict(payload: PredictRequest):
    """
    Exécute le pipeline hybride complet sur les 46 features fournies et
    retourne la décision (CRITICAL / WARNING / NORMAL) ainsi que les scores
    détaillés des deux modèles.
    """
    if not predictor.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Les modèles ne sont pas chargés. Vérifiez /health.",
        )

    payload_dict = payload.model_dump()

    try:
        result = predictor.predict(payload_dict)
    except MissingFeatureError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Erreur inattendue pendant la prédiction.")
        raise HTTPException(status_code=500, detail=f"Erreur de prédiction: {exc}") from exc

    return PredictResponse(**result)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Vérifie que tous les artéfacts nécessaires sont chargés en mémoire."""
    return HealthResponse(
        status="ok" if predictor.is_loaded else "degraded",
        autoencoder_loaded=predictor.autoencoder is not None,
        isolation_forest_loaded=predictor.isolation_forest is not None,
        scaler_loaded=predictor.scaler is not None,
        imputer_loaded=predictor.imputer is not None,
        clip_bounds_loaded=predictor.clip_bounds is not None,
    )


@app.get("/metadata", response_model=MetadataResponse)
async def metadata():
    """Retourne les infos du modèle : threshold, liste de features, métriques."""
    if not predictor.is_loaded or predictor.metadata is None:
        raise HTTPException(status_code=503, detail="Métadonnées non disponibles : modèles non chargés.")

    return MetadataResponse(
        model_version=predictor.metadata.get("model_version", "unknown"),
        autoencoder_threshold=predictor.ae_threshold,
        n_features=len(predictor.feature_names),
        features=predictor.feature_names,
        metrics=predictor.metadata.get("metrics", {}),
    )


@app.get("/")
async def root():
    return {
        "service": "Hybrid Anomaly Detection Microservice",
        "endpoints": ["/predict (POST)", "/health (GET)", "/metadata (GET)"],
    }