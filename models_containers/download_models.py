import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent / "shared"))

from models import ModelLoader


def download_all_models():
    cache_dir = os.getenv("MODELS_CACHE_DIR", "./models_cache")
    Path(cache_dir).mkdir(parents=True, exist_ok=True)

    models = ["resnet50", "vgg16", "vit_base_patch16_224"]

    print("=" * 60)
    print("downloading pretrained models to cache")
    print(f"cache directory: {cache_dir}")
    print("=" * 60)

    for model_name in models:
        try:
            print(f"\ndownloading {model_name}...")
            loader = ModelLoader(cache_dir=cache_dir, model_name=model_name)
            model = loader.load_pretrained_model(model_name)

            cache_path = loader.get_cached_model_path(model_name)
            size_mb = cache_path.stat().st_size / (1024 * 1024)

            print(f"model {model_name} downloaded")
            print(f"  params: {sum(p.numel() for p in model.parameters()):,}")
            print(f"  size: {size_mb:.2f} mb")
            print(f"  saved: {cache_path}")

        except Exception as error:
            print(f"error downloading {model_name}: {error}")

    loader = ModelLoader(cache_dir=cache_dir)
    cache_info = loader.get_cache_info()
    print("\n" + "=" * 60)
    print("cache info:")
    print(f"  total models: {cache_info['total_models']}")
    print(f"  total size: {cache_info['total_size_mb']:.2f} mb")
    print(f"  directory: {cache_info['cache_dir']}")

    for model_name, info in cache_info["models"].items():
        print(f"    {model_name}: {info['size_mb']:.2f} mb")


if __name__ == "__main__":
    download_all_models()
