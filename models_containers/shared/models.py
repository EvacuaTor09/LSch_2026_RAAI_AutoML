import os
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models

try:
    import timm
except ImportError:
    timm = None

REGISTRY = {
    "resnet50": {"source": "torchvision", "weights": models.ResNet50_Weights.IMAGENET1K_V1},
    "vgg16": {"source": "torchvision", "weights": models.VGG16_Weights.IMAGENET1K_V1},
    "vit_base_patch16_224": {"source": "timm", "weights": None},
}


class ModelLoader:
    """Load pretrained ImageNet models, adapt classifier, cache weights."""

    def __init__(self, cache_dir: str = "./models_cache", model_name: Optional[str] = None):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_name = (model_name or os.getenv("MODEL_NAME", "resnet50")).lower()

        if os.getenv("DOWNLOAD_MODELS", "True").lower() == "true":
            self._ensure_cached(self.model_name)

    def _cache_path(self, model_name: str) -> Path:
        return self.cache_dir / f"{model_name}.pth"

    def is_model_cached(self, model_name: str) -> bool:
        return self._cache_path(model_name).exists()

    def get_cached_model_path(self, model_name: str) -> Path:
        return self._cache_path(model_name)

    def _ensure_cached(self, model_name: str):
        if self.is_model_cached(model_name):
            return
        model = self._create(model_name, pretrained=True)
        torch.save(model.state_dict(), self._cache_path(model_name))

    def _create(self, model_name: str, pretrained: bool) -> nn.Module:
        if model_name not in REGISTRY:
            raise ValueError(f"unknown model: {model_name}. supported: {list(REGISTRY)}")

        meta = REGISTRY[model_name]
        if meta["source"] == "torchvision":
            weights = meta["weights"] if pretrained else None
            return getattr(models, model_name)(weights=weights)

        if timm is None:
            raise ImportError("timm is required for ViT")
        return timm.create_model(model_name, pretrained=pretrained)

    def load_pretrained_model(self, model_name: str, num_classes: Optional[int] = None) -> nn.Module:
        model_name = model_name.lower()
        cache_path = self._cache_path(model_name)

        if cache_path.exists():
            model = self._create(model_name, pretrained=False)
            state = torch.load(cache_path, map_location="cpu")
            model.load_state_dict(state)
        else:
            model = self._create(model_name, pretrained=True)
            torch.save(model.state_dict(), cache_path)

        if num_classes is not None and num_classes != self._num_classes(model):
            model = self._adapt_classifier(model, num_classes)

        return model.to(self.device)

    def _num_classes(self, model: nn.Module) -> int:
        if hasattr(model, "fc") and hasattr(model.fc, "out_features"):
            return model.fc.out_features
        if hasattr(model, "classifier"):
            head = model.classifier[-1] if isinstance(model.classifier, nn.Sequential) else model.classifier
            return head.out_features
        if hasattr(model, "head") and hasattr(model.head, "out_features"):
            return model.head.out_features
        return 1000

    def _adapt_classifier(self, model: nn.Module, num_classes: int) -> nn.Module:
        """Freeze backbone and replace the classification head."""
        for param in model.parameters():
            param.requires_grad = False

        if hasattr(model, "fc"):
            model.fc = nn.Linear(model.fc.in_features, num_classes)
            for param in model.fc.parameters():
                param.requires_grad = True
        elif hasattr(model, "classifier"):
            if isinstance(model.classifier, nn.Sequential):
                in_features = model.classifier[-1].in_features
                model.classifier[-1] = nn.Linear(in_features, num_classes)
                for param in model.classifier[-1].parameters():
                    param.requires_grad = True
            else:
                model.classifier = nn.Linear(model.classifier.in_features, num_classes)
                for param in model.classifier.parameters():
                    param.requires_grad = True
        elif hasattr(model, "head"):
            model.head = nn.Linear(model.head.in_features, num_classes)
            for param in model.head.parameters():
                param.requires_grad = True
        else:
            raise ValueError("cannot adapt classifier: unknown architecture")

        return model

    def save_weights_npy(self, model: nn.Module, save_path: str, metadata: Optional[dict] = None):
        import json

        weights = {name: tensor.cpu().numpy() for name, tensor in model.state_dict().items()}
        np.save(save_path, weights)
        if metadata:
            meta_path = Path(save_path).with_suffix(".meta.json")
            with open(meta_path, "w", encoding="utf-8") as file:
                json.dump(metadata, file, indent=2)
        return save_path

    def load_weights_npy(self, model: nn.Module, weights_path: str) -> nn.Module:
        weights = np.load(weights_path, allow_pickle=True).item()
        state = {name: torch.from_numpy(array) for name, array in weights.items()}
        model.load_state_dict(state)
        return model

    def model_size_mb(self, model_name: str) -> float:
        path = self._cache_path(model_name)
        return path.stat().st_size / (1024 * 1024) if path.exists() else 0.0
