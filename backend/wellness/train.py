from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform

import joblib
import numpy as np
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .contracts import CATEGORICAL, DISCLAIMER, FEATURES, FORMAT_VERSION, NUMERIC, TARGET
from .data import load_dataset

SEED = 42


def make_pipeline(estimator):
    preprocessing = ColumnTransformer([
        ('numeric', StandardScaler(), [FEATURES.index(name) for name in NUMERIC]),
        ('categorical', OneHotEncoder(handle_unknown='ignore', sparse_output=True),
         [FEATURES.index(name) for name in CATEGORICAL]),
    ])
    return Pipeline([('preprocessing', preprocessing), ('regressor', estimator)])


def split_dataset(x, y):
    indices = np.arange(len(x))
    train, test = train_test_split(indices, test_size=0.2, random_state=SEED)
    return x[train], x[test], y[train], y[test], train, test


def train(dataset: Path, output: Path, provenance: Path, invalid_policy='error', smoke=False):
    x, y, audit = load_dataset(dataset, invalid_policy)
    source = json.loads(provenance.read_text())
    if source.get('sha256') != audit['sha256']:
        raise ValueError('Dataset checksum does not match provenance. Refuse to train mislabeled data.')
    x_train, x_test, y_train, y_test, train_ids, test_ids = split_dataset(x, y)
    candidates = {
        'dummy_mean': DummyRegressor(strategy='mean'),
        'ridge_0.1': Ridge(alpha=0.1, solver='lsqr'),
        'ridge_1': Ridge(alpha=1, solver='lsqr'),
        'ridge_10': Ridge(alpha=10, solver='lsqr'),
        'random_forest': RandomForestRegressor(n_estimators=20 if smoke else 160,
            min_samples_leaf=2, max_features=0.8, random_state=SEED, n_jobs=1),
    }
    folds = 3 if smoke else 5
    cv = KFold(n_splits=folds, shuffle=True, random_state=SEED)
    comparison = {}
    for name, estimator in candidates.items():
        # Every fold clones/fits the entire pipeline, including vocabulary/scaler.
        scores = -cross_val_score(make_pipeline(clone(estimator)), x_train, y_train,
                                 cv=cv, scoring='neg_mean_absolute_error', n_jobs=1, error_score='raise')
        if not np.isfinite(scores).all():
            raise ValueError('Nonfinite cross-validation metrics; no model will be exported.')
        comparison[name] = {'cv_mae_mean': float(scores.mean()), 'cv_mae_std': float(scores.std()),
                            'fold_mae': scores.tolist()}
    selected = min(comparison, key=lambda name: comparison[name]['cv_mae_mean'])
    pipeline = make_pipeline(clone(candidates[selected])).fit(x_train, y_train)
    prediction = pipeline.predict(x_test)
    metrics = {'mae': float(mean_absolute_error(y_test, prediction)),
               'rmse': float(np.sqrt(mean_squared_error(y_test, prediction))),
               'r2': float(r2_score(y_test, prediction))}
    if not all(np.isfinite(value) for value in metrics.values()):
        raise ValueError('Nonfinite held-out metrics; no model will be exported.')
    ranges = {name: {'min': float(x_train[:, FEATURES.index(name)].astype(float).min()),
                     'max': float(x_train[:, FEATURES.index(name)].astype(float).max())} for name in NUMERIC}
    categories = {name: sorted(set(x_train[:, FEATURES.index(name)].tolist())) for name in CATEGORICAL}
    versions = {name: importlib.metadata.version(name) for name in ('scikit-learn', 'numpy', 'scipy', 'joblib')}
    code_hash = hashlib.sha256(b''.join((Path(__file__).parent / name).read_bytes() for name in ('train.py', 'data.py', 'contracts.py'))).hexdigest()
    version_material = json.dumps({'dataset': audit['sha256'], 'versions': versions, 'selected': selected,
                                  'seed': SEED, 'smoke': smoke, 'format': FORMAT_VERSION, 'training_code_sha256': code_hash}, sort_keys=True)
    version = 'experimental-v1-' + hashlib.sha256(version_material.encode()).hexdigest()[:12]
    info = {'model_version': version, 'disclaimer': DISCLAIMER, 'feature_names': FEATURES,
            'numeric_ranges': ranges, 'categorical_values': categories,
            'score_reference': {'observed_min': float(y_train.min()), 'observed_max': float(y_train.max()),
                                'definition_verified': False,
                                'description': 'Observed training-target range; theoretical scale and scoring definition are unverified.'}}
    metadata = {'artifact_format': FORMAT_VERSION, 'model_info': info, 'dataset_provenance': source,
                'data_audit': audit, 'target': TARGET, 'selected_model': selected, 'training_code_sha256': code_hash,
                'selection': {'criterion': 'lowest training cross-validation MAE', 'folds': folds, 'candidates': comparison},
                'held_out_metrics': metrics, 'trained_at_utc': datetime.now(timezone.utc).isoformat(),
                'package_versions': versions, 'python_version': platform.python_version(), 'smoke_run': smoke,
                'split': {'random_seed': SEED, 'test_fraction': 0.2, 'train_rows': len(train_ids), 'test_rows': len(test_ids),
                          'train_indices_sha256': hashlib.sha256(train_ids.tobytes()).hexdigest(),
                          'test_indices_sha256': hashlib.sha256(test_ids.tobytes()).hexdigest()},
                'limitations': ['Target scoring definition, collection method, and clinical validity are unverified.',
                                'Support ranges and categories come only from training rows; combinations may still be out of distribution.',
                                'The held-out set is never used for fitting or model selection; exported pipeline remains fitted to training rows only.',
                                'Categorical encoder ignores unseen categories during CV; API explicitly rejects categories unseen in final training.']}
    output.mkdir(parents=True, exist_ok=True)
    # Export one self-describing trusted bundle; the JSON sidecar pins its bytes.
    temp = output / 'model.joblib.tmp'
    joblib.dump({'pipeline': pipeline, 'model_info': info, 'artifact_format': FORMAT_VERSION}, temp, compress=3)
    metadata['artifact_sha256'] = hashlib.sha256(temp.read_bytes()).hexdigest()
    temp.replace(output / 'model.joblib')
    metadata_temp = output / 'metadata.json.tmp'
    metadata_temp.write_text(json.dumps(metadata, indent=2, allow_nan=False) + '\n')
    metadata_temp.replace(output / 'metadata.json')
    return metadata


def main():
    parser = argparse.ArgumentParser(description='Train an experimental educational model; never a medical diagnosis.')
    parser.add_argument('--dataset', type=Path, default=Path('data/student_wellness.csv'))
    parser.add_argument('--provenance', type=Path, default=Path('data/provenance.json'))
    parser.add_argument('--output', type=Path, default=Path('models'))
    parser.add_argument('--invalid-policy', choices=['error', 'drop'], default='error')
    parser.add_argument('--smoke', action='store_true', help='3 CV folds and 20 trees; writes a separately versioned smoke model')
    args = parser.parse_args()
    result = train(args.dataset, args.output, args.provenance, args.invalid_policy, args.smoke)
    print(json.dumps({key: result[key] for key in ('selected_model', 'held_out_metrics', 'data_audit')}, indent=2))


if __name__ == '__main__':
    main()
