//! Elite-Level Query Caching System
//!
//! LRU cache with TTL support for optimizing repeated queries.

use std::collections::HashMap;
use std::hash::Hash;
use std::sync::Arc;
use std::time::{Duration, Instant};
use parking_lot::RwLock;

/// LRU cache entry with TTL
struct CacheEntry<V> {
    value: V,
    inserted_at: Instant,
    last_accessed: Instant,
    access_count: u64,
}

/// LRU cache with TTL and statistics
pub struct LruCache<K, V>
where
    K: Eq + Hash + Clone,
    V: Clone,
{
    entries: Arc<RwLock<HashMap<K, CacheEntry<V>>>>,
    capacity: usize,
    ttl: Duration,
    hits: Arc<std::sync::atomic::AtomicU64>,
    misses: Arc<std::sync::atomic::AtomicU64>,
}

impl<K, V> LruCache<K, V>
where
    K: Eq + Hash + Clone,
    V: Clone,
{
    /// Create new LRU cache with capacity and TTL
    pub fn new(capacity: usize, ttl: Duration) -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::with_capacity(capacity))),
            capacity,
            ttl,
            hits: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            misses: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    /// Get value from cache
    pub fn get(&self, key: &K) -> Option<V> {
        let mut entries = self.entries.write();

        if let Some(entry) = entries.get_mut(key) {
            // Check if entry is expired
            if entry.inserted_at.elapsed() > self.ttl {
                entries.remove(key);
                self.misses
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                return None;
            }

            // Update access metadata
            entry.last_accessed = Instant::now();
            entry.access_count += 1;

            self.hits
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            Some(entry.value.clone())
        } else {
            self.misses
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            None
        }
    }

    /// Insert value into cache
    pub fn insert(&self, key: K, value: V) {
        let mut entries = self.entries.write();

        // Check capacity and evict if necessary
        if entries.len() >= self.capacity && !entries.contains_key(&key) {
            self.evict_lru(&mut entries);
        }

        entries.insert(
            key,
            CacheEntry {
                value,
                inserted_at: Instant::now(),
                last_accessed: Instant::now(),
                access_count: 1,
            },
        );
    }

    /// Evict least recently used entry
    fn evict_lru(&self, entries: &mut HashMap<K, CacheEntry<V>>) {
        if let Some(lru_key) = entries
            .iter()
            .min_by_key(|(_, entry)| entry.last_accessed)
            .map(|(k, _)| k.clone())
        {
            entries.remove(&lru_key);
        }
    }

    /// Invalidate (remove) entry from cache
    pub fn invalidate(&self, key: &K) {
        self.entries.write().remove(key);
    }

    /// Clear all cache entries
    pub fn clear(&self) {
        self.entries.write().clear();
    }

    /// Remove expired entries
    pub fn cleanup_expired(&self) {
        let mut entries = self.entries.write();
        let now = Instant::now();

        entries.retain(|_, entry| now.duration_since(entry.inserted_at) <= self.ttl);
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let entries = self.entries.read();
        let hits = self.hits.load(std::sync::atomic::Ordering::Relaxed);
        let misses = self.misses.load(std::sync::atomic::Ordering::Relaxed);
        let total = hits + misses;

        CacheStats {
            size: entries.len(),
            capacity: self.capacity,
            hits,
            misses,
            hit_rate: if total > 0 {
                hits as f64 / total as f64
            } else {
                0.0
            },
            total_accesses: total,
        }
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub size: usize,
    pub capacity: usize,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
    pub total_accesses: u64,
}

/// Query cache key (for database queries)
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct QueryCacheKey {
    pub query: String,
    pub params: String, // JSON-serialized parameters
}

impl QueryCacheKey {
    pub fn new(query: impl Into<String>, params: impl Into<String>) -> Self {
        Self {
            query: query.into(),
            params: params.into(),
        }
    }
}

/// Specialized query result cache
pub type QueryCache = LruCache<QueryCacheKey, Vec<HashMap<String, serde_json::Value>>>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_insert_and_get() {
        let cache = LruCache::new(10, Duration::from_secs(60));

        cache.insert("key1", "value1");
        assert_eq!(cache.get(&"key1"), Some("value1"));

        let stats = cache.stats();
        assert_eq!(stats.hits, 1);
        assert_eq!(stats.misses, 0);
    }

    #[test]
    fn test_cache_miss() {
        let cache: LruCache<String, String> = LruCache::new(10, Duration::from_secs(60));

        assert_eq!(cache.get(&"nonexistent".to_string()), None);

        let stats = cache.stats();
        assert_eq!(stats.hits, 0);
        assert_eq!(stats.misses, 1);
    }

    #[test]
    fn test_cache_eviction() {
        let cache = LruCache::new(2, Duration::from_secs(60));

        cache.insert("key1", "value1");
        cache.insert("key2", "value2");
        cache.insert("key3", "value3"); // Should evict key1

        assert_eq!(cache.get(&"key1"), None); // Evicted
        assert_eq!(cache.get(&"key2"), Some("value2"));
        assert_eq!(cache.get(&"key3"), Some("value3"));
    }

    #[test]
    fn test_cache_ttl() {
        let cache = LruCache::new(10, Duration::from_millis(50));

        cache.insert("key1", "value1");
        assert_eq!(cache.get(&"key1"), Some("value1"));

        // Wait for TTL to expire
        std::thread::sleep(Duration::from_millis(60));

        assert_eq!(cache.get(&"key1"), None); // Expired
    }

    #[test]
    fn test_cache_cleanup_expired() {
        let cache = LruCache::new(10, Duration::from_millis(50));

        cache.insert("key1", "value1");
        cache.insert("key2", "value2");

        std::thread::sleep(Duration::from_millis(60));

        cache.cleanup_expired();

        let stats = cache.stats();
        assert_eq!(stats.size, 0); // All expired
    }

    #[test]
    fn test_cache_hit_rate() {
        let cache = LruCache::new(10, Duration::from_secs(60));

        cache.insert("key1", "value1");

        cache.get(&"key1"); // Hit
        cache.get(&"key1"); // Hit
        cache.get(&"key2"); // Miss

        let stats = cache.stats();
        assert_eq!(stats.hits, 2);
        assert_eq!(stats.misses, 1);
        assert!((stats.hit_rate - 0.666).abs() < 0.01);
    }

    #[test]
    fn test_query_cache_key() {
        let key1 = QueryCacheKey::new("SELECT * FROM users", r#"{"id": 123}"#);
        let key2 = QueryCacheKey::new("SELECT * FROM users", r#"{"id": 123}"#);
        let key3 = QueryCacheKey::new("SELECT * FROM users", r#"{"id": 456}"#);

        assert_eq!(key1, key2); // Same query and params
        assert_ne!(key1, key3); // Different params
    }
}
