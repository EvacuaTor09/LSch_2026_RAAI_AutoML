# Backend

Go backend for the AutoML workflow.

## What this scaffold covers

- multipart dataset upload
- archive inspection for class discovery
- default 60/30/10 splitting with per-class overrides
- task persistence in a file-backed store
- in-memory queue for task dispatch
- worker loop that selects the best model by accuracy
- HTTP endpoints for the React frontend

## API

- `GET /healthz`
- `POST /api/datasets/inspect`
- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/{id}`
- `POST /api/worker/run-once`

## Environment

- `HTTP_ADDR` - server address, default `:8080`
- `DATA_DIR` - storage directory, default `./storage`
- `RESNET_URL` - model service endpoint
- `VGG_URL` - model service endpoint
- `VIT_URL` - model service endpoint
