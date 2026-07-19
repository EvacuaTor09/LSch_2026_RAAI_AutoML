# LSch_2026_RAAI_AutoML
AutoML project for summer school from RAAI.

## Stack

- Go backend that stores tasks in Postgres and queues them in Redis
- worker process that consumes tasks, picks a free model replica, and stores the best result
- React frontend for model selection, ZIP upload, and split editing
- 3 replicas for each model family: ResNet-50, VGG-16, and ViT-B/16

## Run the whole stack

```bash
docker compose up --build
```

Services:

- frontend: http://localhost:5173
- backend: http://localhost:8080
- postgres: localhost:5432
- redis: localhost:6379

The worker picks tasks from Redis, sends each selected model to a free replica, waits for all results, and stores the best one by test accuracy.

## Current structure

- `backend/` - Go API, task queue, dataset split preparation, worker orchestration
- `frontend/` - React UI for model selection, archive upload, and split editing
- `models_containers/` - existing model services for ResNet, VGG, and ViT

## Workflow

1. The user uploads a ZIP archive where each subfolder is a class.
2. The frontend lets the user choose the models and edit the 60/30/10 split or per-class overrides.
3. The backend stores the task, prepares the dataset split, and enqueues the task.
4. Workers pick a free replica for each selected model, run training, and store the best result by accuracy.
5. The frontend polls task status and shows the best model plus its parameters.


## Список литературы

1.  Nilsback, M-E. and Zisserman, A. “Automated flower
classification over a large number of classes”. Proceedings of the
Indian Conference on Computer Vision, Graphics and Image
Processing – 2008.

2. He K. et al. Deep residual learning for image recognition //Proceedings of the IEEE conference on computer vision and pattern recognition. – 2016. – С. 770-778.

3. Simonyan K., Zisserman A. Very deep convolutional networks for large-scale image recognition //arXiv preprint arXiv:1409.1556. – 2014.

4. Dosovitskiy A. et al. An image is worth 16x16 words: Transformers for image recognition at scale //arXiv preprint arXiv:2010.11929. – 2020.

5. Kaya A., Bilik I., Stainvas I. A Comparative Study of Vision Transformers and CNNs for Few-Shot Rigid Transformation and Fundamental Matrix Estimation //arXiv preprint arXiv:2510.04794. – 2025.