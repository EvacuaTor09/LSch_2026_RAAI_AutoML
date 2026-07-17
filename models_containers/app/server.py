import io
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

sys.path.append("/app/shared")

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
from torchvision import transforms

from dataset import create_dataloaders
from model import ModelWrapper
from trainer import Trainer

app = FastAPI(title="AutoML model service")

MODEL_NAME = os.getenv("MODEL_NAME", "resnet50")
MODEL_TYPE = os.getenv("MODEL_TYPE", "resnet")
WEIGHTS_DIR = Path(os.getenv("WEIGHTS_DIR", f"/app/results/weights/{MODEL_TYPE}"))
MODELS_CACHE_DIR = os.getenv("MODELS_CACHE_DIR", "/app/models_cache")
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))

WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

model_wrapper = None
num_classes = 1000
class_names: List[str] = []

inference_transform = transforms.Compose(
    [
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


def get_model_wrapper(new_num_classes: Optional[int] = None) -> ModelWrapper:
    global model_wrapper, num_classes
    target_classes = new_num_classes or num_classes
    if model_wrapper is None or model_wrapper.num_classes != target_classes:
        model_wrapper = ModelWrapper(
            model_name=MODEL_NAME,
            model_type=MODEL_TYPE,
            num_classes=target_classes,
        )
        num_classes = target_classes
    return model_wrapper


get_model_wrapper(1000).get_model().eval()


@app.post("/train")
async def train_model(request_data: dict):
    global model_wrapper, num_classes, class_names

    try:
        task_id = request_data.get("task_id", str(uuid.uuid4()))
        dataset_path = request_data.get("dataset_path")
        if not dataset_path:
            dataset_path = str(DATA_DIR / task_id)

        dataset_root = Path(dataset_path)
        if not dataset_root.exists():
            raise HTTPException(400, f"dataset_path not found: {dataset_path}")

        new_num_classes = request_data.get("num_classes")
        epochs = int(request_data.get("epochs", 10))
        learning_rate = float(request_data.get("learning_rate", 0.001))
        batch_size = int(request_data.get("batch_size", 32))
        image_size = int(request_data.get("image_size", 224))
        class_names = request_data.get("class_names", [])

        train_loader, val_loader, test_loader, detected_classes = create_dataloaders(
            dataset_path=str(dataset_root),
            batch_size=batch_size,
            image_size=image_size,
        )

        if not class_names:
            class_names = detected_classes

        if new_num_classes is None:
            new_num_classes = len(class_names)

        model_wrapper = ModelWrapper(
            model_name=MODEL_NAME,
            model_type=MODEL_TYPE,
            num_classes=new_num_classes,
        )
        model_wrapper.freeze_backbone()
        num_classes = new_num_classes

        trainer = Trainer(model_wrapper.get_model(), MODEL_NAME)
        training_result = trainer.fit(
            train_loader=train_loader,
            val_loader=val_loader,
            epochs=epochs,
            lr=learning_rate,
        )

        metrics = trainer.evaluate(val_loader)
        if test_loader is not None:
            metrics = trainer.evaluate(test_loader)

        weights_path = WEIGHTS_DIR / f"{MODEL_NAME}_{task_id}.npy"
        param_info = model_wrapper.count_parameters()
        metadata = {
            "task_id": task_id,
            "epochs": epochs,
            "learning_rate": learning_rate,
            "batch_size": batch_size,
            "image_size": image_size,
            "num_classes": new_num_classes,
            "class_names": class_names,
            "model_name": MODEL_NAME,
            "model_type": MODEL_TYPE,
            "dataset_path": str(dataset_root),
            "timestamp": datetime.now().isoformat(),
            "history": training_result["history"],
            "best_epoch": training_result["best_epoch"],
        }

        trainer.save_weights_npy(str(weights_path), metadata)

        cache_path = Path(MODELS_CACHE_DIR) / f"{MODEL_NAME}.pth"
        model_size_mb = cache_path.stat().st_size / (1024 * 1024) if cache_path.exists() else 0.0

        return {
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
            "model_size_mb": round(model_size_mb, 2),
            "weights_file": str(weights_path),
            "metadata": metadata,
            "history": training_result["history"],
        }

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        wrapper = get_model_wrapper()
        model = wrapper.get_model()
        model.eval()

        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        image_tensor = inference_transform(image).unsqueeze(0)

        with torch.no_grad():
            output = model(image_tensor)
            probs = torch.softmax(output, dim=1)
            pred = output.argmax(dim=1).item()
            confidence = probs[0][pred].item()

        class_name = class_names[pred] if class_names and pred < len(class_names) else str(pred)

        return {
            "model": MODEL_NAME,
            "model_type": MODEL_TYPE,
            "class_id": pred,
            "class_name": class_name,
            "confidence": confidence,
            "probabilities": probs[0].tolist(),
        }

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/health")
async def health():
    wrapper = get_model_wrapper()
    return {
        "status": "healthy",
        "model": MODEL_NAME,
        "model_type": MODEL_TYPE,
        "model_loaded": wrapper is not None,
        "num_classes": num_classes,
        "class_names": class_names,
        "weights_dir": str(WEIGHTS_DIR),
        "data_dir": str(DATA_DIR),
    }


@app.get("/cache/info")
async def cache_info():
    wrapper = get_model_wrapper()
    return wrapper.loader.get_cache_info()


@app.get("/weights/{task_id}")
async def get_weights(task_id: str):
    weight_files = list(WEIGHTS_DIR.glob(f"*{task_id}*.npy"))
    if not weight_files:
        raise HTTPException(404, f"weights for task {task_id} not found")

    meta_path = weight_files[0].with_suffix(".meta.json")
    metadata = {}
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as file:
            metadata = json.load(file)

    return JSONResponse(
        {
            "weights_file": str(weight_files[0]),
            "task_id": task_id,
            "model": MODEL_NAME,
            "metadata": metadata,
        }
    )


@app.post("/load_weights")
async def load_weights(request_data: dict):
    global model_wrapper, num_classes, class_names

    try:
        weights_path = request_data.get("weights_path")
        if not weights_path:
            raise HTTPException(400, "weights_path is required")

        weights_path = Path(weights_path)
        if not weights_path.exists():
            raise HTTPException(404, f"file {weights_path} not found")

        meta_path = weights_path.with_suffix(".meta.json")
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as file:
                metadata = json.load(file)
            num_classes = metadata.get("num_classes", num_classes)
            class_names = metadata.get("class_names", class_names)

        model_wrapper = ModelWrapper(
            model_name=MODEL_NAME,
            model_type=MODEL_TYPE,
            num_classes=num_classes,
        )
        model_wrapper.load_weights_npy(str(weights_path))
        model_wrapper.get_model().eval()

        return {
            "status": "success",
            "message": f"weights loaded from {weights_path}",
            "model": MODEL_NAME,
            "num_classes": num_classes,
            "class_names": class_names,
        }

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
