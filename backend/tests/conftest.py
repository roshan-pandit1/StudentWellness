from pathlib import Path
import json
import pytest
from fastapi.testclient import TestClient
from wellness.api import Settings, create_app
from wellness.train import train

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope='session')
def trained(tmp_path_factory):
    output = tmp_path_factory.mktemp('model')
    metadata = train(ROOT / 'data/student_wellness.csv', output, ROOT / 'data/provenance.json', 'drop', smoke=True)
    return output, metadata


@pytest.fixture
def client(trained):
    output, _ = trained
    app = create_app(Settings(output / 'model.joblib', output / 'metadata.json', ('http://localhost:5173',)))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def request_payload():
    return json.loads((ROOT / 'tests/example_request.json').read_text())
