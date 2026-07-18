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
num_classes = 0
class_names: List[str] = []

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
    global model_wrapper, num_classes, class_names

    try:
        task_id = request_data.get("task_id", str(uuid.uuid4()))
        dataset_path = Path(request_data.get("dataset_path") or (DATA_DIR / task_id))
        if not dataset_path.exists():
            raise HTTPException(400, f"dataset_path not found: {dataset_path}")

        epochs = int(request_data.get("epochs", 10))
        learning_rate = float(request_data.get("learning_rate", 0.001))
        batch_size = int(request_data.get("batch_size", 32))
        image_size = int(request_data.get("image_size", 224))

        train_loader, val_loader, test_loader, detected_classes = create_dataloaders(
            dataset_path=str(dataset_path),
            batch_size=batch_size,
            image_size=image_size,
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
            "model_size_mb": round(model_wrapper.loader.model_size_mb(MODEL_NAME), 2),
            "weights_file": str(weights_path),
            "history": training_result["history"],
        }

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Single-image inference (assignment: predict with each model)."""
    if model_wrapper is None:
        raise HTTPException(400, "model is not trained yet; call POST /train first")

    try:
        model = model_wrapper.get_model()
        model.eval()

        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
        tensor = inference_transform(image).unsqueeze(0)

        with torch.no_grad():
            output = model(tensor)
            probs = torch.softmax(output, dim=1)[0]
            pred = int(output.argmax(dim=1).item())
            confidence = float(probs[pred].item())

        name = class_names[pred] if pred < len(class_names) else str(pred)
        return {
            "model": MODEL_NAME,
            "model_type": MODEL_TYPE,
            "class_id": pred,
            "class_name": name,
            "confidence": confidence,
            "probabilities": probs.tolist(),
        }

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
