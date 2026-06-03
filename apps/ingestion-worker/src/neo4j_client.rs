//! Neo4j HTTP transactional client. Every Cypher statement filters by
//! `tenant_id` — there is no codepath that writes or reads a graph
//! node without a tenant filter.
//!
//! The label of the node is the PascalCase form of
//! `canon.entity_type`. Relationships are inserted using
//! `relationships[*].label`.

use reqwest::Client as Http;
use serde::Serialize;
use serde_json::{json, Map, Value};

use crate::config::Config;
use crate::entities::CanonicalGraphObject;
use crate::errors::{Result, WorkerError};
use crate::queue::AccessScope;

pub struct Neo4jClient {
    http: Http,
    base_url: String,
    auth_header: String,
    database: String,
    scope: AccessScope,
}

impl Neo4jClient {
    pub fn new(cfg: &Config) -> Result<Self> {
        Self::with_scope(cfg, AccessScope::Personal)
    }

    pub fn with_scope(cfg: &Config, scope: AccessScope) -> Result<Self> {
        let http = Http::builder()
            .gzip(true)
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        let creds = base64_impl::encode(format!("{}:{}", cfg.neo4j_username, cfg.neo4j_password));
        let database = match scope {
            AccessScope::Personal => cfg.neo4j_personal_database.clone(),
            AccessScope::Central => cfg.neo4j_central_database.clone(),
        };
        Ok(Self {
            http,
            base_url: normalize_http_base(&cfg.neo4j_uri),
            auth_header: format!("Basic {creds}"),
            database,
            scope,
        })
    }

    pub fn scope(&self) -> AccessScope {
        self.scope
    }

    pub fn database(&self) -> &str {
        &self.database
    }

    /// Build the parameter bag that `merge_cypher_for` consumes. Exposed
    /// so the tenant-isolation integration test can inspect it.
    pub fn build_params(canon: &CanonicalGraphObject) -> Value {
        let mut attrs = canon.attributes.clone();
        // Always include the canonical identity columns so the property
        // bag is self-describing on the node.
        attrs.insert(
            "tenant_id".into(),
            Value::String(canon.tenant_id.to_string()),
        );
        attrs.insert("user_id".into(), Value::String(canon.user_id.to_string()));
        attrs.insert("entity_id".into(), Value::String(canon.entity_id.clone()));
        attrs.insert(
            "entity_type".into(),
            Value::String(canon.entity_type.clone()),
        );
        attrs.insert("domain".into(), Value::String(canon.domain.clone()));
        attrs.insert(
            "source_table".into(),
            Value::String(canon.source_table.clone()),
        );
        attrs.insert(
            "sensitivity_level".into(),
            Value::String(canon.sensitivity_level.as_str().into()),
        );
        attrs.insert(
            "created_at".into(),
            Value::String(canon.created_at.to_rfc3339()),
        );
        attrs.insert(
            "updated_at".into(),
            Value::String(canon.updated_at.to_rfc3339()),
        );
        Value::Object(Map::from_iter([
            ("attrs".into(), Value::Object(attrs)),
            (
                "tenant_id".into(),
                Value::String(canon.tenant_id.to_string()),
            ),
            ("entity_id".into(), Value::String(canon.entity_id.clone())),
        ]))
    }

    /// Build the Cypher upsert + per-relationship `MERGE` for a given
    /// canonical object. Exposed for tests.
    pub fn merge_cypher_for(canon: &CanonicalGraphObject) -> String {
        let label = pascalize(&canon.entity_type);
        let mut cypher = format!(
            "MERGE (n:{label} {{ tenant_id: $tenant_id, entity_id: $entity_id }}) \
             SET n += $attrs"
        );
        for r in &canon.relationships {
            let r_label = sanitize_rel(&r.label);
            let target_label = pascalize(&r.target_entity_type);
            cypher.push_str(&format!(
                " WITH n \
                 MERGE (t:{target_label} {{ tenant_id: $tenant_id, entity_id: '{tgt}' }}) \
                 MERGE (t)-[:{r_label}]->(n)",
                tgt = escape_for_cypher_string(&r.target_entity_id)
            ));
        }
        cypher
    }

