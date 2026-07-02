"""
fix_test_predictions_table.py

Objectif : recharger le modèle IsolationForest déjà entraîné (.pkl),
recalculer les scores sur le même split temporel, et reconstruire
la table PostgreSQL `test_predictions` en y ajoutant server_id et timestamp.

⚠️ Ce script NE RÉENTRAÎNE PAS le modèle. Il recharge le scaler et le
modèle déjà fit depuis le pickle, et applique seulement .transform()
et .score_samples() (rapide), pas .fit() (lent, déjà fait une fois).

Pré-requis : le dossier 'data' doit être au même niveau que le dossier contenant
ce script (ex: API_Logs/ML/fix_test_predictions_table.py + API_Logs/data/...).
Les chemins sont résolus automatiquement à partir de l'emplacement du script,
peu importe le dossier depuis lequel tu le lances (Code Runner, terminal, etc.)
"""

import pickle
import os
import pandas as pd
import numpy as np
from sqlalchemy import create_engine

# ─────────────────────────────────────────────────────────
# 0. Chemins ABSOLUS basés sur l'emplacement du script,
#    pour ne pas dépendre du dossier depuis lequel il est lancé
#    (Code Runner peut changer le working directory)
# ─────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(SCRIPT_DIR, '..', 'data')

PKL_PATH        = os.path.join(DATA_DIR, 'isolation_forest_unsupervised.pkl')
FEATURES_PATH   = os.path.join(DATA_DIR, 'features_ml.csv')
OUTPUT_CSV_PATH = os.path.join(DATA_DIR, 'test_predictions_IF_v4.csv')

print(f"Dossier du script : {SCRIPT_DIR}")
print(f"Dossier data résolu : {os.path.abspath(DATA_DIR)}")

if not os.path.exists(PKL_PATH):
    raise FileNotFoundError(
        f"Fichier .pkl introuvable à : {PKL_PATH}\n"
        f"Vérifie que le dossier 'data' est bien au même niveau que le dossier de ce script."
    )

# ─────────────────────────────────────────────────────────
# 1. Charger l'artifact déjà entraîné (modèle + scaler + seuil)
# ─────────────────────────────────────────────────────────
with open(PKL_PATH, 'rb') as f:
    artifact = pickle.load(f)

model         = artifact['model']
scaler        = artifact['scaler']
clip_bounds   = artifact['clip_bounds']
FEATURES_ML   = artifact['feature_names']
THRESHOLD     = artifact['threshold']

print("Artifact chargé.")
print(f"Nb features attendues : {len(FEATURES_ML)}")
print(f"Seuil retenu : {THRESHOLD:.4f}")

# ─────────────────────────────────────────────────────────
# 2. Recharger les données brutes et refaire EXACTEMENT le même split
#    (même tri, même proportion 80/20, même reset_index)
#    → garantit que server_id/timestamp tombent sur les bonnes lignes
# ─────────────────────────────────────────────────────────
features_df = pd.read_csv(FEATURES_PATH)

EXCLUDE_COLS = [
    'server_id', 'timestamp', 'is_anomaly', 'anomaly_type',
    'dist_to_threshold', 'label_3class', 'is_anomaly_clean'
]

features_df_sorted = features_df.sort_values('timestamp').reset_index(drop=True)

n = len(features_df_sorted)
test_start = int(n * 0.80)

# Les colonnes méta qui manquaient dans la table d'origine
meta_test = features_df_sorted.iloc[test_start:][['server_id', 'timestamp']].reset_index(drop=True)

X_test_raw = features_df_sorted[FEATURES_ML].iloc[test_start:].fillna(0).reset_index(drop=True)
y_test_true = features_df_sorted['is_anomaly'].iloc[test_start:].reset_index(drop=True)

print(f"\nSplit reproduit : {len(X_test_raw)} lignes de test (sur {n} au total)")
print(f"Meta (server_id/timestamp) : {len(meta_test)} lignes")

# Vérification de cohérence avant d'aller plus loin
assert len(meta_test) == len(X_test_raw) == len(y_test_true), \
    "Mismatch de longueur — NE PAS CONTINUER, le split ne correspond pas."

# ─────────────────────────────────────────────────────────
# 3. Appliquer le même clipping que dans le notebook (cellule 7)
# ─────────────────────────────────────────────────────────
COLS_TO_CLIP = ["quality_degradation"]
for col in COLS_TO_CLIP:
    low, high = clip_bounds[col]
    X_test_raw[col] = X_test_raw[col].clip(lower=low, upper=high)

# ─────────────────────────────────────────────────────────
# 4. Re-scorer avec le scaler et le modèle déjà entraînés
#    (PAS de .fit() ici — juste .transform() et .score_samples())
# ─────────────────────────────────────────────────────────
X_test = scaler.transform(X_test_raw)
scores_test = -model.score_samples(X_test)
y_pred = (scores_test >= THRESHOLD).astype(int)

print(f"\nScoring terminé (pas de réentraînement).")
print(f"Anomalies détectées : {y_pred.sum()} / {len(y_pred)}")

# ─────────────────────────────────────────────────────────
# 5. Reconstruire test_results AVEC server_id, timestamp,
#    ET des noms de colonnes compatibles avec metrics.service.js
#    (is_anomaly = prédiction du modèle, status = libellé dérivé)
# ─────────────────────────────────────────────────────────
test_results = X_test_raw.reset_index(drop=True).copy()   # valeurs BRUTES, pas standardisées
test_results['server_id']        = meta_test['server_id'].values
test_results['timestamp']        = meta_test['timestamp'].values
test_results['anomaly_score']    = scores_test
test_results['is_anomaly']       = y_pred                  # prédiction du modèle (web-facing)
test_results['status']           = test_results['is_anomaly'].map({1: 'anomaly', 0: 'healthy'})
test_results['y_true_eval_only'] = y_test_true.values       # vérité terrain, gardée à part pour l'évaluation

print(f"\nColonnes finales : {list(test_results.columns)}")
print(test_results[['server_id', 'timestamp', 'anomaly_score', 'is_anomaly', 'status']].head())

# ─────────────────────────────────────────────────────────
# 6. Remplacer la table PostgreSQL existante
# ─────────────────────────────────────────────────────────
engine = create_engine("postgresql://postgres.eezxgekvdyjorokuoowc:Stageete2026@aws-1-eu-central-1.pooler.supabase.com:6543/postgres")

test_results.to_sql(
    name="test_predictions",
    con=engine,
    if_exists="replace",
    index=False
)

# Sauvegarde aussi le CSV pour garder une copie locale cohérente
test_results.to_csv(OUTPUT_CSV_PATH, index=False)

print("\nOK - Table 'test_predictions' mise a jour avec server_id et timestamp.")