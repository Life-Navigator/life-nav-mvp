"""Reciprocal Rank Fusion (RRF) for merging multiple search rankings."""

from lib.config import Config


def reciprocal_rank_fusion(*rankings: list[dict]) -> list[dict]:
    """Fuse multiple ranked result lists using Reciprocal Rank Fusion.

    Each result dict must have: entity_id, entity_type, text, score, source.
    Returns fused results sorted by combined RRF score.
    """
    k = Config.RRF_K
    scores: dict[str, dict] = {}

    for ranking in rankings:
        for rank, result in enumerate(ranking):
            key = result["entity_id"]
            rrf_score = 1.0 / (k + rank + 1)

            if key in scores:
                scores[key]["score"] += rrf_score
                # Keep the result with more text
                if len(result.get("text", "")) > len(scores[key]["result"].get("text", "")):
                    scores[key]["result"] = {**result, "score": scores[key]["score"]}
                else:
                    scores[key]["result"]["score"] = scores[key]["score"]
            else:
                scores[key] = {
                    "score": rrf_score,
                    "result": {**result, "score": rrf_score},
                }

    return sorted(
        [entry["result"] for entry in scores.values()],
        key=lambda x: x["score"],
        reverse=True,
    )
