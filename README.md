# LogPulse : API Anomaly Detection Platform

LogPulse monitors API traffic from a set of servers in real time and flags anomalies (traffic spikes, latency degradation, error bursts) using a hybrid machine learning pipeline that combines a deep Autoencoder with an Isolation Forest, backed by a calibrated confidence score.

The system has three moving parts: a Node.js API that owns the business logic and the database, a Python ML microservice that only does inference, and a React dashboard that visualizes metrics live over WebSockets and lets an operator review and acknowledge alerts.

## How it works

1. Traffic metrics for a server (request count, response times, error rates, and other derived features : 46 in total) are sent to the Node backend.
2. The backend forwards the feature vector to the ML service, which runs it through the preprocessing pipeline (impute => clip => scale) and then through both models.
3. The Autoencoder is the primary decision-maker: if its reconstruction error goes above the trained threshold, the point is flagged. The Isolation Forest acts as a severity qualifier on top of that flag.
4. The two flags combine into one of three decisions:

   | Autoencoder | Isolation Forest | Decision   |
   |-------------|-------------------|------------|
   | flagged     | flagged           | `CRITICAL` |
   | flagged     | not flagged       | `WARNING`  |
   | not flagged | (either)          | `NORMAL`   |

   This rule is intentionally asymmetric: the Autoencoder has by far the better recall on this dataset, so a `WARNING` from it is never downgraded to `NORMAL` just because the Isolation Forest disagrees.
