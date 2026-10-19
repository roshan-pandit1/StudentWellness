from __future__ import annotations

import hashlib
import importlib.metadata
import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.pipeline import Pipeline
from .contracts import CATEGORICAL, FEATURES, FORMAT_VERSION, NUMERIC, ModelInfo


class ModelUnavailable(RuntimeError):
    pass


class ModelStore:
    def __init__(self, artifact: Path, metadata: Path):
        self.pipeline = None
        self.info = None
        self.reason = 'model_missing'
        try:
            if not artifact.is_file() or not metadata.is_file():
                return
            document = json.loads(metadata.read_text())
            if document['artifact_format'] != FORMAT_VERSION:
                raise ValueError('Unsupported model format')
            if hashlib.sha256(artifact.read_bytes()).hexdigest() != document['artifact_sha256']:
                raise ValueError('Artifact integrity check failed')
            for name in ('scikit-learn', 'numpy', 'scipy', 'joblib'):
                if document['package_versions'][name] != importlib.metadata.version(name):
                    raise ValueError('Incompatible package version')
            info = ModelInfo.model_validate(document['model_info'])
            if info.feature_names != FEATURES or set(info.numeric_ranges) != set(NUMERIC) or set(info.categorical_values) != set(CATEGORICAL):
                raise ValueError('Feature contract mismatch')
            if any(not values for values in info.categorical_values.values()):
                raise ValueError('Empty category vocabulary')
            # joblib can execute code. Only load operator-controlled artifacts produced by this trainer.
            # A checksum detects corruption, NOT a malicious artifact plus malicious metadata.
            bundle = joblib.load(artifact)
            if bundle['artifact_format'] != FORMAT_VERSION or bundle['model_info'] != document['model_info'] or not isinstance(bundle['pipeline'], Pipeline):
                raise ValueError('Bundle mismatch')
            probe = {name: bounds.min for name, bounds in info.numeric_ranges.items()}
            probe.update({name: values[0] for name, values in info.categorical_values.items()})
            sample = float(bundle['pipeline'].predict(np.asarray([[probe[name] for name in FEATURES]], dtype=object))[0])
            if not np.isfinite(sample):
                raise ValueError('Nonfinite model output')
            self.pipeline, self.info, self.reason = bundle['pipeline'], info, None
        except Exception:
            # Neither paths nor exceptions containing training data are returned/logged.
            self.pipeline, self.info, self.reason = None, None, 'model_invalid'

    def require(self):
        if self.pipeline is None or self.info is None:
            raise ModelUnavailable('Model is unavailable. Train and configure a compatible trusted artifact.')
        return self.info

    def predict(self, values):
        self.require()
        prediction = float(self.pipeline.predict(np.asarray([[values[name] for name in FEATURES]], dtype=object))[0])
        if not np.isfinite(prediction):
            raise ModelUnavailable('The model produced an invalid numerical output.')
        return prediction
