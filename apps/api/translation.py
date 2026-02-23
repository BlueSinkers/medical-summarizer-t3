import os
from functools import lru_cache
from typing import Dict, List

TRANSLATION_MODEL = os.getenv("TRANSLATION_MODEL", "facebook/nllb-200-distilled-600M")

NLLB_LANG_CODES: Dict[str, str] = {
    "en": "eng_Latn",
    "es": "spa_Latn",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "pt": "por_Latn",
    "it": "ita_Latn",
    "zh": "zho_Hans",
    "ar": "arb_Arab",
}


@lru_cache(maxsize=1)
def _load_model_and_tokenizer():
    # Lazy import so backend can start even when translation stack is not installed.
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(TRANSLATION_MODEL)
    model = AutoModelForSeq2SeqLM.from_pretrained(TRANSLATION_MODEL)
    return tokenizer, model


def _resolve_lang_code(code: str) -> str:
    code = (code or "").strip()
    if not code:
        raise ValueError("Language code cannot be empty.")
    if "_" in code:
        return code
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
    tokenizer.src_lang = src_code

    encoded = tokenizer(
        texts,
        return_tensors="pt",
        padding=True,
        truncation=True,
    )
    forced_bos_token_id = tokenizer.convert_tokens_to_ids(tgt_code)

    generated = model.generate(
        **encoded,
        forced_bos_token_id=forced_bos_token_id,
        max_new_tokens=max_new_tokens,
    )
    translated = tokenizer.batch_decode(generated, skip_special_tokens=True)
    return [entry.strip() for entry in translated]
