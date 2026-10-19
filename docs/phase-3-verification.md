# Phase 3 verification — 2026-10-19

Deployment preparation only: no Vercel or Render account resources were created and no deployment occurred. Existing React components and sage/cream design were preserved.

## Audit findings and architecture

- Frontend entry: `src/main.tsx` → `src/App.tsx` → `src/app/router.tsx`; assessment/results state is held in `src/app/AssessmentProvider.tsx` memory. Four routes and the not-found route remain intact.
- Assessment inputs and model payload are separate. The adapter sends exactly the 12 backend fields, not the acknowledgment or unsupported gender identities. Live metadata support checks precede submission; the backend independently validates all fields.
- Frontend configuration: `VITE_ASSESSMENT_MODE` defaults to demo; `VITE_API_BASE_URL` is used in explicit live mode only. Both are public build-time values. Demo performs no API calls. Live errors remain errors without substitution.
- Backend entry: `backend/wellness/api.py:app`. `WELLNESS_MODEL_PATH`, `WELLNESS_METADATA_PATH`, and `WELLNESS_CORS_ORIGINS` configure artifact loading and exact allowed browser origins. Environment files are examples, not automatically loaded secrets.
- Artifacts: `backend/models/model.joblib` and `metadata.json`. Loading checks integrity, recorded library versions and metadata. The new deployment preflight also checks all 12 feature positions, numeric/categorical preprocessing columns, encoder vocabulary and a finite prediction within the documented observed range.
- API: `/health`, `/model-info`, `/predict`. Responses include model version, educational disclaimer and observed target range. The frontend validates these responses with Zod. Model support ranges are not clinical cutoffs or a comprehensive distribution detector.
- Existing dataset, training pipeline, metrics, model version and fitted artifact were retained. The theoretical target scale, scoring instrument, dataset licensing/consent and clinical validity remain unverified.
- Existing protections include strict Pydantic validation, sanitized errors, no submission persistence, no answer logging, no-store responses and a 16 KiB POST body limit. CORS does not authenticate clients or rate-limit abuse.

## Confirmed gaps addressed

- Mobile disclosure now closes on route/history changes and desktop breakpoint transitions. Escape works both inside navigation and on its toggle. Hidden desktop/mobile navigation does not duplicate the visible mobile menu after resizing.
- Field labels, hints and validation text are more legible. Model status and long result notices wrap; errors receive focus, loading is announced, and failed submissions expose a clear retry action while preserving answers.
- The chart container is a labeled figure rather than an image role that can flatten interactive descendants. Existing responsive chart sizing and reduced-motion behavior remain.
- Response-body timeouts are reported as timeouts rather than malformed JSON. POST uploads have an absolute 10-second receive deadline, with sanitized 408 responses; oversized streamed bodies still return 413.
- Added the React-to-real-FastAPI integration test, navigation regression tests, upload deadline/size tests and artifact preflight coverage.
- Added Vercel SPA routing/security headers, a Render monorepo service manifest, Python 3.12 selection, environment examples and manual deployment instructions. Render build preflight fails on incompatible/missing artifacts; health checks fail when the model is unavailable.

## Files changed or added

| Area | Files |
| --- | --- |
| UI | `src/components/layout/Layout.tsx`, `src/pages/AssessmentPage.tsx`, `src/features/results/components/HabitChart.tsx`, `src/styles/globals.css` |
| API adapter | `src/services/assessmentService.ts` |
| Backend | `backend/wellness/api.py`, `backend/wellness/middleware.py`, `backend/wellness/verify_model.py` |
| Frontend tests/config | `tests/navigation.test.tsx`, `tests/assessment.test.tsx`, `tests/service.test.ts`, `tests/integration/live-flow.test.tsx`, `vitest.integration.config.ts`, `vite.config.ts`, `tsconfig.app.json`, `tsconfig.node.json`, `package.json` |
| Backend tests | `backend/tests/test_middleware.py`, `backend/tests/test_training.py`, `backend/tests/asgi_bridge.py`, `backend/tests/__init__.py` |
| Deployment/docs | `vercel.json`, `render.yaml`, `backend/.python-version`, `.env.example`, `backend/.env.example`, `README.md`, this report |

The smoke command also regenerated the existing API contract fixtures from the unchanged full model. Generated `dist/` output is a build artifact, not source. No new dependencies were introduced.

## Executed checks

| Check | Actual outcome |
| --- | --- |
| `npm run lint` | Passed, no lint warnings |
| `npm run typecheck` | Passed |
| `npm test` | 61 tests passed in 4 files |
| `npm run test:integration` with configured Python interpreter | 1 test passed against real FastAPI and exported model |
| `npm run build` | Passed; non-fatal upstream Zod annotation and large-chunk warnings |
| `python -m pytest -q` from backend | 50 passed, including training/export, loading, API, CORS, data validation and preprocessing checks |
| `python -m wellness.verify_model` | Passed; 12 features, model `experimental-v1-563a8c9c1bb9` |
| `python -m wellness.smoke` | Health ready; real example prediction **7.495947916666668**, observed reference **3.6–9.4**, definition unverified |
| Deployment manifest parsing | JSON/YAML parsed; directories, SPA fallback, free/manual service configuration and health path checked locally |
| Browser/live HTTP/Docker/hosted deployment | Not verified; local socket binding returns EPERM and no graphical browser tooling is available |

Python checks used the existing read-only Python 3.9.6 environment described in README. No installs, dependency cache changes or repeated network retries were needed. Python 3.12 hosting must still pass build-time verification on Render.

The integration test renders the real landing page and four-step React form in jsdom, submits through the actual API adapter, and bridges requests to FastAPI TestClient over stdin. It deliberately fails the first send, verifies no demo fallback, retries into the real model, verifies the exact payload and displayed result/version/disclaimer, and retakes to empty inputs. This is cross-language integration, not a graphical browser or real HTTPS transport test. Chart sizing alone is mocked.

## Required browser/deployment acceptance checks

1. Follow README's manual Vercel and Render setup; verify `/health` and the documented example request first. Confirm actual browser CORS from the exact production domain and rejection from an unlisted origin.
2. At 320 px, 375 px, tablet and desktop widths, check navigation, field spacing, errors, review summary, chart labels and result wrapping. Open the mobile menu and resize to desktop and back; it must close.
3. Use keyboard only: skip link, navigation disclosure, Escape, all form fields, Back/Next, validation focus, acknowledgment, submission, retry and retake. Check screen-reader labels/status and system reduced-motion preference.
4. Complete the example assessment in live mode; inspect the single POST payload and real response. Retake must clear inputs. Refresh results must show the privacy-preserving empty state.
5. Disconnect the backend before submitting and retry after restoring it. No demo score may appear. Check metadata-loading failure and retry, unsupported values, and Render cold-start timeout behavior.
6. Visit `/assessment`, `/about` and `/results` directly and refresh each. Verify Vercel SPA routing, chart responsiveness, print output and real-device performance.

Remaining release decisions: dataset/model use rights and suitability, runtime/hosted verification, resource/load measurement and infrastructure abuse controls. The prepared free Render tier is for evaluation; no production availability guarantee is claimed. The application remains explicitly experimental and educational.
