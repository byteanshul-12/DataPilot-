"""RapidFuzz similarity matching helper module."""
from rapidfuzz import fuzz
from app.graph.nodes.deduplicate import normalize_value, get_dedup_key_str

def calculate_similarity(text1: str, text2: str) -> float:
    """Computes string similarity ratio between two collected items."""
    return float(fuzz.token_sort_ratio(text1, text2))

__all__ = ["calculate_similarity", "normalize_value", "get_dedup_key_str"]
