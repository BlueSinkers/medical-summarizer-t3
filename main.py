"""
main.py

CLI demo for similarity: given an input image, compute similarity between the image
and a set of predefined text labels. Prints the top text matches and scores.

Usage:
    python main.py --image <image_path>
Optional:
    --labels_file <path_to_text_file>  # one label per line
If no labels_file provided, a default set of labels is used.
"""

import argparse
from langchain_embeddings import MedCLIPEmbeddings
import numpy as np
import os
import sys

DEFAULT_LABELS = [
    "normal chest x-ray",
    "pneumonia",
    "cardiomegaly",
    "pleural effusion",
    "pulmonary edema",
    "atelectasis",
    "lung nodule or mass",
    "fracture",
]

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))

def load_labels(path: str):
    """Load labels from a text file (one per line)."""
    if not os.path.exists(path):
        print(f"Error: Labels file not found: {path}")
        sys.exit(1)
    
    with open(path, "r") as f:
        lines = [l.strip() for l in f if l.strip()]
    return lines

def demo():
    parser = argparse.ArgumentParser(description="MedCLIP image-text similarity demo")
    parser.add_argument("--image", type=str, required=True, help="Path to image (PNG/JPG/DICOM)")
    parser.add_argument("--labels_file", type=str, default=None, help="Optional labels file (one label per line)")
    args = parser.parse_args()
    
    # Check if image exists
    if not os.path.exists(args.image):
        print(f"Error: Image file not found: {args.image}")
        sys.exit(1)
    
    # Load labels
    labels = DEFAULT_LABELS if args.labels_file is None else load_labels(args.labels_file)
    print(f"Using {len(labels)} labels: {labels}\n")
    
    try:
        # Instantiate embeddings adapter (loads model)
        print("Loading MedCLIP model...")
        emb = MedCLIPEmbeddings()
        
        print(f"Computing image embedding for: {args.image}...")
        img_emb = np.array(emb.embed_documents([args.image])[0], dtype=np.float32)
        
        # Compute text embeddings for labels
        print("Computing text embeddings for labels...")
        text_embs = emb.wrapper.get_text_embedding(labels)  # (N, D)
        
        # Compute similarity scores
        scores = (text_embs @ img_emb)  # dot product works because everything is L2-normalized
        
        ranked_idx = np.argsort(-scores)  # descending
        
        print("\n" + "="*60)
        print("Top matches:")
        print("="*60)
        for i in ranked_idx[:10]:
            print(f"  {labels[i]:<30} — score: {float(scores[i]):.4f}")
        
        # Example of prompt construction (for future LLM stage)
        top_label = labels[ranked_idx[0]]
        top_score = float(scores[ranked_idx[0]])
        
        print("\n" + "="*60)
        print("Example VLM prompt (do not use without clinical oversight):")
        print("="*60)
        prompt = (
            f"Patient scan suggests: {top_label} (confidence: {top_score:.3f}).\n"
            "Provide a concise 2-4 line radiology-style impression and recommended next steps. "
            "Mark confidence level and recommend clinician verification."
        )
        print(prompt)
        
    except Exception as e:
        print(f"\nError during processing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    demo()