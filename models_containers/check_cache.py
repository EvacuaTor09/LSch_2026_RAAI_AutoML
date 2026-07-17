import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent / "shared"))

from models import ModelLoader


def check_cache():
    cache_dir = os.getenv("MODELS_CACHE_DIR", "./models_cache")

    if not Path(cache_dir).exists():
        print("cache directory does not exist")
        print("create it: mkdir models_cache")
        print("or download models: python download_models.py")
        return

    loader = ModelLoader(cache_dir=cache_dir)

    print("=" * 60)
    print("models cache status")
    print(f"directory: {cache_dir}")
    print("=" * 60)

    cache_info = loader.get_cache_info()

    print(f"\ntotal models: {cache_info['total_models']}")
    print(f"total size: {cache_info['total_size_mb']:.2f} mb")

    if cache_info["models"]:
        print("\nmodels in cache:")
        for model_name, info in cache_info["models"].items():
            status = "ok" if Path(info["path"]).exists() else "missing"
            print(f"  {model_name}:")
            print(f"    size: {info['size_mb']:.2f} mb")
            print(f"    status: {status}")
            print(f"    path: {info['path']}")
    else:
        print("\ncache is empty")
        print("download models: python download_models.py")


if __name__ == "__main__":
    check_cache()
