//! Signs a ZeroClaw plugin `manifest.toml` using the exact canonicalization
//! and Ed25519 scheme implemented in `crates/zeroclaw-plugins/src/signature.rs`
//! (`canonical_manifest_bytes` / `sign_manifest` / `public_key_hex`), so the
//! resulting `signature`/`publisher_key` fields verify against a real
//! ZeroClaw host running with `signature_mode = "strict"`.
//!
//! Usage:
//!   sign-plugin-manifest keygen <pkcs8-out-file>
//!   sign-plugin-manifest sign <manifest.toml> <pkcs8-file>

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ring::signature::{Ed25519KeyPair, KeyPair};
use std::fs;

fn canonical_manifest_bytes(manifest_toml: &str) -> Vec<u8> {
    let mut lines: Vec<&str> = Vec::new();
    for line in manifest_toml.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("signature") && trimmed.contains('=') {
            continue;
        }
        if trimmed.starts_with("publisher_key") && trimmed.contains('=') {
            continue;
        }
        lines.push(line);
    }
    while lines.last().is_some_and(|l| l.trim().is_empty()) {
        lines.pop();
    }
    lines.join("\n").into_bytes()
}

fn hex_encode(data: &[u8]) -> String {
    data.iter().map(|b| format!("{b:02x}")).collect()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("keygen") => {
            let out_path = args.get(2).expect("usage: keygen <pkcs8-out-file>");
            let rng = ring::rand::SystemRandom::new();
            let pkcs8 = Ed25519KeyPair::generate_pkcs8(&rng).expect("keypair generation");
            fs::write(out_path, pkcs8.as_ref()).expect("writing pkcs8 file");
            let key_pair = Ed25519KeyPair::from_pkcs8(pkcs8.as_ref()).expect("parsing generated key");
            println!("publisher_key = {}", hex_encode(key_pair.public_key().as_ref()));
            println!("(private key written to {out_path} — keep this out of git, it's the publisher signing key)");
        }
        Some("sign") => {
            let manifest_path = args.get(2).expect("usage: sign <manifest.toml> <pkcs8-file>");
            let pkcs8_path = args.get(3).expect("usage: sign <manifest.toml> <pkcs8-file>");
            let manifest_toml = fs::read_to_string(manifest_path).expect("reading manifest");
            let pkcs8 = fs::read(pkcs8_path).expect("reading pkcs8 file");
            let key_pair = Ed25519KeyPair::from_pkcs8(&pkcs8).expect("parsing pkcs8 key");

            let canonical = canonical_manifest_bytes(&manifest_toml);
            let signature = key_pair.sign(&canonical);
            let signature_b64u = URL_SAFE_NO_PAD.encode(signature.as_ref());
            let publisher_key_hex = hex_encode(key_pair.public_key().as_ref());

            let mut lines: Vec<String> = manifest_toml
                .lines()
                .filter(|l| {
                    let t = l.trim();
                    !((t.starts_with("signature") || t.starts_with("publisher_key")) && t.contains('='))
                })
                .map(String::from)
                .collect();
            while lines.last().is_some_and(|l| l.trim().is_empty()) {
                lines.pop();
            }
            lines.push(format!("signature = \"{signature_b64u}\""));
            lines.push(format!("publisher_key = \"{publisher_key_hex}\""));
            lines.push(String::new());

            fs::write(manifest_path, lines.join("\n")).expect("writing signed manifest");
            println!("signed {manifest_path}");
            println!("publisher_key = {publisher_key_hex}");
        }
        _ => {
            eprintln!("usage:\n  sign-plugin-manifest keygen <pkcs8-out-file>\n  sign-plugin-manifest sign <manifest.toml> <pkcs8-file>");
            std::process::exit(1);
        }
    }
}
