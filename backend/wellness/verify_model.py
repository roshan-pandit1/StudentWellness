"""Deployment preflight: validate the existing artifact without fitting or modifying it."""
import json
import numpy as np
from .api import Settings
from .contracts import AssessmentRequest, CATEGORICAL, FEATURES, NUMERIC
from .model import ModelStore


def verify(settings=None):
    settings = settings or Settings.from_env()
    store = ModelStore(settings.model_path, settings.metadata_path)
    info = store.require()
    pre = store.pipeline.named_steps['preprocessing']
    if store.pipeline.n_features_in_ != len(FEATURES):
        raise ValueError('Pipeline feature count differs from the request contract.')
    columns = {name: list(indices) for name, _transformer, indices in pre.transformers_}
    if columns['numeric'] != [FEATURES.index(name) for name in NUMERIC]:
        raise ValueError('Numeric preprocessing order does not match training.')
    if columns['categorical'] != [FEATURES.index(name) for name in CATEGORICAL]:
        raise ValueError('Categorical preprocessing order does not match training.')
    encoder = pre.named_transformers_['categorical']
    for name, categories in zip(CATEGORICAL, encoder.categories_):
        if list(categories) != info.categorical_values[name]:
            raise ValueError('Encoded vocabulary differs from model metadata.')
    # Fixed illustrative request; this is not a user submission or a fabricated training row.
    request = AssessmentRequest(Age=21, Gender='Female', Country='India', Academic_Level='Undergraduate',
        Most_Used_Platform='YouTube', Purpose_Of_Use='Education', Avg_Daily_Usage_Hours=2.5,
        Daily_Unlocks=120, Study_Hours=5, Physical_Activity_Hours=0.5, Sleep_Hours_Per_Night=7.5, Stress_Level='Medium')
    values = request.model_dump()
    for name, bounds in info.numeric_ranges.items():
        if not bounds.min <= values[name] <= bounds.max:
            raise ValueError('Deployment probe is outside model support; review the replacement artifact.')
    for name, supported in info.categorical_values.items():
        if values[name] not in supported:
            raise ValueError('Deployment probe category is unsupported; review the replacement artifact.')
    score = store.predict(values)
    if not np.isfinite(score) or not info.score_reference.observed_min <= score <= info.score_reference.observed_max:
        raise ValueError('Deployment probe prediction is outside the documented expected range; review the artifact. No clamping performed.')
    return {'status': 'verified', 'model_version': info.model_version,
            'feature_count': len(FEATURES), 'probe_prediction': score,
            'score_reference': info.score_reference.model_dump(), 'disclaimer': info.disclaimer}


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
