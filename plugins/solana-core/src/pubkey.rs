use curve25519_dalek::edwards::CompressedEdwardsY;
use sha2::{Digest, Sha256};
use std::fmt;

pub const PUBKEY_LEN: usize = 32;

#[derive(Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Pubkey(pub [u8; PUBKEY_LEN]);

#[derive(Debug, PartialEq, Eq)]
pub struct PubkeyParseError;

impl Pubkey {
    pub const fn new_from_array(bytes: [u8; PUBKEY_LEN]) -> Self {
        Self(bytes)
    }

    pub fn to_bytes(self) -> [u8; PUBKEY_LEN] {
        self.0
    }

    pub fn from_base58(s: &str) -> Result<Self, PubkeyParseError> {
        let bytes = bs58::decode(s).into_vec().map_err(|_| PubkeyParseError)?;
        let arr: [u8; PUBKEY_LEN] = bytes.try_into().map_err(|_| PubkeyParseError)?;
        Ok(Self(arr))
    }

    pub fn to_base58(self) -> String {
        bs58::encode(self.0).into_string()
    }

    /// Reimplements `solana_program::pubkey::Pubkey::find_program_address`
    /// from primitives (sha2 + curve25519-dalek's on-curve check) since the
    /// full `solana-program`/`solana-sdk` dependency tree is deliberately
    /// excluded from the wasm32-wasip2 build this crate targets. Verified
    /// byte-for-byte against `solana-sdk` in `tests/cross_check.rs`.
    pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
        for bump in (0..=u8::MAX).rev() {
            if let Some(pda) = Self::create_program_address_with_bump(seeds, bump, program_id) {
                return (pda, bump);
            }
        }
        panic!("no off-curve PDA found in 256 bump attempts (astronomically unlikely)");
    }

    pub fn create_program_address_with_bump(
        seeds: &[&[u8]],
        bump: u8,
        program_id: &Pubkey,
    ) -> Option<Pubkey> {
        let mut hasher = Sha256::new();
        for seed in seeds {
            hasher.update(seed);
        }
        hasher.update([bump]);
        hasher.update(program_id.0);
        hasher.update(b"ProgramDerivedAddress");
        let hash: [u8; PUBKEY_LEN] = hasher.finalize().into();

        // A valid PDA is a hash with no corresponding private key, i.e. one
        // that is NOT a point on the ed25519 curve.
        match CompressedEdwardsY::from_slice(&hash) {
            Ok(point) if point.decompress().is_none() => Some(Pubkey(hash)),
            _ => None,
        }
    }
}

impl fmt::Display for Pubkey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_base58())
    }
}

impl fmt::Debug for Pubkey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_base58())
    }
}

impl serde::Serialize for Pubkey {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_base58())
    }
}

impl<'de> serde::Deserialize<'de> for Pubkey {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Pubkey::from_base58(&s).map_err(|_| serde::de::Error::custom("invalid base58 pubkey"))
    }
}

impl borsh::BorshSerialize for Pubkey {
    fn serialize<W: std::io::Write>(&self, writer: &mut W) -> std::io::Result<()> {
        writer.write_all(&self.0)
    }
}

impl borsh::BorshDeserialize for Pubkey {
    fn deserialize_reader<R: std::io::Read>(reader: &mut R) -> std::io::Result<Self> {
        let mut buf = [0u8; PUBKEY_LEN];
        reader.read_exact(&mut buf)?;
        Ok(Pubkey(buf))
    }
}
