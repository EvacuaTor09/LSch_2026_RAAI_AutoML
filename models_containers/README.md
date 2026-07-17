# AutoML — контейнеры моделей

Три независимых Docker-контейнера для трансферного обучения и инференса моделей **ResNet-50**, **VGG-16** и **ViT-B/16** в рамках платформы AutoML (ЛШ РАИИ 2026).

Один общий образ и один набор исходников — сервисы отличаются только переменными окружения в `docker-compose.yml`. Файл `.env` не используется.

## Архитектура

```
                    ┌─────────────────┐
                    │  Оркестратор    │  (Go, не реализован)
                    │  (будущий)      │
                    └────────┬────────┘
                             │ HTTP
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │   resnet    │     │     vgg     │     │     vit     │
  │  :8001      │     │  :8002      │     │  :8003      │
  └─────────────┘     └─────────────┘     └─────────────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
              ./data  ./models_cache  ./results
```

Планируемые, но **не реализованные** в этом репозитории компоненты:
- **Оркестратор (Go)** — принимает zip-датасет, распаковывает в `data/`, параллельно вызывает `/train` у всех трёх контейнеров, собирает метрики.
- **Фронтенд** — загрузка архива и просмотр результатов сравнения моделей.

## Структура проекта

```
models_containers/
├── docker-compose.yml      # 3 сервиса из одного Dockerfile
├── Dockerfile
├── requirements.txt
├── entrypoint.sh
├── run.ps1
├── download_models.py
├── check_cache.py
├── models_cache/           # общий кеш предобученных весов
├── data/                   # датасеты (train/val/test), монтируется оркестратором
├── results/weights/        # дообученные веса (.npy) по моделям
├── shared/models.py        # загрузка ResNet / VGG / ViT
└── app/
    ├── server.py           # FastAPI: train / predict / health
    ├── model.py
    ├── trainer.py
    └── dataset.py
```

## Быстрый старт

```powershell
cd models_containers
.\run.ps1
```

Или вручную:

```powershell
docker compose up --build -d
```

Предзагрузка весов в кеш (опционально, на хосте):

```powershell
pip install -r requirements.txt
python download_models.py
python check_cache.py
```

## Сервисы

| Сервис   | Контейнер      | Порт | Модель                  |
|----------|----------------|------|-------------------------|
| `resnet` | `automl_resnet`| 8001 | `resnet50` (torchvision)|
| `vgg`    | `automl_vgg`   | 8002 | `vgg16` (torchvision)   |
| `vit`    | `automl_vit`   | 8003 | `vit_base_patch16_224` (timm) |

---

## Входы и выходы контейнеров моделей

Каждый контейнер предоставляет одинаковый HTTP API (FastAPI). Оркестратор обращается к сервисам по внутренним именам `resnet`, `vgg`, `vit` в сети `automl_net`, с хоста — по портам 8001–8003.

### Общие входы (окружение контейнера)

| Переменная          | Описание                                      |
|---------------------|-----------------------------------------------|
| `MODEL_NAME`        | Имя архитектуры (`resnet50`, `vgg16`, …)      |
| `MODEL_TYPE`        | Тип (`resnet`, `vgg`, `vit`)                  |
| `PORT`              | Порт HTTP-сервера                             |
| `WEIGHTS_DIR`       | Каталог для сохранения дообученных весов      |
| `MODELS_CACHE_DIR`  | Каталог кеша предобученных весов              |
| `DATA_DIR`          | Корень датасетов (`/app/data`)                |
| `DOWNLOAD_MODELS`   | Скачивать предобученные веса при старте       |

### Общие тома (volumes)

| Хост              | Контейнер           | Назначение                          |
|-------------------|---------------------|-------------------------------------|
| `./models_cache`  | `/app/models_cache` | Кеш ImageNet-весов (общий)          |
| `./results`       | `/app/results`      | Дообученные веса и метаданные       |
| `./data`          | `/app/data`         | Датасеты в формате папок по классам |

### Формат датасета (вход для обучения)

Оркестратор кладёт распакованный архив в `data/<task_id>/`:

```
data/<task_id>/
├── train/
│   ├── class_a/
│   │   └── *.jpg
│   └── class_b/
│       └── *.jpg
├── val/
│   ├── class_a/
│   └── class_b/
└── test/          # опционально
    ├── class_a/
    └── class_b/
```

Изображения приводятся к 224×224 (аугментация на train). Ядро модели замораживается, обучается только классификатор (трансферное обучение).

---

### `POST /train` — дообучение

**Вход (JSON):**

```json
{
  "task_id": "uuid-задачи",
  "dataset_path": "/app/data/uuid-задачи",
  "num_classes": 102,
  "epochs": 10,
  "learning_rate": 0.001,
  "batch_size": 32,
  "image_size": 224,
  "class_names": ["rose", "tulip"]
}
```

