"""
medclip_model.py
Loads MedCLIP (Hugging Face style) and exposes:
 - encode_image(pil_image or list of PIL tiles) -> numpy float32 vector
 - encode_text(list_of_texts) -> numpy float32 vectors
 - compute_similarity(image_emb, text_embs) -> cosine similarities

Notes:
 - If the model already returns image/text embeddings via get_image_features/get_text_features,
   we use those. Otherwise we call model(**inputs) and read 'img_embeds'/'text_embeds'.
 - We normalize embeddings (L2) to make cosine similarity be inner product.
"""

from typing import List, Union
from PIL import Image
import config
from preprocess import resize_and_center_crop, tile_image
import torch
from transformers import (
    CLIPModel,
    CLIPProcessor,
)
import numpy as np

class MedCLIPWrapper:
    def __init__(self, device=None):
        if device is None:
            device = config.DEVICE
        self.device = device
        
        # Use the model name from config
        self.model_name = config.MODEL_NAME
        
        print(f"Loading MedCLIP model: {self.model_name}...")
        try:
            # Try to load as MedCLIP first
            self.model = CLIPModel.from_pretrained(self.model_name).to(self.device)
            self.processor = CLIPProcessor.from_pretrained(self.model_name)
            print("✓ Model loaded successfully")
        except Exception as e:
            print(f"Error loading model: {e}")
            # Fallback to standard CLIP if MedCLIP fails
            fallback_model = "openai/clip-vit-base-patch16"
            print(f"Falling back to: {fallback_model}")
            self.model = CLIPModel.from_pretrained(fallback_model).to(self.device)
            self.processor = CLIPProcessor.from_pretrained(fallback_model)
        
        self.model.eval()

    def get_image_embedding(self, image_path: str) -> List[float]:
        """
        Convenience method for single image path input.
        Returns flattened embedding as list of floats.
        """
        pil = Image.open(image_path).convert("RGB")
        emb = self.encode_image(pil)
        return emb.tolist()

    def _prepare_image(self, pil: Image.Image):
        """Resize to target and return processor inputs."""
        pil_inp = resize_and_center_crop(pil, config.IMAGE_SIZE)
        inputs = self.processor(images=pil_inp, return_tensors="pt")
        # move tensors to device if present
        for k, v in inputs.items():
            if isinstance(v, torch.Tensor):
                inputs[k] = v.to(self.device)
        return inputs

    def encode_image(self, pil_or_tiles: Union[Image.Image, List[Image.Image]], aggregate: str = "mean") -> np.ndarray:
        """
        If input is a single PIL image -> preprocess and encode.
        If input is a list of tiles -> encode each tile and aggregate (mean by default).
        Returns L2-normalized numpy vector (float32).
        """
        single = False
        if isinstance(pil_or_tiles, Image.Image):
            tiles = [pil_or_tiles]
            single = True
        else:
            tiles = pil_or_tiles

        emb_list = []
        with torch.no_grad():
            for pil in tiles:
                inputs = self._prepare_image(pil)
                # Use get_image_features for CLIP models
                img_feats = self.model.get_image_features(**inputs)
                emb = img_feats.detach().cpu().numpy()
                
                if emb is None:
                    raise RuntimeError("Unable to obtain image embedding from model outputs.")
                emb = emb.reshape(-1)
                emb_list.append(emb)
        
        # aggregate
        mat = np.stack(emb_list, axis=0).astype(np.float32)
        if aggregate == "mean":
            agg = mat.mean(axis=0)
        elif aggregate == "max":
            agg = mat.max(axis=0)
        else:
            # simple average fallback
            agg = mat.mean(axis=0)
        
        # L2 normalize
        norm = np.linalg.norm(agg) + 1e-12
        return (agg / norm).astype(np.float32)

    def encode_text(self, texts: List[str]) -> np.ndarray:
        """
        Encode a list of texts. Returns (n_texts, dim) numpy array normalized.
        """
        inputs = self.processor(text=texts, return_tensors="pt", padding=True, truncation=True)
        for k, v in inputs.items():
            if isinstance(v, torch.Tensor):
                inputs[k] = v.to(self.device)
        
        with torch.no_grad():
            text_feats = self.model.get_text_features(**inputs)
            arr = text_feats.detach().cpu().numpy()
        
        # normalize
        norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
        return (arr / norms).astype(np.float32)
    
    def get_text_embedding(self, texts: Union[str, List[str]]) -> np.ndarray:
        """
        Convenience wrapper for encode_text.
        Accepts single string or list of strings.
        """
        if isinstance(texts, str):
            texts = [texts]
        return self.encode_text(texts)

    def similarity(self, image_emb: np.ndarray, text_embs: np.ndarray) -> np.ndarray:
        """
        Cosine similarity between one image embedding and multiple text embeddings.
        Both should be L2-normalized (function normalizes defensively).
        """
        # defensive normalize
        ie = image_emb / (np.linalg.norm(image_emb) + 1e-12)
        te = text_embs / (np.linalg.norm(text_embs, axis=1, keepdims=True) + 1e-12)
        return float(np.dot(ie, te.T)) if te.ndim == 1 else np.dot(te, ie).astype(float)