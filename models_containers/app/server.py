import io
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

sys.path.append("/app/shared")

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from torchvision import transforms

from dataset import IMAGENET_MEAN, IMAGENET_STD, create_dataloaders
from model import ModelWrapper
from trainer import Trainer

app = FastAPI(title="AutoML model service")

MODEL_NAME = os.getenv("MODEL_NAME", "resnet50")
MODEL_TYPE = os.getenv("MODEL_TYPE", "resnet")
WEIGHTS_DIR = Path(os.getenv("WEIGHTS_DIR", f"/app/results/weights/{MODEL_TYPE}"))
MODELS_CACHE_DIR = os.getenv("MODELS_CACHE_DIR", "/app/models_cache")
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))

WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

model_wrapper: Optional[ModelWrapper] = None
pretrained_wrapper: Optional[ModelWrapper] = None
num_classes = 0
class_names: List[str] = []
last_train_result: Optional[dict] = None
_imagenet_names: Optional[List[str]] = None


def imagenet_class_names() -> List[str]:
    global _imagenet_names
    if _imagenet_names is not None:
        return _imagenet_names

    from models import REGISTRY
    import torchvision.models as tv_models

    meta = REGISTRY.get(MODEL_NAME, {})
    weights = meta.get("weights")
    if weights is not None and hasattr(weights, "meta"):
        categories = weights.meta.get("categories") or []
        if categories:
            _imagenet_names = list(categories)
            return _imagenet_names
    _imagenet_names = list(tv_models.ResNet50_Weights.IMAGENET1K_V1.meta["categories"])
    return _imagenet_names


def ensure_model_wrapper_for_predict() -> ModelWrapper:
    global model_wrapper, num_classes, class_names
    if model_wrapper is None:
        model_wrapper = ModelWrapper(model_name=MODEL_NAME, model_type=MODEL_TYPE, num_classes=1000)
        num_classes = 1000
        class_names = imagenet_class_names()
    return model_wrapper


def ensure_pretrained_wrapper() -> ModelWrapper:
    global pretrained_wrapper
    if pretrained_wrapper is None:
        pretrained_wrapper = ModelWrapper(model_name=MODEL_NAME, model_type=MODEL_TYPE, num_classes=1000)
    return pretrained_wrapper


def train_result_for_client(result: dict) -> dict:
    """Metrics/params to return to the user (without weights file path)."""
    return {
        "status": result.get("status"),
        "task_id": result.get("task_id"),
        "model_name": result.get("model_name"),
        "model_type": result.get("model_type"),
        "num_classes": result.get("num_classes"),
        "class_names": result.get("class_names"),
        "accuracy": result.get("accuracy"),
        "precision": result.get("precision"),
        "recall": result.get("recall"),
        "f1_score": result.get("f1_score"),
        "training_time": result.get("training_time"),
        "epochs_trained": result.get("epochs_trained"),
        "best_epoch": result.get("best_epoch"),
        "best_val_acc": result.get("best_val_acc"),
        "num_params": result.get("num_params"),
        "trainable_params": result.get("trainable_params"),
        "model_size_mb": result.get("model_size_mb"),
        "history": result.get("history"),
    }


def build_top_predictions(probs: torch.Tensor, names: List[str], k: int = 5) -> List[dict]:
    top_k = min(k, int(probs.numel()))
    values, indices = torch.topk(probs, k=top_k)
    predictions = []
    for score, idx in zip(values.tolist(), indices.tolist()):
        class_id = int(idx)
        class_name = names[class_id] if names and class_id < len(names) else str(class_id)
        predictions.append(
            {
                "class_id": class_id,
                "class_name": class_name,
                "confidence": float(score),
            }
        )
    return predictions


def build_predict_response(
    *,
    wrapper: ModelWrapper,
    pred: int,
    confidence: float,
    probs: torch.Tensor,
    names: List[str],
    include_train_metrics: bool,
) -> dict:
    name = names[pred] if names and pred < len(names) else str(pred)
    param_info = wrapper.count_parameters()
    response = {
        "status": "success",
        "model": MODEL_NAME,
        "model_name": MODEL_NAME,
        "model_type": MODEL_TYPE,
        "class_id": pred,
        "class_name": name,
        "confidence": confidence,
        "num_classes": len(names) if names else int(probs.numel()),
        "num_params": param_info["total"],
        "trainable_params": param_info["trainable"],
        "model_size_mb": round(wrapper.loader.model_size_mb(MODEL_NAME), 2),
        "top_predictions": build_top_predictions(probs, names),
    }
    if include_train_metrics and last_train_result is not None:
        response = {**train_result_for_client(last_train_result), **response}
    return response

inference_transform = transforms.Compose(
    [
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ]
)


