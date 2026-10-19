"""Test-only JSON-lines transport to the REAL ASGI app. Not a production endpoint.

Messages are ephemeral stdin/stdout test traffic; no assessment bodies are logged to files.
This avoids a listening socket in restricted development environments.
"""
import json
import sys
from fastapi.testclient import TestClient
from wellness.api import create_app


def main():
    with TestClient(create_app(), raise_server_exceptions=False) as client:
        health = client.get('/health')
        if health.status_code != 200:
            print(json.dumps({'ready': False, 'reason': 'Model unavailable'}), flush=True)
            return 1
        print(json.dumps({'ready': True}), flush=True)
        for line in sys.stdin:
            message = json.loads(line)
            if message.get('path') not in ('/predict', '/model-info', '/health'):
                raise ValueError('Unsupported test endpoint')
            response = client.request(message['method'], message['path'], content=message.get('body'),
                                      headers={'Content-Type': 'application/json'})
            print(json.dumps({'id': message['id'], 'status': response.status_code, 'body': response.json()}), flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
