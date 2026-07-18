# AutoML — контейнеры моделей

Три сервиса трансферного обучения: **ResNet-50**, **VGG-16**, **ViT-B/16**.

---

## Инструкция по запуску

### 1. Перейти в каталог

```bash
cd models_containers
```

### 2. Собрать образ

```bash
docker compose build
```

### 3. (Рекомендуется) Прогнать smoke-тест

Тест выполняется **внутри контейнера**: качает Oxford Flowers-102, готовит датасет, обучает все 3 модели (по 2 эпохи).

```bash
docker compose run --rm --entrypoint python resnet /app/test_flowers.py
```

После успеха появятся:
- `./data/flowers_smoke/` — ImageFolder-поднабор
- `./data/flowers102_raw/` — сырой Flowers-102
- `./models_cache/` — кеш pretrained-весов

### 4. Запустить 3 сервиса

```bash
docker compose up -d
```

| Сервис | URL | Модель |
|--------|-----|--------|
| resnet | http://localhost:8001 | resnet50 |
| vgg    | http://localhost:8002 | vgg16 |
| vit    | http://localhost:8003 | vit_base_patch16_224 |

### 5. Проверить, что сервисы живы

```bash
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
```

Ожидается `"status": "healthy"`.

### 6. Обучить модель через API

Датасет должен лежать в `./data/<task_id>/` в формате:

```
data/<task_id>/
├── train/<class_name>/*.jpg
├── val/<class_name>/*.jpg
└── test/<class_name>/*.jpg
```

Пример на датасете из smoke-теста:

```bash
curl -X POST http://localhost:8001/train \
  -H "Content-Type: application/json" \
  -d '{"task_id":"flowers_smoke","dataset_path":"/app/data/flowers_smoke","epochs":2,"batch_size":4}'
```

То же для VGG (`8002`) и ViT (`8003`).

В ответе: `accuracy`, `precision`, `recall`, `f1_score`, `training_time`, `num_params`, `model_size_mb`, `weights_file`.

Веса сохраняются в `./results/weights/<model_type>/`.

### 7. Сделать predict

Сначала нужен успешный `/train` на этом сервисе.

```bash
curl -X POST http://localhost:8001/predict \
  -F "file=@./data/flowers_smoke/test/class_000/0000.jpg"
```

### 8. Остановить контейнеры

```bash
docker compose down
```

---

## API (кратко)

| Метод | Путь | Назначение |
|-------|------|------------|
| `POST` | `/train` | дообучение (backbone заморожен) |
| `POST` | `/predict` | прогноз по одному изображению |
| `GET` | `/health` | статус сервиса |

---

## Структура проекта

```
models_containers/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── entrypoint.sh
├── test_flowers.py
├── shared/models.py
└── app/
    ├── server.py
    ├── model.py
    ├── trainer.py
    └── dataset.py
```
