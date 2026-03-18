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


def ensure_constraints() -> None:
    """Create uniqueness constraints and indexes for all entity types (idempotent).

    Called during ontology initialization instead of n10s (which is not
    available on Neo4j Aura).
    """
    from lib.graph_schema import LABEL_MAP

    driver = get_driver()
    with driver.session() as session:
        # Person constraint
        try:
            session.run(
                "CREATE CONSTRAINT person_tenant_user IF NOT EXISTS "
                "FOR (p:Person) REQUIRE (p.tenant_id, p.user_id) IS UNIQUE"
            )
        except Exception:
            pass

        # Entity constraints
        for label in set(LABEL_MAP.values()):
            try:
                session.run(
                    f"CREATE CONSTRAINT {label.lower()}_entity_id IF NOT EXISTS "
                    f"FOR (n:{label}) REQUIRE (n.entity_id, n.tenant_id) IS UNIQUE"
                )
            except Exception:
                pass

        # Tenant index for fast tenant-scoped lookups
        try:
            session.run(
                "CREATE INDEX person_tenant IF NOT EXISTS FOR (p:Person) ON (p.tenant_id)"
            )
        except Exception:
            pass


def load_ontology_metadata(classes: list[dict], properties: list[dict]) -> dict:
    """Store parsed ontology classes and properties as metadata nodes in Neo4j.

    This replaces n10s RDF import. Classes and properties from TTL files are
    parsed externally (in Python) and stored as :OntologyClass / :OntologyProperty
    nodes for schema documentation and query context.
    """
    driver = get_driver()
    stats = {"classes_merged": 0, "properties_merged": 0}

    with driver.session() as session:
        for cls in classes:
            session.run(
                "MERGE (c:OntologyClass {uri: $uri}) "
                "SET c.label = $label, c.comment = $comment, c.updated_at = datetime()",
                {
                    "uri": cls.get("uri", ""),
                    "label": cls.get("label", ""),
                    "comment": cls.get("comment", ""),
                },
            )
            # Link subclass relationships
            if cls.get("subclass_of"):
                session.run(
                    "MATCH (c:OntologyClass {uri: $uri}) "
                    "MERGE (p:OntologyClass {uri: $parent}) "
                    "MERGE (c)-[:SUBCLASS_OF]->(p)",
                    {"uri": cls["uri"], "parent": cls["subclass_of"]},
                )
            stats["classes_merged"] += 1

        for prop in properties:
            session.run(
                "MERGE (p:OntologyProperty {uri: $uri}) "
                "SET p.label = $label, p.comment = $comment, "
                "p.property_type = $ptype, p.updated_at = datetime()",
                {
                    "uri": prop.get("uri", ""),
                    "label": prop.get("label", ""),
                    "comment": prop.get("comment", ""),
                    "ptype": prop.get("property_type", "datatype"),
                },
            )
            # Link domain/range
            if prop.get("domain"):
                session.run(
                    "MATCH (pr:OntologyProperty {uri: $uri}) "
                    "MERGE (c:OntologyClass {uri: $domain}) "
                    "MERGE (pr)-[:HAS_DOMAIN]->(c)",
                    {"uri": prop["uri"], "domain": prop["domain"]},
                )
            if prop.get("range"):
                session.run(
                    "MATCH (pr:OntologyProperty {uri: $uri}) "
                    "MERGE (c:OntologyClass {uri: $range}) "
                    "MERGE (pr)-[:HAS_RANGE]->(c)",
                    {"uri": prop["uri"], "range": prop["range"]},
                )
            stats["properties_merged"] += 1

    return stats


def scalar_props(payload: dict) -> dict:
    """Strip nested objects/arrays and nulls — Neo4j properties must be scalars."""
    out = {}
    for k, v in payload.items():
        if v is None or isinstance(v, (dict, list)):
            continue
        if isinstance(v, (str, int, float, bool)):
            out[k] = v
    return out
