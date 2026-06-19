use crate::audit;
use crate::receipt;
use crate::host::interfaces::{kv_store, logging};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use hex;

#[derive(Deserialize)]
struct EvaluateRequest {
    #[serde(rename = "agentDid")]
    agent_did: String,
    action: ActionInput,
    #[serde(rename = "requestId")]
    request_id: String,
    timestamp: u64,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct ActionInput {
    #[serde(rename = "type")]
    action_type: String,
    resource: String,
    amount: Option<f64>,
    currency: Option<String>,
    metadata: Option<Value>,
}

#[derive(Deserialize)]
struct RevokeRequest {
    #[serde(rename = "targetAgentDid")]
    target_agent_did: String,
    #[serde(rename = "operatorDid")]
    operator_did: String,
    reason: String,
}

#[derive(Serialize, Deserialize)]
struct AgentRecord {
    did: String,
    #[serde(rename = "type")]
    agent_type: String,
    scope: Vec<String>,
    #[serde(rename = "credentialStatus")]
    credential_status: String,
    #[serde(rename = "issuedAt")]
    issued_at: u64,
    #[serde(rename = "expiresAt")]
    expires_at: u64,
}

fn kv_name(suffix: &str) -> String {
    let tid = hex::encode(tenant_context::tenant_did());
    format!("z:{}:{}", tid, suffix)
}

pub fn evaluate(input: &[u8], _context: Option<&[u8]>) -> Result<Vec<u8>, String> {
    let req: EvaluateRequest = serde_json::from_slice(input)
        .map_err(|e| format!("evaluate-compliance: invalid JSON input — {e}"))?;

    logging::info(&format!(
        "[SENTINEL] evaluate-compliance: agent={} action={} req={}",
        req.agent_did, req.action.action_type, req.request_id
    ));

    let agent_record = load_agent_record(&req.agent_did)?;

    if agent_record.credential_status != "active" {
        let denial = build_denial_response(
            &req,
            &format!(
                "Agent credential is '{}' — only 'active' credentials may act.",
                agent_record.credential_status
            ),
            "credential.status != active",
        );
        audit::write_entry(&req.agent_did, "DENY", "credential.status != active", &req.action, &req.request_id)?;
        return serde_json::to_vec(&denial).map_err(|e| e.to_string());
    }

    if req.timestamp > agent_record.expires_at {
        let denial = build_denial_response(
            &req,
            "Agent credential has expired.",
            "credential.expired",
        );
        audit::write_entry(&req.agent_did, "DENY", "credential.expired", &req.action, &req.request_id)?;
        return serde_json::to_vec(&denial).map_err(|e| e.to_string());
    }

    let policy_text = load_policy(&agent_record.agent_type)?;
    let policy_hash = sha256_hex(policy_text.as_bytes());

    let decision = evaluate_rules(
        &agent_record,
        &req.action,
        req.timestamp,
    );

    let (clause, reason) = policy_clause_for_decision(&decision, &agent_record, &req.action);

    audit::write_entry(&req.agent_did, &format!("{:?}", decision), &clause, &req.action, &req.request_id)?;

    let issued_receipt = receipt::issue(
        &req.agent_did,
        &format!("{:?}", decision),
        &policy_hash,
        &clause,
        &req.request_id,
        req.timestamp,
    )?;

    let response = json!({
        "requestId": req.request_id,
        "decision": format!("{:?}", decision),
        "receipt": issued_receipt,
        "reason": reason,
        "escalationId": if decision == Decision::Escalate {
            Some(format!("ESC-{}", &req.request_id[..8]))
        } else {
            None
        }
    });

    serde_json::to_vec(&response).map_err(|e| format!("evaluate-compliance: serialization failed — {e}"))
}

#[derive(Debug, PartialEq)]
enum Decision { Permit, Deny, Escalate }

fn evaluate_rules(agent: &AgentRecord, action: &ActionInput, timestamp_ms: u64) -> Decision {
    if agent.agent_type == "travel-booking" {
        let hour_of_day = ((timestamp_ms / 1000) % 86400) / 3600;
        if hour_of_day < 9 || hour_of_day >= 17 {
            return Decision::Deny;
        }
    }

    let scope_cap = extract_spend_cap(&agent.scope);
    if let Some(amount) = action.amount {
        if scope_cap != u64::MAX && amount as u64 > scope_cap {
            if amount as u64 > (scope_cap * 8 / 10) {
                return Decision::Escalate;
            }
            return Decision::Deny;
        }
    }

    let allowed_domains = extract_domains(&agent.scope);
    let action_domain = action.resource.split(':').next().unwrap_or("");
    if !allowed_domains.is_empty() && !allowed_domains.contains(&action_domain.to_string()) {
        return Decision::Deny;
    }

    Decision::Permit
}

fn extract_spend_cap(scope: &[String]) -> u64 {
    for s in scope {
        if let Some(cap_str) = s.strip_prefix("spend:") {
            if cap_str == "unlimited" { return u64::MAX; }
            if let Ok(cap) = cap_str.parse::<u64>() { return cap; }
        }
    }
    0
}

fn extract_domains(scope: &[String]) -> Vec<String> {
    for s in scope {
        if let Some(domains_str) = s.strip_prefix("domain:") {
            return domains_str.split(',').map(|d| d.to_string()).collect();
        }
    }
    vec![]
}

fn policy_clause_for_decision(
    decision: &Decision,
    agent: &AgentRecord,
    action: &ActionInput,
) -> (String, String) {
    match decision {
        Decision::Permit => (
            format!("permit(principal={}, action={})", agent.agent_type, action.action_type),
            "Action permitted within policy bounds.".to_string(),
        ),
        Decision::Deny => (
            format!("forbid(principal={}, action={})", agent.agent_type, action.action_type),
            format!(
                "Action '{}' on resource '{}' exceeds permitted scope for agent type '{}'.",
                action.action_type, action.resource, agent.agent_type
            ),
        ),
        Decision::Escalate => (
            format!("escalate(principal={}, action={})", agent.agent_type, action.action_type),
            "Action requires human operator review before execution.".to_string(),
        ),
    }
}

fn build_denial_response(
    req: &EvaluateRequest,
    reason: &str,
    clause: &str,
) -> Value {
    json!({
        "requestId": req.request_id,
        "decision": "DENY",
        "receipt": {
            "receiptId": format!("DENIED-{}", req.request_id),
            "agentDid": req.agent_did,
            "decision": "DENY",
            "policyHash": "",
            "policyClause": clause,
            "issuedAt": req.timestamp,
            "expiresAt": req.timestamp,
            "signature": ""
        },
        "reason": reason
    })
}

pub fn revoke(input: &[u8], _context: Option<&[u8]>) -> Result<Vec<u8>, String> {
    let req: RevokeRequest = serde_json::from_slice(input)
        .map_err(|e| format!("revoke-agent: invalid JSON — {e}"))?;

    logging::info(&format!(
        "[SENTINEL] revoke-agent: target={} operator={} reason={}",
        req.target_agent_did, req.operator_did, req.reason
    ));

    let mut agent_record = load_agent_record(&req.target_agent_did)?;
    agent_record.credential_status = "revoked".to_string();

    let registry_map = kv_name("agent-registry");
    let updated_json = serde_json::to_string(&agent_record)
        .map_err(|e| format!("revoke-agent: serialization failed — {e}"))?;
    kv_store::set(&registry_map, req.target_agent_did.as_bytes(), updated_json.as_bytes())
        .map_err(|e| format!("revoke-agent: KV write failed — {e}"))?;

    invalidate_receipts_for_did(&req.target_agent_did)?;

    let revocation_timestamp = current_timestamp_ms();

    let revoke_action = serde_json::from_str::<ActionInput>(&format!(
        r#"{{"type":"revoke","resource":"did-registry","metadata":{{"operator":"{}","reason":"{}"}}}}"#,
        req.operator_did, req.reason
    )).unwrap_or(ActionInput {
        action_type: "revoke".into(),
        resource: "did-registry".into(),
        amount: None,
        currency: None,
        metadata: None,
    });

    audit::write_entry(
        &req.operator_did,
        "REVOKE",
        &format!("operator_revoked:{}", req.target_agent_did),
        &revoke_action,
        &format!("revoke-{}", revocation_timestamp),
    )?;

    let response = json!({
        "revoked": true,
        "targetAgentDid": req.target_agent_did,
        "operatorDid": req.operator_did,
        "reason": req.reason,
        "revokedAt": revocation_timestamp
    });

    serde_json::to_vec(&response).map_err(|e| e.to_string())
}

fn load_agent_record(did: &str) -> Result<AgentRecord, String> {
    let registry_map = kv_name("agent-registry");
    let raw = kv_store::get(&registry_map, did.as_bytes())
        .map_err(|e| format!("agent-registry KV read failed — {e}"))?
        .ok_or_else(|| format!("Agent DID not found in registry: {did}"))?;
    serde_json::from_slice::<AgentRecord>(&raw)
        .map_err(|e| format!("agent-registry: corrupt record for {did} — {e}"))
}

fn load_policy(agent_type: &str) -> Result<String, String> {
    let policies_map = kv_name("policies");
    let raw = kv_store::get(&policies_map, agent_type.as_bytes())
        .map_err(|e| format!("policies KV read failed — {e}"))?
        .ok_or_else(|| format!("No Cedar policy for agent type: {agent_type}. Defaulting to DENY."))?;
    String::from_utf8(raw).map_err(|e| format!("policy bytes invalid UTF-8 — {e}"))
}

fn invalidate_receipts_for_did(did: &str) -> Result<(), String> {
    let revocations_map = kv_name("revocations");
    let now = "1";
    kv_store::set(&revocations_map, did.as_bytes(), now.as_bytes())
        .map_err(|e| format!("revocations KV write failed — {e}"))
}

fn sha256_hex(data: &[u8]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    data.hash(&mut h);
    format!("{:016x}", h.finish())
}

fn current_timestamp_ms() -> u64 {
    use crate::host::interfaces::time;
    time::now_ms()
}
