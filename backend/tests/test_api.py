import json
import numpy as np
import pytest
from fastapi.testclient import TestClient
from wellness.api import Settings, create_app
from wellness.contracts import FEATURES, PredictionResponse


def test_health_and_real_prediction(client, request_payload):
    health = client.get('/health')
    assert health.status_code == 200 and health.json()['model_loaded'] is True
    response = client.post('/predict', json=request_payload)
    assert response.status_code == 200
    body = PredictionResponse.model_validate(response.json())
    store = client.app.state.model
    expected = float(store.pipeline.predict(np.asarray([[request_payload[name] for name in FEATURES]], dtype=object))[0])
    assert body.Mental_Health_Score == expected
    assert body.model_version == health.json()['model_version']
    assert body.score_reference.definition_verified is False
    assert response.headers['cache-control'] == 'no-store'


@pytest.mark.parametrize('field,value', [('Age', 17), ('Age', 25), ('Age', 20.5), ('Age', '21'),
    ('Age', True), ('Daily_Unlocks', 40), ('Daily_Unlocks', -1), ('Physical_Activity_Hours', -0.1),
    ('Sleep_Hours_Per_Night', 25), ('Gender', 'Another identity'), ('Country', 'Unknown Country'),
    ('Most_Used_Platform', 'None'), ('Purpose_Of_Use', 'Other')])
def test_unsupported_values_explicitly_rejected(client, request_payload, field, value):
    request_payload[field] = value
    response = client.post('/predict', json=request_payload)
    assert response.status_code == 422
    assert response.json()['code'] in ('invalid_input', 'unsupported_input')
    assert all('input' not in issue for issue in response.json()['fields'])


@pytest.mark.parametrize('literal', ['NaN', 'Infinity', '-Infinity'])
def test_nonfinite_values(client, request_payload, literal):
    body = json.dumps(request_payload).replace('"Study_Hours": 5', f'"Study_Hours": {literal}')
    response = client.post('/predict', content=body, headers={'Content-Type': 'application/json'})
    assert response.status_code == 422


def test_missing_and_extra_fields(client, request_payload):
    del request_payload['Age']
    assert client.post('/predict', json=request_payload).status_code == 422
    request_payload['Age'] = 21; request_payload['acknowledgment'] = True
    assert client.post('/predict', json=request_payload).status_code == 422


def test_no_private_values_in_errors(client, request_payload):
    request_payload['Country'] = 'sensitive-private-value'
    response = client.post('/predict', json=request_payload)
    assert response.status_code == 422
    assert 'sensitive-private-value' not in response.text


def test_missing_model_is_503(tmp_path, request_payload):
    with TestClient(create_app(Settings(tmp_path / 'none.joblib', tmp_path / 'none.json'))) as client:
        assert client.get('/health').status_code == 503
        assert client.get('/health').json()['reason'] == 'model_missing'
        assert client.get('/model-info').status_code == 503
        assert client.post('/predict', json=request_payload).status_code == 503


def test_cors_allowlist(client):
    good = client.options('/predict', headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
    assert good.status_code == 200
    assert good.headers['access-control-allow-origin'] == 'http://localhost:5173'
    bad = client.options('/predict', headers={'Origin': 'https://untrusted.example', 'Access-Control-Request-Method': 'POST'})
    assert bad.status_code == 400 and 'access-control-allow-origin' not in bad.headers
    assert 'access-control-allow-credentials' not in good.headers


@pytest.mark.parametrize('origin', ['*', 'https://example.org/path', 'file://localhost', 'https://user:pass@example.org'])
def test_invalid_cors_config(tmp_path, origin):
    with pytest.raises(ValueError): Settings(tmp_path / 'model', tmp_path / 'meta', (origin,))


def test_environment_settings(monkeypatch, tmp_path):
    monkeypatch.setenv('WELLNESS_MODEL_PATH', str(tmp_path / 'model'))
    monkeypatch.setenv('WELLNESS_CORS_ORIGINS', '["http://localhost:5173"]')
    assert Settings.from_env().model_path == tmp_path / 'model'
    monkeypatch.setenv('WELLNESS_CORS_ORIGINS', '"*"')
    with pytest.raises(ValueError): Settings.from_env()


def test_no_output_clamping(client, request_payload, monkeypatch):
    monkeypatch.setattr(client.app.state.model, 'predict', lambda _values: 12.345)
    response = client.post('/predict', json=request_payload)
    assert response.json()['Mental_Health_Score'] == 12.345
    assert response.json()['warnings']


def test_model_info_contract(client):
    body = client.get('/model-info').json()
    assert body['feature_names'] == FEATURES
    assert set(body['numeric_ranges']) | set(body['categorical_values']) == set(FEATURES)
    assert body['numeric_ranges']['Age'] == {'min': 18, 'max': 24}


def test_oversized_request_and_malformed_json(client):
    response = client.post('/predict', content=b'x' * 16385, headers={'Content-Type': 'application/json', 'Origin': 'http://localhost:5173'})
    assert response.status_code == 413
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert response.headers['cache-control'] == 'no-store'
    malformed = client.post('/predict', content='{invalid', headers={'Content-Type': 'application/json'})
    assert malformed.status_code == 422
    assert '{invalid' not in malformed.text
