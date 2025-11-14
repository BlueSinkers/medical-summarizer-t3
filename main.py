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
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))

def load_labels(path: str):
    with open(path, "r") as f:
        lines = [l.strip() for l in f if l.strip()]
    return lines

def demo():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=str, required=True, help="Path to image (PNG/JPG/DICOM)")
    parser.add_argument("--labels_file", type=str, default=None, help="Optional labels file (one label per line)")
    args = parser.parse_args()

    labels = DEFAULT_LABELS if args.labels_file is None else load_labels(args.labels_file)
    print(f"Using labels ({len(labels)}): {labels}")

    # instantiate embeddings adapter (loads model)
    emb = MedCLIPEmbeddings()
    print("Computing image embedding...")
    img_emb = np.array(emb.embed_documents([args.image])[0], dtype=np.float32)

    # compute text embeddings for labels
    print("Computing text embeddings for labels...")
    text_embs = np.array(emb.wrapper.get_text_embedding(labels), dtype=np.float32)  # (N, D)

    # compute similarity scores
    scores = (text_embs @ img_emb)  # dot product works because everything is L2-normalized
    # Defensive normalization (rare)
    # scores = np.array([cosine_similarity(img_emb, t) for t in text_embs])

    ranked_idx = np.argsort(-scores)  # descending
    print("\nTop matches:")
    for i in ranked_idx[:10]:
        print(f"  {labels[i]}  —  score: {float(scores[i]):.4f}")

    # Example of prompt construction (for future LLM stage)
    top_label = labels[ranked_idx[0]]
    prompt = (
        f"Patient scan suggests: {top_label} (score {float(scores[ranked_idx[0]]):.3f}).\n"
        "Provide a concise 2-4 line radiology-style impression and recommended next steps. "
        "Mark confidence and recommend clinician verification."
    )
    print("\nExample LLM prompt (do not run LLM without clinical oversight):\n")
    print(prompt)

if __name__ == "__main__":
    demo()