@app.post("/train")
async def train_model(request_data: dict):
    """Transfer learning: freeze backbone, train classifier on ImageFolder dataset."""
    global model_wrapper, num_classes, class_names, last_train_result

    try:
        task_id = request_data.get("task_id", str(uuid.uuid4()))
        dataset_path = Path(request_data.get("dataset_path") or (DATA_DIR / task_id))
        if not dataset_path.exists():
            raise HTTPException(400, f"dataset_path not found: {dataset_path}")

        epochs = int(request_data.get("epochs", 10))
        learning_rate = float(request_data.get("learning_rate", 0.001))
        batch_size = int(request_data.get("batch_size", 32))
        image_size = int(request_data.get("image_size", 224))
        print(
            f"[server:{MODEL_NAME}] train start task_id={task_id} dataset_path={dataset_path} "
            f"epochs={epochs} batch_size={batch_size} image_size={image_size}",
            flush=True,
        )

        train_loader, val_loader, test_loader, detected_classes = create_dataloaders(
            dataset_path=str(dataset_path),
            batch_size=batch_size,
            image_size=image_size,
        )
        print(
            f"[server:{MODEL_NAME}] dataloaders ready: "
            f"train_batches={len(train_loader)} val_batches={len(val_loader)} "
            f"test_batches={(len(test_loader) if test_loader is not None else 0)} "
            f"detected_classes={len(detected_classes)}",
            flush=True,
        )

        class_names = request_data.get("class_names") or detected_classes
        new_num_classes = int(request_data.get("num_classes") or len(class_names))

        model_wrapper = ModelWrapper(
            model_name=MODEL_NAME,
            model_type=MODEL_TYPE,
            num_classes=new_num_classes,
        )
        num_classes = new_num_classes

        trainer = Trainer(model_wrapper.get_model(), MODEL_NAME)
        training_result = trainer.fit(
            train_loader=train_loader,
            val_loader=val_loader,
            epochs=epochs,
            lr=learning_rate,
        )

        eval_loader = test_loader if test_loader is not None else val_loader
        metrics = trainer.evaluate(eval_loader)

        weights_path = WEIGHTS_DIR / f"{MODEL_NAME}_{task_id}.npy"
        param_info = model_wrapper.count_parameters()
        metadata = {
            "task_id": task_id,
            "model_name": MODEL_NAME,
            "model_type": MODEL_TYPE,
            "num_classes": new_num_classes,
            "class_names": class_names,
            "epochs": epochs,
            "learning_rate": learning_rate,
            "batch_size": batch_size,
            "image_size": image_size,
            "dataset_path": str(dataset_path),
            "timestamp": datetime.now().isoformat(),
            "best_epoch": training_result["best_epoch"],
            "history": training_result["history"],
        }
        trainer.save_weights_npy(str(weights_path), metadata)
        print(
            f"[server:{MODEL_NAME}] train done task_id={task_id} "
            f"acc={metrics['accuracy']:.4f} best_epoch={training_result['best_epoch']}",
            flush=True,
        )

        last_train_result = {
            "status": "success",
            "task_id": task_id,
            "model_name": MODEL_NAME,
            "model_type": MODEL_TYPE,
            "num_classes": new_num_classes,
            "class_names": class_names,
            "accuracy": metrics["accuracy"],
            "precision": metrics["precision"],
            "recall": metrics["recall"],
            "f1_score": metrics["f1_score"],
            "training_time": training_result["training_time"],
            "epochs_trained": training_result["epochs_trained"],
            "best_epoch": training_result["best_epoch"],
            "best_val_acc": training_result["best_val_acc"],
            "num_params": param_info["total"],
            "trainable_params": param_info["trainable"],
            "model_size_mb": round(model_wrapper.loader.model_size_mb(MODEL_NAME), 2),
            "weights_file": str(weights_path),
            "history": training_result["history"],
        }
        return last_train_result

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/predict")
async def predict(file: UploadFile = File(...), pretrained: bool = False):
    """Single-image inference with labeled params and top-5 classes (not raw probability vector)."""
    if pretrained:
        wrapper = ensure_pretrained_wrapper()
        names = imagenet_class_names()
        include_train_metrics = False
    else:
        wrapper = ensure_model_wrapper_for_predict()
        names = class_names if class_names else imagenet_class_names()
        include_train_metrics = True

    try:
        model = wrapper.get_model()
        model.eval()

        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
        tensor = inference_transform(image).unsqueeze(0)

        with torch.no_grad():
            output = model(tensor)
            probs = torch.softmax(output, dim=1)[0]
            pred = int(output.argmax(dim=1).item())
            confidence = float(probs[pred].item())

        return build_predict_response(
            wrapper=wrapper,
            pred=pred,
            confidence=confidence,
            probs=probs,
            names=names,
            include_train_metrics=include_train_metrics,
        )

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model": MODEL_NAME,
        "model_type": MODEL_TYPE,
        "model_loaded": model_wrapper is not None,
        "num_classes": num_classes,
        "class_names": class_names,
        "weights_dir": str(WEIGHTS_DIR),
        "data_dir": str(DATA_DIR),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
