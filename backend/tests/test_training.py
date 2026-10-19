import json
from pathlib import Path
import joblib
import numpy as np
import pytest
from sklearn.base import clone
from sklearn.model_selection import KFold
from wellness.contracts import FEATURES, NUMERIC, CATEGORICAL
from wellness.data import load_dataset
from wellness.model import ModelStore, ModelUnavailable
from wellness.train import split_dataset, train

ROOT = Path(__file__).resolve().parents[1]


def test_export_and_no_holdout_leakage(trained):
    output, metadata = trained
    x, y, _ = load_dataset(ROOT / 'data/student_wellness.csv', 'drop')
    x_train, x_test, _, _, train_ids, test_ids = split_dataset(x, y)
    assert set(train_ids).isdisjoint(test_ids)
    assert {tuple(row) for row in x_train}.isdisjoint({tuple(row) for row in x_test})
    bundle = joblib.load(output / 'model.joblib')
    pre = bundle['pipeline'].named_steps['preprocessing']
    indices = [FEATURES.index(name) for name in NUMERIC]
    np.testing.assert_allclose(pre.named_transformers_['numeric'].mean_, x_train[:, indices].astype(float).mean(axis=0))
    assert int(pre.named_transformers_['numeric'].n_samples_seen_) == len(train_ids)
    for index, name in enumerate(CATEGORICAL):
        assert set(pre.named_transformers_['categorical'].categories_[index]) == set(x_train[:, FEATURES.index(name)])
    assert set(metadata['held_out_metrics']) == {'mae', 'rmse', 'r2'}
    assert all(np.isfinite(list(metadata['held_out_metrics'].values())))
    comparison = metadata['selection']['candidates']
    assert metadata['selected_model'] == min(comparison, key=lambda key: comparison[key]['cv_mae_mean'])
    assert {'dummy_mean', 'ridge_1', 'random_forest'} <= set(comparison)


def test_fold_preprocessing_learns_only_fold_training_and_handles_unknown(trained):
    output, _ = trained
    pipeline = joblib.load(output / 'model.joblib')['pipeline']
    x, y, _ = load_dataset(ROOT / 'data/student_wellness.csv', 'drop')
    x_train, _, _, _, _, _ = split_dataset(x, y)
    fit_ids, validation_ids = next(KFold(3, shuffle=True, random_state=42).split(x_train))
    fit, validation = x_train[fit_ids].copy(), x_train[validation_ids].copy()
    # Sentinel exists ONLY in the fold validation partition; it is a test mutation, never training data.
    validation[:, FEATURES.index('Country')] = '__UNSEEN_TEST_CATEGORY__'
    pre = clone(pipeline.named_steps['preprocessing']).fit(fit)
    assert '__UNSEEN_TEST_CATEGORY__' not in pre.named_transformers_['categorical'].categories_[CATEGORICAL.index('Country')]
    assert np.isfinite(pre.transform(validation).data).all()
    expected = fit[:, [FEATURES.index(name) for name in NUMERIC]].astype(float).mean(axis=0)
    np.testing.assert_allclose(pre.named_transformers_['numeric'].mean_, expected)


def test_model_loading_and_missing_artifact(trained, tmp_path):
    output, _ = trained
    assert ModelStore(output / 'model.joblib', output / 'metadata.json').require().model_version.startswith('experimental-v1-')
    missing = ModelStore(tmp_path / 'none', tmp_path / 'none.json')
    assert missing.reason == 'model_missing'
    with pytest.raises(ModelUnavailable): missing.require()


def test_corrupt_artifact_is_rejected_before_deserialization(trained, tmp_path):
    output, _ = trained
    (tmp_path / 'metadata.json').write_bytes((output / 'metadata.json').read_bytes())
    (tmp_path / 'model.joblib').write_bytes(b'corrupt')
    assert ModelStore(tmp_path / 'model.joblib', tmp_path / 'metadata.json').reason == 'model_invalid'


def test_wrong_package_version_rejected(trained, tmp_path):
    output, metadata = trained
    doc = json.loads(json.dumps(metadata)); doc['package_versions']['scikit-learn'] = '0.0'
    (tmp_path / 'metadata.json').write_text(json.dumps(doc))
    assert ModelStore(output / 'model.joblib', tmp_path / 'metadata.json').reason == 'model_invalid'


def test_provenance_mismatch_fails(tmp_path):
    provenance = tmp_path / 'source.json'; provenance.write_text('{"sha256":"wrong"}')
    with pytest.raises(ValueError, match='checksum'):
        train(ROOT / 'data/student_wellness.csv', tmp_path, provenance, 'drop', smoke=True)


def test_training_is_reproducible(trained, tmp_path):
    output, metadata = trained
    again = train(ROOT / 'data/student_wellness.csv', tmp_path, ROOT / 'data/provenance.json', 'drop', smoke=True)
    assert again['model_info'] == metadata['model_info']
    assert again['held_out_metrics'] == metadata['held_out_metrics']
    assert again['selection'] == metadata['selection']
    x, _, _ = load_dataset(ROOT / 'data/student_wellness.csv', 'drop')
    first = joblib.load(output / 'model.joblib')['pipeline']
    second = joblib.load(tmp_path / 'model.joblib')['pipeline']
    np.testing.assert_array_equal(first.predict(x[:10]), second.predict(x[:10]))


def test_deployment_verifies_feature_order_and_expected_range(trained):
    from wellness.api import Settings
    from wellness.verify_model import verify
    output, _ = trained
    result = verify(Settings(output / 'model.joblib', output / 'metadata.json'))
    assert result['status'] == 'verified'
    assert result['feature_count'] == 12
    assert result['score_reference']['observed_min'] <= result['probe_prediction'] <= result['score_reference']['observed_max']
