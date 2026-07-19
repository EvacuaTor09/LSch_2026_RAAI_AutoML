import json
import time
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score


class Trainer:
    def __init__(self, model: nn.Module, model_name: str, device: Optional[str] = None):
        self.model = model
        self.model_name = model_name
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        self.history = {"train_loss": [], "val_loss": [], "val_acc": [], "val_f1": []}
        self.best_val_acc = 0.0
        self.best_state_dict = None
        self.training_time = 0.0
        self.best_epoch = 0

    def train_epoch(self, train_loader, optimizer, criterion):
        self.model.train()
        total_loss = 0.0
        for data, target in train_loader:
            data, target = data.to(self.device), target.to(self.device)
            optimizer.zero_grad()
            loss = criterion(self.model(data), target)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        return total_loss / max(len(train_loader), 1)

    def validate(self, val_loader, criterion):
        self.model.eval()
        total_loss = 0.0
        preds, labels = [], []
        with torch.no_grad():
            for data, target in val_loader:
                data, target = data.to(self.device), target.to(self.device)
                output = self.model(data)
                total_loss += criterion(output, target).item()
                preds.extend(output.argmax(dim=1).cpu().numpy())
                labels.extend(target.cpu().numpy())
        return (
            total_loss / max(len(val_loader), 1),
            accuracy_score(labels, preds),
            f1_score(labels, preds, average="weighted", zero_division=0),
        )

    def fit(
        self,
        train_loader,
        val_loader,
        epochs: int = 10,
        lr: float = 0.001,
        weight_decay: float = 1e-4,
        early_stopping_patience: int = 5,
    ):
        trainable = [p for p in self.model.parameters() if p.requires_grad]
        optimizer = optim.Adam(trainable, lr=lr, weight_decay=weight_decay)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", patience=3, factor=0.5)
        criterion = nn.CrossEntropyLoss()

        start = time.time()
        patience = 0

        for epoch in range(1, epochs + 1):
            train_loss = self.train_epoch(train_loader, optimizer, criterion)
            val_loss, val_acc, val_f1 = self.validate(val_loader, criterion)
            scheduler.step(val_loss)

            self.history["train_loss"].append(train_loss)
            self.history["val_loss"].append(val_loss)
            self.history["val_acc"].append(val_acc)
            self.history["val_f1"].append(val_f1)

            if val_acc > self.best_val_acc:
                self.best_val_acc = val_acc
                self.best_epoch = epoch
                self.best_state_dict = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}
                patience = 0
            else:
                patience += 1
                if patience >= early_stopping_patience:
                    break

        self.training_time = time.time() - start
        if self.best_state_dict:
            self.model.load_state_dict(self.best_state_dict)

        return {
            "history": self.history,
            "best_val_acc": self.best_val_acc,
            "training_time": self.training_time,
            "epochs_trained": len(self.history["train_loss"]),
            "best_epoch": self.best_epoch,
        }

    def evaluate(self, loader):
        self.model.eval()
        preds, labels = [], []
        with torch.no_grad():
            for data, target in loader:
                data, target = data.to(self.device), target.to(self.device)
                output = self.model(data)
                preds.extend(output.argmax(dim=1).cpu().numpy())
                labels.extend(target.cpu().numpy())
        return {
            "accuracy": accuracy_score(labels, preds),
            "precision": precision_score(labels, preds, average="weighted", zero_division=0),
            "recall": recall_score(labels, preds, average="weighted", zero_division=0),
            "f1_score": f1_score(labels, preds, average="weighted", zero_division=0),
        }

    def save_weights_npy(self, save_path: str, metadata: Optional[dict] = None):
        weights = {name: p.cpu().numpy() for name, p in self.model.state_dict().items()}
        np.save(save_path, weights)
        if metadata:
            meta_path = str(save_path).replace(".npy", ".meta.json")
            with open(meta_path, "w", encoding="utf-8") as file:
                json.dump(metadata, file, indent=2)
        return save_path
