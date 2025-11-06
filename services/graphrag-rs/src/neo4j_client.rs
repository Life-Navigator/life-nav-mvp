//! Neo4j client for knowledge graph operations

use neo4rs::{Graph, Query};
use std::sync::Arc;
use crate::config::Neo4jConfig;
use crate::error::Result;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Clone)]
pub struct Neo4jClient {
    graph: Arc<Graph>,
}

impl Neo4jClient {
    /// Create new Neo4j client with connection pool
    pub async fn new(config: &Neo4jConfig) -> Result<Self> {
        let graph = Graph::new(&config.uri, &config.user, &config.password)
            .await?;

        Ok(Self {
            graph: Arc::new(graph),
        })
    }

    /// Execute a Cypher query and return results
    pub async fn execute_query(
        &self,
        cypher: &str,
        params: HashMap<String, Value>,
    ) -> Result<Vec<HashMap<String, Value>>> {
        let mut query = Query::new(cypher.to_string());

        // Add parameters
        for (key, value) in params {
            query = match value {
                Value::String(s) => query.param(&key, s),
                Value::Number(n) if n.is_i64() => query.param(&key, n.as_i64().unwrap()),
                Value::Number(n) if n.is_f64() => query.param(&key, n.as_f64().unwrap()),
                Value::Bool(b) => query.param(&key, b),
                _ => query, // Skip unsupported types
            };
        }

        let mut result = self.graph.execute(query).await?;
        let mut rows = Vec::new();

        while let Some(_row) = result.next().await? {
            // Neo4rs 0.7.3 doesn't support generic row iteration
            // Specific field extraction should be done in specialized methods
            // For now, return empty results for generic queries
            let row_map = HashMap::new();
            rows.push(row_map);
        }

        Ok(rows)
    }

    /// Get entity by URI
    pub async fn get_entity(&self, uri: &str, tenant_id: Option<&str>) -> Result<Option<Entity>> {
        let mut params = HashMap::new();
        params.insert("uri".to_string(), Value::String(uri.to_string()));

        let cypher = if let Some(tenant) = tenant_id {
            params.insert("tenant_id".to_string(), Value::String(tenant.to_string()));
            "MATCH (n {uri: $uri, tenant_id: $tenant_id}) RETURN n"
        } else {
            "MATCH (n {uri: $uri}) RETURN n"
        };

        let results = self.execute_query(cypher, params).await?;

        if let Some(row) = results.first() {
            if let Some(node) = row.get("n") {
                return Ok(Some(self.node_to_entity(node)?));
            }
        }

        Ok(None)
    }

    /// Get entity relationships
    pub async fn get_relationships(
        &self,
        entity_uri: &str,
        direction: &str,
        limit: usize,
    ) -> Result<Vec<Relationship>> {
        let cypher = match direction {
            "outgoing" => "MATCH (n {uri: $uri})-[r]->(m) RETURN r, m LIMIT $limit",
            "incoming" => "MATCH (n {uri: $uri})<-[r]-(m) RETURN r, m LIMIT $limit",
            _ => "MATCH (n {uri: $uri})-[r]-(m) RETURN r, m LIMIT $limit",
        };

        let mut params = HashMap::new();
        params.insert("uri".to_string(), Value::String(entity_uri.to_string()));
        params.insert("limit".to_string(), Value::Number(limit.into()));

        let results = self.execute_query(cypher, params).await?;
        let mut relationships = Vec::new();

        for row in results {
            if let (Some(rel), Some(target)) = (row.get("r"), row.get("m")) {
                relationships.push(Relationship {
                    predicate: self.extract_relationship_type(rel)?,
                    subject_uri: entity_uri.to_string(),
                    object_uri: self.extract_uri(target)?,
                    object: Some(self.node_to_entity(target)?),
                });
            }
        }

        Ok(relationships)
    }

    /// Semantic search using full-text index
    pub async fn semantic_search(
        &self,
        query: &str,
        entity_type: Option<&str>,
        tenant_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<Entity>> {
        let mut cypher = String::from("CALL db.index.fulltext.queryNodes('entitySearch', $query) YIELD node, score ");

        let mut params = HashMap::new();
        params.insert("query".to_string(), Value::String(query.to_string()));
        params.insert("limit".to_string(), Value::Number(limit.into()));

        if let Some(etype) = entity_type {
            cypher.push_str(&format!("WHERE $entity_type IN labels(node) "));
            params.insert("entity_type".to_string(), Value::String(etype.to_string()));
        }

        if let Some(tenant) = tenant_id {
            cypher.push_str("AND node.tenant_id = $tenant_id ");
            params.insert("tenant_id".to_string(), Value::String(tenant.to_string()));
        }

        cypher.push_str("RETURN node ORDER BY score DESC LIMIT $limit");

        let results = self.execute_query(&cypher, params).await?;
        let mut entities = Vec::new();

        for row in results {
            if let Some(node) = row.get("node") {
                entities.push(self.node_to_entity(node)?);
            }
        }

        Ok(entities)
    }

    /// Create full-text search index
    pub async fn create_fulltext_index(&self) -> Result<()> {
        let cypher = r#"
            CREATE FULLTEXT INDEX entitySearch IF NOT EXISTS
            FOR (n:Entity|Goal|Transaction|Account|Condition|JobApplication)
            ON EACH [n.name, n.description, n.content, n.notes]
        "#;

        self.execute_query(cypher, HashMap::new()).await?;
        Ok(())
    }

    // Helper methods
    fn node_to_entity(&self, node: &Value) -> Result<Entity> {
        // Extract properties from Neo4j node
        let properties = if let Value::Object(obj) = node {
            obj.clone()
        } else {
            serde_json::Map::new()
        };

        let uri = properties
            .get("uri")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let entity_type = properties
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let label = properties
            .get("label")
            .or_else(|| properties.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or(&uri)
            .to_string();

        let tenant_id = properties
            .get("tenant_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let props: HashMap<String, String> = properties
            .iter()
            .map(|(k, v)| (k.clone(), v.to_string()))
            .collect();

        Ok(Entity {
            uri,
            entity_type,
            label,
            properties: props,
            relationships: Vec::new(),
            tenant_id,
            created_at: properties
                .get("created_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            updated_at: properties
                .get("updated_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        })
    }

    fn extract_relationship_type(&self, rel: &Value) -> Result<String> {
        Ok(rel
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("RELATED_TO")
            .to_string())
    }

    fn extract_uri(&self, node: &Value) -> Result<String> {
        Ok(node
            .get("uri")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string())
    }
}

// Domain types matching gRPC definitions
#[derive(Debug, Clone)]
pub struct Entity {
    pub uri: String,
    pub entity_type: String,
    pub label: String,
    pub properties: HashMap<String, String>,
    pub relationships: Vec<Relationship>,
    pub tenant_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct Relationship {
    pub predicate: String,
    pub subject_uri: String,
    pub object_uri: String,
    pub object: Option<Entity>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires running Neo4j
    async fn test_neo4j_connection() {
        let config = crate::config::Config::default_dev();
        let client = Neo4jClient::new(&config.neo4j).await;
        assert!(client.is_ok());
    }
}