    pub async fn upsert_node(&self, canon: &CanonicalGraphObject) -> Result<()> {
        let cypher = Self::merge_cypher_for(canon);
        let params = Self::build_params(canon);
        let body = QueryRequest {
            statement: cypher,
            parameters: params,
        };
        let url = format!("{}/db/{}/query/v2", self.base_url, self.database);
        let res = self
            .http
            .post(&url)
            .header("authorization", &self.auth_header)
            .header("accept", "application/json")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(WorkerError::Neo4j(format!("{status}: {text}")));
        }
        // Defensive: if the Query API ever returns a 2xx with an errors
        // array (partial failure), surface it rather than silently passing.
        let v: Value = serde_json::from_str(&text)?;
        if let Some(errors) = v.get("errors").and_then(Value::as_array) {
            if !errors.is_empty() {
                return Err(WorkerError::Neo4j(format!("cypher errors: {errors:?}")));
            }
        }
        Ok(())
    }

    pub async fn delete_node(
        &self,
        tenant_id: &str,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<()> {
        let label = pascalize(entity_type);
        let cypher = format!(
            "MATCH (n:{label} {{ tenant_id: $tenant_id, entity_id: $entity_id }}) DETACH DELETE n"
        );
        let body = QueryRequest {
            statement: cypher,
            parameters: json!({"tenant_id": tenant_id, "entity_id": entity_id}),
        };
        let url = format!("{}/db/{}/query/v2", self.base_url, self.database);
        let res = self
            .http
            .post(&url)
            .header("authorization", &self.auth_header)
            .json(&body)
            .send()
            .await?;
        if !res.status().is_success() {
            return Err(WorkerError::Neo4j(format!(
                "delete {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            )));
        }
        Ok(())
    }
}

/// Neo4j Aura Query API v2 request body. The legacy `/tx/commit`
/// transactional endpoint is forbidden on Aura (403 "Denied by
/// administrative rules"), so we POST a single statement to
/// `/db/{db}/query/v2` instead.
#[derive(Serialize)]
struct QueryRequest {
    statement: String,
    parameters: Value,
}

/// The Query API is HTTP(S). Aura hands out a bolt-style URI
/// (`neo4j+s://host`); normalize it to the `https://host` the HTTP
/// endpoint expects.
fn normalize_http_base(uri: &str) -> String {
    let trimmed = uri.trim_end_matches('/');
    for scheme in [
        "neo4j+s://",
        "neo4j+ssc://",
        "neo4j://",
        "bolt+s://",
        "bolt+ssc://",
        "bolt://",
    ] {
        if let Some(rest) = trimmed.strip_prefix(scheme) {
            return format!("https://{rest}");
        }
    }
    trimmed.to_string()
}

/// PascalCase the snake_case entity_type for Neo4j labels.
fn pascalize(s: &str) -> String {
    s.split('_')
        .filter(|p| !p.is_empty())
        .map(|p| {
            let mut c = p.chars();
            match c.next() {
                Some(first) => first.to_uppercase().collect::<String>() + c.as_str(),
                None => String::new(),
            }
        })
        .collect()
}

/// Relationship labels in Cypher must be ASCII identifiers. The
/// normalizer already controls these strings, but we belt-and-braces
/// anyway.
fn sanitize_rel(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn escape_for_cypher_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "\\'")
}

/// Tiny inline base64 so we don't pull in a whole crate for one call.
/// Standard alphabet + `=` padding.
mod base64_impl {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    pub fn encode<T: AsRef<[u8]>>(input: T) -> String {
        let bytes = input.as_ref();
        let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
        for chunk in bytes.chunks(3) {
            let b0 = chunk[0];
            let b1 = *chunk.get(1).unwrap_or(&0);
            let b2 = *chunk.get(2).unwrap_or(&0);
            out.push(ALPHABET[(b0 >> 2) as usize] as char);
            out.push(ALPHABET[(((b0 & 0b11) << 4) | (b1 >> 4)) as usize] as char);
            if chunk.len() > 1 {
                out.push(ALPHABET[(((b1 & 0b1111) << 2) | (b2 >> 6)) as usize] as char);
            } else {
                out.push('=');
            }
            if chunk.len() > 2 {
                out.push(ALPHABET[(b2 & 0b0011_1111) as usize] as char);
            } else {
                out.push('=');
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::{EntityType, Relationship, SensitivityLevel};
    use chrono::Utc;
    use uuid::Uuid;

    fn sample_canon() -> CanonicalGraphObject {
        CanonicalGraphObject {
            tenant_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            entity_id: "abc".into(),
            entity_type: EntityType::Goal.as_str().into(),
            domain: EntityType::Goal.domain().into(),
            source_table: "public.goals".into(),
            title: "T".into(),
            summary: "S".into(),
            attributes: serde_json::Map::new(),
            relationships: vec![Relationship {
                label: "HAS_GOAL".into(),
                target_entity_type: "user_profile".into(),
                target_entity_id: "user-x".into(),
            }],
            sensitivity_level: SensitivityLevel::Low,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn cypher_includes_tenant_filter() {
        let c = sample_canon();
        let cypher = Neo4jClient::merge_cypher_for(&c);
        assert!(cypher.contains("tenant_id: $tenant_id"));
        assert!(cypher.contains("MERGE (n:Goal"));
        assert!(cypher.contains("HAS_GOAL"));
    }

    #[test]
    fn params_include_tenant_and_attrs() {
        let c = sample_canon();
        let p = Neo4jClient::build_params(&c);
        assert!(p.get("tenant_id").is_some());
        assert!(p.get("entity_id").is_some());
        let attrs = p.get("attrs").and_then(|a| a.as_object()).unwrap();
        assert_eq!(
            attrs.get("tenant_id").unwrap(),
            &serde_json::Value::String(c.tenant_id.to_string())
        );
        assert_eq!(
            attrs.get("entity_type").unwrap(),
            &serde_json::Value::String("goal".into())
        );
    }

    #[test]
    fn pascalize_works() {
        assert_eq!(pascalize("user_profile"), "UserProfile");
        assert_eq!(pascalize("financial_account"), "FinancialAccount");
        assert_eq!(pascalize("goal"), "Goal");
    }
}
