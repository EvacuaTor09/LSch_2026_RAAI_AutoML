import os
import sys
from typing import Optional

sys.path.append("/app/shared")

import torch.nn as nn

from models import ModelLoader


class ModelWrapper:
    def __init__(
        self,
        model_name: Optional[str] = None,
        model_type: Optional[str] = None,
        num_classes: int = 1000,
    ):
        self.model_name = (model_name or os.getenv("MODEL_NAME", "resnet50")).lower()
        self.model_type = (model_type or os.getenv("MODEL_TYPE", "resnet")).lower()
        self.num_classes = num_classes
        self.loader = ModelLoader(
            cache_dir=os.getenv("MODELS_CACHE_DIR", "/app/models_cache"),
            model_name=self.model_name,
        )
        self.model = self.loader.load_pretrained_model(self.model_name, num_classes=num_classes)

    def get_model(self) -> nn.Module:
        return self.model

    def count_parameters(self) -> dict:
        total = sum(p.numel() for p in self.model.parameters())
        trainable = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        return {"total": total, "trainable": trainable}

    def load_weights_npy(self, weights_path: str):
        return self.loader.load_weights_npy(self.model, weights_path)
