from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Tuple
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .contracts import AssessmentRequest, ErrorResponse, FEATURES, HealthResponse, ModelInfo, PredictionResponse
from .model import ModelStore, ModelUnavailable
from .middleware import BodyLimitMiddleware


@dataclass(frozen=True)
class Settings:
    model_path: Path
    metadata_path: Path
    cors_origins: Tuple[str, ...] = ()

    def __post_init__(self):
        for origin in self.cors_origins:
            parsed = urlsplit(origin)
            if (origin == '*' or parsed.scheme not in ('http', 'https') or not parsed.netloc
                    or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password):
                raise ValueError('CORS origins must be exact HTTP(S) origins without paths or wildcards.')

    @classmethod
    def from_env(cls):
        origins = json.loads(os.getenv('WELLNESS_CORS_ORIGINS', '[]'))
        if not isinstance(origins, list) or any(not isinstance(item, str) for item in origins):
            raise ValueError('WELLNESS_CORS_ORIGINS must be a JSON array of exact origins.')
        return cls(Path(os.getenv('WELLNESS_MODEL_PATH', 'models/model.joblib')),
                   Path(os.getenv('WELLNESS_METADATA_PATH', 'models/metadata.json')), tuple(origins))


def error(status, code, message, fields=None):
    return JSONResponse(status_code=status, content=ErrorResponse(code=code, message=message, fields=fields or []).model_dump())


def create_app(settings=None):
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app):
        app.state.model = ModelStore(settings.model_path, settings.metadata_path)
        yield

    app = FastAPI(title='Student Wellness Insights', version='2.0.0', lifespan=lifespan)
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins),
                       allow_credentials=False, allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])

    @app.middleware('http')
    async def private_responses(request: Request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request, exc):
        fields = []
        for issue in exc.errors():
            name = next((part for part in issue['loc'] if part in FEATURES), None)
            if name:
                fields.append({'field': name, 'message': 'Invalid value or type for this field.'})
        # FastAPI's default error includes submitted values. Return field names only.
        return error(422, 'invalid_input', 'Check the input types, categories, numeric limits, and 24-hour routine total.', fields)

    @app.exception_handler(ModelUnavailable)
    async def unavailable(_request, _exc):
        return error(503, 'model_unavailable', 'Prediction service is not ready. No demo result was substituted.')

    @app.get('/health', response_model=HealthResponse, responses={503: {'model': HealthResponse}})
    def health(request: Request):
        store = request.app.state.model
        if store.info is None:
            return JSONResponse(status_code=503, content=HealthResponse(status='unavailable', model_loaded=False, reason=store.reason).model_dump())
        return HealthResponse(status='ready', model_loaded=True, model_version=store.info.model_version)

    @app.get('/model-info', response_model=ModelInfo, responses={503: {'model': ErrorResponse}})
    def model_info(request: Request):
        return request.app.state.model.require()

    @app.post('/predict', response_model=PredictionResponse, responses={408: {'model': ErrorResponse}, 413: {'model': ErrorResponse}, 422: {'model': ErrorResponse}, 503: {'model': ErrorResponse}})
    def predict(payload: AssessmentRequest, request: Request):
        store = request.app.state.model
        info = store.require()
        values = payload.model_dump()
        issues = []
        for name, bounds in info.numeric_ranges.items():
            if not bounds.min <= values[name] <= bounds.max:
                issues.append({'field': name, 'message': f'Outside supported training range [{bounds.min}, {bounds.max}].'})
        for name, supported in info.categorical_values.items():
            if values[name] not in supported:
                issues.append({'field': name, 'message': 'Category not observed in training. Consult /model-info; no recoding is performed.'})
        if issues:
            return error(422, 'unsupported_input', 'Some answers are outside the model’s supported training data.', issues)
        try:
            score = store.predict(values)
        except Exception as exc:
            raise ModelUnavailable() from exc
        warnings = []
        reference = info.score_reference
        if not reference.observed_min <= score <= reference.observed_max:
            warnings.append('Prediction is outside the observed training-target range. It has not been clamped.')
        return PredictionResponse(Mental_Health_Score=score, model_version=info.model_version,
                                  disclaimer=info.disclaimer, score_reference=reference, warnings=warnings)
    return app


app = create_app()
