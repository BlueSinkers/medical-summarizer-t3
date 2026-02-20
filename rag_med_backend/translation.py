# translation.py
import os
from typing import List, Dict
from functools import lru_cache

from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Default model can be overridden with env var if you want a different NLLB variant
TRANSLATION_MODEL = os.getenv("TRANSLATION_MODEL", "facebook/nllb-200-distilled-600M")

# Map simple language tags to NLLB language codes.
# Extend this as needed.
NLLB_LANG_CODES: Dict[str, str] = {
    "en": "eng_Latn",
    "es": "spa_Latn",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "pt": "por_Latn",
    "it": "ita_Latn",
    "zh": "zho_Hans",
    "ar": "arb_Arab",
    # add more as needed
}


@lru_cache(maxsize=1)
def _load_model_and_tokenizer():
    """
    Lazy-load the NLLB model and tokenizer once per process.
    """
    tokenizer = AutoTokenizer.from_pretrained(TRANSLATION_MODEL)
    model = AutoModelForSeq2SeqLM.from_pretrained(TRANSLATION_MODEL)
    return tokenizer, model


def _resolve_lang_code(code: str) -> str:
    """
    Accept both simple codes ('en', 'es') and raw NLLB codes ('eng_Latn').
    """
    code = (code or "").strip()
    if not code:
        raise ValueError("Language code cannot be empty.")
    # If user passes an NLLB code directly, just use it.
    if "_" in code:
        return code
    # Else map 'en' -> 'eng_Latn', etc.
    if code in NLLB_LANG_CODES:
        return NLLB_LANG_CODES[code]
    raise ValueError(f"Unsupported language code: {code}")


def translate_texts(
    texts: List[str],
    source_lang: str = "en",
    target_lang: str = "es",
    max_new_tokens: int = 1024,
) -> List[str]:

    if not texts:
        return []

    tokenizer, model = _load_model_and_tokenizer()

    src_code = _resolve_lang_code(source_lang)
    tgt_code = _resolve_lang_code(target_lang)

    # Set tokenizer source language
    tokenizer.src_lang = src_code
    
    # Prepare all segments to be translated
    # We will flatten all texts into a list of lines, keeping track of where they belong
    all_segments = []
    text_structure = []  # List of (num_lines, list_of_empty_indices) or similar

    for text in texts:
        lines = text.split('\n')
        structure = []
        for i, line in enumerate(lines):
            if line.strip():
                all_segments.append(line)
                structure.append(True) # True means "this slot takes a translated segment"
            else:
                structure.append(False) # False means "keep original empty line"
        text_structure.append((lines, structure))

    if not all_segments:
        # If there's nothing to translate (all empty lines), just return originals
        return texts

    # Batch translate segments
    # Note: If all_segments is very large, we might want to chunk it, 
    # but for now we rely on the caller not sending massive batches.
    encoded = tokenizer(
        all_segments,
        return_tensors="pt",
        padding=True,
        truncation=True,
    )

    # 🔥 FIX: Fast tokenizer does NOT have lang_code_to_id
    forced_bos_token_id = tokenizer.convert_tokens_to_ids(tgt_code)

    generated_tokens = model.generate(
        **encoded,
        forced_bos_token_id=forced_bos_token_id,
        max_new_tokens=max_new_tokens,
    )

    translated_segments = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)
    translated_segments = [o.strip() for o in translated_segments]

    # Reconstruct texts
    final_outputs = []
    seg_idx = 0
    
    for original_lines, structure in text_structure:
        new_lines = []
        for i, is_translated in enumerate(structure):
            if is_translated:
                # Post-process the translated segment
                orig_line = original_lines[i]
                trans_line = translated_segments[seg_idx]
                
                # 1. Restore headers if lost (e.g. "### SUMMARY" -> "RESUMEN" => "### RESUMEN")
                if orig_line.strip().startswith("###") and not trans_line.strip().startswith("###"):
                    # Try to find the text part
                    # If original was "### SUMMARY", and translated is "RESUMEN", make it "### RESUMEN"
                    # If original was "### RISKS", and translated is "### RIESGOS", it's fine.
                    # We just prepend ### if missing.
                    trans_line = "### " + trans_line.lstrip("#").strip()
                
                # 2. Ensure header capitalization (e.g. "### resumen" -> "### RESUMEN")
                if trans_line.strip().startswith("###"):
                    trans_line = trans_line.upper()

                # 3. Preserve bullet points (e.g. "- something" -> "algo" => "- algo")
                if orig_line.strip().startswith("-") and not trans_line.strip().startswith("-"):
                    trans_line = "- " + trans_line.strip()
                
                new_lines.append(trans_line)
                seg_idx += 1
            else:
                # Keep the original empty line (or whitespace-only line)
                new_lines.append(original_lines[i])
        final_outputs.append("\n".join(new_lines))

    return final_outputs
