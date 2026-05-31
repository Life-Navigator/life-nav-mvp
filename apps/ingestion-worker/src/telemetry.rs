//! Structured tracing setup + a small helper that redacts sensitive
//! field names from any value before it lands in a log line.
//!
//! We never log raw PHI/PII. The redactor below walks a `serde_json::Value`
//! and replaces any key matching `SENSITIVE_FIELD_PATTERN` with the
//! string `"[REDACTED]"`. The pattern is also used by the normalizer
//! when building the canonical embedding text — it's the single source
//! of truth for "what we never let through".

use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Initialize structured (JSON) tracing at the level requested by
/// `LOG_LEVEL`. Falls back to `info` when unset or unparseable.
pub fn init(log_level: &str) {
    let filter = EnvFilter::try_new(log_level).unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(filter)
        .with(
            fmt::layer()
                .json()
                .with_target(true)
                .with_current_span(true),
        )
        .init();
}

/// Regex describing field names we treat as sensitive — these are
/// stripped from embedding text and redacted in any structured log
/// values that might include them.
pub static SENSITIVE_FIELD_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)(_encrypted$|^member_id$|^group_number$|^account_number$|^routing_number$|\b(ssn|social_security)\b|^notes_encrypted$|^password|^api[_-]?key$|^access_token|^refresh_token)",
    )
    .expect("sensitive-field regex compiles")
});

/// Walk a JSON value, replacing any sensitive-named key's value with
/// the string `"[REDACTED]"`. Returns a fresh `Value` — does not
/// mutate the input.
pub fn redact_sensitive(v: &Value) -> Value {
    match v {
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (k, val) in map {
                if SENSITIVE_FIELD_PATTERN.is_match(k) {
                    out.insert(k.clone(), Value::String("[REDACTED]".into()));
                } else {
                    out.insert(k.clone(), redact_sensitive(val));
                }
            }
            Value::Object(out)
        }
        Value::Array(arr) => Value::Array(arr.iter().map(redact_sensitive).collect()),
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn redacts_encrypted_suffix() {
        let v = json!({
            "name": "Acme PPO",
            "member_id_encrypted": "xxx",
            "routing_number_encrypted": "yyy",
            "ok_field": 42,
        });
        let r = redact_sensitive(&v);
        assert_eq!(r["member_id_encrypted"], "[REDACTED]");
        assert_eq!(r["routing_number_encrypted"], "[REDACTED]");
        assert_eq!(r["name"], "Acme PPO");
        assert_eq!(r["ok_field"], 42);
    }

    #[test]
    fn redacts_member_id_and_ssn_recursively() {
        let v = json!({
            "outer": {
                "member_id": "M123",
                "ssn": "000-00-0000",
                "ok": "fine",
            }
        });
        let r = redact_sensitive(&v);
        assert_eq!(r["outer"]["member_id"], "[REDACTED]");
        assert_eq!(r["outer"]["ssn"], "[REDACTED]");
        assert_eq!(r["outer"]["ok"], "fine");
    }

    #[test]
    fn ignores_non_sensitive_keys() {
        let v = json!({"title": "x", "amount": 100});
        let r = redact_sensitive(&v);
        assert_eq!(r, v);
    }
}
