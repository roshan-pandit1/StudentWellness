"""Bound JSON request size before FastAPI parses it; never log bodies."""
import asyncio
from time import monotonic
from fastapi.responses import JSONResponse


class BodyLimitMiddleware:
    def __init__(self, app, max_bytes=16_384, read_timeout=10.0):
        self.app = app
        self.max_bytes = max_bytes
        self.read_timeout = read_timeout

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] != 'POST':
            return await self.app(scope, receive, send)
        chunks, total = [], 0
        deadline = monotonic() + self.read_timeout
        while True:
            try:
                message = await asyncio.wait_for(receive(), timeout=max(0, deadline - monotonic()))
            except asyncio.TimeoutError:
                response = JSONResponse(status_code=408, content={
                    'code': 'request_timeout', 'message': 'Request body was not received within 10 seconds.', 'fields': []})
                return await response(scope, receive, send)
            if message['type'] == 'http.disconnect':
                return
            total += len(message.get('body', b''))
            if total > self.max_bytes:
                response = JSONResponse(status_code=413, content={
                    'code': 'request_too_large', 'message': 'Request exceeds the 16 KiB limit.', 'fields': []})
                return await response(scope, receive, send)
            chunks.append(message.get('body', b''))
            if not message.get('more_body', False):
                break
        body = b''.join(chunks)
        consumed = False

        async def bounded_receive():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {'type': 'http.request', 'body': body, 'more_body': False}
            return await receive()
        await self.app(scope, bounded_receive, send)
