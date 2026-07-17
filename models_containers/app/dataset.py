from pathlib import Path

from torch.utils.data import DataLoader
from torchvision import datasets, transforms


def build_transforms(image_size: int = 224, augment: bool = True):
    normalize = transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])

    if augment:
        train_transform = transforms.Compose(
            [
                transforms.Resize(int(image_size * 1.14)),
                transforms.RandomResizedCrop(image_size),
                transforms.RandomHorizontalFlip(),
                transforms.ToTensor(),
                normalize,
            ]
        )
    else:
        train_transform = transforms.Compose(
            [
                transforms.Resize(256),
                transforms.CenterCrop(image_size),
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
    root = Path(dataset_path)
    train_dir = root / "train"
    val_dir = root / "val"
    test_dir = root / "test"

    if not train_dir.exists():
        raise FileNotFoundError(f"train directory not found: {train_dir}")
    if not val_dir.exists():
        raise FileNotFoundError(f"val directory not found: {val_dir}")

    train_transform, eval_transform = build_transforms(image_size=image_size)

    train_dataset = datasets.ImageFolder(str(train_dir), transform=train_transform)
    val_dataset = datasets.ImageFolder(str(val_dir), transform=eval_transform)

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=False,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=False,
    )

    test_loader = None
    if test_dir.exists():
        test_dataset = datasets.ImageFolder(str(test_dir), transform=eval_transform)
        test_loader = DataLoader(
            test_dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=False,
        )

    class_names = train_dataset.classes
    return train_loader, val_loader, test_loader, class_names
