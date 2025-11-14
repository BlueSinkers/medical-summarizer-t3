"""
preprocess.py
Utilities to load and preprocess medical images for the MedCLIP vision encoder.

Functions:
 - load_image(path_or_file): read PIL image from PNG/JPG/DICOM/filelike
 - resize_and_center_crop(pil, target_size): make inputs consistent
 - tile_image(pil, tile_size, stride): split large images into tiles (patches)
 - tiles_to_aggregated_emb: utility explained in medclip_model (aggregation belongs there)
"""

from PIL import Image
import numpy as np
import pydicom
import io
from typing import List, Tuple

def load_image(path_or_file) -> Image.Image:
    """
    Accepts a path or file-like object. Handles .dcm via pydicom and standard images via PIL.
    Returns a PIL RGB image.
    """
    # Path string
    if isinstance(path_or_file, str):
        if path_or_file.lower().endswith(".dcm"):
            ds = pydicom.dcmread(path_or_file)
            arr = ds.pixel_array.astype(float)
            # Normalize to 0..255
            arr = arr - arr.min()
            if arr.max() != 0:
                arr = arr / arr.max()
            arr = (arr * 255).astype("uint8")
            img = Image.fromarray(arr).convert("L").convert("RGB")
            return img
        else:
            return Image.open(path_or_file).convert("RGB")
    # File-like object (e.g., Gradio tempfile or InMemory)
    if hasattr(path_or_file, "read"):
        raw = path_or_file.read()
        # attempt DICOM first
        try:
            ds = pydicom.dcmread(io.BytesIO(raw))
            arr = ds.pixel_array.astype(float)
            arr = arr - arr.min()
            if arr.max() != 0:
                arr = arr / arr.max()
            arr = (arr * 255).astype("uint8")
            img = Image.fromarray(arr).convert("L").convert("RGB")
            return img
        except Exception:
            return Image.open(io.BytesIO(raw)).convert("RGB")
    raise ValueError("Unsupported input for load_image")

def resize_and_center_crop(pil: Image.Image, target_size: Tuple[int,int]) -> Image.Image:
    """
    Resize while keeping aspect ratio (smallest side -> target shorter side),
    then center crop to exact target_size.
    """
    target_w, target_h = target_size
    w, h = pil.size
    # maintain aspect, scale so that min(w,h) == min(target_w,target_h)
    scale = max(target_w / w, target_h / h)
    new_w = int(scale * w + 0.5)
    new_h = int(scale * h + 0.5)
    pil_resized = pil.resize((new_w, new_h), Image.BILINEAR)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return pil_resized.crop((left, top, left + target_w, top + target_h))

def tile_image(pil: Image.Image, tile_size:int=224, stride:int=224) -> List[Image.Image]:
    """
    Tile a PIL image into tiles of tile_size with stride. Returns list of PIL tiles.
    Ensures coverage of edges by adding extra tiles if necessary.
    """
    w, h = pil.size
    tiles = []
    # iterate rows and cols
    y = 0
    while y <= h - tile_size:
        x = 0
        while x <= w - tile_size:
            tiles.append(pil.crop((x, y, x + tile_size, y + tile_size)))
            x += stride
        # right edge if leftover
        if (w - tile_size) % stride != 0 and (w - tile_size) > 0:
            tiles.append(pil.crop((w - tile_size, y, w, y + tile_size)))
        y += stride
    # bottom edge rows
    if (h - tile_size) % stride != 0 and (h - tile_size) > 0:
        y = h - tile_size
        x = 0
        while x <= w - tile_size:
            tiles.append(pil.crop((x, y, x + tile_size, y + tile_size)))
            x += stride
        if (w - tile_size) % stride != 0 and (w - tile_size) > 0:
            tiles.append(pil.crop((w - tile_size, h - tile_size, w, h)))
    # If image smaller than tile_size => pad/resize externally (caller should handle)
    return tiles