| Поле             | Обязательное | По умолчанию              | Описание |
|------------------|--------------|---------------------------|----------|
| `task_id`        | нет          | auto UUID                 | ID задачи |
| `dataset_path`   | нет*         | `/app/data/<task_id>`     | Путь к датасету |
| `num_classes`    | нет          | число папок в `train/`    | Число классов |
| `epochs`         | нет          | `10`                      | Число эпох |
| `learning_rate`  | нет          | `0.001`                   | Learning rate |
| `batch_size`     | нет          | `32`                      | Размер батча |
| `image_size`     | нет          | `224`                     | Размер входа |
| `class_names`    | нет          | из `ImageFolder`          | Имена классов |

\* Если `dataset_path` не передан, используется `DATA_DIR/task_id`.

**Выход (JSON):**

```json
{
  "status": "success",
  "task_id": "uuid-задачи",
  "model_name": "resnet50",
  "model_type": "resnet",
  "num_classes": 102,
  "class_names": ["rose", "tulip"],
  "accuracy": 0.91,
  "precision": 0.90,
  "recall": 0.89,
  "f1_score": 0.90,
  "training_time": 342.5,
  "epochs_trained": 8,
  "best_epoch": 6,
  "best_val_acc": 0.92,
  "num_params": 23508000,
  "trainable_params": 1048576,
  "model_size_mb": 97.5,
  "weights_file": "/app/results/weights/resnet/resnet50_uuid.npy",
  "history": {
    "train_loss": [],
    "val_loss": [],
    "val_acc": [],
    "val_f1": []
  },
  "metadata": { }
}
```

Файлы на диске:
- `results/weights/<model_type>/<model_name>_<task_id>.npy` — веса
- `results/weights/<model_type>/<model_name>_<task_id>.meta.json` — метаданные обучения

---

### `POST /predict` — инференс на одном изображении

**Вход:** `multipart/form-data`, поле `file` — изображение (JPEG/PNG).

**Выход (JSON):**

```json
{
  "model": "resnet50",
  "model_type": "resnet",
  "class_id": 3,
  "class_name": "rose",
  "confidence": 0.94,
  "probabilities": [0.01, 0.02, 0.03, 0.94]
}
```

---

### `GET /health` — проверка состояния

**Выход:**

```json
{
  "status": "healthy",
  "model": "resnet50",
  "model_type": "resnet",
  "model_loaded": true,
  "num_classes": 102,
  "class_names": ["rose", "tulip"],
  "weights_dir": "/app/results/weights/resnet",
  "data_dir": "/app/data"
}
```

---

### `GET /cache/info` — информация о кеше предобученных весов

**Выход:**

```json
{
  "cache_dir": "/app/models_cache",
  "total_models": 3,
  "total_size_mb": 512.4,
  "models": {
    "resnet50": {
      "path": "/app/models_cache/resnet50.pth",
      "downloaded_at": "2026-07-17T12:00:00",
      "size_mb": 97.5
    }
  }
}
```

---

### `GET /weights/{task_id}` — метаданные сохранённых весов

**Выход:**

```json
{
  "weights_file": "/app/results/weights/resnet/resnet50_uuid.npy",
  "task_id": "uuid",
  "model": "resnet50",
  "metadata": { }
}
```

---

### `POST /load_weights` — загрузка дообученных весов в память

**Вход (JSON):**

```json
{
  "weights_path": "/app/results/weights/resnet/resnet50_uuid.npy"
}
```

**Выход:**

```json
{
  "status": "success",
  "message": "weights loaded from ...",
  "model": "resnet50",
  "num_classes": 102,
  "class_names": ["rose", "tulip"]
}
```

---

## Примеры запросов (curl)

Проверка здоровья:

```bash
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
```

Запуск обучения (после размещения датасета в `data/my-task/`):

```bash
curl -X POST http://localhost:8001/train \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"my-task\", \"epochs\": 5, \"batch_size\": 16}"
```

Прогноз:

```bash
curl -X POST http://localhost:8001/predict -F "file=@image.jpg"
```

## Интеграция с оркестратором (план)

Оркестратор на Go должен:

1. Принять zip-архив от пользователя.
2. Распаковать в `data/<task_id>/` с подпапками `train/`, `val/`, `test/`.
3. Параллельно вызвать `POST /train` на `http://resnet:8001`, `http://vgg:8002`, `http://vit:8003`.
4. Собрать JSON-ответы (accuracy, f1, training_time, model_size_mb).
5. По запросу пользователя вызывать `POST /predict` на всех трёх сервисах и сравнивать прогнозы.

Все три контейнера подключены к сети `automl_net` и доступны друг другу по DNS-имени сервиса.

## Управление контейнерами

```powershell
.\run.ps1 -Action status
.\run.ps1 -Action logs -Service resnet
.\run.ps1 -Action down
```

## Зависимости

- PyTorch + torchvision — ResNet, VGG
- timm — Vision Transformer
- FastAPI + uvicorn — HTTP API
- scikit-learn — метрики (accuracy, precision, recall, F1)
