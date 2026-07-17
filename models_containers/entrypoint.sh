#!/bin/bash
set -e

echo "starting ${MODEL_TYPE:-model} service (${MODEL_NAME:-unknown})"
echo "cache: ${MODELS_CACHE_DIR:-/app/models_cache}"
echo "weights: ${WEIGHTS_DIR:-/app/results/weights}"
echo "data: ${DATA_DIR:-/app/data}"

if [ -d "${MODELS_CACHE_DIR}" ] && [ "$(ls -A "${MODELS_CACHE_DIR}" 2>/dev/null)" ]; then
    echo "cached models found"
else
    echo "cache empty, model will be downloaded on startup"
fi

echo "starting server on port ${PORT:-8000}"
exec python app/server.py
