import asyncio
import json
from wellness.middleware import BodyLimitMiddleware


def test_stalled_body_has_deadline():
    async def scenario():
        calls = []
        async def downstream(*_args):
            raise AssertionError('A timed-out body must never reach parsing or inference')
        async def receive():
            await asyncio.sleep(1)
            return {'type': 'http.request', 'body': b'', 'more_body': True}
        async def send(message):
            calls.append(message)
        middleware = BodyLimitMiddleware(downstream, read_timeout=0.01)
        await middleware({'type': 'http', 'method': 'POST'}, receive, send)
        assert calls[0]['status'] == 408
        assert json.loads(calls[1]['body'])['code'] == 'request_timeout'
    asyncio.run(scenario())


def test_chunked_body_cannot_bypass_size_limit():
    async def scenario():
        calls = []
        async def downstream(*_args):
            raise AssertionError('Oversized input reached the application')
        async def receive():
            return {'type': 'http.request', 'body': b'x' * 9000, 'more_body': True}
        async def send(message): calls.append(message)
        await BodyLimitMiddleware(downstream)({'type': 'http', 'method': 'POST'}, receive, send)
        assert calls[0]['status'] == 413
    asyncio.run(scenario())
