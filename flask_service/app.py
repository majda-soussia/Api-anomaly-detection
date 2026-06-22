"""
Microservice Flask — Détection d'anomalies (Isolation Forest)
 
"""
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
import os
import pickle
from flask import Flask, jsonify, request
import pandas as pd
 
# ──────────────────────────────────────────────────────────
# ÉTAPE 2 — Chemin vers l'artefact
# ──────────────────────────────────────────────────────────
# __file__         = chemin de CE fichier (app.py)
# os.path.abspath  = transforme en chemin absolu, peu importe le
#                    dossier depuis lequel tu lances "python app.py"
# os.path.dirname  = ne garde que le dossier parent (flask_service/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
 
# On remonte d'un niveau (..) pour sortir de flask_service/,
# puis on entre dans data/ pour atteindre le .pkl
ARTIFACT_PATH = os.path.join(BASE_DIR, "..", "data", "isolation_forest_unsupervised.pkl")
 
 
# ──────────────────────────────────────────────────────────
# ÉTAPE 3 — Chargement de l'artefact (niveau MODULE, pas dans une fonction)
# ──────────────────────────────────────────────────────────
# Ce bloc n'est inclus dans aucune fonction/route : il s'exécute une
# seule fois, au moment où Python lit le fichier (= démarrage de Flask).
print("Chargement du modèle Isolation Forest...")
'''isolation_forest_unsupervised.pkl
    ↓
    lecture
    ↓
    chargement en mémoire '''
with open(ARTIFACT_PATH, "rb") as f:
    artifact = pickle.load(f)
 
model         = artifact["model"]          # l'IsolationForest entraîné
scaler        = artifact["scaler"]         # le StandardScaler fit sur le train
clip_bounds   = artifact["clip_bounds"]    # bornes de clipping (quality_degradation)
feature_names = artifact["feature_names"]  # ordre exact des 49 colonnes attendues
threshold     = artifact["threshold"]      # seuil de décision retenu (~0.5875)
 
print(f"Modèle charge -- seuil={threshold:.4f}, {len(feature_names)} features")
 
def build_feature_dataframe(records):
    """records : liste de dicts (une fenêtre = un dict).
    Vérifie que toutes les features requises sont présentes et numériques,
    renvoie un DataFrame avec les colonnes dans l'ordre exact attendu
    par le scaler. Lève ValueError si quelque chose ne va pas."""
    df = pd.DataFrame(records)
 
    missing = [col for col in feature_names if col not in df.columns]
    if missing:
        raise ValueError(f"Features manquantes : {missing}")
 
    # On garde uniquement les colonnes attendues, dans le bon ordre
    # (l'ordre doit être identique à celui utilisé pour fit() le scaler)
    df = df[feature_names].copy()
 
    # Conversion en numérique ; toute valeur non convertible devient NaN
    df = df.apply(pd.to_numeric, errors="coerce")
 
    if df.isnull().any().any():
        bad_cols = df.columns[df.isnull().any()].tolist()
        raise ValueError(f"Valeurs manquantes ou non numériques dans : {bad_cols}")
 
    return df
 
 
def preprocess(df):
    """Applique clip PUIS scale, exactement dans le même ordre qu'à
    l'entraînement (cf. clip_specific_columns dans le notebook)."""
    df_clipped = df.copy()
    for col, (low, high) in clip_bounds.items():
        if col in df_clipped.columns:
            df_clipped[col] = df_clipped[col].clip(lower=low, upper=high)
 
    return scaler.transform(df_clipped)
 
 
def score_to_result(score):
    return {
        "anomaly_score": float(score),
        "is_anomaly": bool(score >= threshold),
        "threshold": float(threshold)
    }
 
 
# ──────────────────────────────────────────────────────────
# ÉTAPE 4 — Création de l'app Flask (APRÈS le chargement du modèle)
# ──────────────────────────────────────────────────────────
# L'ordre compte conceptuellement : on charge d'abord tout ce dont le
# serveur aura besoin, PUIS on crée le serveur qui va s'en servir.
app = Flask(__name__)
 
 
@app.route("/health", methods=["GET"])
def health():
    """Endpoint de contrôle : Node.js l'appelle pour vérifier que Flask tourne
    et que le modèle est bien chargé avant d'envoyer du trafic vers /predict."""
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "threshold": threshold,
        "n_features": len(feature_names)
    })
 
 
@app.route("/predict", methods=["POST"])
def predict():
    """Accepte SOIT un objet JSON (une fenêtre), SOIT une liste d'objets
    (batch de plusieurs fenêtres). La détection se fait sur le type reçu.
 
    Entrée (objet)  : {"request_count": 120, "unique_ips": 45, ...}
    Entrée (batch)  : [{"request_count": 120, ...}, {"request_count": 80, ...}]
 
    Sortie (objet)  : {"anomaly_score": 0.61, "is_anomaly": true, "threshold": 0.5875}
    Sortie (batch)  : {"results": [{...}, {...}]}
    """
    payload = request.get_json(silent=True)
 
    if payload is None:
        return jsonify({
            "error": "JSON invalide ou Content-Type manquant (attendu: application/json)"
        }), 400
 
    is_batch = isinstance(payload, list)
    records = payload if is_batch else [payload]
 
    if len(records) == 0:
        return jsonify({"error": "Liste vide"}), 400
 
    try:
        df = build_feature_dataframe(records)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
 
    X_scaled = preprocess(df)
    scores = -model.score_samples(X_scaled)
    results = [score_to_result(s) for s in scores]
 
    if is_batch:
        return jsonify({"results": results})
    return jsonify(results[0])
 
# ──────────────────────────────────────────────────────────
# ÉTAPE 5 — Lancement du serveur
# ──────────────────────────────────────────────────────────
# Ce bloc ne s'exécute QUE si tu lances ce fichier directement
# (python app.py) — pas si le fichier est importé depuis ailleurs.
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)