use crate::host::interfaces::kv_store;
use crate::compliance::ActionInput;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use hex;
use crate::host::tenant::tenant_context;

fn kv_name(suffix: &str) -> String {
    let tid = hex::encode(tenant_context::tenant_did());
    format!("z:{}:{}", tid, suffix)
}

#[derive(Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: u64,
    #[serde(rename = "agentDid")]
    pub agent_did: String,
    pub decision: String,
    #[serde(rename = "policyClause")]
    pub policy_clause: String,
    pub action: Value,
    #[serde(rename = "receiptId")]
    pub receipt_id: String,
}

pub fn write_entry(
    agent_did: &str,
    decision: &str,
    policy_clause: &str,
    action: &ActionInput,
    request_id: &str,
) -> Result<(), String> {
    let ts = current_timestamp_ms();
    let entry_key = format!("{}:{}", ts, request_id);
    let audit_map = kv_name("audit-log");

    let entry = AuditEntry {
        id: request_id.to_string(),
        timestamp: ts,
        agent_did: agent_did.to_string(),
        decision: decision.to_string(),
        policy_clause: policy_clause.to_string(),
        action: serde_json::to_value(action).unwrap_or(Value::Null),
        receipt_id: format!("RCP-{}", request_id),
    };

    let entry_json = serde_json::to_vec(&entry)
        .map_err(|e| format!("audit: serialization failed — {e}"))?;

    kv_store::set(&audit_map, entry_key.as_bytes(), &entry_json)
        .map_err(|e| format!("audit: KV write failed for key '{entry_key}' — {e}"))?;

    Ok(())
}

pub fn query(input: &[u8]) -> Result<Vec<u8>, String> {
    #[derive(Deserialize)]
    struct QueryRequest {
        #[serde(rename = "agentDid")]
        agent_did: Option<String>,
        #[serde(rename = "startTs")]
        start_ts: Option<u64>,
        #[serde(rename = "endTs")]
        end_ts: Option<u64>,
        limit: Option<usize>,
    }

    let req: QueryRequest = serde_json::from_slice(input)
        .map_err(|e| format!("query-audit-log: invalid JSON — {e}"))?;

    let limit = req.limit.unwrap_or(50).min(200);
    let audit_map = kv_name("audit-log");

    let keys = kv_store::list_keys(&audit_map)
        .map_err(|e| format!("audit: list_keys failed — {e}"))?;

    let mut entries: Vec<AuditEntry> = vec![];
    for key in keys.iter().take(limit * 2) {
        let raw = kv_store::get(&audit_map, key.as_bytes())
            .ok().flatten();
        if let Some(bytes) = raw {
            if let Ok(entry) = serde_json::from_slice::<AuditEntry>(&bytes) {
                if let Some(ref did) = req.agent_did {
                    if &entry.agent_did != did { continue; }
                }
                if let Some(start) = req.start_ts {
                    if entry.timestamp < start { continue; }
                }
                if let Some(end) = req.end_ts {
                    if entry.timestamp > end { continue; }
                }
                entries.push(entry);
                if entries.len() >= limit { break; }
            }
        }
    }

    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    serde_json::to_vec(&entries).map_err(|e| format!("query-audit-log: serialization — {e}"))
}

fn current_timestamp_ms() -> u64 {
    use crate::host::interfaces::time;
    time::now_ms()
}