5. A **calibrated confidence score** (logistic regression, Platt scaling — see [Confidence Calibration](#8-confidence-calibration)) estimates how reliable the decision is, symmetrically in both directions (high confidence for a clear `NORMAL` as well as for a clear `CRITICAL`), instead of the earlier hand-tuned heuristic.
6. Anomalies are persisted as alerts in Postgres, broadcast to connected dashboards over Socket.IO, and subject to a per-server cooldown so the same ongoing issue doesn't spam a new alert every few seconds.
7. **Every** prediction — including `NORMAL` ones — is separately logged to a predictions journal, so the full behavior of the pipeline can be reviewed, not just the incidents it flagged.

## Architecture

The codebase is split into four main parts:
```
                                  HTTP / REST
┌─────────────────────┐   ◄────────────────────►   ┌──────────────────────────┐
│   React Frontend    │                            │     Express Backend      │
│─────────────────────│                            │──────────────────────────│
│ • React 19          │                            │ • Express 5              │
│ • Vite              │                            │ • Port 4000              │
│ • Port 5173         │◄─────── Socket.IO ───────► │ • Socket.IO              │
└─────────────────────┘                            │ • PostgreSQL             │
                                                   │ • Redis (optional)       │
                                                   └─────────────┬────────────┘
                                                                 │
                                                                 │ HTTP / REST
                                                                 ▼
                                                   ┌──────────────────────────┐
                                                   │    FastAPI ML Service    │
                                                   │──────────────────────────│
                                                   │ • Uvicorn (Port 8001)    │
                                                   │ • Autoencoder            │
                                                   │ • Isolation Forest       │
                                                   │ • Confidence Calibrator  │
                                                   │ • /predict               │
                                                   │ • /health                │
                                                   │ • /metadata              │
                                                   └──────────────────────────┘
```
 - **Frontend** : React 19 + Vite, talks to the backend over REST for alert history, the predictions journal, server management, and over Socket.IO for live metrics.
- **Backend** : Express 5 API. Owns auth, alerts, the predictions journal, server registration, metrics history, and the health check. Talks to Postgres directly and proxies prediction requests to the ML service through a circuit breaker (`opossum`) with retries (`axios-retry`), so a slow or dead ML service degrades gracefully instead of blocking requests.
- **ML service** : FastAPI app that loads the trained Autoencoder (Keras), the Isolation Forest, the scaler, the imputer, and the confidence calibrator once at startup and exposes `/predict`, `/health`, and `/metadata`. It has no knowledge of Postgres, Redis, or alerts — it only scores feature vectors. The calibrator is optional: if it's missing or fails to load, the service falls back to the original heuristic confidence formula rather than refusing to start.

## Repository layout

```
backend/            Node.js/Express API
  src/
    app.js           Express app setup (middleware, route mounting)
    server.js         HTTP server bootstrap + Socket.IO init
    config/           env validation, Postgres pool, Redis client, logger, mail, socket config
    controllers/      thin HTTP handlers (alerts, predictions, servers, auth, health, metrics, predict)
    services/         business logic (alerts, predictions, servers, auth, health, metrics, predict, mail)
    middleware/       auth, role checks, request logging/correlation IDs, rate limiting, validation
    routes/           Express routers per resource
    validators/       Zod schemas for request validation
    utils/            AppError, response helpers, the ML service HTTP client (retry + circuit breaker)
    websocket/        Socket.IO setup and the periodic metrics emitter
  scripts/
    create_admin.js   CLI helper to create an admin user directly in the DB

flask_service/       Python/FastAPI ML microservice (despite the folder name, it runs on uvicorn/FastAPI, not Flask)
  main.py             FastAPI app, routes, exception handlers
  predictor.py         HybridPredictor class: artifact loading + the AE/IF pipeline + confidence calibration (with heuristic fallback)
  schemas.py           Pydantic request/response models (the request schema is built dynamically from the feature list)
  tests/               pytest tests for the decision rule and the confidence logic

frontend/            React + Vite dashboard
  src/
    pages/            Overview, Servers, Alerts, Predictions, History, Login, Register, Verify2FA
    components/       charts, layout, and reusable UI primitives
    hooks/            Socket.IO hooks, debounce, active-alerts counter
    context/          auth context (session stored in sessionStorage, not localStorage)
    lib/apiClient.js  small fetch wrapper for the backend REST API

ml/                  Training notebooks and exported model artifacts (Autoencoder, Isolation Forest, confidence calibrator), plus evaluation charts in ml/report/
  notebooks/
    AutoEncoder_notebook.ipynb          Autoencoder training
    isolation_forest_unsupervised.ipynb Isolation Forest training
    confidence_calibration.ipynb        Confidence calibrator training + validation (see below)
etl/                 Data cleaning / feature engineering notebooks and exported diagnostic charts
data/                Processed datasets and the pickled preprocessing artifacts (imputer, scaler, clip bounds) used by the ML service at inference time
```
## **Anomaly Detection Pipeline**

This project combines data preprocessing, machine learning, and a web-based monitoring system to automatically detect abnormal API server behavior. The complete pipeline starts with raw server logs, trains anomaly detection models, exposes them through a FastAPI service, and integrates the prediction results into a real-time monitoring dashboard.

The following sections describe each stage of the pipeline.

---

### 1. Data Preparation (ETL)

The training dataset comes from the public Hugging Face dataset **mindweave/web-server-logs**, which contains approximately 5,000 HTTP server log entries. Since individual requests do not provide enough information to identify server behavior, an ETL pipeline (`etl_v2.ipynb`) was developed to transform raw logs into feature vectors suitable for machine learning.

The ETL process consists of the following steps:

1. **Load** the raw log dataset.
2. **Clean** the data by removing duplicates, correcting inconsistent data types, and removing invalid values such as negative response times.
3. **Parse** each log entry to extract useful information including timestamps, HTTP status codes, request paths, and user agents.
4. **Aggregate** requests into **5-minute windows** for each monitored server. For every window, 46 numerical features are generated, including:
   - request count,
   - average latency,
   - P95 latency,
   - error rate,
   - traffic statistics,
   - additional derived metrics.
5. **Label** each aggregated window as either **Normal** or **Anomalous** using provisional thresholds:

```python
SEUIL_ERROR_5XX = 0.05
SEUIL_P95_LATENCE = 2000
SEUIL_TRAFIC_MULT = 3.0
```

> These thresholds are temporary and should be replaced with the company's official values before retraining the models.

6. **Feature Engineering** generates additional derived features and a severity indicator.
7. **Export** the processed dataset together with the fitted imputer, scaler, labels, and ordered feature list used later during inference. `features_ml.csv` keeps `server_id`/`timestamp`/`is_anomaly` alongside the 46 model features — this context is what later made a leakage-safe, per-server chronological split possible for the confidence calibrator (see below).

During development, several improvements were made to the preprocessing pipeline:

- The dataset is sorted chronologically before training to preserve the temporal split.
- Missing values are handled using **SimpleImputer (median strategy)** instead of replacing them with zeros.
- Feature scaling is applied only after splitting the dataset into training and testing sets to avoid data leakage.

---

### 2. Machine Learning Models

Two different anomaly detection algorithms were trained and evaluated.

#### Autoencoder

The Autoencoder is the primary anomaly detection model. It is trained only on normal data and learns to reconstruct normal server behavior. During inference, abnormal inputs produce a larger reconstruction error, which is used as the anomaly score.

Architecture:

```
Input (46 features)
      ↓
Dense(64)
      ↓
Dense(32)
      ↓
Dense(8)     
      ↓
Dense(32)
      ↓
Dense(64)
      ↓
Output (46 features)
```

The model is trained using a temporal split:

- Training: 64%
- Validation: 16%
- Test: 20%

The anomaly threshold is calculated from the **99th percentile** of the reconstruction error on the validation set.

Performance:

| Metric | Value |
|---------|------:|
| Precision | 0.682 |
| Recall | 0.882 |
| F1-score | 0.769 |
| ROC-AUC | 0.993 |

---

#### Isolation Forest

Isolation Forest is used as a secondary anomaly detector.

Unlike the Autoencoder, it isolates observations through random partitioning. Since anomalous samples are usually rare and different from normal data, they tend to be isolated faster than normal observations.

Performance:

| Metric | Value |
|---------|------:|
| Precision | 0.963 |
| Recall | 0.765 |
| F1-score | 0.853 |
| ROC-AUC | 0.996 |

The two models have complementary strengths.

- The Autoencoder detects more anomalies (high recall).
- Isolation Forest produces fewer false positives (high precision).

---

### 3. Hybrid Decision Rule

Instead of relying on a single model, the project combines both models using a hybrid decision strategy.

| Autoencoder | Isolation Forest | Final Decision |
|--------------|-----------------|----------------|
| Anomaly | Anomaly | **CRITICAL** |
| Anomaly | Normal | **WARNING** |
| Normal | Either | **NORMAL** |

The Autoencoder is considered the primary detector because it has higher recall and is less likely to miss important anomalies. Isolation Forest is only used to determine the severity level.

This decision rule was validated with the project supervisor before implementation.

---

### 4. ML Microservice

The trained models are deployed as a separate **FastAPI** microservice.

When the service starts, it loads all required artifacts into memory only once:

- Autoencoder model
- Isolation Forest model
- Scaler
- Imputer
- Confidence calibrator (optional — see [Confidence Calibration](#8-confidence-calibration))
- Feature metadata

The service exposes three REST endpoints.

| Endpoint | Description |
|----------|-------------|
| `POST /predict` | Predicts whether a feature vector is normal or anomalous, with a calibrated confidence score |
| `GET /health` | Verifies that the service and models are loaded correctly |
| `GET /metadata` | Returns model information, feature names, and training metadata |

The preprocessing pipeline used during training (imputation, clipping, and scaling) is applied again before every prediction to guarantee consistency.

The ML service has only one responsibility: performing anomaly detection. It does not access PostgreSQL or manage alerts.

---

### 5. Backend Integration

The backend was developed with **Express.js** and acts as the bridge between the frontend, the database, and the ML service.

Its main responsibilities include:

- user authentication,
- alert management,
- the full predictions journal (every decision, including `NORMAL`),
- server registration and lifecycle,
- historical metrics,
- health checks,
- forwarding prediction requests,
- storing alerts in PostgreSQL,
- broadcasting alerts through WebSocket.

The backend is organized into several API modules:

- Authentication
- Metrics
- Predictions
- Alerts
- Servers
- Health

When a prediction request is received, the backend:

1. Sends the feature vector to the FastAPI service.
2. Receives the prediction (decision, scores, and calibrated confidence).
3. Logs the prediction to the `predictions_log` table — every decision, `NORMAL` included (fire-and-forget: a logging failure never blocks the pipeline).
4. For `WARNING`/`CRITICAL` decisions only: applies a cooldown mechanism to prevent duplicate alerts for the same server.
5. Stores `WARNING` and `CRITICAL` alerts in PostgreSQL (`alerts` table).
6. Broadcasts new alerts to connected dashboard clients using Socket.IO, and sends a push notification via OneSignal.

To improve reliability, communication with the ML service uses:

- **axios-retry** for temporary network failures.
- **opossum** as a circuit breaker to prevent backend failures when the ML service becomes unavailable.


---

### 6. Frontend Dashboard

The frontend was developed using **React 19** and **Vite**.

It provides a monitoring dashboard that communicates with the backend using both REST APIs and Socket.IO for real-time updates.

The dashboard includes the following pages:

| Page | Description |
|------|-------------|
| Overview | Live response time and request volume charts |
| Servers | Current health status of monitored servers, plus manual server registration (add/deactivate) |
| Alerts | Alert list (`WARNING`/`CRITICAL` only) with filtering, acknowledgment, and detailed information |
| Predictions | Full journal of every prediction the pipeline has made, `NORMAL` included, with a decision breakdown and per-row feature vector inspection |
| History | Historical trends and MTTR statistics |
| Login / Register / Verify2FA | User authentication pages |

Whenever a WARNING or CRITICAL alert is generated, the frontend receives it immediately through WebSocket without requiring a page refresh.

---

### 7. Predictions Journal

Unlike the `alerts` table — which only ever receives `WARNING`/`CRITICAL` decisions, after cooldown filtering — the `predictions_log` table receives **every single call** to `/predict`, regardless of decision. This makes it possible to answer questions the alerts table can't, such as "what fraction of traffic is actually anomalous?" or "is the model's behavior stable over time?", without those answers being skewed by cooldown suppression.

- **Table**: `predictions_log` (decision, confidence, both model scores/flags, the request's feature vector, and a timestamp).
- **Backend**: `GET /api/predictions` (paginated, filterable by `decision`/`server_id`/date range) and `GET /api/predictions/breakdown` (counts per decision over a period, used for the summary cards on the Predictions page).
- **Frontend**: the Predictions page shows the same kind of table as Alerts, but includes `NORMAL` rows and a small breakdown panel (count + percentage per decision).
- Logging to `predictions_log` is fire-and-forget from `predict.service.js`: a failure to write is logged server-side but never affects the response returned to the caller or the existing alerting pipeline.

⚠️ Because this table grows with every prediction (one row per server per emitter tick, by default every 2 seconds), a retention/cleanup job is recommended before this runs in a real production environment (e.g. `DELETE FROM predictions_log WHERE created_at < NOW() - INTERVAL '30 days'` on a schedule).

---

### 8. Confidence Calibration

The original confidence score was a hand-tuned heuristic based on the Autoencoder's distance from its threshold. It worked, but it wasn't a real probability: two predictions both reported as "80% confidence" had no guarantee of being wrong at the same rate.

This was replaced with a **calibrated confidence score** trained on labelled data, using **Platt scaling** (a logistic regression fit on top of the two models' raw signals):

- **Inputs**: `ae_score_normalized` (the Autoencoder's reconstruction error, normalized against its threshold) and `if_score` (the Isolation Forest's score).
- **Target**: the true historical label (`is_anomaly`).
- **Output**: `P(anomaly)`, converted into "confidence in the decision actually taken" — i.e. for a `NORMAL` decision, confidence is reported as `1 - P(anomaly)`, so a clear `NORMAL` and a clear `CRITICAL` both read as high confidence, rather than confidence collapsing toward 0 for every non-anomalous prediction.

**Validation.** An initial random train/test split gave a suspiciously low Brier score (0.0058), which turned out to be partly explained by temporal leakage: rows from the same anomaly episode, adjacent in time, ended up split across train and test. Switching to a **chronological, per-server split** (train on each server's earliest 70% of timestamps, test on the most recent 30%) and a walk-forward validation across multiple time windows gave a more honest and still excellent result:

| Split method | Brier score |
|---|---:|
| Random split (single holdout) | 0.0058 |
| Chronological per-server holdout | 0.0120 |
| Walk-forward (per-server, multiple windows) | 0.0127 ± 0.0046 |

The two features remain genuinely highly informative even without any leakage — the drop from 0.0058 to ~0.012 reflects the leakage being closed, not the underlying signal being weak.

**Fallback behavior.** The calibrator is loaded once at ML service startup (`ML/confidence_calibrator.pkl`, alongside `confidence_calibrator_metadata.json` documenting the training run). If the file is missing or fails to load, `predictor.py` logs a warning and transparently falls back to the original heuristic (`_confidence_heuristic`) — the service never refuses to start over a missing calibrator, and a single failed inference call falls back the same way rather than raising an error.

Retraining: `ml/notebooks/confidence_calibration.ipynb` reproduces `predictor.py`'s exact preprocessing and scoring logic (including the same monkey-patch used elsewhere for the `Dense`/`quantization_config` Keras compatibility issue), so the labelled scores used for calibration match production inference precisely.

---

### 9. Server Management

Servers are tracked in a lightweight `servers` table (`id`, `name`, `environment`, `is_active`, `created_at`). The auto-incrementing `id` doubles as the `server_id` used everywhere else in the pipeline (`predictions_log`, `alerts`, the metrics emitter) — there's no separate identifier to keep in sync.

- **Add a server**: `POST /api/servers` (name + environment). Because the underlying dataset is a replay of a fixed historical log sample, a newly added server has no real history of its own — the metrics emitter transparently synthesizes one for it by sampling from the existing pool of historical rows across all servers and applying a small random jitter (±10%) to magnitude-type features (latency, request count, bytes sent, etc.), so it produces a distinct, plausible-looking stream rather than mirroring an existing server exactly.
- **Deactivate a server**: `DELETE /api/servers/:id` sets `is_active = false`; the metrics emitter re-reads the active server list on a short TTL (a few seconds) so a deactivated server stops emitting shortly after.
- **List servers**: `GET /api/servers`.

---

### 10. Project Artifacts

The repository contains all the resources required to reproduce the anomaly detection pipeline:

- ETL notebooks
- Model training notebooks (Autoencoder, Isolation Forest, confidence calibrator)
- Trained Autoencoder
- Isolation Forest model
- Confidence calibrator + its training metadata
- Feature metadata
- Sample datasets
- Preprocessing artifacts (scaler and imputer)

These files are loaded by the FastAPI service during inference to ensure the same preprocessing steps are applied during both training and prediction.

## Prerequisites

Before running the project locally, make sure you have:

- Node.js and npm
- Python 3.11 or newer
- PostgreSQL running locally
- Optional: Redis if you want the backend cache layer enabled

The Python service Dockerfile targets Python 3.11, so that version is a sensible choice for local development.

## Environment configuration

The repository includes local environment files for the frontend and backend:

- backend/.env
- frontend/.env

The backend expects variables such as:
| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `PORT` | no | `4000` | |
| `CLIENT_URL` | no | `http://localhost:5173` | Used for CORS and Socket.IO origin |
| `ML_SERVICE_URL` | no | `http://localhost:8001` | Base URL of the FastAPI service |
| `ML_REQUEST_TIMEOUT_MS`, `ML_RETRY_ATTEMPTS`, `ML_CIRCUIT_BREAKER_*` | no | see `config/env.js` | Tuning for the resilience layer around `/predict` |
| `REDIS_ENABLED`, `REDIS_URL` | no | disabled | Alerts/predictions list caching; the app runs fine without Redis |
| `ALERT_COOLDOWN_MS` | no | `300000` | Minimum time between two alerts of the same decision on the same server |
| `METRICS_EMIT_INTERVAL_MS` | no | `2000` | How often simulated metrics are pushed over Socket.IO |
| `RATE_LIMIT_*`, `PREDICT_RATE_LIMIT_MAX` | no | see `config/env.js` | API rate limiting |
| `JWT_SECRET`, `PENDING_TOKEN_SECRET`, `OTP_EXPIRES_MINUTES` | for auth | — | Used by the login/2FA flow |
| `SMTP_USER`, `SMTP_PASS` | for auth | — | Gmail credentials for sending the OTP email via Nodemailer |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | for push alerts | — | OneSignal app-scoped REST API key (not a legacy key — see OneSignal dashboard → Keys & IDs → App API Keys) used to push `WARNING`/`CRITICAL` notifications |

The frontend uses VITE_API_URL to point at the backend.

If you are running everything locally, the default configuration uses:

- Backend: http://localhost:4000
- Frontend: http://localhost:5173
- ML service: http://localhost:8001

## Installing dependencies

### Backend

From the repository root:

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

### Python ML service

```bash
cd flask_service
pip install -r requirements.txt
```

## Running the project locally

### 1. Start the Python ML service

```bash
cd flask_service
uvicorn main:app --host 0.0.0.0 --port 8001
```

The service exposes:

- POST /predict
- GET /health
- GET /metadata

### 2. Start the backend

```bash
cd backend
npm run dev
```

The backend starts the Express API and initializes Socket.IO for live updates.
Note : To create your first admin account:

```bash
node scripts/create_admin.js admin@example.com SomeStr0ngPass!
```

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

The Vite dev server serves the dashboard on the local frontend port.

## API overview

All backend responses follow the shape `{ success, data, meta? }` on success and `{ success: false, error: { message, code } }` on failure.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Aggregated health of the API, Postgres, and the ML service |
| `GET` | `/api/metrics?minutes=` | Latest simulated metrics + recent history per server |
| `GET` | `/api/alerts` | List alerts (`WARNING`/`CRITICAL` only), filterable by `decision`, `status`, `server_id`, `from`/`to`, with sorting and pagination |
| `GET` | `/api/alerts/mttr` | Mean time to resolve (acknowledged alerts only) |
| `POST` | `/api/alerts/:id/acknowledge` | Acknowledge an active alert |
| `GET` | `/api/predictions` | Full predictions journal (every decision, `NORMAL` included), filterable by `decision`, `server_id`, `from`/`to`, with sorting and pagination |
| `GET` | `/api/predictions/breakdown` | Count of predictions per decision (`NORMAL`/`WARNING`/`CRITICAL`) over a period |
| `GET` | `/api/servers` | List registered servers |
| `POST` | `/api/servers` | Register a new server (name + environment); it starts emitting synthesized metrics within a few seconds |
| `DELETE` | `/api/servers/:id` | Deactivate a server (stops it from emitting metrics; does not delete its history) |
| `POST` | `/api/predict` | Run the hybrid ML pipeline on a feature vector and persist an alert if warranted |
| `POST` | `/api/auth/login` | Step 1 of login: validates credentials, emails a one-time code |
| `POST` | `/api/auth/verify-2fa` | Step 2: exchanges the OTP for a real JWT |
| `POST` | `/api/auth/register` | Public registration (always creates a `viewer`) |
| `POST` | `/api/auth/admin/users` | Admin-only user creation with a chosen role |

Socket.IO events: the server emits `metrics:update` on an interval and `alert:new` whenever a fresh alert is created; the client can also emit `subscribe:server` to join a per-server room.