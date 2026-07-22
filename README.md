# LSch_2026_RAAI_AutoML

**AutoML-платформа для сравнения моделей трансферного обучения (Transfer Learning) на пользовательских датасетах.**  
Система позволяет загрузить датасет в виде архива изображений, автоматически инспектировать классы, выбрать модели (ResNet-50, VGG-16, ViT-B/16), запустить обучение в фоновом режиме и получить сравнение метрик (accuracy, precision, recall, F1, время обучения, размер модели) в удобной таблице.



## 📁 Структура проекта

```bash
.
├── backend/                 # Go-сервер (оркестратор)
│   ├── cmd/                 # Точки входа (main.go)
│   ├── internal/            # Внутренние пакеты (сервисы, хранилища, воркер)
│   │   ├── dataset/         # Работа с датасетами (инспекция, распаковка)
│   │   ├── task/            # Управление задачами (CRUD, очереди)
│   │   ├── worker/          # Фоновый воркер для запуска обучения
│   │   ├── storage/         # Файловое хранилище (чтение/запись датасетов и результатов)
│   │   └── models/          # Клиенты к сервисам моделей (HTTP)
│   ├── pkg/                 # Переиспользуемые утилиты
│   └── go.mod
│
├── frontend/                # React-приложение
│   ├── src/
│   │   ├── components/      # UI-компоненты (загрузка, выбор моделей, таблица результатов)
│   │   ├── api/             # Клиент для общения с бэкендом
│   │   └── App.js
│   └── package.json
│
├── model_services/          # Python-сервисы моделей (FastAPI)
│   ├── resnet/              # ResNet-50
│   │   ├── app.py
│   │   └── requirements.txt
│   ├── vgg/                 # VGG-16
│   │   ├── app.py
│   │   └── requirements.txt
│   └── vit/                 # ViT-B/16
│       ├── app.py
│       └── requirements.txt
│
├── storage/                 # Директория для данных (DATA_DIR)
│   ├── datasets/            # Загруженные и распакованные датасеты
│   └── results/             # Сохранённые метрики и графики обучения
│
├── docker-compose.yml       # Запуск всех сервисов (Go, Redis, PostgreSQL, Python-сервисы, React)
├── .env                     # Переменные окружения
└── README.md
```


## 🧩 Выполненный функционал

| Модуль | Функционал | Статус |
|--------|------------|--------|
| **Загрузка датасета** | Пользователь загружает ZIP-архив с изображениями, бэкенд распаковывает и инспектирует структуру классов | ✅ |
| **Инспекция датасета** | Автоматическое определение классов и предложение сплита (train/val/test) на основе количества изображений | ✅ |
| **Выбор моделей** | Интерфейс для выбора одной или нескольких моделей из списка: ResNet-50, VGG-16, ViT-B/16 | ✅ |
| **Создание задачи** | Формирование задачи с параметрами (сплит, число эпох) и сохранение в PostgreSQL | ✅ |
| **Постановка в очередь** | ID задачи помещается в Redis-очередь (LPUSH) | ✅ |
| **Фоновый воркер** | Демон, который забирает задачи из Redis (RPOP) и запускает обучение на выбранных моделях | ✅ |
| **Обучение моделей** | Каждая модель запускается как отдельный FastAPI-сервис с эндпоинтом `/train`, получает путь к датасету и возвращает метрики | ✅ |
| **Сохранение результатов** | Метрики записываются в PostgreSQL, артефакты (графики, веса) сохраняются в файловую систему | ✅ |
| **Отображение сравнения** | Пользователь видит таблицу со сравнением метрик всех моделей по задаче | ✅ |
| **REST API** | Полный набор эндпоинтов для интеграции (см. ниже) | ✅ |



## 🏗 Архитектура системы

Ниже представлена компонентная диаграмма, отражающая взаимодействие основных модулей:

![Архитектура](pics\Components_dia.drawio.png)



## 🔌 API Эндпоинты

Бэкенд (Go) предоставляет REST API (по умолчанию `http://localhost:8080`).

