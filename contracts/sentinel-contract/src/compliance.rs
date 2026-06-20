use crate::audit;
use crate::receipt;
use crate::host::interfaces::{kv_store, logging, signing, time};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use hex;

const ADMIN_PUBKEY_KV_KEY: &str = "operator-public-key";
const ESCALATIONS_MAP_SUFFIX: &str = "escalations";
const SPEND_LEDGER_SUFFIX: &str = "spend-ledger";

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

#[derive(Deserialize, Serialize)]
struct RevokeRequest {
    #[serde(rename = "targetAgentDid")]
    target_agent_did: String,
    #[serde(rename = "operatorDid")]
    operator_did: String,
    reason: String,
    signature: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct RegisterRequest {
    #[serde(rename = "agentDid")]
    did: String,
    #[serde(rename = "agentType")]
    agent_type: String,
    scope: Vec<String>,
    #[serde(rename = "issuedAt")]
    issued_at: u64,
    #[serde(rename = "expiresAt")]
    expires_at: u64,
    signature: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct SeedPolicyRequest {
    #[serde(rename = "agentType")]
    agent_type: String,
    #[serde(rename = "policyText")]
    policy_text: String,
    signature: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct ResolveEscalationRequest {
    #[serde(rename = "escalationId")]
    escalation_id: String,
    decision: String,
    #[serde(rename = "operatorDid")]
    operator_did: String,
    reason: Option<String>,
    signature: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentRecord {
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

#[derive(Serialize, Deserialize)]
struct EscalationRecord {
    #[serde(rename = "escalationId")]
    escalation_id: String,
    #[serde(rename = "agentDid")]
    agent_did: String,
    #[serde(rename = "requestId")]
    request_id: String,
    action: Value,
    amount: f64,
    reason: String,
    status: String,
    #[serde(rename = "createdAt")]
    created_at: u64,
    #[serde(rename = "resolvedAt")]
    resolved_at: Option<u64>,
    resolution: Option<String>,
    #[serde(rename = "resolvedBy")]
    resolved_by: Option<String>,
}

fn kv_name(suffix: &str) -> String {
    let tid = hex::encode(tenant_context::tenant_did());
    format!("z:{}:{}", tid, suffix)
}

fn verify_admin_signature(payload: &[u8], signature_hex: &str) -> Result<bool, String> {
    let admin_pubkey_map = kv_name("admin-config");
    let pubkey_raw = match kv_store::get(&admin_pubkey_map, ADMIN_PUBKEY_KV_KEY.as_bytes()) {
        Ok(Some(raw)) => raw,
        Ok(None) => return Ok(true), // No public key configured — skip verification (dev/setup mode)
        Err(e) => return Err(format!("admin-config KV read failed — {e}")),
    };

    let sig_bytes = hex::decode(signature_hex)
        .map_err(|e| format!("invalid signature hex — {e}"))?;

    signing::verify(payload, &sig_bytes, &pubkey_raw)
        .map_err(|e| format!("signature verification failed — {e}"))
}

/// Build a canonical JSON payload from a request struct, excluding the
/// `signature` field (which is appended after signing and must not be
/// included in the signed data).
fn canonicalize_without_signature<T: Serialize>(request: &T) -> Result<Vec<u8>, String> {
    let mut value = serde_json::to_value(request)
        .map_err(|e| format!("canonicalization failed — {e}"))?;
    if let Some(obj) = value.as_object_mut() {
        obj.remove("signature");
    }
    serde_json::to_vec(&value).map_err(|e| format!("canonicalization serialization failed — {e}"))
}

fn require_admin_auth<T: Serialize>(request: &T, signature_opt: &Option<String>) -> Result<(), String> {
    let sig = signature_opt.as_ref()
        .ok_or_else(|| "admin operation requires a signature field".to_string())?;

    let canonical = canonicalize_without_signature(request)?;

    let valid = verify_admin_signature(&canonical, sig)?;
    if !valid {
        return Err("signature does not match operator public key".to_string());
    }
    Ok(())
}

pub fn register(input: &[u8], _context: Option<&[u8]>) -> Result<Vec<u8>, String> {
    let req: RegisterRequest = serde_json::from_slice(input)
        .map_err(|e| format!("register-agent: invalid JSON — {e}"))?;

    require_admin_auth(&req, &req.signature)?;

    logging::info(&format!(
        "[SENTINEL] register-agent: did={} type={}",
        req.did, req.agent_type
    ));

    let record = AgentRecord {
        did: req.did.clone(),
        agent_type: req.agent_type,
        scope: req.scope,
        credential_status: "active".to_string(),
        issued_at: req.issued_at,
        expires_at: req.expires_at,
    };

    let registry_map = kv_name("agent-registry");
    let bytes = serde_json::to_vec(&record)
        .map_err(|e| format!("register-agent: serialization failed — {e}"))?;
    kv_store::set(&registry_map, req.did.as_bytes(), &bytes)
        .map_err(|e| format!("register-agent: KV write failed — {e}"))?;

    serde_json::to_vec(&json!({ "registered": true, "did": req.did }))
        .map_err(|e| e.to_string())
}

pub fn seed_policy(input: &[u8], _context: Option<&[u8]>) -> Result<Vec<u8>, String> {
    let req: SeedPolicyRequest = serde_json::from_slice(input)
        .map_err(|e| format!("seed-policy: invalid JSON — {e}"))?;

    require_admin_auth(&req, &req.signature)?;

    logging::info(&format!(
        "[SENTINEL] seed-policy: agent_type={} len={}",
        req.agent_type,
        req.policy_text.len()
    ));

    let policies_map = kv_name("policies");
    kv_store::set(&policies_map, req.agent_type.as_bytes(), req.policy_text.as_bytes())
        .map_err(|e| format!("seed-policy: KV write failed — {e}"))?;

    serde_json::to_vec(&json!({ "seeded": true, "agentType": req.agent_type }))
        .map_err(|e| e.to_string())
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

    let mut escalation_id: Option<String> = None;
    if decision == Decision::Escalate {
        let eid = format!("ESC-{}", &req.request_id[..8.min(req.request_id.len())]);
        escalation_id = Some(eid.clone());

        let escalation_record = EscalationRecord {
            escalation_id: eid.clone(),
            agent_did: req.agent_did.clone(),
            request_id: req.request_id.clone(),
            action: serde_json::to_value(&req.action).unwrap_or(Value::Null),
            amount: req.action.amount.unwrap_or(0.0),
            reason: reason.clone(),
            status: "pending".to_string(),
            created_at: time::now_ms(),
            resolved_at: None,
            resolution: None,
            resolved_by: None,
        };

        let esc_map = kv_name(ESCALATIONS_MAP_SUFFIX);
        let esc_bytes = serde_json::to_vec(&escalation_record)
            .map_err(|e| format!("evaluate-compliance: escalation serialization — {e}"))?;
        kv_store::set(&esc_map, eid.as_bytes(), &esc_bytes)
            .map_err(|e| format!("evaluate-compliance: escalation KV write failed — {e}"))?;

        logging::info(&format!("[SENTINEL] escalation created: {} for agent {}", eid, req.agent_did));
    }

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
        "escalationId": escalation_id,
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
        if scope_cap != u64::MAX && scope_cap > 0 {
            let daily = cumulative_spend_for_period(&agent.did, timestamp_ms);
            let hourly = cumulative_spend_for_window(&agent.did, timestamp_ms, 3600, "hourly");
            let total_daily = daily + amount as u64;
            let total_hourly = hourly + amount as u64;
            let hourly_cap = scope_cap / 10;

            if total_daily > scope_cap {
                if total_daily <= scope_cap * 12 / 10 {
                    return Decision::Escalate;
                }
                return Decision::Deny;
            }

            if total_daily >= scope_cap * 8 / 10 {
                return Decision::Escalate;
            }

            if hourly_cap > 0 && total_hourly > hourly_cap {
                return Decision::Escalate;
            }
        }
    }

    let allowed_domains = extract_domains(&agent.scope);
    let action_domain = action.resource.split(':').next().unwrap_or("");
    if !allowed_domains.is_empty() && !allowed_domains.contains(&action_domain.to_string()) {
        return Decision::Deny;
    }

    Decision::Permit
}

fn bucket_key(did: &str, timestamp_ms: u64, window_seconds: u64, suffix: &str) -> String {
    let bucket = timestamp_ms / 1000 / window_seconds;
    format!("{}:{}:{}", did, bucket, suffix)
}

fn cumulative_spend_for_window(did: &str, timestamp_ms: u64, window_seconds: u64, suffix: &str) -> u64 {
    let ledger_map = kv_name(SPEND_LEDGER_SUFFIX);
    let ledger_key = bucket_key(did, timestamp_ms, window_seconds, suffix);
    match kv_store::get(&ledger_map, ledger_key.as_bytes()) {
        Ok(Some(raw)) => {
            let s = String::from_utf8(raw).unwrap_or_default();
            s.parse::<u64>().unwrap_or(0)
        }
        _ => 0,
    }
}

fn cumulative_spend_for_period(did: &str, timestamp_ms: u64) -> u64 {
    cumulative_spend_for_window(did, timestamp_ms, 86400, "daily")
}

fn record_spend(did: &str, amount: u64, timestamp_ms: u64) {
    let ledger_map = kv_name(SPEND_LEDGER_SUFFIX);
    let windows: [(u64, &str); 3] = [
        (3600, "hourly"),
        (86400, "daily"),
        (604800, "weekly"),
    ];
    for &(win_sec, win_sfx) in windows.iter() {
        let key = bucket_key(did, timestamp_ms, win_sec, win_sfx);
        let current = cumulative_spend_for_window(did, timestamp_ms, win_sec, win_sfx);
        let new_total = current + amount;
        kv_store::set(&ledger_map, key.as_bytes(), new_total.to_string().as_bytes()).ok();
    }
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

    require_admin_auth(&req, &req.signature)?;

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

    let revocation_timestamp = time::now_ms();

    let revoke_action = ActionInput {
        action_type: "revoke".into(),
        resource: "did-registry".into(),
        amount: None,
        currency: None,
        metadata: Some(json!({
            "operator": req.operator_did,
            "reason": req.reason,
        })),
    };

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

pub fn resolve_escalation(input: &[u8], _context: Option<&[u8]>) -> Result<Vec<u8>, String> {
    let req: ResolveEscalationRequest = serde_json::from_slice(input)
        .map_err(|e| format!("resolve-escalation: invalid JSON — {e}"))?;

    require_admin_auth(&req, &req.signature)?;

    let normalized_decision = req.decision.to_uppercase();
    if normalized_decision != "APPROVE" && normalized_decision != "DENY" {
        return Err(format!(
            "resolve-escalation: decision must be 'APPROVE' or 'DENY', got '{}'",
            req.decision
        ));
    }

    logging::info(&format!(
        "[SENTINEL] resolve-escalation: id={} decision={} operator={}",
        req.escalation_id, normalized_decision, req.operator_did
    ));

    let esc_map = kv_name(ESCALATIONS_MAP_SUFFIX);
    let raw = kv_store::get(&esc_map, req.escalation_id.as_bytes())
        .map_err(|e| format!("resolve-escalation: KV read failed — {e}"))?
        .ok_or_else(|| format!("Escalation not found: {}", req.escalation_id))?;

    let mut esc: EscalationRecord = serde_json::from_slice(&raw)
        .map_err(|e| format!("resolve-escalation: corrupt escalation record — {e}"))?;

    if esc.status != "pending" {
        return Err(format!(
            "Escalation {} already resolved with status '{}'",
            req.escalation_id, esc.status
        ));
    }

    let operator_did = req.operator_did.clone();
    let resolution_reason = req.reason.clone().unwrap_or_else(|| format!("Resolution by {}", operator_did));

    esc.status = if normalized_decision == "APPROVE" { "approved".to_string() } else { "denied".to_string() };
    esc.resolved_at = Some(time::now_ms());
    esc.resolution = Some(resolution_reason.clone());
    esc.resolved_by = Some(operator_did.clone());

    let updated_bytes = serde_json::to_vec(&esc)
        .map_err(|e| format!("resolve-escalation: serialization failed — {e}"))?;
    kv_store::set(&esc_map, req.escalation_id.as_bytes(), &updated_bytes)
        .map_err(|e| format!("resolve-escalation: KV write failed — {e}"))?;

    let resolve_action = ActionInput {
        action_type: "resolve_escalation".into(),
        resource: req.escalation_id.clone(),
        amount: None,
        currency: None,
        metadata: Some(json!({
            "resolution": normalized_decision,
            "operator": operator_did,
            "reason": resolution_reason,
        })),
    };

    audit::write_entry(
        &req.operator_did,
        &format!("ESCALATION_{}", normalized_decision),
        &format!("escalation_resolved:{}={}", req.escalation_id, normalized_decision),
        &resolve_action,
        &format!("res-{}", req.escalation_id),
    )?;

    if normalized_decision == "APPROVE" {
        let agent_record = load_agent_record(&esc.agent_did).ok();
        if let Some(agent) = agent_record {
            let scope_cap = extract_spend_cap(&agent.scope);
            let amount_u64 = esc.amount as u64;
            if amount_u64 <= scope_cap || scope_cap == u64::MAX {
                record_spend(&esc.agent_did, amount_u64, esc.created_at);
            }
        }
    }

    let response = json!({
        "resolved": true,
        "escalationId": req.escalation_id,
        "decision": normalized_decision,
        "operatorDid": req.operator_did,
        "resolvedAt": esc.resolved_at,
        "status": esc.status,
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
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}
