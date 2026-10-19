"""Exercise the actual exported pipeline through ASGI; optionally export cross-language fixtures."""
import argparse
import json
from pathlib import Path
from fastapi.testclient import TestClient
from .api import Settings, create_app
from .contracts import PredictionResponse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir', type=Path, default=Path('models'))
    parser.add_argument('--export-contracts', type=Path)
    args = parser.parse_args()
    request = json.loads(Path('tests/example_request.json').read_text())
    app = create_app(Settings(args.model_dir / 'model.joblib', args.model_dir / 'metadata.json'))
    with TestClient(app) as client:
        health = client.get('/health'); assert health.status_code == 200, health.text
        info = client.get('/model-info'); assert info.status_code == 200, info.text
        response = client.post('/predict', json=request); assert response.status_code == 200, response.text
        PredictionResponse.model_validate(response.json())
        if args.export_contracts:
            args.export_contracts.mkdir(parents=True, exist_ok=True)
            for filename, body in [('model-info.json', info.json()), ('prediction-example.json', response.json())]:
                (args.export_contracts / filename).write_text(json.dumps(body, indent=2) + '\n')
        print(json.dumps({'health': health.json(), 'prediction': response.json()}, indent=2))


if __name__ == '__main__':
    main()