| Метод | Эндпоинт | Описание | Тело запроса (JSON) | Ответ |
|-------|----------|----------|---------------------|--------|
| **POST** | `/api/datasets/inspect` | Загрузка и инспекция датасета | `form-data` с файлом `archive` | `{ "classes": ["cat","dog"], "splits": {"train":60,"val":30,"test":10} }` |
| **POST** | `/api/tasks` | Создание новой задачи | `{ "dataset_id": "...", "models": ["resnet","vgg","vit"], "epochs": 10, "split": {...} }` | `{ "task_id": "uuid" }` |
| **GET** | `/api/tasks/{id}` | Получение статуса и результатов задачи | – | `{ "id": "...", "status": "pending/running/completed/failed", "results": { "resnet": {...}, ... } }` |
| **POST** | `/api/worker/run-once` | Принудительный запуск воркера (для тестов) | – | `{ "status": "ok" }` |
| **GET** | `/api/health` | Проверка работоспособности | – | `{ "status": "ok" }` |

> **Важно:** воркер запускается автоматически как отдельный процесс. Эндпоинт `/api/worker/run-once` полезен для отладки.



## 🚀 Запуск проекта

### Требования
- Docker & Docker Compose
- Go 1.22+ (для локальной разработки)
- Python 3.10+ (для model services)
- Node.js 18+ (для фронтенда)

### С помощью Docker Compose (рекомендуемый способ)

1. Клонируйте репозиторий и переключитесь на ветку `lazya`:
```bash
git clone https://github.com/EvacuaTor09/LSch_2026_RAAI_AutoML.git
cd LSch_2026_RAAI_AutoML
git checkout lazya
```

2. Создайте файл `.env` (пример):
```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=secret
POSTGRES_DB=automl
REDIS_URL=redis://redis:6379
DATA_DIR=/app/storage
MODEL_SERVICES_URLS=resnet:8001,vgg:8002,vit:8003
```

3. Запустите все сервисы:
```bash
docker-compose up --build
```

После запуска:
- Frontend доступен по адресу `http://localhost:3000`
- Backend API — `http://localhost:8080`
- Redis — `localhost:6379`
- PostgreSQL — `localhost:5432`
- Model Services — `http://localhost:8001`, `8002`, `8003`

### Локальная разработка (без Docker)

Запускайте каждый компонент отдельно в соответствии с инструкциями в соответствующих папках (`backend/`, `frontend/`, `model_services/`).



## 📊 Пример использования

1. Откройте интерфейс фронтенда.
2. Загрузите ZIP-архив с датасетом (структура: `train/class1/*.jpg`, `train/class2/*.jpg`, ...).
3. Дождитесь инспекции — система покажет список классов и предложит сплит.
4. Выберите модели (например, ResNet-50 и ViT-B/16), задайте число эпох.
5. Нажмите «Запустить обучение».
6. Наблюдайте за статусом задачи; после завершения увидите сравнительную таблицу метрик.



## 🛠 Технологический стек

| Компонент | Технологии |
|-----------|------------|
| **Frontend** | React, Axios, Chart.js |
| **Backend** | Go (Gin, GORM), PostgreSQL, Redis (go-redis) |
| **Model Services** | Python, FastAPI, PyTorch, torchvision, transformers |
| **Оркестрация** | Docker, Docker Compose |
| **Базы данных** | PostgreSQL (метаданные задач), Redis (очередь) |
| **Хранилище** | Файловая система (артефакты, датасеты) |


## 📝 Дальнейшие планы

- Добавление новых моделей (EfficientNet, DenseNet).
- Поддержка мульти-GPU и распределённого обучения.
- Аутентификация и управление пользователями.
- Экспорт результатов в PDF/CSV.



## 🤝 Вклад

Предложения и pull request’ы приветствуются. Для серьёзных изменений сначала откройте issue для обсуждения.



## Список литературы 

1. Gurnani A. et al. Flower categorization using deep convolutional neural networks. arXiv //arXiv preprint arXiv:1708.03763. – 2017.

2. He K. et al. Deep residual learning for image recognition //Proceedings of the IEEE conference on computer vision and pattern recognition. – 2016. – С. 770-778.

3. Simonyan K., Zisserman A. Very deep convolutional networks for large-scale image recognition //arXiv preprint arXiv:1409.1556. – 2014.

4. Dosovitskiy A. et al. An image is worth 16x16 words: Transformers for image recognition at scale //arXiv preprint arXiv:2010.11929. – 2020.

5. Kaya A., Bilik I., Stainvas I. A Comparative Study of Vision Transformers and CNNs for Few-Shot Rigid Transformation and Fundamental Matrix Estimation //arXiv preprint arXiv:2510.04794. – 2025.