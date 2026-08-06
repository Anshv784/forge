//! Exact fixed-point amount formatting — no floating point, so a value that
//! looks fine at a glance never silently drifts from the raw on-chain
//! integer it came from.

/// Format `raw` (an integer amount in its smallest unit — lamports for SOL,
/// base units for an SPL token) as a human-readable decimal string with up
/// to `decimals` fractional digits, trimming trailing zeros.
///
/// `format_amount(1_765_000_000, 9)` -> `"1.765"`, not `"1.765000000"`.
pub fn format_amount(raw: u64, decimals: u32) -> String {
    let divisor = 10u64.pow(decimals);
    let whole = raw / divisor;
    let frac = raw % divisor;
    if frac == 0 {
        return whole.to_string();
    }
    let frac_str = format!("{:0width$}", frac, width = decimals as usize);
    let trimmed = frac_str.trim_end_matches('0');
    format!("{whole}.{trimmed}")
}

/// Parse a human-typed decimal amount (e.g. `"1"`, `"0.5"`, `"0.235"`) into
/// its integer smallest-unit value (lamports for SOL, base units for an SPL
/// token), with no floating point anywhere in the path.
///
/// This exists so a caller (in practice, an LLM tool call) only ever has to
/// pass along the number a human actually said, never compute `* 10^9`
/// itself — that multiplication is exactly the kind of arithmetic mistake
/// that is easy to get subtly wrong (e.g. `* 1e8` instead of `* 1e9`) and
/// which nothing on-chain would catch, since a wrong-but-smaller amount
/// still clears every cap fine.
pub fn parse_amount(s: &str, decimals: u32) -> Result<u64, String> {
    let s = s.trim();
    if s.is_empty() {
        return Err("amount must not be empty".to_string());
    }

    let (whole_str, frac_str) = s.split_once('.').unwrap_or((s, ""));
    if whole_str.is_empty() || !whole_str.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("invalid amount {s:?}: expected a plain decimal number like \"1\" or \"0.5\""));
    }
    if !frac_str.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("invalid amount {s:?}: expected a plain decimal number like \"1\" or \"0.5\""));
    }
    if frac_str.len() > decimals as usize {
        return Err(format!(
            "invalid amount {s:?}: at most {decimals} decimal place(s) are supported for this asset"
        ));
    }

    let whole: u64 = whole_str
        .parse()
        .map_err(|_| format!("amount {s:?} is too large"))?;
    let scale = 10u64.pow(decimals);
    let whole_scaled = whole
        .checked_mul(scale)
        .ok_or_else(|| format!("amount {s:?} is too large"))?;

    let frac_padded = format!("{frac_str:0<width$}", width = decimals as usize);
    let frac: u64 = if frac_padded.is_empty() {
        0
    } else {
        frac_padded
            .parse()
            .map_err(|_| format!("amount {s:?} is too large"))?
    };

    whole_scaled
        .checked_add(frac)
        .ok_or_else(|| format!("amount {s:?} is too large"))
}

#[cfg(test)]
mod tests {
    use super::{format_amount, parse_amount};

    #[test]
    fn whole_number_has_no_decimal_point() {
        assert_eq!(format_amount(2_000_000_000, 9), "2");
    }

    #[test]
    fn trims_trailing_zeros() {
        assert_eq!(format_amount(1_765_000_000, 9), "1.765");
        assert_eq!(format_amount(235_000_000, 9), "0.235");
    }

    #[test]
    fn preserves_significant_trailing_digits() {
        assert_eq!(format_amount(1_000_000_001, 9), "1.000000001");
    }

    #[test]
    fn zero_is_zero() {
        assert_eq!(format_amount(0, 9), "0");
    }

    #[test]
    fn six_decimal_spl_amount() {
        assert_eq!(format_amount(200_000, 6), "0.2");
        assert_eq!(format_amount(2_000_000, 6), "2");
    }

    #[test]
    fn parses_whole_sol_amount() {
        // The exact real-world regression: an LLM computed 1 SOL as
        // 100_000_000 (0.1 SOL) instead of 1_000_000_000. Parsing "1"
        // directly must give the correct value with no room for that
        // mistake.
        assert_eq!(parse_amount("1", 9).unwrap(), 1_000_000_000);
    }

    #[test]
    fn parses_fractional_sol_amount() {
        assert_eq!(parse_amount("0.5", 9).unwrap(), 500_000_000);
        assert_eq!(parse_amount("0.235", 9).unwrap(), 235_000_000);
    }

    #[test]
    fn parses_fractional_spl_amount() {
        assert_eq!(parse_amount("0.2", 6).unwrap(), 200_000);
    }

    #[test]
    fn parses_amount_with_no_fractional_part() {
        assert_eq!(parse_amount("2", 6).unwrap(), 2_000_000);
    }

    #[test]
    fn rejects_too_many_decimal_places() {
        assert!(parse_amount("0.2000001", 6).is_err());
    }

    #[test]
    fn rejects_empty_and_malformed_input() {
        assert!(parse_amount("", 9).is_err());
        assert!(parse_amount("abc", 9).is_err());
        assert!(parse_amount("-1", 9).is_err());
        assert!(parse_amount("1.2.3", 9).is_err());
        assert!(parse_amount("1e9", 9).is_err());
    }

    #[test]
    fn round_trips_with_format_amount() {
        for raw in [0u64, 1, 500_000_000, 1_000_000_000, 1_765_000_000, 235_000_000] {
            let formatted = format_amount(raw, 9);
            assert_eq!(parse_amount(&formatted, 9).unwrap(), raw, "round-trip failed for {raw}");
        }
    }
}
