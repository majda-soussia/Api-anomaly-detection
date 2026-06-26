"""
test_hybrid_rule.py
--------------------
Tests unitaires pour la règle de décision hybride asymétrique :

    AE=True  ET IF=True   -> CRITICAL
    AE=True  ET IF=False  -> WARNING
    AE=False (peu importe IF) -> NORMAL

Ces tests ciblent uniquement HybridPredictor._decide(), qui est une méthode
statique pure (pas de dépendance aux artéfacts ML), pour pouvoir tourner
rapidement sans charger TensorFlow/sklearn.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from predictor import ArtifactLoadError, HybridPredictor


class TestHybridDecisionRule:
    def test_critical_when_both_models_agree(self):
        """AE=True ET IF=True -> CRITICAL (signal ultra fiable)."""
        decision = HybridPredictor._decide(ae_flag=True, if_flag=True)
        assert decision == "CRITICAL"

    def test_warning_when_only_autoencoder_flags(self):
        """AE=True ET IF=False -> WARNING (on ne rate jamais une alerte AE)."""
        decision = HybridPredictor._decide(ae_flag=True, if_flag=False)
        assert decision == "WARNING"

    def test_normal_when_autoencoder_does_not_flag(self):
        """AE=False ET IF=False -> NORMAL."""
        decision = HybridPredictor._decide(ae_flag=False, if_flag=False)
        assert decision == "NORMAL"

    def test_normal_when_autoencoder_false_even_if_isolation_forest_true(self):
        """
        AE=False ET IF=True -> NORMAL malgré tout.

        Ce cas est le plus important à tester : il vérifie que Isolation
        Forest ne peut JAMAIS, à lui seul, déclencher une alerte. L'AE reste
        le seul décideur principal, conformément à la décision du
        superviseur (IF est un qualificateur de sévérité, pas un détecteur
        indépendant).
        """
        decision = HybridPredictor._decide(ae_flag=False, if_flag=True)
        assert decision == "NORMAL"


class TestConfidenceScore:
    """Vérifie que le score de confiance reste toujours borné dans [0, 1]."""

    def test_confidence_critical_in_bounds(self):
        conf = HybridPredictor._confidence(
            ae_score=0.9, ae_threshold=0.446282, ae_flag=True, if_flag=True
        )
        assert 0.0 <= conf <= 1.0

    def test_confidence_warning_in_bounds(self):
        conf = HybridPredictor._confidence(
            ae_score=0.5, ae_threshold=0.446282, ae_flag=True, if_flag=False
        )
        assert 0.0 <= conf <= 1.0

    def test_confidence_normal_in_bounds(self):
        conf = HybridPredictor._confidence(
            ae_score=0.1, ae_threshold=0.446282, ae_flag=False, if_flag=False
        )
        assert 0.0 <= conf <= 1.0


class TestMissingFeatureValidation:
    """Vérifie que les features manquantes sont bien détectées avant tout calcul."""

    def test_missing_feature_raises(self):
        from predictor import MissingFeatureError

        predictor = HybridPredictor()
        predictor.feature_names = ["feat_a", "feat_b", "feat_c"]
        predictor._loaded = True

        payload = {"feat_a": 1.0, "feat_b": 2.0}  # feat_c manquant

        try:
            predictor._validate_and_order_features(payload)
            assert False, "Aurait dû lever MissingFeatureError"
        except MissingFeatureError as exc:
            assert exc.missing_features == ["feat_c"]

    def test_all_features_present_orders_correctly(self):
        predictor = HybridPredictor()
        predictor.feature_names = ["feat_a", "feat_b", "feat_c"]

        payload = {"feat_c": 3.0, "feat_a": 1.0, "feat_b": 2.0}
        result = predictor._validate_and_order_features(payload)

        assert result.tolist() == [[1.0, 2.0, 3.0]]


class TestClipBoundsFormatDetection:
    """
    Tests pour le bug rapporté : "'tuple' object has no attribute 'get'".
    clip_bounds.pkl peut être sérialisé sous plusieurs formats selon l'outil
    d'entraînement utilisé ; _extract_lower_upper doit les gérer tous.
    """

    def test_dict_lower_upper_format(self):
        bounds = {"lower": -3.0, "upper": 3.0}
        lower, upper = HybridPredictor._extract_lower_upper(bounds)
        assert (lower, upper) == (-3.0, 3.0)

    def test_dict_min_max_format(self):
        bounds = {"min": -2.5, "max": 2.5}
        lower, upper = HybridPredictor._extract_lower_upper(bounds)
        assert (lower, upper) == (-2.5, 2.5)

    def test_tuple_format(self):
        """Reproduit exactement le format qui causait le crash signalé."""
        bounds = (-3.0, 3.0)
        lower, upper = HybridPredictor._extract_lower_upper(bounds)
        assert (lower, upper) == (-3.0, 3.0)

    def test_list_format(self):
        bounds = [-1.0, 1.0]
        lower, upper = HybridPredictor._extract_lower_upper(bounds)
        assert (lower, upper) == (-1.0, 1.0)

    def test_numpy_array_format(self):
        import numpy as np

        bounds = np.array([-4.0, 4.0])
        lower, upper = HybridPredictor._extract_lower_upper(bounds)
        assert (lower, upper) == (-4.0, 4.0)

    def test_invalid_format_raises_value_error(self):
        try:
            HybridPredictor._extract_lower_upper("not a valid format")
            assert False, "Aurait dû lever ValueError"
        except ValueError:
            pass

    def test_per_column_dict_with_tuple_bounds(self):
        """Format par colonne : {"quality_degradation": (lower, upper)}"""
        predictor = HybridPredictor()
        predictor.clip_bounds = {"quality_degradation": (-3.0, 3.0)}
        lower, upper = predictor._get_bounds_for_column("quality_degradation")
        assert (lower, upper) == (-3.0, 3.0)

    def test_global_tuple_bounds_for_any_column(self):
        """Format global (une seule colonne attendue) : (lower, upper) directement."""
        predictor = HybridPredictor()
        predictor.clip_bounds = (-3.0, 3.0)
        lower, upper = predictor._get_bounds_for_column("quality_degradation")
        assert (lower, upper) == (-3.0, 3.0)


class _FakeEstimator:
    """Faux estimateur minimal pour tester _unwrap_model sans dépendance sklearn."""

    def score_samples(self, X):
        return [0.5]

    def transform(self, X):
        return X


class TestUnwrapModel:
    """
    Tests pour le bug rapporté : "'dict' object has no attribute 'score_samples'".
    Certains .pkl contiennent un dict-wrapper {"model": <estimateur>, ...}
    au lieu de l'estimateur sklearn directement.
    """

    def test_returns_object_unchanged_if_method_present(self):
        est = _FakeEstimator()
        result = HybridPredictor._unwrap_model(est, "test.pkl", "score_samples")
        assert result is est

    def test_unwraps_dict_with_model_key(self):
        """Reproduit exactement le format qui causait le crash signalé."""
        est = _FakeEstimator()
        wrapped = {"model": est, "trained_on": "2026-06-20"}
        result = HybridPredictor._unwrap_model(wrapped, "isolation_forest.pkl", "score_samples")
        assert result is est

    def test_unwraps_dict_with_isolation_forest_key(self):
        est = _FakeEstimator()
        wrapped = {"isolation_forest": est, "contamination": 0.1}
        result = HybridPredictor._unwrap_model(wrapped, "isolation_forest.pkl", "score_samples")
        assert result is est

    def test_unwraps_dict_via_generic_search(self):
        """Clé non standard mais l'objet a la bonne méthode -> trouvé par recherche générique."""
        est = _FakeEstimator()
        wrapped = {"my_custom_key": est, "other": 123}
        result = HybridPredictor._unwrap_model(wrapped, "test.pkl", "score_samples")
        assert result is est

    def test_raises_when_no_matching_object_in_dict(self):
        wrapped = {"trained_on": "2026-06-20", "contamination": 0.1}
        try:
            HybridPredictor._unwrap_model(wrapped, "isolation_forest.pkl", "score_samples")
            assert False, "Aurait dû lever ArtifactLoadError"
        except ArtifactLoadError:
            pass

    def test_raises_for_non_dict_non_estimator(self):
        try:
            HybridPredictor._unwrap_model("not a model", "test.pkl", "score_samples")
            assert False, "Aurait dû lever ArtifactLoadError"
        except ArtifactLoadError:
            pass


if __name__ == "__main__":
    import pytest

    pytest.main([__file__, "-v"])