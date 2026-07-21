# Frontend

React UI for the AutoML workflow.

## Features in this scaffold

- model selection for ResNet-50, VGG-16, and ViT-B/16
- archive upload for ImageFolder-style datasets
- dataset inspection through the backend
- default split editing and per-class overrides
- task polling and result display

## Run

```bash
npm install
npm run dev
```

The dev server proxies `/api` and `/healthz` to `http://localhost:8080`.
