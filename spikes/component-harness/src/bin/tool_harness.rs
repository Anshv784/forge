//! Loads and invokes a real `tool.wit`-shaped Carapace plugin component
//! (name/description/parameters_schema/execute) exactly the way ZeroClaw's
//! own host would, including satisfying the `logging` import it requires.
//! This is the concrete, end-to-end proof that the WASM plugin bundle (M3)
//! actually works, independent of building the full ZeroClaw binary.

use anyhow::{Context, Result};
use wasmtime::component::{bindgen, Component, Linker, ResourceTable};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder, WasiView};
use wasmtime_wasi_http::{WasiHttpCtx, WasiHttpView};

bindgen!({
    path: "wit-tool",
    world: "tool-plugin",
    async: true,
    with: {
        "wasi:io": wasmtime_wasi::bindings::io,
        "wasi:clocks": wasmtime_wasi::bindings::clocks,
        "wasi:http": wasmtime_wasi_http::bindings::http,
    },
});

use zeroclaw::plugin::logging::{Host as LoggingHost, LogLevel, PluginEvent};

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

impl LoggingHost for Ctx {
    fn log_record<'life0, 'async_trait>(
        &'life0 mut self,
        level: LogLevel,
        event: PluginEvent,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        Self: 'async_trait,
    {
        Box::pin(async move {
            eprintln!("[plugin log {level:?}] {}: {}", event.function_name, event.message);
        })
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let wasm_path = std::env::args().nth(1).expect("usage: tool_harness <path-to-component.wasm> [json-args]");
    let json_args = std::env::args().nth(2).unwrap_or_else(|| "{}".to_string());

    let mut config = Config::new();
    config.async_support(true);
    config.wasm_component_model(true);
    let engine = Engine::new(&config)?;

    let component = Component::from_file(&engine, &wasm_path).with_context(|| format!("loading {wasm_path}"))?;

    let mut linker: Linker<Ctx> = Linker::new(&engine);
    wasmtime_wasi::add_to_linker_async(&mut linker)?;
    wasmtime_wasi_http::add_only_http_to_linker_async(&mut linker)?;
    // Only the custom `logging` import needs bindgen-generated host glue —
    // wasi:io/wasi:clocks/wasi:http are already satisfied above via the
    // standard wasmtime-wasi(-http) linker helpers, and calling the
    // aggregate `ToolPlugin::add_to_linker` would try to re-wire those too,
    // in a way incompatible with `WasiImpl`'s internal wrapping.
    zeroclaw::plugin::logging::add_to_linker(&mut linker, |ctx: &mut Ctx| ctx)?;

    let table = ResourceTable::new();
    let wasi = WasiCtxBuilder::new().inherit_stdio().build();
    let http = WasiHttpCtx::new();
    let mut store = Store::new(&engine, Ctx { wasi, http, table });

    let instance = ToolPlugin::instantiate_async(&mut store, &component, &linker).await?;
    let tool = instance.zeroclaw_plugin_tool();

    let name = tool.call_name(&mut store).await?;
    let description = tool.call_description(&mut store).await?;
    let schema = tool.call_parameters_schema(&mut store).await?;
    println!("tool name: {name}");
    println!("description: {description}");
    println!("parameters_schema: {schema}");

    match tool.call_execute(&mut store, &json_args).await? {
        Ok(result) => {
            println!("success={} output={} error={:?}", result.success, result.output, result.error);
        }
        Err(e) => {
            println!("execute() trapped: {e}");
        }
    }

    Ok(())
}
