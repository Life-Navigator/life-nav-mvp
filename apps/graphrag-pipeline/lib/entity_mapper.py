"""Maps Supabase rows to Neo4j nodes + Qdrant vectors.

Orchestrates the sync of a single entity: builds text, embeds, upserts/deletes
in both Neo4j and Qdrant.
"""

from lib import neo4j_client, qdrant_client, gemini_client
from lib.embedding_builder import build_entity_text
from lib.graph_schema import LABEL_MAP, REL_MAP, DOMAIN_MAP, CROSS_RELATIONSHIPS


class SyncPartialError(Exception):
    """Raised when one backend succeeds but the other fails.

    Carries partial success flags so the caller can record which backends
    completed before the failure.
    """

    def __init__(
        self, message: str, neo4j_synced: bool = False, qdrant_synced: bool = False
    ):
        super().__init__(message)
        self.neo4j_synced = neo4j_synced
        self.qdrant_synced = qdrant_synced


def sync_entity(
    entity_type: str,
    entity_id: str,
    user_id: str,
    operation: str,
    payload: dict,
) -> dict[str, bool]:
    """Sync a single entity to Neo4j and Qdrant.

    Returns {"neo4j": bool, "qdrant": bool} indicating success.
    Raises SyncPartialError if one backend succeeds and the other fails,
    preserving which backend completed for accurate retry tracking.
    """
    label = LABEL_MAP.get(entity_type, "Entity")
    rel = REL_MAP.get(entity_type, "HAS_ENTITY")
    domain = DOMAIN_MAP.get(entity_type, entity_type)

    # --- DELETE ---
    if operation == "delete":
        neo4j_ok = False
        qdrant_ok = False
        errors: list[str] = []

        try:
            neo4j_client.delete_entity(label, entity_id, user_id)
            neo4j_ok = True
        except Exception as e:
            errors.append(f"Neo4j delete: {e}")

        try:
            qdrant_client.delete_points([entity_id])
            qdrant_ok = True
        except Exception as e:
            errors.append(f"Qdrant delete: {e}")

        if errors:
            raise SyncPartialError(
                "; ".join(errors),
                neo4j_synced=neo4j_ok,
                qdrant_synced=qdrant_ok,
            )

        return {"neo4j": True, "qdrant": True}

    # --- UPSERT ---
    # 1. Build embedding text
    text = build_entity_text(entity_type, payload)

    # 2. Generate embedding
    vector = gemini_client.embed_text(text)

    # 3. Prepare scalar props for Neo4j
    props = neo4j_client.scalar_props(payload)

    neo4j_ok = False
    qdrant_ok = False
    errors = []

    # 4. Upsert to Neo4j + cross-relationships
    try:
        neo4j_client.upsert_entity(
            label=label,
            entity_id=entity_id,
            tenant_id=user_id,
            user_id=user_id,
            props=props,
            rel_type=rel,
        )
        # 5. Create cross-entity relationships if applicable
        _create_cross_relationships(entity_type, entity_id, user_id, payload)
        neo4j_ok = True
    except Exception as e:
        errors.append(f"Neo4j upsert: {e}")

    # 6. Upsert to Qdrant
    try:
        qdrant_client.upsert_points([
            {
                "id": entity_id,
                "vector": vector,
                "payload": {
                    "tenant_id": user_id,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "domain": domain,
                    "text": text,
                    **props,
                },
            }
        ])
        qdrant_ok = True
    except Exception as e:
        errors.append(f"Qdrant upsert: {e}")

    if errors:
        raise SyncPartialError(
            "; ".join(errors),
            neo4j_synced=neo4j_ok,
            qdrant_synced=qdrant_ok,
        )

    return {"neo4j": True, "qdrant": True}


def _create_cross_relationships(
    entity_type: str,
    entity_id: str,
    tenant_id: str,
    payload: dict,
) -> None:
    """Create cross-entity relationships based on foreign keys in payload."""
    for from_type, to_type, rel_type, fk_field in CROSS_RELATIONSHIPS:
        if entity_type != from_type:
            continue
        fk_value = payload.get(fk_field)
        if not fk_value:
            continue
        from_label = LABEL_MAP.get(from_type, "Entity")
        to_label = LABEL_MAP.get(to_type, "Entity")
        try:
            neo4j_client.create_cross_relationship(
                from_label=from_label,
                from_id=entity_id,
                to_label=to_label,
                to_id=str(fk_value),
                tenant_id=tenant_id,
                rel_type=rel_type,
            )
        except Exception:
            # Target node may not exist yet — skip silently
            pass
