//! Standalone `wasmtime` host harness that loads a `tool.wit`-shaped (or, for
//! this Day-0 spike, a bare `run() -> result<string,string>`) WASM component
//! and invokes it directly — the same shape of test ZeroClaw's own
//! `wasm_tool.rs` host performs when it loads a plugin, but without needing
//! to build the full ZeroClaw binary. Reused in M3 to test the real Carapace
//! tool components against `wit/v0/tool.wit`.

use anyhow::{Context, Result};
use wasmtime::component::{bindgen, Component, Linker, ResourceTable};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder, WasiView};
use wasmtime_wasi_http::{WasiHttpCtx, WasiHttpView};

bindgen!({
    path: "wit",
    world: "spike",
    async: true,
    with: {
        "wasi:io": wasmtime_wasi::bindings::io,
        "wasi:clocks": wasmtime_wasi::bindings::clocks,
        "wasi:http": wasmtime_wasi_http::bindings::http,
    },
});

struct Ctx {
    wasi: WasiCtx,
    http: WasiHttpCtx,
    table: ResourceTable,
}

impl WasiView for Ctx {
    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.wasi
    }
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }
}

impl WasiHttpView for Ctx {
    fn ctx(&mut self) -> &mut WasiHttpCtx {
        &mut self.http
    }
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let wasm_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "../../target/wasm32-wasip1/release/wasm_http_spike.wasm".to_string());

    let mut config = Config::new();
    config.async_support(true);
    config.wasm_component_model(true);
    let engine = Engine::new(&config)?;

    let component = Component::from_file(&engine, &wasm_path)
        .with_context(|| format!("loading component at {wasm_path}"))?;

    let mut linker: Linker<Ctx> = Linker::new(&engine);
    wasmtime_wasi::add_to_linker_async(&mut linker)?;
    wasmtime_wasi_http::add_only_http_to_linker_async(&mut linker)?;

    let table = ResourceTable::new();
    let wasi = WasiCtxBuilder::new().inherit_stdio().build();
    let http = WasiHttpCtx::new();
    let mut store = Store::new(&engine, Ctx { wasi, http, table });

    let instance = Spike::instantiate_async(&mut store, &component, &linker).await?;
    match instance.call_run(&mut store).await? {
        Ok(status) => {
            println!("spike=ok {status}");
            Ok(())
        }
        Err(e) => anyhow::bail!("component reported error: {e}"),
    }
}
