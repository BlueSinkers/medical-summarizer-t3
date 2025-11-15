"""
langchain_embeddings.py
LangChain embeddings wrapper and tool for MedCLIP image embeddings.

This module provides two interfaces:
1. MedCLIPEmbeddings: LangChain Embeddings interface for vectorstore integration
2. MedCLIPImageTool: LangChain BaseTool for agent-based workflows

The Embeddings interface is used with FAISS and other vectorstores.
The Tool interface is used with LangChain agents.
"""

from langchain.embeddings.base import Embeddings
from langchain_core.tools import BaseTool
from typing import List, Type
import numpy as np
from pydantic import BaseModel, Field

from medclip_model import MedCLIPWrapper
from preprocess import load_image, tile_image
import config


class MedCLIPEmbeddings(Embeddings):
    """
    LangChain Embeddings interface for MedCLIP.
    Implements embed_documents and embed_query for vectorstore compatibility.
    """
    
    def __init__(self, device=None, tile_threshold=1024):
        """
        Args:
            device: torch device (cpu/cuda). If None, uses config.DEVICE
            tile_threshold: images larger than this (max dimension) will be tiled
        """
        super().__init__()
        self.wrapper = MedCLIPWrapper(device=device)
        self.tile_threshold = tile_threshold
    
    def _image_to_embedding(self, image_path_or_file) -> List[float]:
        """
        Convert a single image to embedding.
        Handles tiling for large images.
        """
        pil = load_image(image_path_or_file)
        w, h = pil.size
        
        if max(w, h) > self.tile_threshold:
            # Tile large images
            tiles = tile_image(pil, tile_size=config.TILE_SIZE, stride=config.TILE_STRIDE)
            emb = self.wrapper.encode_image(tiles, aggregate="mean")
        else:
            # Single image encoding
            emb = self.wrapper.encode_image(pil)
        
        return emb.tolist()
    
    def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """
        Embed a list of documents (image paths).
        
        Args:
            documents: list of image paths (strings) or file-like objects
            
        Returns:
            list of embeddings (each embedding is a list of floats)
        """
        outs = []
        for d in documents:
            outs.append(self._image_to_embedding(d))
        return outs
    
    def embed_query(self, query: str) -> List[float]:
        """
        For a text query, return its text embedding for cross-modal retrieval.
        
        Args:
            query: text string to embed
            
        Returns:
            embedding as list of floats
        """
        te = self.wrapper.encode_text([query])[0]
        return te.tolist()


class MedCLIPToolInput(BaseModel):
    """Input schema for MedCLIP tool."""
    image_path: str = Field(..., description="Path to the input medical image")


class MedCLIPImageTool(BaseTool):
    """
    LangChain tool for extracting embeddings from medical images.
    Use this in agent-based workflows.
    """
    name: str = "medclip_image_embeddings"
    description: str = (
        "Extracts embeddings from a medical image using MedCLIP. "
        "Input should be a file path to a medical image (PNG, JPG, or DICOM). "
        "Returns a numerical embedding vector."
    )
    args_schema: Type[BaseModel] = MedCLIPToolInput
    
    def __init__(self, device=None):
        super().__init__()
        self.wrapper = MedCLIPWrapper(device=device)
    
    def _run(self, image_path: str) -> List[float]:
        """
        Synchronous execution of the tool.
        
        Args:
            image_path: path to medical image
            
        Returns:
            embedding as list of floats
        """
        return self.wrapper.get_image_embedding(image_path)
    
    async def _arun(self, image_path: str) -> List[float]:
        """
        Async execution (not implemented).
        """
        raise NotImplementedError("Async execution not implemented for MedCLIP tool.")