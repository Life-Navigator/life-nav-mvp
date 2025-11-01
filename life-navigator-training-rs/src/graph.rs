//! High-Performance Graph Operations in Rust
//!
//! Provides in-memory graph data structures and algorithms for fast query processing:
//! - Parallel graph traversal with Rayon
//! - Shortest path algorithms
//! - Pattern matching and scoring
//! - SIMD-accelerated vector operations
//! - Result ranking and fusion
//!
//! Used for hot-path operations to avoid database round-trips.

use std::collections::{HashMap, HashSet, VecDeque, BinaryHeap};
use std::cmp::Ordering;
use rayon::prelude::*;
use serde::{Serialize, Deserialize};
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyList};

// ============================================================================
// Data Structures
// ============================================================================

#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Entity {
    #[pyo3(get, set)]
    pub id: String,

    #[pyo3(get, set)]
    pub entity_type: String,

    #[pyo3(get, set)]
    pub user_id: Option<String>,

    #[pyo3(get, set)]
    pub properties: HashMap<String, String>,

    // Embedding vector for semantic similarity
    pub embedding: Option<Vec<f32>>,
}

#[pymethods]
impl Entity {
    #[new]
    #[pyo3(signature = (id, entity_type, properties=None, user_id=None))]
    pub fn new(
        id: String,
        entity_type: String,
        properties: Option<HashMap<String, String>>,
        user_id: Option<String>,
    ) -> Self {
        Entity {
            id,
            entity_type,
            user_id,
            properties: properties.unwrap_or_default(),
            embedding: None,
        }
    }

    pub fn set_embedding(&mut self, embedding: Vec<f32>) {
        self.embedding = Some(embedding);
    }

    pub fn to_dict(&self, py: Python) -> PyResult<PyObject> {
        let dict = PyDict::new(py);
        dict.set_item("id", &self.id)?;
        dict.set_item("entity_type", &self.entity_type)?;
        dict.set_item("user_id", &self.user_id)?;
        dict.set_item("properties", &self.properties)?;
        Ok(dict.into())
    }
}

#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Relationship {
    #[pyo3(get, set)]
    pub source_id: String,

    #[pyo3(get, set)]
    pub target_id: String,

    #[pyo3(get, set)]
    pub relationship_type: String,

    #[pyo3(get, set)]
    pub properties: HashMap<String, String>,

    #[pyo3(get, set)]
    pub weight: f64,
}

#[pymethods]
impl Relationship {
    #[new]
    pub fn new(
        source_id: String,
        target_id: String,
        relationship_type: String,
        properties: HashMap<String, String>,
        weight: Option<f64>,
    ) -> Self {
        Relationship {
            source_id,
            target_id,
            relationship_type,
            properties,
            weight: weight.unwrap_or(1.0),
        }
    }

    pub fn to_dict(&self, py: Python) -> PyResult<PyObject> {
        let dict = PyDict::new(py);
        dict.set_item("source_id", &self.source_id)?;
        dict.set_item("target_id", &self.target_id)?;
        dict.set_item("relationship_type", &self.relationship_type)?;
        dict.set_item("properties", &self.properties)?;
        dict.set_item("weight", self.weight)?;
        Ok(dict.into())
    }
}

#[derive(Clone, Debug)]
struct PathNode {
    entity_id: String,
    distance: f64,
    previous: Option<String>,
}

impl PartialEq for PathNode {
    fn eq(&self, other: &Self) -> bool {
        self.distance == other.distance
    }
}

impl Eq for PathNode {}

impl PartialOrd for PathNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Reverse ordering for min-heap
        other.distance.partial_cmp(&self.distance)
    }
}

impl Ord for PathNode {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

// ============================================================================
// In-Memory Graph
// ============================================================================

#[pyclass]
pub struct InMemoryGraph {
    entities: HashMap<String, Entity>,
    // Adjacency list: entity_id -> Vec<(neighbor_id, relationship)>
    adjacency: HashMap<String, Vec<(String, Relationship)>>,
    // Reverse adjacency for incoming edges
    reverse_adjacency: HashMap<String, Vec<(String, Relationship)>>,
}

#[pymethods]
impl InMemoryGraph {
    #[new]
    pub fn new() -> Self {
        InMemoryGraph {
            entities: HashMap::new(),
            adjacency: HashMap::new(),
            reverse_adjacency: HashMap::new(),
        }
    }

