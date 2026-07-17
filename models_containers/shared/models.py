import json
import os
from datetime import datetime
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

TORCHVISION_WEIGHTS = {
    "resnet50": models.ResNet50_Weights.IMAGENET1K_V1,
    "vgg16": models.VGG16_Weights.IMAGENET1K_V1,
}

MODEL_SOURCES = {
    "resnet50": "torchvision",
    "vgg16": "torchvision",
    "vit_base_patch16_224": "timm",
}


class ModelLoader:
    def __init__(self, cache_dir: str = "./models_cache", model_name: Optional[str] = None):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_name = (model_name or os.getenv("MODEL_NAME", "resnet50")).lower()
        self.download_models = os.getenv("DOWNLOAD_MODELS", "True").lower() == "true"

        self.metadata_file = self.cache_dir / "models_metadata.json"
        self.metadata = self._load_metadata()
        self._validate_cache()

        if self.download_models:
            self._ensure_model_downloaded(self.model_name)

    def _validate_cache(self):
        if not self.metadata_file.exists():
            return

        corrupted = []
        for model_name, meta in self.metadata.get("models", {}).items():
            cache_path = Path(meta["path"])
            if not cache_path.exists() or cache_path.stat().st_size < 1024 * 1024:
                corrupted.append(model_name)

        if corrupted:
            for model_name in corrupted:
                self.metadata["models"].pop(model_name, None)
            self._save_metadata()

    def _load_metadata(self) -> dict:
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, "r", encoding="utf-8") as file:
                    return json.load(file)
            except (json.JSONDecodeError, OSError):
                pass
        return {"models": {}, "last_update": None}

    def _save_metadata(self):
        self.metadata["last_update"] = datetime.now().isoformat()
        with open(self.metadata_file, "w", encoding="utf-8") as file:
            json.dump(self.metadata, f, indent=2)

    def _ensure_model_downloaded(self, model_name: str):
        if self.is_model_cached(model_name):
            return

        try:
            model = self._load_from_source(model_name)
            self._save_to_cache(model, model_name)
            self.metadata["models"][model_name] = {
                "source": MODEL_SOURCES.get(model_name, "unknown"),
                "downloaded_at": datetime.now().isoformat(),
                "path": str(self.cache_dir / f"{model_name}.pth"),
                "size_mb": self._get_model_size(model_name),
            }
            self._save_metadata()
        except Exception as error:
            print(f"error downloading {model_name}: {error}")

    def _load_from_source(self, model_name: str) -> nn.Module:
        source = MODEL_SOURCES.get(model_name)
        if source == "torchvision":
            return self._load_torchvision(model_name)
        if source == "timm":
            return self._load_timm(model_name)
        raise ValueError(f"unknown model: {model_name}")

    def _load_torchvision(self, model_name: str) -> nn.Module:
        model_func = getattr(models, model_name)
        weights = TORCHVISION_WEIGHTS.get(model_name)
        return model_func(weights=weights) if weights else model_func(weights=None)

    def _load_timm(self, model_name: str) -> nn.Module:
        if timm is None:
            raise ImportError("timm is required for ViT models")
        return timm.create_model(model_name, pretrained=True)

    def _get_model_size(self, model_name: str) -> float:
        cache_path = self.cache_dir / f"{model_name}.pth"
        if cache_path.exists():
            return cache_path.stat().st_size / (1024 * 1024)
        return 0.0

    def is_model_cached(self, model_name: str) -> bool:
        cache_path = self.cache_dir / f"{model_name}.pth"
        info_path = self.cache_dir / f"{model_name}_info.json"
        return cache_path.exists() and info_path.exists()

    def get_cached_model_path(self, model_name: str) -> Path:
        return self.cache_dir / f"{model_name}.pth"

    def load_pretrained_model(self, model_name: str, num_classes: Optional[int] = None) -> nn.Module:
        model_name = model_name.lower()
        cache_path = self.cache_dir / f"{model_name}.pth"
        info_path = self.cache_dir / f"{model_name}_info.json"

        if cache_path.exists() and info_path.exists():
            model = self._load_from_cache(model_name, cache_path, info_path)
        else:
            model = self._load_from_source(model_name)
            self._save_to_cache(model, model_name)

        if num_classes is not None and num_classes != self._get_original_num_classes(model):
            model = self._adapt_classifier(model, num_classes)

        return model.to(self.device)

    def _load_from_cache(self, model_name: str, cache_path: Path, info_path: Path) -> nn.Module:
        try:
            with open(info_path, "r", encoding="utf-8") as file:
                info = json.load(file)

            if info["source"] == "torchvision":
                model = getattr(models, model_name)(weights=None)
            elif info["source"] == "timm":
                if timm is None:
                    raise ImportError("timm is required for ViT models")
                model = timm.create_model(model_name, pretrained=False)
            else:
                raise ValueError(f"unsupported source: {info['source']}")

            state_dict = torch.load(cache_path, map_location="cpu")
            model.load_state_dict(state_dict)
            return model
        except Exception:
            model = self._load_from_source(model_name)
            self._save_to_cache(model, model_name)
            return model

    def _save_to_cache(self, model: nn.Module, model_name: str):
        cache_path = self.cache_dir / f"{model_name}.pth"
        torch.save(model.state_dict(), cache_path)

        info_path = self.cache_dir / f"{model_name}_info.json"
        with open(info_path, "w", encoding="utf-8") as file:
            json.dump(
                {
                    "name": model_name,
                    "source": MODEL_SOURCES.get(model_name, "unknown"),
                    "num_params": sum(param.numel() for param in model.parameters()),
                    "architecture": type(model).__name__,
                    "cached_at": datetime.now().isoformat(),
                },
                f,
                indent=2,
            )

    def _get_original_num_classes(self, model: nn.Module) -> int:
        if hasattr(model, "fc") and hasattr(model.fc, "out_features"):
            return model.fc.out_features
        if hasattr(model, "classifier"):
            if isinstance(model.classifier, nn.Sequential):
                return model.classifier[-1].out_features
            return model.classifier.out_features
        if hasattr(model, "head") and hasattr(model.head, "out_features"):
            return model.head.out_features
        return 1000

    def _adapt_classifier(self, model: nn.Module, num_classes: int) -> nn.Module:
        for param in model.parameters():
            param.requires_grad = False

        if hasattr(model, "fc"):
            in_features = model.fc.in_features
            model.fc = nn.Sequential(
                nn.Dropout(0.3),
                nn.Linear(in_features, 512),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(512, num_classes),
            )
            for param in model.fc.parameters():
                param.requires_grad = True
        elif hasattr(model, "classifier"):
            if isinstance(model.classifier, nn.Sequential):
                in_features = model.classifier[-1].in_features
            else:
                in_features = model.classifier.in_features
            model.classifier = nn.Sequential(
                nn.Linear(in_features, 4096),
                nn.ReLU(True),
                nn.Dropout(0.5),
                nn.Linear(4096, 4096),
                nn.ReLU(True),
                nn.Dropout(0.5),
                nn.Linear(4096, num_classes),
            )
            for param in model.classifier.parameters():
                param.requires_grad = True
        elif hasattr(model, "head"):
            in_features = model.head.in_features
            model.head = nn.Linear(in_features, num_classes)
            for param in model.head.parameters():
                param.requires_grad = True

        return model

    def save_weights_npy(self, model: nn.Module, save_path: str, metadata: Optional[dict] = None):
        weights_dict = {name: param.cpu().numpy() for name, param in model.state_dict().items()}
        np.save(save_path, weights_dict)

        if metadata:
            meta_path = Path(save_path).with_suffix(".meta.json")
            with open(meta_path, "w", encoding="utf-8") as file:
                json.dump(metadata, f, indent=2)

        return save_path

    def load_weights_npy(self, model: nn.Module, weights_path: str):
        weights_dict = np.load(weights_path, allow_pickle=True).item()
        state_dict = {name: torch.from_numpy(weights) for name, weights in weights_dict.items()}
        model.load_state_dict(state_dict)
        return model

    def get_cache_info(self) -> dict:
        info = {
            "cache_dir": str(self.cache_dir),
            "total_models": len(self.metadata["models"]),
            "models": {},
            "total_size_mb": 0.0,
        }

        for model_name, meta in self.metadata["models"].items():
            size_mb = meta.get("size_mb", 0.0)
            info["models"][model_name] = {
                "path": meta["path"],
                "downloaded_at": meta["downloaded_at"],
                "size_mb": size_mb,
            }
            info["total_size_mb"] += size_mb

        return info
