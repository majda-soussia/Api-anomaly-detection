import json
import os
from typing import Optional

from pydantic import BaseModel, Field, create_model, ConfigDict

_DEFAULT_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_BASE_DIR = os.getenv("ARTIFACTS_BASE_DIR", _DEFAULT_BASE_DIR)
_ML_DIR_NAME = os.getenv("ML_ARTIFACTS_DIR", "ML")
_METADATA_FILENAME = os.getenv("ARTIFACT_METADATA_FILENAME", "autoencoder_metadata.json")

METADATA_PATH = os.path.join(_BASE_DIR, _ML_DIR_NAME, _METADATA_FILENAME)


def _load_feature_names() -> list[str]:
    """Charge la liste exacte et ordonnée des 46 features depuis le metadata."""
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        metadata = json.load(f)
    features = metadata["features"]
    if not isinstance(features, list) or len(features) == 0:
        raise ValueError("autoencoder_metadata.json: 'features' doit être une liste non vide.")
    return features


FEATURE_NAMES: list[str] = _load_feature_names()

# Construction dynamique du modèle PredictRequest : un champ float par feature.
# Toutes les features sont obligatoires (Ellipsis = pas de défaut) afin que
# Pydantic renvoie une erreur 422 explicite si une feature est manquante,
# conformément à la contrainte du cahier des charges.
_predict_request_fields = {
    name: (float, Field(..., description=f"Valeur de la feature '{name}'"))
    for name in FEATURE_NAMES
}

PredictRequest = create_model(
    "PredictRequest",
    __config__=ConfigDict(extra="ignore"),
    **_predict_request_fields,
)
PredictRequest.__doc__ = (
    "Requête de prédiction : les 46 features attendues par le pipeline "
    "(imputer -> clip -> scaler -> autoencoder / isolation forest)."
)


class PredictResponse(BaseModel):
    """Réponse renvoyée par POST /predict."""

    autoencoder_score: float = Field(..., description="Erreur de reconstruction (MSE) de l'Autoencoder")
    autoencoder_flag: bool = Field(..., description="True si autoencoder_score > threshold")
    autoencoder_threshold: float = Field(..., description="Seuil de décision de l'Autoencoder")

    isolation_forest_score: float = Field(..., description="Score de l'Isolation Forest (normalisé en [0,1])")
    isolation_forest_flag: bool = Field(..., description="True si Isolation Forest considère le point anormal")

    decision: str = Field(..., description="'CRITICAL', 'WARNING' ou 'NORMAL'")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Score de confiance de la décision, dans [0,1]")

    processing_time_ms: float = Field(..., description="Temps de traitement total en millisecondes")
    timestamp: str = Field(..., description="Horodatage ISO 8601 UTC de la prédiction")


class HealthResponse(BaseModel):
    status: str
    autoencoder_loaded: bool
    isolation_forest_loaded: bool
    scaler_loaded: bool
    imputer_loaded: bool
    clip_bounds_loaded: bool


class MetadataResponse(BaseModel):
    model_version: str
    autoencoder_threshold: float
    n_features: int
    features: list[str]
    metrics: dict


class MissingFeatureError(BaseModel):
    detail: str
    missing_features: list[str]