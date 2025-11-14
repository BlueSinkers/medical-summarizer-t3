"""
config.py
Central configuration for the MedCLIP integration.
Change MODEL_NAME if you want a different HF checkpoint.
"""
import os
import torch

# Public MedCLIP checkpoint (working)
MODEL_NAME = os.environ.get("MEDCLIP_MODEL", "uclnlp/medclip-vit-base-patch16")

# Image settings
IMAGE_SIZE = (224, 224)   # model input size
TILE_SIZE = 224
TILE_STRIDE = 224

# Device (auto-detect)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# FAISS / persistence (not used in minimal demo but kept for extension)
FAISS_INDEX_PATH = "faiss_index.bin"