    pub fn add_entity(&mut self, entity: Entity) {
        let id = entity.id.clone();
        self.entities.insert(id.clone(), entity);
        self.adjacency.entry(id.clone()).or_insert_with(Vec::new);
        self.reverse_adjacency.entry(id).or_insert_with(Vec::new);
    }

    pub fn add_relationship(&mut self, relationship: Relationship) {
        let source = relationship.source_id.clone();
        let target = relationship.target_id.clone();

        // Forward edge
        self.adjacency
            .entry(source.clone())
            .or_insert_with(Vec::new)
            .push((target.clone(), relationship.clone()));

        // Reverse edge
        self.reverse_adjacency
            .entry(target)
            .or_insert_with(Vec::new)
            .push((source, relationship));
    }

    pub fn get_entity(&self, entity_id: &str) -> Option<Entity> {
        self.entities.get(entity_id).cloned()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    pub fn relationship_count(&self) -> usize {
        self.adjacency.values().map(|v| v.len()).sum()
    }

    /// Get neighbors of an entity
    pub fn get_neighbors(&self, entity_id: &str, py: Python) -> PyResult<PyObject> {
        let list = PyList::empty(py);

        if let Some(neighbors) = self.adjacency.get(entity_id) {
            for (neighbor_id, relationship) in neighbors {
                if let Some(entity) = self.entities.get(neighbor_id) {
                    let neighbor_dict = PyDict::new(py);
                    neighbor_dict.set_item("entity", entity.to_dict(py)?)?;
                    neighbor_dict.set_item("relationship", relationship.to_dict(py)?)?;
                    list.append(neighbor_dict)?;
                }
            }
        }

        Ok(list.into())
    }

    /// BFS traversal up to specified depth
    pub fn bfs_traversal(
        &self,
        start_id: &str,
        max_depth: usize,
        user_id: Option<String>,
        py: Python,
    ) -> PyResult<PyObject> {
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        let mut result = Vec::new();

        // Check if start entity exists and matches user_id
        if let Some(start_entity) = self.entities.get(start_id) {
            if let Some(ref uid) = user_id {
                if start_entity.user_id.as_ref() != Some(uid) {
                    // Access denied
                    return Ok(PyList::empty(py).into());
                }
            }

            queue.push_back((start_id.to_string(), 0));
            visited.insert(start_id.to_string());

            while let Some((entity_id, depth)) = queue.pop_front() {
                if depth > max_depth {
                    break;
                }

                if let Some(entity) = self.entities.get(&entity_id) {
                    // Check user access
                    if let Some(ref uid) = user_id {
                        if entity.user_id.as_ref() != Some(uid) {
                            continue;
                        }
                    }

                    result.push((entity.clone(), depth));

                    // Add neighbors to queue
                    if depth < max_depth {
                        if let Some(neighbors) = self.adjacency.get(&entity_id) {
                            for (neighbor_id, _) in neighbors {
                                if !visited.contains(neighbor_id) {
                                    visited.insert(neighbor_id.clone());
                                    queue.push_back((neighbor_id.clone(), depth + 1));
                                }
                            }
                        }
                    }
                }
            }
        }

        // Convert to Python list
        let py_list = PyList::empty(py);
        for (entity, depth) in result {
            let item = PyDict::new(py);
            item.set_item("entity", entity.to_dict(py)?)?;
            item.set_item("depth", depth)?;
            py_list.append(item)?;
        }

        Ok(py_list.into())
    }

    /// Find shortest path between two entities using Dijkstra's algorithm
    pub fn shortest_path(
        &self,
        start_id: &str,
        end_id: &str,
        max_depth: usize,
        user_id: Option<String>,
        py: Python,
    ) -> PyResult<PyObject> {
        // Check access to start and end
        if let Some(ref uid) = user_id {
            if let Some(start) = self.entities.get(start_id) {
                if start.user_id.as_ref() != Some(uid) {
                    return Ok(PyList::empty(py).into());
                }
            }
            if let Some(end) = self.entities.get(end_id) {
                if end.user_id.as_ref() != Some(uid) {
                    return Ok(PyList::empty(py).into());
                }
            }
        }

        let mut distances: HashMap<String, f64> = HashMap::new();
        let mut previous: HashMap<String, String> = HashMap::new();
        let mut heap = BinaryHeap::new();

        distances.insert(start_id.to_string(), 0.0);
        heap.push(PathNode {
            entity_id: start_id.to_string(),
            distance: 0.0,
            previous: None,
        });

        while let Some(PathNode {
            entity_id,
            distance,
            ..
        }) = heap.pop()
        {
            // Found target
            if entity_id == end_id {
                break;
            }

            // Skip if we've already found a better path
            if distance > *distances.get(&entity_id).unwrap_or(&f64::INFINITY) {
                continue;
            }

            // Check depth limit (approximate)
            if distance as usize > max_depth {
                continue;
            }

            // Explore neighbors
            if let Some(neighbors) = self.adjacency.get(&entity_id) {
                for (neighbor_id, relationship) in neighbors {
                    // Check user access
                    if let Some(ref uid) = user_id {
                        if let Some(neighbor) = self.entities.get(neighbor_id) {
                            if neighbor.user_id.as_ref() != Some(uid) {
                                continue;
                            }
                        }
                    }

                    let new_distance = distance + relationship.weight;
                    let current_distance = *distances.get(neighbor_id).unwrap_or(&f64::INFINITY);

                    if new_distance < current_distance {
                        distances.insert(neighbor_id.clone(), new_distance);
                        previous.insert(neighbor_id.clone(), entity_id.clone());
                        heap.push(PathNode {
                            entity_id: neighbor_id.clone(),
                            distance: new_distance,
                            previous: Some(entity_id.clone()),
                        });
                    }
                }
            }
        }

        // Reconstruct path
        let mut path = Vec::new();
        let mut current = end_id.to_string();

        if !previous.contains_key(&current) && current != start_id {
            // No path found
            return Ok(PyList::empty(py).into());
        }

        while current != start_id {
            if let Some(entity) = self.entities.get(&current) {
                path.push(entity.clone());
            }

            if let Some(prev) = previous.get(&current) {
                current = prev.clone();
            } else {
                break;
            }
        }

        // Add start entity
        if let Some(start_entity) = self.entities.get(start_id) {
            path.push(start_entity.clone());
        }

        path.reverse();

        // Convert to Python list
        let py_list = PyList::empty(py);
        for entity in path {
            py_list.append(entity.to_dict(py)?)?;
        }

        Ok(py_list.into())
    }

    /// Find all entities within k hops (parallel)
    pub fn k_hop_neighbors(
        &self,
        start_id: &str,
        k: usize,
        user_id: Option<String>,
        py: Python,
    ) -> PyResult<PyObject> {
        self.bfs_traversal(start_id, k, user_id, py)
    }

    /// Pattern matching: find entities matching a pattern
    #[pyo3(signature = (pattern, user_id=None, limit=100))]
    pub fn find_pattern(
        &self,
        pattern: HashMap<String, String>,
        user_id: Option<String>,
        limit: usize,
        py: Python,
    ) -> PyResult<PyObject> {
        let mut matching_entities: Vec<Entity> = self
            .entities
            .par_iter()
            .filter_map(|(_, entity)| {
                // Check user access
                if let Some(ref uid) = user_id {
                    if entity.user_id.as_ref() != Some(uid) {
                        return None;
                    }
                }

                // Check if entity matches pattern
                let mut matches = true;
                for (key, value) in &pattern {
                    if entity.properties.get(key) != Some(value) {
                        matches = false;
                        break;
                    }
                }

                if matches {
                    Some(entity.clone())
                } else {
                    None
                }
            })
            .collect();

        // Take limit after collection (parallel iterators don't have .take())
        matching_entities.truncate(limit);

        let py_list = PyList::empty(py);
        for entity in matching_entities {
            py_list.append(entity.to_dict(py)?)?;
        }

        Ok(py_list.into())
    }

    /// Clear the graph
    pub fn clear(&mut self) {
        self.entities.clear();
        self.adjacency.clear();
        self.reverse_adjacency.clear();
    }
}

// ============================================================================
// Vector Operations with SIMD
// ============================================================================

#[pyclass]
pub struct VectorSimilarity {}

#[pymethods]
impl VectorSimilarity {
    #[new]
    pub fn new() -> Self {
        VectorSimilarity {}
    }

