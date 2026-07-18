from pathlib import Path

from torch.utils.data import DataLoader
from torchvision import datasets, transforms

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def build_transforms(image_size: int = 224):
    normalize = transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)

    train_transform = transforms.Compose(
        [
            transforms.Resize(int(image_size * 1.14)),
            transforms.RandomResizedCrop(image_size),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            normalize,
        ]
    )
    eval_transform = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            normalize,
        ]
    )
    return train_transform, eval_transform


def create_dataloaders(
    dataset_path: str,
    batch_size: int = 32,
    image_size: int = 224,
    num_workers: int = 0,
):
    """Expects ImageFolder layout: root/{train,val,test}/class_name/*.jpg"""
    root = Path(dataset_path)
    train_dir = root / "train"
    val_dir = root / "val"
    test_dir = root / "test"

    if not train_dir.is_dir():
        raise FileNotFoundError(f"train directory not found: {train_dir}")
    if not val_dir.is_dir():
        raise FileNotFoundError(f"val directory not found: {val_dir}")

    train_transform, eval_transform = build_transforms(image_size=image_size)

    train_ds = datasets.ImageFolder(str(train_dir), transform=train_transform)
    val_ds = datasets.ImageFolder(str(val_dir), transform=eval_transform)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=num_workers)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    test_loader = None
    if test_dir.is_dir():
        test_ds = datasets.ImageFolder(str(test_dir), transform=eval_transform)
        test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    return train_loader, val_loader, test_loader, train_ds.classes
