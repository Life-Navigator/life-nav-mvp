"""POST /api/ontology — Load TTL ontology files into Neo4j via Cypher.

Parses TTL files externally and loads classes/properties as Cypher MERGE
statements. This avoids n10s/neosemantics dependency, which is NOT available
on Neo4j Aura.
"""

from http.server import BaseHTTPRequestHandler
import json
import hmac
import os
import re

from lib.config import Config
from lib import neo4j_client

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-worker-secret",
}

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_THIS_DIR)
_DEFAULT_ONTOLOGY_DIR = os.path.join(_PROJECT_ROOT, "ontology")

ONTOLOGY_FILES = [
    "core/person.ttl",
    "core/document.ttl",
    "core/cross-domain.ttl",
    "health/condition.ttl",
    "career/profile.ttl",
    "career/job.ttl",
    "education/credentials.ttl",
    "education/institutions.ttl",
    "finance/accounts.ttl",
    "finance/instruments.ttl",
    "finance/strategies.ttl",
    "goals/goal.ttl",
    "compliance/regulations.ttl",
    "compliance/documents.ttl",
]


def parse_ttl(content: str) -> tuple[list[dict], list[dict]]:
    """Parse a Turtle file and extract OWL classes and properties.

    Returns (classes, properties) where each is a list of dicts with
    uri, label, comment, and relationship fields.

    This is a lightweight parser — handles the subset of Turtle syntax
    used in our ontology files (prefix declarations, class/property
    definitions with rdfs:label, rdfs:comment, rdfs:domain, rdfs:range,
    rdfs:subClassOf).
    """
    classes: list[dict] = []
    properties: list[dict] = []

    # Resolve prefixes
    prefixes: dict[str, str] = {}
    for match in re.finditer(r"@prefix\s+(\w*):\s+<([^>]+)>\s*\.", content):
        prefixes[match.group(1)] = match.group(2)

    def expand(term: str) -> str:
        """Expand a prefixed name like ln:Person to full URI."""
        if term.startswith("<") and term.endswith(">"):
            return term[1:-1]
        if ":" in term:
            prefix, local = term.split(":", 1)
            if prefix in prefixes:
                return prefixes[prefix] + local
        return term

    def extract_string(text: str) -> str:
        """Extract quoted string value."""
        m = re.search(r'"([^"]*)"', text)
        return m.group(1) if m else ""

    # Split into blocks by subject (lines starting at column 0 with a subject)
    # Each block describes one resource
    blocks = re.split(r"\n(?=\S)", content)

    for block in blocks:
        block = block.strip()
        if not block or block.startswith("@prefix") or block.startswith("#"):
            continue

        # Extract subject
        parts = block.split(None, 1)
        if len(parts) < 2:
            continue
        subject_raw = parts[0]
        subject = expand(subject_raw)
        body = parts[1]

        # Determine type
        is_class = "owl:Class" in body
        is_object_prop = "owl:ObjectProperty" in body
        is_datatype_prop = "owl:DatatypeProperty" in body
        is_annotation_prop = "owl:AnnotationProperty" in body

        if not any([is_class, is_object_prop, is_datatype_prop, is_annotation_prop]):
            continue

        label = ""
        comment = ""
        domain = ""
        range_ = ""
        subclass_of = ""

        for line in body.split(";"):
            line = line.strip()
            if "rdfs:label" in line:
                label = extract_string(line)
            elif "rdfs:comment" in line:
                comment = extract_string(line)
            elif "rdfs:domain" in line:
                m = re.search(r"rdfs:domain\s+(\S+)", line)
                if m:
                    domain = expand(m.group(1).rstrip(" ;."))
            elif "rdfs:range" in line:
                m = re.search(r"rdfs:range\s+(\S+)", line)
                if m:
                    range_ = expand(m.group(1).rstrip(" ;."))
            elif "rdfs:subClassOf" in line:
                m = re.search(r"rdfs:subClassOf\s+(\S+)", line)
                if m:
                    subclass_of = expand(m.group(1).rstrip(" ;."))

        if is_class:
            classes.append({
                "uri": subject,
                "label": label,
                "comment": comment,
                "subclass_of": subclass_of or None,
            })
        elif is_object_prop or is_datatype_prop or is_annotation_prop:
            ptype = "object" if is_object_prop else ("datatype" if is_datatype_prop else "annotation")
            properties.append({
                "uri": subject,
                "label": label,
                "comment": comment,
                "property_type": ptype,
                "domain": domain or None,
                "range": range_ or None,
            })

    return classes, properties


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_POST(self):
        # --- Auth ---
        secret = Config.GRAPHRAG_WORKER_SECRET
        if secret:
            provided = self.headers.get("x-worker-secret", "")
            if not hmac.compare_digest(provided, secret):
                self._json_response(401, {"error": "Unauthorized"})
                return

        # --- Parse body ---
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
        except (json.JSONDecodeError, ValueError):
            body = {}

        base_dir = body.get("base_dir", _DEFAULT_ONTOLOGY_DIR)

        try:
            # Step 1: Create constraints and indexes (replaces n10s.graphconfig.init)
            neo4j_client.ensure_constraints()

            # Step 2: Parse and load each TTL file
            all_classes: list[dict] = []
            all_properties: list[dict] = []
            file_results = []

            for ttl_path in ONTOLOGY_FILES:
                full_path = os.path.join(base_dir, ttl_path)
                try:
                    with open(full_path, "r") as f:
                        ttl_content = f.read()

                    classes, properties = parse_ttl(ttl_content)
                    all_classes.extend(classes)
                    all_properties.extend(properties)

                    file_results.append({
                        "file": ttl_path,
                        "status": "parsed",
                        "classes": len(classes),
                        "properties": len(properties),
                    })
                except FileNotFoundError:
                    file_results.append({
                        "file": ttl_path,
                        "status": "not_found",
                    })
                except Exception as e:
                    file_results.append({
                        "file": ttl_path,
                        "status": "error",
                        "error": str(e)[:500],
                    })

            # Step 3: Load all parsed ontology into Neo4j via Cypher
            load_stats = neo4j_client.load_ontology_metadata(all_classes, all_properties)

            loaded = sum(1 for r in file_results if r.get("status") == "parsed")
            self._json_response(200, {
                "status": "ok",
                "files_loaded": loaded,
                "total_files": len(file_results),
                "classes_total": load_stats["classes_merged"],
                "properties_total": load_stats["properties_merged"],
                "details": file_results,
            })
        except Exception as e:
            self._json_response(500, {"error": str(e)[:2000]})

    def _json_response(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())