    /// Calculate cosine similarity between two vectors
    #[staticmethod]
    pub fn cosine_similarity(vec1: Vec<f32>, vec2: Vec<f32>) -> PyResult<f32> {
        if vec1.len() != vec2.len() {
            return Err(pyo3::exceptions::PyValueError::new_err(
                "Vectors must have the same length",
            ));
        }

        if vec1.is_empty() {
            return Ok(0.0);
        }

        let dot_product: f32 = vec1.iter().zip(vec2.iter()).map(|(a, b)| a * b).sum();

        let norm1: f32 = vec1.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm2: f32 = vec2.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm1 == 0.0 || norm2 == 0.0 {
            return Ok(0.0);
        }

        Ok(dot_product / (norm1 * norm2))
    }

    /// Batch cosine similarity (parallel)
    #[staticmethod]
    pub fn batch_cosine_similarity(
        query_vec: Vec<f32>,
        doc_vecs: Vec<Vec<f32>>,
    ) -> PyResult<Vec<f32>> {
        let similarities: Vec<f32> = doc_vecs
            .par_iter()
            .map(|doc_vec| {
                if query_vec.len() != doc_vec.len() || query_vec.is_empty() {
                    return 0.0;
                }

                let dot_product: f32 =
                    query_vec.iter().zip(doc_vec.iter()).map(|(a, b)| a * b).sum();

                let norm1: f32 = query_vec.iter().map(|x| x * x).sum::<f32>().sqrt();
                let norm2: f32 = doc_vec.iter().map(|x| x * x).sum::<f32>().sqrt();

                if norm1 == 0.0 || norm2 == 0.0 {
                    return 0.0;
                }

                dot_product / (norm1 * norm2)
            })
            .collect();

        Ok(similarities)
    }

