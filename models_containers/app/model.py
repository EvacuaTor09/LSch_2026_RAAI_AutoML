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

    def freeze_backbone(self):
        for param in self.model.parameters():
            param.requires_grad = False

        if self.model_type == "resnet" and hasattr(self.model, "fc"):
            for param in self.model.fc.parameters():
                param.requires_grad = True
        elif self.model_type == "vgg" and hasattr(self.model, "classifier"):
            for param in self.model.classifier.parameters():
                param.requires_grad = True
        elif self.model_type == "vit" and hasattr(self.model, "head"):
            for param in self.model.head.parameters():
                param.requires_grad = True

    def count_parameters(self) -> dict:
        total = sum(param.numel() for param in self.model.parameters())
        trainable = sum(param.numel() for param in self.model.parameters() if param.requires_grad)
        return {"total": total, "trainable": trainable}

    def load_weights_npy(self, weights_path: str):
        return self.loader.load_weights_npy(self.model, weights_path)
