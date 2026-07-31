//! Solana's "compact-u16" / short-vec length encoding: a little-endian
//! base-128 varint capped at 3 bytes (sufficient for any `u16`). Solana's
//! wire format uses this for every `Vec` length in a `Message`/`Transaction`
//! — NOT bincode's default 8-byte length prefix — so a hand-rolled encoder
//! is required once `solana-sdk` is off the table. Verified against
//! `solana-sdk`'s own `short_vec` module in `tests/cross_check.rs`.

pub fn encode(value: u16, out: &mut Vec<u8>) {
    let mut val = value;
    loop {
        let mut byte = (val & 0x7f) as u8;
        val >>= 7;
        if val != 0 {
            byte |= 0x80;
            out.push(byte);
        } else {
            out.push(byte);
            break;
        }
    }
}

/// Returns the decoded value and the number of bytes consumed.
pub fn decode(bytes: &[u8]) -> Option<(u16, usize)> {
    let mut value: u32 = 0;
    for (i, &byte) in bytes.iter().enumerate().take(3) {
        value |= u32::from(byte & 0x7f) << (7 * i);
        if byte & 0x80 == 0 {
            return u16::try_from(value).ok().map(|v| (v, i + 1));
        }
    }
    None
}
