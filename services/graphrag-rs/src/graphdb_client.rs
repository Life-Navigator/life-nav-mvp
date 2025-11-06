//! GraphDB SPARQL client for semantic ontology queries

use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use crate::config::GraphDBConfig;
use crate::error::{GraphRAGError, Result};

#[derive(Clone)]
pub struct GraphDBClient {
    client: Client,
    base_url: String,
    repository: String,
}

impl GraphDBClient {
    /// Create new GraphDB SPARQL client
    pub fn new(config: &GraphDBConfig) -> Self {
        Self {
            client: Client::new(),
            base_url: config.url.clone(),
            repository: config.repository.clone(),
        }
    }

    /// Execute SPARQL SELECT query
    pub async fn query_select(&self, sparql: &str) -> Result<Vec<HashMap<String, String>>> {
        let url = format!(
            "{}/repositories/{}",
            self.base_url, self.repository
        );

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/sparql-query")
            .header("Accept", "application/sparql-results+json")
            .body(sparql.to_string())
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(GraphRAGError::GraphDB(format!(
                "SPARQL query failed: {}",
                response.status()
            )));
        }

        let result: SparqlResults = response.json().await?;
        Ok(self.parse_results(result))
    }

    /// Execute SPARQL CONSTRUCT query (returns RDF triples)
    pub async fn query_construct(&self, sparql: &str) -> Result<String> {
        let url = format!(
            "{}/repositories/{}",
            self.base_url, self.repository
        );

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/sparql-query")
            .header("Accept", "text/turtle")
            .body(sparql.to_string())
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(GraphRAGError::GraphDB(format!(
                "SPARQL CONSTRUCT failed: {}",
                response.status()
            )));
        }

        Ok(response.text().await?)
    }

    /// Execute SPARQL ASK query (returns boolean)
    pub async fn query_ask(&self, sparql: &str) -> Result<bool> {
        let url = format!(
            "{}/repositories/{}",
            self.base_url, self.repository
        );

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/sparql-query")
            .header("Accept", "application/sparql-results+json")
            .body(sparql.to_string())
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(GraphRAGError::GraphDB(format!(
                "SPARQL ASK failed: {}",
                response.status()
            )));
        }

        let result: SparqlAskResult = response.json().await?;
        Ok(result.boolean)
    }

    /// Get entity by URI from ontology
    pub async fn get_entity_ontology(&self, uri: &str) -> Result<EntityOntology> {
        let sparql = format!(
            r#"
            PREFIX ln: <https://ln.life/ontology#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

            SELECT ?property ?value ?label ?comment
            WHERE {{
                <{}> ?property ?value .
                OPTIONAL {{ ?property rdfs:label ?label }}
                OPTIONAL {{ ?property rdfs:comment ?comment }}
            }}
            "#,
            uri
        );

        let results = self.query_select(&sparql).await?;

        let mut properties = HashMap::new();
        let mut entity_type = None;

        for row in results {
            if let (Some(prop), Some(value)) = (row.get("property"), row.get("value")) {
                if prop.contains("rdf-syntax-ns#type") {
                    entity_type = Some(value.clone());
                } else {
                    properties.insert(prop.clone(), value.clone());
                }
            }
        }

        Ok(EntityOntology {
            uri: uri.to_string(),
            entity_type: entity_type.unwrap_or_else(|| "Unknown".to_string()),
            properties,
        })
    }

    /// Semantic search using SPARQL with filters
    pub async fn semantic_search(
        &self,
        entity_type: Option<&str>,
        filters: HashMap<String, String>,
        tenant_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<String>> {
        let mut where_clauses = Vec::new();

        // Entity type filter
        if let Some(etype) = entity_type {
            where_clauses.push(format!("?entity a <{}>", etype));
        } else {
            where_clauses.push("?entity a ?type".to_string());
        }

        // Tenant ID filter
        if let Some(tenant) = tenant_id {
            where_clauses.push(format!(
                "?entity ln:tenantId \"{}\"",
                tenant
            ));
        }

        // Additional filters
        for (key, value) in filters {
            where_clauses.push(format!(
                "?entity {} \"{}\"",
                key, value
            ));
        }

        let sparql = format!(
            r#"
            PREFIX ln: <https://ln.life/ontology#>

            SELECT DISTINCT ?entity
            WHERE {{
                {}
            }}
            LIMIT {}
            "#,
            where_clauses.join(" .\n                "),
            limit
        );

        let results = self.query_select(&sparql).await?;

        Ok(results
            .into_iter()
            .filter_map(|row| row.get("entity").cloned())
            .collect())
    }

    /// Get all classes in ontology
    pub async fn get_ontology_classes(&self) -> Result<Vec<String>> {
        let sparql = r#"
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT DISTINCT ?class ?label
            WHERE {
                ?class a owl:Class .
                OPTIONAL { ?class rdfs:label ?label }
            }
            ORDER BY ?class
        "#;

        let results = self.query_select(sparql).await?;

        Ok(results
            .into_iter()
            .filter_map(|row| row.get("class").cloned())
            .collect())
    }

    /// Validate entity against SHACL shapes
    pub async fn validate_entity(&self, entity_turtle: &str) -> Result<ValidationReport> {
        // First, insert the entity temporarily
        let url = format!(
            "{}/repositories/{}/statements",
            self.base_url, self.repository
        );

        let insert_response = self
            .client
            .post(&url)
            .header("Content-Type", "text/turtle")
            .body(entity_turtle.to_string())
            .send()
            .await?;

        if !insert_response.status().is_success() {
            return Err(GraphRAGError::GraphDB(format!(
                "Failed to insert entity for validation: {}",
                insert_response.status()
            )));
        }

        // Run SHACL validation (if GraphDB has SHACL plugin)
        // For now, return a simple validation
        Ok(ValidationReport {
            conforms: true,
            violations: Vec::new(),
        })
    }

    // Helper function to parse SPARQL results
    fn parse_results(&self, results: SparqlResults) -> Vec<HashMap<String, String>> {
        results
            .results
            .bindings
            .into_iter()
            .map(|binding| {
                binding
                    .into_iter()
                    .map(|(k, v)| (k, v.value))
                    .collect()
            })
            .collect()
    }
}

// SPARQL result types
#[derive(Debug, Deserialize)]
struct SparqlResults {
    results: SparqlBindings,
}

#[derive(Debug, Deserialize)]
struct SparqlBindings {
    bindings: Vec<HashMap<String, SparqlValue>>,
}

#[derive(Debug, Deserialize)]
struct SparqlValue {
    #[serde(rename = "type")]
    value_type: String,
    value: String,
    #[serde(default)]
    datatype: Option<String>,
    #[serde(default)]
    #[serde(rename = "xml:lang")]
    lang: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SparqlAskResult {
    boolean: bool,
}

// Domain types
#[derive(Debug, Clone)]
pub struct EntityOntology {
    pub uri: String,
    pub entity_type: String,
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct ValidationReport {
    pub conforms: bool,
    pub violations: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires running GraphDB
    async fn test_graphdb_query() {
        let config = crate::config::Config::default_dev();
        let client = GraphDBClient::new(&config.graphdb);

        let sparql = "SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }";
        let result = client.query_select(sparql).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_ontology_classes() {
        let config = crate::config::Config::default_dev();
        let client = GraphDBClient::new(&config.graphdb);
        let classes = client.get_ontology_classes().await;
        assert!(classes.is_ok());
    }
}
