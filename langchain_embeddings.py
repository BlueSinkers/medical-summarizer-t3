"""
langchain_tool.py
LangChain embeddings wrapper for MedCLIP image embeddings.

This implements the minimal Embeddings interface expected by LangChain:
 - embed_documents(list[str]) -> list[list[float]]
 - embed_query(str) -> list[float]

We use embed_documents to accept a list of image paths (strings) for simplicity.
If you want to integrate image objects, adapt to pass preprocessed tiles directly.
"""

from langchain.embeddings.base import Embeddings
from typing import List
import numpy as np
from medclip_model import MedCLIPWrapper
from preprocess import load_image, tile_image
import config
from langchain.tools import BaseTool
from medclip_model import MedCLIPWrapper

from langchain_core.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
from medclip_model import MedCLIPWrapper


class MedCLIPInput(BaseModel):
    image_path: str = Field(..., description="Path to the input medical image")


class MedCLIPImageEmbeddings(BaseTool):
    name: str = "medclip_image_embeddings"
    description: str = "Extracts embeddings from a medical image using MedCLIP."
    args_schema: Type[BaseModel] = MedCLIPInput

    def __init__(self, device="cpu"):
        super().__init__()
        self.wrapper = MedCLIPWrapper(device=device)

    def _run(self, image_path: str):
        return self.wrapper.get_image_embedding(image_path)

    async def _arun(self, image_path: str):
        raise NotImplementedError("Async not implemented.")

    def _image_to_embedding(self, image_path_or_file) -> List[float]:
        pil = load_image(image_path_or_file)
        w,h = pil.size
        if max(w,h) > self.tile_threshold:
            tiles = tile_image(pil, tile_size=config.TILE_SIZE, stride=config.TILE_STRIDE)
            emb = self.wrapper.encode_image(tiles, aggregate="mean")
        else:
            emb = self.wrapper.encode_image(pil)
        return emb.tolist()

    def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """
        documents: list of image paths (strings) or file-like objects.
        Returns a list of float lists.
        """
        outs = []
        for d in documents:
            outs.append(self._image_to_embedding(d))
        return outs

    def embed_query(self, query: str) -> List[float]:
        """
        For a text query, we return its text embedding so you can do cross-modal retrieval.
        """
        te = self.wrapper.encode_text([query])[0]
        return te.tolist()
