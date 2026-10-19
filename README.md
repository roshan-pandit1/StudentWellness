# Student Wellness Insights

An educational student wellness application with the existing Calm & Minimal React interface, a reproducible ML pipeline, and a FastAPI prediction service. **Experimental educational estimate; not a medical diagnosis.** No clinical validity, diagnostic performance, or model “accuracy” is claimed.

Demo mode remains the default. It shows a fixed **7.2** labeled **“Demo result — not a real prediction.”** Live mode uses the trained pipeline, displays its version and disclaimer, and never substitutes demo data after a failure.

## Verification and actual results

Verified on 2026-10-19:

| Check | Result |
| --- | --- |
| Frontend lint | Passed |
| Frontend strict TypeScript checking | Passed |
| Frontend tests | 61 passed across 4 files |
| Production build | Passed; output generated in `dist/` |
| Backend tests | 50 passed, including model export/loading, dataset validation, leakage checks, reproducibility, API, input limits, CORS, and error handling |
| Full training | Completed against the downloaded reference CSV; exported `backend/models/model.joblib` and `metadata.json` |
| Training smoke run | Separate reduced-size training and API smoke commands included and executed |
| Actual exported model API integration | `/health`, `/model-info`, and `/predict` passed through FastAPI TestClient (in-process ASGI) |
| Cross-language assessment flow | 1 integration test: React form → real FastAPI ASGI → exported model → results → retake; includes failed-send/retry and no demo fallback |
| Deployment artifact preflight | Passed: 12-feature ordering, preprocessing vocabulary, integrity, versions, finite prediction and observed range |
| Local HTTP servers | Environment-blocked: Vite `listen EPERM 127.0.0.1:5173`; Uvicorn started successfully but binding `127.0.0.1:8000` returned operation not permitted |
| Browser/network end-to-end QA and Docker build | Not verified in this restricted environment |

The production build retains non-fatal warnings about two upstream Zod comment annotations and a minified entry chunk larger than 500 kB; these do not prevent output generation.

The frontend used the existing `node_modules` and lockfile, Node 24.22.0, and npm 11.19.1. Python verification used the already-installed, read-only interpreter at `/Volumes/Samsung SSD/Project/DeepVerify/.venv/bin/python` (Python 3.9.6) and its libraries; no changes were made to that environment. **The application does not depend on that absolute path.** Use your own isolated environment as described below. Fresh dependency installation and Python 3.12/Docker execution were not verified here. No offline installation, custom dependency cache, or repeated installation loop was used for Phases 2–3.

### Model evaluation

The pinned reference data contained 5,000 rows. The documented exclusion policy retained **4,978 rows**, with 3,982 for training and 996 for held-out evaluation. The selected model was **RandomForestRegressor**, selected by lowest mean training cross-validation MAE, before examining held-out performance.

| Held-out metric | Value |
| --- | ---: |
| MAE | 0.2946431128 |
| RMSE | 0.4125210934 |
| R² | 0.8982610855 |

These are dataset-target prediction metrics, **not medical performance measures**. R² is not accuracy. The target’s definition, theoretical scale, collection methodology, and clinical relevance are unverified. Metrics do not establish applicability to any individual or population.

The actual full-model prediction for `backend/tests/example_request.json` was **7.495947916666668**, returned by version `experimental-v1-563a8c9c1bb9`. This is a real prediction for a documented example request, not a score for a real user. Full metadata and cross-validation comparisons are in `backend/models/metadata.json`. Versions incorporate the dataset checksum, training-code digest, library versions, seed, selected model, and smoke/full configuration; retraining after source changes may change the version.

## Local setup

### Frontend

Use Node 24 LTS or Node 22.12+ and npm. From the project root:

```sh
npm ci --no-audit --no-fund --fetch-retries=1
cp .env.example .env
npm run dev
```

Vite normally serves `http://localhost:5173`. If registry access fails, stop and resolve connectivity rather than retrying in a loop. Existing installed dependencies do not need reinstalling merely to run checks.

For the default demo experience:

```dotenv
VITE_ASSESSMENT_MODE=demo
VITE_API_BASE_URL=http://localhost:8000
```

For real inference after starting the backend:

```dotenv
VITE_ASSESSMENT_MODE=live
VITE_API_BASE_URL=http://localhost:8000
```

Restart Vite after editing `.env`; rebuild deployed assets after changing build-time environment variables. Unknown mode names produce a configuration error. **All `VITE_` variables are public. Never put secrets or API keys in them.**

