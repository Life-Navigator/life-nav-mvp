"""Neo4j Bolt driver wrapper."""

from neo4j import GraphDatabase, Driver
from lib.config import Config

_driver: Driver | None = None


def get_driver() -> Driver:
    """Return a singleton Neo4j driver."""
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            Config.NEO4J_URI,
            auth=(Config.NEO4J_USERNAME, Config.NEO4J_PASSWORD),
        )
    return _driver


def run_cypher(
    cypher: str, params: dict | None = None
) -> list[dict]:
    """Execute a Cypher query and return results as list of dicts."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run(cypher, params or {})
        return [dict(record) for record in result]


def upsert_entity(
    label: str,
    entity_id: str,
    tenant_id: str,
    user_id: str,
    props: dict,
    rel_type: str,
) -> None:
    """Ensure Person node exists, upsert entity node, and create relationship."""
    driver = get_driver()
    with driver.session() as session:
        # Ensure Person node
        session.run(
            "MERGE (p:Person {tenant_id: $tid, user_id: $uid})",
            {"tid": tenant_id, "uid": user_id},
        )
        # Upsert entity and relationship
        session.run(
            f"""
            MATCH (p:Person {{tenant_id: $tid}})
            MERGE (n:{label} {{entity_id: $eid, tenant_id: $tid}})
            SET n += $props, n.updated_at = datetime()
            MERGE (p)-[:{rel_type}]->(n)
            """,
            {"tid": tenant_id, "eid": entity_id, "props": props},
        )


def create_cross_relationship(
    from_label: str,
    from_id: str,
    to_label: str,
    to_id: str,
    tenant_id: str,
    rel_type: str,
) -> None:
    """Create a relationship between two entity nodes."""
    driver = get_driver()
    with driver.session() as session:
        session.run(
            f"""
            MATCH (a:{from_label} {{entity_id: $fid, tenant_id: $tid}})
            MATCH (b:{to_label} {{entity_id: $to_id, tenant_id: $tid}})
            MERGE (a)-[:{rel_type}]->(b)
            """,
            {"fid": from_id, "to_id": to_id, "tid": tenant_id},
        )


def delete_entity(label: str, entity_id: str, tenant_id: str) -> None:
    """Detach-delete an entity node."""
    driver = get_driver()
    with driver.session() as session:
        session.run(
            f"MATCH (n:{label} {{entity_id: $eid, tenant_id: $tid}}) DETACH DELETE n",
            {"eid": entity_id, "tid": tenant_id},
        )


def load_rdf_inline(ttl_content: str) -> dict:
    """Load Turtle RDF content into Neo4j via n10s."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            "CALL n10s.rdf.import.inline($ttl, 'Turtle')",
            {"ttl": ttl_content},
        )
        record = result.single()
        return dict(record) if record else {}


def init_n10s() -> None:
    """Initialize n10s graph config (idempotent)."""
    driver = get_driver()
    with driver.session() as session:
        try:
            session.run("CALL n10s.graphconfig.init()")
        except Exception:
            # Already initialized
            pass


def scalar_props(payload: dict) -> dict:
    """Strip nested objects/arrays and nulls — Neo4j properties must be scalars."""
    out = {}
    for k, v in payload.items():
        if v is None or isinstance(v, (dict, list)):
            continue
        if isinstance(v, (str, int, float, bool)):
            out[k] = v
    return out
