use crate::host::interfaces::{kv_store, signing, time};
use hex;
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Serialize, Deserialize)]
pub struct ComplianceReceipt {
    #[serde(rename = "receiptId")]
    pub receipt_id: String,
    #[serde(rename = "agentDid")]
    pub agent_did: String,
    pub decision: String,
    #[serde(rename = "policyHash")]
    pub policy_hash: String,
    #[serde(rename = "policyClause")]
    pub policy_clause: String,
    #[serde(rename = "issuedAt")]
    pub issued_at: u64,
    #[serde(rename = "expiresAt")]
    pub expires_at: u64,
    pub signature: String,
}

#[derive(Deserialize)]
struct VerifyRequest {
    #[serde(rename = "receiptId")]
    receipt_id: String,
    #[serde(rename = "agentDid")]
    agent_did: String,
}

fn kv_name(suffix: &str) -> String {
    let tid = hex::encode(tenant_context::tenant_did());
    format!("z:{}:{}", tid, suffix)
}

pub fn issue(
    agent_did: &str,
    decision: &str,
    policy_hash: &str,
    policy_clause: &str,
    request_id: &str,
    _timestamp: u64,
) -> Result<Value, String> {
    let receipt_id = format!("RCP-{}", request_id);
    let now = time::now_ms();
    let expires_at = now + 86_400_000; // 24 hours

    let receipt_data = serde_json::json!({
        "receiptId": &receipt_id,
        "agentDid": agent_did,
        "decision": decision,
        "policyHash": policy_hash,
        "policyClause": policy_clause,
        "issuedAt": now,
        "expiresAt": expires_at,
    });

    let receipt_bytes = serde_json::to_vec(&receipt_data)
        .map_err(|e| format!("receipt: serialization failed — {e}"))?;

    let signature = signing::sign(&receipt_bytes)
        .map_err(|e| format!("receipt: signing failed — {e}"))?;
    let signature_hex = hex::encode(signature);

    let receipt = json!({
        "receiptId": receipt_id,
        "agentDid": agent_did,
        "decision": decision,
        "policyHash": policy_hash,
        "policyClause": policy_clause,
        "issuedAt": now,
        "expiresAt": expires_at,
        "signature": signature_hex,
    });

    let receipts_map = kv_name("receipts");
    let receipt_json = serde_json::to_vec(&receipt)
        .map_err(|e| format!("receipt: serialization failed — {e}"))?;
    kv_store::set(&receipts_map, receipt_id.as_bytes(), &receipt_json)
        .map_err(|e| format!("receipt: KV store write failed — {e}"))?;

    Ok(receipt)
}

pub fn verify(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: VerifyRequest = serde_json::from_slice(input)
        .map_err(|e| format!("verify-receipt: invalid JSON — {e}"))?;

    let receipts_map = kv_name("receipts");
    let raw = kv_store::get(&receipts_map, req.receipt_id.as_bytes())
        .map_err(|e| format!("verify-receipt: KV read failed — {e}"))?
        .ok_or_else(|| format!("verify-receipt: receipt not found: {}", req.receipt_id))?;

    let receipt: ComplianceReceipt = serde_json::from_slice(&raw)
        .map_err(|e| format!("verify-receipt: corrupt receipt — {e}"))?;

    if receipt.agent_did != req.agent_did {
        let response = json!({
            "valid": false,
            "reason": "Receipt agent DID does not match requested agent DID."
        });
        return serde_json::to_vec(&response).map_err(|e| e.to_string());
    }

    let revocations_map = kv_name("revocations");
    let revoked = kv_store::get(&revocations_map, req.agent_did.as_bytes())
        .ok().flatten().is_some();

    if revoked {
        let response = json!({
            "valid": false,
            "reason": "Agent credential has been revoked."
        });
        return serde_json::to_vec(&response).map_err(|e| e.to_string());
    }

    let now = time::now_ms();
    if now > receipt.expires_at {
        let response = json!({
            "valid": false,
            "reason": "Receipt has expired."
        });
        return serde_json::to_vec(&response).map_err(|e| e.to_string());
    }

    let response = json!({
        "valid": true,
        "reason": "Receipt is valid."
    });

    serde_json::to_vec(&response).map_err(|e| e.to_string())
}