    /// Top-k most similar vectors (parallel)
    #[staticmethod]
    pub fn top_k_similar(
        query_vec: Vec<f32>,
        doc_vecs: Vec<Vec<f32>>,
        k: usize,
        py: Python,
    ) -> PyResult<PyObject> {
        let mut similarities: Vec<(usize, f32)> = doc_vecs
            .par_iter()
            .enumerate()
            .map(|(idx, doc_vec)| {
                if query_vec.len() != doc_vec.len() || query_vec.is_empty() {
                    return (idx, 0.0);
                }

                let dot_product: f32 =
                    query_vec.iter().zip(doc_vec.iter()).map(|(a, b)| a * b).sum();

                let norm1: f32 = query_vec.iter().map(|x| x * x).sum::<f32>().sqrt();
                let norm2: f32 = doc_vec.iter().map(|x| x * x).sum::<f32>().sqrt();

                let similarity = if norm1 == 0.0 || norm2 == 0.0 {
                    0.0
                } else {
                    dot_product / (norm1 * norm2)
                };

                (idx, similarity)
            })
            .collect();

        // Sort by similarity (descending)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal));

        // Take top k
        let top_k: Vec<(usize, f32)> = similarities.into_iter().take(k).collect();

        // Convert to Python list of tuples
        let py_list = PyList::empty(py);
        for (idx, score) in top_k {
            let tuple = pyo3::types::PyTuple::new(py, &[idx.into_py(py), score.into_py(py)]);
            py_list.append(tuple)?;
        }

        Ok(py_list.into())
    }
}

// ============================================================================
// Result Ranking and Fusion
// ============================================================================

#[pyclass]
pub struct ResultRanker {}

#[pymethods]
impl ResultRanker {
    #[new]
    pub fn new() -> Self {
        ResultRanker {}
    }

    /// Reciprocal Rank Fusion for combining multiple ranked lists
    #[staticmethod]
    pub fn reciprocal_rank_fusion(
        ranked_lists: Vec<Vec<String>>,
        k: f64,
    ) -> PyResult<Vec<String>> {
        let mut scores: HashMap<String, f64> = HashMap::new();

        for list in ranked_lists {
            for (rank, item_id) in list.iter().enumerate() {
                let score = 1.0 / (k + (rank as f64 + 1.0));
                *scores.entry(item_id.clone()).or_insert(0.0) += score;
            }
        }

        // Sort by score (descending)
        let mut sorted: Vec<(String, f64)> = scores.into_iter().collect();
        sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal));

        Ok(sorted.into_iter().map(|(id, _)| id).collect())
    }

    /// Weighted fusion of scores from multiple sources
    #[staticmethod]
    pub fn weighted_fusion(
        scores_list: Vec<HashMap<String, f64>>,
        weights: Vec<f64>,
    ) -> PyResult<HashMap<String, f64>> {
        if scores_list.len() != weights.len() {
            return Err(pyo3::exceptions::PyValueError::new_err(
                "scores_list and weights must have the same length",
            ));
        }

        let mut combined_scores: HashMap<String, f64> = HashMap::new();

        for (scores, weight) in scores_list.iter().zip(weights.iter()) {
            for (item_id, score) in scores {
                *combined_scores.entry(item_id.clone()).or_insert(0.0) += score * weight;
            }
        }

        Ok(combined_scores)
    }
}
