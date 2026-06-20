wit_bindgen::generate!({
    world: "sentinel-compliance",
    path: "wit",
    generate_all,
});

mod audit;
mod compliance;
mod receipt;

use exports::z::sentinel_compliance::contracts::{GenericInput, Guest};

struct Component;

#[cfg(target_arch = "wasm32")]
impl Guest for Component {
    fn evaluate_compliance(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("evaluate-compliance: missing input field")?;
        compliance::evaluate(&input, req.context.as_deref())
    }

    fn revoke_agent(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("revoke-agent: missing input field")?;
        compliance::revoke(&input, req.context.as_deref())
    }

    fn verify_receipt(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("verify-receipt: missing input field")?;
        receipt::verify(&input)
    }

    fn query_audit_log(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("query-audit-log: missing input field")?;
        audit::query(&input)
    }

    fn register_agent(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("register-agent: missing input field")?;
        compliance::register(&input, req.context.as_deref())
    }

    fn seed_policy(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("seed-policy: missing input field")?;
        compliance::seed_policy(&input, req.context.as_deref())
    }

    fn resolve_escalation(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("resolve-escalation: missing input field")?;
        compliance::resolve_escalation(&input, req.context.as_deref())
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);
