# RapidFuzz similarity matching helper module.
from rapidfuzz import fuzz

def calculate_similarity(text1: str, text2: str) -> float:
    # Computes string similarity ratio between two collected items.
    return fuzz.token_sort_ratio(text1, text2)
