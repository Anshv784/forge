#[allow(warnings)]
mod bindings;

use bindings::wasi::http::outgoing_handler;
use bindings::wasi::http::types::{Fields, Method, OutgoingRequest, Scheme};
use bindings::Guest;

struct Component;

impl Guest for Component {
    /// GET https://example.com/ over `wasi:http/outgoing-handler`, the exact
    /// host capability ZeroClaw wires up when a plugin manifest declares the
    /// `http_client` permission. Proves outbound networking works from a
    /// wasm32-wasip2 component under wasmtime's `-S http=y`, independent of
    /// whether a real Solana RPC endpoint is reachable from this sandbox.
    fn run() -> Result<String, String> {
        let headers = Fields::new();
        let request = OutgoingRequest::new(headers);
        request.set_method(&Method::Get).map_err(|_| "set_method failed".to_string())?;
        request
            .set_scheme(Some(&Scheme::Https))
            .map_err(|_| "set_scheme failed".to_string())?;
        request
            .set_authority(Some("example.com"))
            .map_err(|_| "set_authority failed".to_string())?;
        request
            .set_path_with_query(Some("/"))
            .map_err(|_| "set_path_with_query failed".to_string())?;

        let future_response =
            outgoing_handler::handle(request, None).map_err(|e| format!("handle failed: {e:?}"))?;

        if future_response.get().is_none() {
            let pollable = future_response.subscribe();
            pollable.block();
        }

        let response = future_response
            .get()
            .ok_or("future still not ready after blocking")?
            .map_err(|_| "future-incoming-response.get() consumed twice".to_string())?
            .map_err(|e| format!("request error: {e:?}"))?;

        Ok(format!("status={}", response.status()))
    }
}

bindings::export!(Component with_types_in bindings);
