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
}

#[cfg(target_arch = "wasm32")]
export!(Component);