### Backend

Recommended fresh environment: Python **3.12**, with the pinned requirements. The implementation was additionally exercised on the available Python 3.9 runtime; do not deploy an end-of-life Python runtime. The pinned NumPy/scikit-learn stack is not intended for Python 3.14.

From the project root:

```sh
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install --retries 1 -r backend/requirements-dev.txt
cd backend
export WELLNESS_CORS_ORIGINS='["http://localhost:5173","http://127.0.0.1:5173"]'
.venv/bin/python -m uvicorn wellness.api:app --host 127.0.0.1 --port 8000 --no-access-log --limit-concurrency 32
```

Run backend commands **from `backend/`** so default artifact paths resolve correctly. `requirements.txt` is sufficient for serving/training; `requirements-dev.txt` additionally installs pytest and httpx for tests and smoke checks. No database is required. The downloaded dataset and locally trained full artifact are present. The backend refuses artifacts with incompatible recorded library versions; retrain with the same intended deployment environment when necessary.

`backend/.env.example` documents environment settings. The application reads process environment variables; it does **not** automatically load that file. Use shell exports or your deployment platform’s environment configuration.

| Backend variable | Default | Purpose |
| --- | --- | --- |
| `WELLNESS_MODEL_PATH` | `models/model.joblib` | Trusted, operator-controlled pipeline bundle |
| `WELLNESS_METADATA_PATH` | `models/metadata.json` | Matching integrity/contract/version metadata |
| `WELLNESS_CORS_ORIGINS` | `[]` | JSON array of exact permitted browser origins; no wildcard or credentials |

Examples for custom locations:

```sh
export WELLNESS_MODEL_PATH=/srv/wellness/models/model.joblib
export WELLNESS_METADATA_PATH=/srv/wellness/models/metadata.json
export WELLNESS_CORS_ORIGINS='["https://wellness.example.org"]'
```

## Dataset provenance and limitations

