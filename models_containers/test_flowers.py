"""
Smoke-test of ResNet / VGG / ViT transfer learning on Oxford Flowers-102.

Uses torchvision.datasets.Flowers102, exports a small ImageFolder subset
(train/val/test), then trains each architecture for a few epochs.

Run inside Docker (from models_containers/):
    docker compose build
    docker compose run --rm --entrypoint python resnet /app/test_flowers.py
"""

from __future__ import annotations

import os
import shutil
import sys
import time
from pathlib import Path

import torch
from PIL import Image
from torchvision.datasets import Flowers102

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "app"))
sys.path.insert(0, str(ROOT / "shared"))

os.environ.setdefault("MODELS_CACHE_DIR", os.getenv("MODELS_CACHE_DIR", str(ROOT / "models_cache")))
os.environ.setdefault("DOWNLOAD_MODELS", "True")

from dataset import create_dataloaders  # noqa: E402
from model import ModelWrapper  # noqa: E402
from trainer import Trainer  # noqa: E402

MODELS = [
    ("resnet50", "resnet"),
    ("vgg16", "vgg"),
    ("vit_base_patch16_224", "vit"),
]

DATA_ROOT = ROOT / "data" / "flowers_smoke"
FLOWERS_RAW = ROOT / "data" / "flowers102_raw"
NUM_CLASSES = 5
MAX_PER_SPLIT = 8
EPOCHS = 2
BATCH_SIZE = 4
IMAGE_SIZE = 224


def _export_split(dataset: Flowers102, split_name: str, class_ids: list[int], max_per_class: int):
    """Write Flowers102 samples into ImageFolder layout: split/class_XXX/*.jpg"""
    counters = {cid: 0 for cid in class_ids}
    for image, label in dataset:
        if label not in counters:
            continue
        if counters[label] >= max_per_class:
            if all(counters[c] >= max_per_class for c in class_ids):
                break
            continue

        class_dir = DATA_ROOT / split_name / f"class_{label:03d}"
        class_dir.mkdir(parents=True, exist_ok=True)
        out = class_dir / f"{counters[label]:04d}.jpg"
        image.convert("RGB").save(out, quality=90)
        counters[label] += 1


def prepare_flowers_subset():
    """Download Flowers102 via torchvision and build a tiny ImageFolder dataset."""
    if (DATA_ROOT / "train").exists() and any((DATA_ROOT / "train").iterdir()):
        print(f"dataset already prepared: {DATA_ROOT}")
        return

    if DATA_ROOT.exists():
        shutil.rmtree(DATA_ROOT)
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    FLOWERS_RAW.mkdir(parents=True, exist_ok=True)

    print("downloading Oxford Flowers-102 (torchvision)...")
    train_ds = Flowers102(root=str(FLOWERS_RAW), split="train", download=True)
    val_ds = Flowers102(root=str(FLOWERS_RAW), split="val", download=True)
    test_ds = Flowers102(root=str(FLOWERS_RAW), split="test", download=True)

    class_ids = list(range(NUM_CLASSES))
    print(f"exporting subset: {NUM_CLASSES} classes, up to {MAX_PER_SPLIT} images per split")
    _export_split(train_ds, "train", class_ids, MAX_PER_SPLIT)
    _export_split(val_ds, "val", class_ids, MAX_PER_SPLIT)
    _export_split(test_ds, "test", class_ids, max(2, MAX_PER_SPLIT // 2))
    print(f"ready: {DATA_ROOT}")


def run_one_model(model_name: str, model_type: str) -> dict:
    print("\n" + "=" * 60)
    print(f"training {model_name} ({model_type})")
    print("=" * 60)

    train_loader, val_loader, test_loader, class_names = create_dataloaders(
        dataset_path=str(DATA_ROOT),
        batch_size=BATCH_SIZE,
        image_size=IMAGE_SIZE,
    )

    wrapper = ModelWrapper(
        model_name=model_name,
        model_type=model_type,
        num_classes=len(class_names),
    )
    params = wrapper.count_parameters()
    print(f"classes={len(class_names)} total_params={params['total']:,} trainable={params['trainable']:,}")

    trainer = Trainer(wrapper.get_model(), model_name)
    fit = trainer.fit(
        train_loader=train_loader,
        val_loader=val_loader,
        epochs=EPOCHS,
        lr=0.001,
        early_stopping_patience=EPOCHS,
    )
    metrics = trainer.evaluate(test_loader if test_loader is not None else val_loader)

    # single-image predict smoke check
    sample_path = next((DATA_ROOT / "test").rglob("*.jpg"))
    image = Image.open(sample_path).convert("RGB")
    from torchvision import transforms
    from dataset import IMAGENET_MEAN, IMAGENET_STD

    transform = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )
    model = wrapper.get_model()
    model.eval()
    with torch.no_grad():
        logits = model(transform(image).unsqueeze(0))
        pred = int(logits.argmax(dim=1).item())

    result = {
        "model_name": model_name,
        "model_type": model_type,
        "accuracy": metrics["accuracy"],
        "precision": metrics["precision"],
        "recall": metrics["recall"],
        "f1_score": metrics["f1_score"],
        "training_time": fit["training_time"],
        "epochs_trained": fit["epochs_trained"],
        "num_params": params["total"],
        "trainable_params": params["trainable"],
        "predict_class_id": pred,
        "sample": str(sample_path),
    }

    print(
        f"acc={result['accuracy']:.3f} f1={result['f1_score']:.3f} "
        f"time={result['training_time']:.1f}s predict_class={pred}"
    )
    return result


def main():
    prepare_flowers_subset()

    results = []
    started = time.time()
    for model_name, model_type in MODELS:
        results.append(run_one_model(model_name, model_type))

    print("\n" + "=" * 60)
    print("comparison (assignment metrics)")
    print("=" * 60)
    print(f"{'model':<28} {'acc':>7} {'f1':>7} {'time_s':>8} {'params':>12}")
    for row in results:
        print(
            f"{row['model_name']:<28} "
            f"{row['accuracy']:>7.3f} "
            f"{row['f1_score']:>7.3f} "
            f"{row['training_time']:>8.1f} "
            f"{row['num_params']:>12,}"
        )
    print(f"\ntotal wall time: {time.time() - started:.1f}s")
    print("ok: all three models trained and produced a prediction")


if __name__ == "__main__":
    main()