The original CSV was not present in the frontend workspace. It was retrieved without modifying its bytes from [Mental-Health-Score](https://github.com/tanishq-latent/Mental-Health-Score) at commit **`6a3111bf6dcd8a2d858a3c6377b35702c8453627`**:

- Original filename: `Student Social Media And Mental Health Impact.csv`
- Local file: `backend/data/student_wellness.csv`
- Exact source URL and retrieval details: `backend/data/provenance.json`
- SHA-256: `32b542a497c39389735710fb4e2f43bdf444af5d9bacde6289801d201b6bebd3`
- Observed source and final training target range: **3.6–9.4**. This does **not** establish a theoretical 0–10 scale.

The source README and training notebook do not establish a validated scoring instrument, how the target was generated, recruitment, collection consent, or representativeness. Country names do not demonstrate representative sampling. Dataset licensing was not established; review use and redistribution rights before public distribution or deployment. No dataset, target scores, fitted model, metrics, or predictions were fabricated. The original repository’s pickle was not downloaded or loaded.

### Validation and exclusions

Strict dataset validation is the default and fails on invalid rows. Training requires the explicit, documented `--invalid-policy drop` option for this source:

| Finding | Handling |
| --- | --- |
| 10 negative physical-activity values | Excluded; never clipped to zero |
| 2 exact duplicate rows | Deduplicated before splitting |
| 10 rows in 5 feature-identical groups with conflicting targets | All group members excluded; no “first row wins” choice |
| Missing, malformed, non-finite values, wrong column schema, invalid types/categories/counts, impossible daily totals | Validated; rejected or counted and explicitly excluded under the chosen policy |

The raw file remains unchanged. `data_audit` in model metadata records counts and reasons. The target is separated from features before fitting. Rows have distinct feature vectors after exclusion/deduplication, preventing duplicate records crossing the split. This does not rule out unrecorded participant-level dependencies in the original data.

## Reproducible training

From `backend/`, after installing dependencies:

```sh
.venv/bin/python -m wellness.train --invalid-policy drop
```

Defaults are the bundled CSV/provenance, seed 42, an 80/20 train/test split, and 5-fold shuffled training cross-validation. The trainer compares:

- DummyRegressor with the training mean baseline.
- Ridge with alpha 0.1, 1, and 10, using the sparse LSQR solver.
- RandomForestRegressor with 160 trees, `min_samples_leaf=2`, `max_features=0.8`, fixed seed, and one worker.

Each candidate is a complete sklearn Pipeline with a ColumnTransformer: StandardScaler on numeric features and OneHotEncoder on categorical features. All learned statistics and vocabularies are fitted **inside each training fold**. No global country regrouping, target-derived feature, imputation, or pre-split fitted transform is used. Sparse encoding avoids unnecessary dense matrices. Cross-validation selects the lowest mean MAE; the selected pipeline is fitted on the training partition and evaluated once on the held-out partition using MAE, RMSE, and R². It is **not** refitted on the held-out rows before export.

The encoder safely tolerates unseen categories within cross-validation, while the public API explicitly rejects categories absent from final training. This distinction permits honest validation without silently treating unsupported user values as known categories.

Outputs:

- `models/model.joblib`: selected fitted pipeline plus its feature/support contract.
- `models/metadata.json`: artifact SHA-256, dataset provenance/checksum, code digest, training UTC date, dependency versions, seed/split digests and counts, candidate CV results, held-out metrics, support ranges/categories, target reference range, and limitations.

The trainer checks provenance integrity and finite metrics before export. Only trusted local joblib files may be loaded: **pickle/joblib can execute code**. The checksum detects mismatched or corrupt bytes, not malicious artifacts paired with forged metadata. Deploy model and metadata together on a read-only filesystem; restart to load a new model.

### Smoke training and API check

```sh
.venv/bin/python -m wellness.train --invalid-policy drop --smoke --output models-smoke
.venv/bin/python -m wellness.smoke --model-dir models-smoke
.venv/bin/python -m wellness.smoke --export-contracts ../contracts
```

Smoke training uses the real dataset, 3 folds, and 20 trees, with its own version and output directory. It does not replace the default full model. The last command checks the **full** exported model and writes actual API responses to `contracts/model-info.json` and `contracts/prediction-example.json`. Frontend compatibility tests consume those recorded responses. Regenerate them when intentionally replacing the full model.

## API

| Endpoint | Behavior |
| --- | --- |
| `GET /health` | 200 with `status: ready`, `model_loaded: true`, and model version; 503 with a safe reason if missing/invalid |
| `GET /model-info` | Version, disclaimer, ordered features, training-only numeric ranges/categories, and observed target range; 503 if unavailable |
| `POST /predict` | Strictly validates the exact 12-field contract, checks model support, runs the fitted pipeline, and returns a real raw prediction |
| `/docs` | FastAPI’s generated API documentation |

Request example (`backend/tests/example_request.json`):

```json
{
  "Age": 21,
  "Gender": "Female",
  "Country": "India",
  "Academic_Level": "Undergraduate",
  "Most_Used_Platform": "YouTube",
  "Purpose_Of_Use": "Education",
  "Avg_Daily_Usage_Hours": 2.5,
  "Daily_Unlocks": 120,
  "Study_Hours": 5,
  "Physical_Activity_Hours": 0.5,
  "Sleep_Hours_Per_Night": 7.5,
  "Stress_Level": "Medium"
}
```

With the server running, from the project root:

```sh
curl http://localhost:8000/health
curl http://localhost:8000/model-info
curl -X POST http://localhost:8000/predict \
  -H 'Content-Type: application/json' \
  --data-binary @backend/tests/example_request.json
```

Actual full-model response:

```json
{
  "Mental_Health_Score": 7.495947916666668,
  "model_version": "experimental-v1-563a8c9c1bb9",
  "disclaimer": "Experimental educational estimate; not a medical diagnosis.",
  "score_reference": {
    "observed_min": 3.6,
    "observed_max": 9.4,
    "definition_verified": false,
    "description": "Observed training-target range; theoretical scale and scoring definition are unverified."
  },
  "warnings": []
}
```

No score is clamped or mapped to a different scale. A finite output outside the observed target range is returned unchanged with a warning. Live results show the dataset units and range, with a neutral circular frame instead of pretending the value is a percentage or “out of 10.” The demo retains its original, explicitly illustrative 0–10 visualization.

### Input support and errors

Both layers use the existing 12 named fields. Pydantic forbids extra fields, non-finite numbers, numeric strings, boolean counts, invalid enum values, and invalid routine totals. The UI-only acknowledgment and inclusive gender choices are never silently sent as model categories.

Training support is narrower than general form validity. The current artifact accepts ages **18–24**, daily unlocks **62–273**, social-media hours **1–8.8**, study hours **0.3–8.3**, physical activity **0–3.8**, and sleep **3.6–9.9**. These are observed training bounds, not validated model eligibility or clinical cutoffs. Consult `/model-info` after every retraining. Country and platform are exact, case-sensitive training categories; unsupported names are not mapped to “Other.” Valid combinations within individual ranges can still be out of distribution; marginal checks are not a complete OOD detector.

The frontend loads `/model-info` in live mode without transmitting answers, checks each step locally, and prevents unsupported submissions with field-specific explanations. Users should never change accurate answers simply to fit a model. Another identity and prefer-not-to-say remain valid in demo mode and explicitly unsupported by the binary model contract.

- 422: invalid or unsupported input, with safe field names/messages and no echoed submitted values.
- 408: POST body was not received within the absolute 10-second upload deadline.
- 413: JSON request exceeds 16 KiB (checked while receiving, before parsing).
- 503: missing, corrupt, incompatible, or failing model; no demo fallback.
- Frontend: configuration failures, HTTP failures, malformed/invalid JSON, and 15-second network timeouts are visible errors, preserving answers for retry.

CORS allows only explicitly configured origins, GET/POST, and Content-Type, with credentials disabled. CORS is a browser policy, **not authentication or abuse prevention**. Responses are `Cache-Control: no-store` with `X-Content-Type-Options: nosniff`. No individual submissions are written to disk, stored in a database, or logged by application handlers. Disable request/body tracing in infrastructure; the provided server commands disable access logs. Answers exist transiently in memory while processing. The API performs no outbound requests during inference.

## Existing frontend features and privacy

The four pages remain `/`, `/assessment`, `/results`, and `/about`, plus a friendly not-found page. The design, original artwork, responsive layouts, keyboard labels/focus, reduced-motion handling, answer review, retake/clear actions, print styling, reported-habit chart, and general wellness suggestions remain in place.

React 19/TypeScript, Vite, Tailwind 4, local shadcn-style primitives, Lucide, Framer Motion, Recharts, React Router, React Hook Form, and Zod remain unchanged as the frontend stack. DM Sans and artwork are bundled locally; no tracking, analytics, third-party fonts, localStorage, or sessionStorage were added.

Demo sends **no API requests**, including model-info requests. Live mode sends only a model-info GET until the user acknowledges and submits the 12 fields to `/predict`. Drafts/results live in tab memory and disappear on refresh or tab close. Backend processing introduces no submission persistence. Printing is user-initiated and can contain personal reported habits.

The score cannot diagnose a condition or label someone mentally healthy/unhealthy. Suggestions are general information and reflection prompts, not treatment or causal explanations. Sleep guidance links to [CDC](https://www.cdc.gov/sleep/about/), and movement guidance to [WHO](https://www.who.int/news-room/fact-sheets/detail/physical-activity). External references open only on user action.

## Tests and checks

Frontend, from project root:

```sh
npm run lint
npm run typecheck
npm test
npm run build
# After installing backend development dependencies (absolute interpreter path):
WELLNESS_TEST_PYTHON="$PWD/backend/.venv/bin/python" npm run test:integration
```

The separate integration command requires Python and the real model artifacts; it fails explicitly when the interpreter is not configured. It drives the rendered React assessment in jsdom and sends requests over a test-only stdin bridge to FastAPI TestClient. It does not use a mocked prediction. It verifies a connection failure, preserved answers, retry, the exact 12-field payload, real result/version/disclaimer, and cleared answers on retake. It does not replace browser or deployed HTTPS/CORS testing.

Backend, from `backend/`:

```sh
.venv/bin/python -m pytest -q
.venv/bin/python -m wellness.verify_model
.venv/bin/python -m wellness.train --invalid-policy drop --smoke --output models-smoke
.venv/bin/python -m wellness.smoke --model-dir models-smoke
.venv/bin/python -m wellness.smoke
```

Backend tests train temporary smoke artifacts from the **real bundled CSV**; they do not fabricate training datasets. Mutated copies/sentinel categories and stubbed out-of-range predictions are explicitly confined to negative tests. Coverage includes column/type/missing/duplicate/nonfinite checks, train/holdout separation, fold-only preprocessing, unseen-category encoding, model selection/export/reproducibility, integrity/version loading, valid and invalid API requests, missing models, CORS, body size, sanitized errors, and raw unclamped output. ASGI tests need no listening port.

Frontend coverage preserves the original assessment/demo tests and adds actual backend-response parsing, metadata retrieval without answers, support checks before POST, version/disclaimer display, and removal of the assumed live 0–10 bound. The chart is mocked in component tests; real responsive chart layout, printing, browser networking, and assistive technologies still require browser QA.

## Project structure

```text
src/                         # Existing React app and design
  app/                       # Router and in-memory assessment provider
  components/{layout,shared,ui}/
  features/{assessment,results}/
  hooks/useModelInfo.ts       # Live metadata loading/retry; no demo requests
  pages/                     # Same four pages, no redesign
  services/
    assessmentService.ts     # Central API adapter and demo boundary
    modelContract.ts         # Runtime response contracts + support checking
    demoService.ts
  styles/
tests/                       # Frontend validation, service and flow tests
contracts/                   # Actual generated API response fixtures
backend/
  wellness/
    contracts.py             # Pydantic models and exact feature order
    data.py                  # CSV validation and exclusion audit
    train.py                 # Reproducible CV, evaluation, export
    model.py                 # Trusted artifact integrity/version loading
    api.py                   # FastAPI application and CORS configuration
    middleware.py            # 16 KiB body limit and 10-second upload deadline
    verify_model.py          # Read-only artifact/preprocessing deployment preflight
    smoke.py                 # Actual model/API smoke and fixture export
  data/                      # Original CSV + pinned provenance + limitations
  models/                    # Fitted full pipeline and metadata
  tests/                     # Backend tests + documented example request
  requirements*.txt
  .env.example
  Dockerfile
  .dockerignore
vercel.json                  # Vite build, security headers, SPA routing
render.yaml                  # Manual deployment, free Python service, readiness check
docs/phase-3-verification.md  # Audit, changes, verification limits and browser checklist
README.md
```

## Deployment: Vercel frontend and Render backend

Deployment files are prepared; **no service was created and nothing was deployed**. Review dataset redistribution/use rights and suitability before a public pilot: these remain unresolved. Review privacy requirements and configure infrastructure abuse/rate controls for your audience; CORS is not authentication. Keep access/body tracing disabled. No secrets belong in `VITE_` variables.

### 1. Prepare the repository and frontend origin

1. Put this existing project in your Git repository and push it yourself. Include `package-lock.json`, `backend/models/model.joblib`, and its matching `metadata.json`; Render does not train or download a model during deployment. Only load operator-controlled joblib artifacts. Review dataset rights before publishing the bundled CSV or model.
2. In Vercel, choose **Add New → Project**, import the repository, and set **Root Directory** to the project root (`.`), **Framework Preset** to Vite, and **Node.js Version** to 24.x. `vercel.json` supplies install `npm ci --no-audit --no-fund`, build `npm run build`, and output `dist`.
3. Initially set `VITE_ASSESSMENT_MODE=demo` for Production and Preview. Deploy manually to establish the production origin, for example `https://student-wellness.vercel.app`. No backend URL is needed in demo. Do not put private keys in Vercel's Vite environment variables.

`vercel.json` includes the React Router SPA rewrite recommended by [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite). Source assumes hosting at the domain root. A refreshed `/results` page intentionally shows an empty state because assessment data exists only in memory.

### 2. Create the Render backend manually

1. In Render, select **New → Blueprint**, connect the same repository, and select the root `render.yaml`. Review the proposed single **Free** web service before applying it; no database, disk, or paid service is defined. Applying it is your explicit deployment action. Automatic deployments for subsequent commits are disabled by `autoDeployTrigger: "off"`.
2. Supply `WELLNESS_CORS_ORIGINS` when prompted as an exact JSON array, e.g. `["https://student-wellness.vercel.app"]`. Use the origin only: HTTPS scheme, hostname and optional port, no trailing slash or URL path. Add a custom domain explicitly if used. Do not allow wildcard preview domains.
3. Confirm service root `backend`, runtime Python, build `pip install --no-cache-dir -r requirements.txt && python -m wellness.verify_model`, and startup `python -m uvicorn wellness.api:app --host 0.0.0.0 --port $PORT --no-access-log --limit-concurrency 16 --timeout-keep-alive 5 --timeout-graceful-shutdown 20`.
4. Keep `WELLNESS_MODEL_PATH=models/model.joblib` and `WELLNESS_METADATA_PATH=models/metadata.json`. The service's `.python-version` selects Python 3.12; do not override it with an incompatible runtime. Build-time preflight must succeed before release. The health check is `/health`, which returns 503 when the model is unavailable.
5. After deployment, verify the assigned HTTPS endpoint with the documented illustrative request (commands below). Do not use real student information for deployment smoke checks.

The manifest uses Render's [Blueprint specification](https://render.com/docs/blueprint-spec), [monorepo root directory convention](https://render.com/docs/monorepo-support), and [Python version configuration](https://render.com/docs/python-version). Python 3.12 execution and hosted provisioning have not been tested in this workspace; the artifact preflight checks loading, library compatibility, feature ordering, categorical vocabulary, and an unclamped finite prediction on the deployment runtime.

```sh
# From the repository root; substitute the actual Render service hostname.
export WELLNESS_BACKEND_URL=https://YOUR-SERVICE.onrender.com
curl --fail "$WELLNESS_BACKEND_URL/health"
curl --fail "$WELLNESS_BACKEND_URL/model-info"
curl --fail "$WELLNESS_BACKEND_URL/predict" \
  -H 'Content-Type: application/json' \
  --data-binary @backend/tests/example_request.json
```

### 3. Enable live mode and verify the deployed flow

1. In Vercel's **Production** environment, set `VITE_ASSESSMENT_MODE=live` and `VITE_API_BASE_URL=https://YOUR-SERVICE.onrender.com`. Keep Preview set to `demo` unless a particular preview origin is explicitly allowlisted on Render.
2. Redeploy Vercel: these values are embedded at build time. Backend environment changes likewise need a Render restart/redeployment. Use Manual Deploy for future backend changes.
3. Open the production landing page, complete the four steps with `backend/tests/example_request.json`, acknowledge the disclaimer, and submit. Confirm a successful HTTPS `/predict` request, displayed model version and educational disclaimer, and no demo label. Check Retake clears answers. Test direct `/assessment`, `/about`, and `/results` navigation and refresh.
4. Follow the browser/mobile/keyboard checklist in `docs/phase-3-verification.md`. Inspect network traffic to confirm answers are sent only after submission, no analytics requests occur, and failures show retry errors instead of a demo score.

Render's [free service](https://render.com/docs/free) spins down after inactivity and can take about a minute to wake. The app's 15-second request timeout may therefore expire during a cold start. Let `/health` become ready, then use the visible metadata or prediction retry action; entered answers remain in memory. Free hosting is suitable for evaluation and has no production availability guarantee. Review resource use under expected load before selecting a production hosting tier yourself.

### Optional container deployment

Docker was **not built or tested here**:

```sh
docker build -t student-wellness-api ./backend
docker run --rm -p 8000:8000 --read-only \
  -e WELLNESS_CORS_ORIGINS='["https://wellness.example.org"]' \
  student-wellness-api
```

The container runs as a non-root user, copies backend code and the fitted artifact, disables access logs, and limits concurrency. Retrain and verify in the intended runtime when upgrading dependencies. There is no submission database or model-upload endpoint.

## Troubleshooting and operational limits

- **503 / model unavailable:** check both artifact paths relative to `backend/`, file availability and matching hashes/library versions. Run `python -m wellness.verify_model`. Replace model and metadata together; never disable integrity checks or load untrusted joblib files.
- **422 / unsupported answers:** consult `/model-info` for the current model's exact categories and observed numeric bounds. Do not change accurate answers to fit the model, silently recode identities, or use demo output as a live prediction.
- **CORS failure:** confirm the exact Vercel production/custom origin appears in the backend JSON allowlist. Restart/redeploy after backend configuration changes. A successful curl request alone does not validate browser CORS.
- **Wrong mode/backend URL:** change Vercel build environment values and redeploy. The default is demo; live failures never fall back to demo.
- **408 or 413:** POST uploads must finish within 10 seconds and be at most 16 KiB. The frontend's 15-second deadline includes response-body reading. Client abort does not forcibly cancel Python inference already running. Render's process configuration limits concurrent work; add gateway rate controls as needed.
- **Port binding EPERM:** this workspace disallows local listening sockets. Run servers and real-browser checks on your own machine or a permitted environment. Do not interpret ASGI/jsdom tests as a verified hosted deployment.
- **Results disappear after refresh:** expected privacy behavior. Answers and predictions are not persisted; start another assessment.
- **Large build chunk:** Vite reports a non-fatal bundle-size warning. Measure real-device load performance before adding optimization complexity.

The target definition, clinical validity, dataset licensing/consent, representative sampling, Python 3.12 deployment runtime, graphical/browser layout, and hosted networking have not been established by these checks. This remains an experimental educational application, not a medical assessment or treatment service.
