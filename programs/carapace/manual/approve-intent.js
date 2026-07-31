// One-off manual script: approves a pending Intent so the execute_transfer
// tool's above-threshold path can be exercised end-to-end locally.
// Usage: node manual/approve-intent.js <nonce>
const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const IDL = require("../target/idl/carapace.json");

async function main() {
  const nonce = BigInt(process.argv[2] ?? "0");
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".config/solana/id.json"), "utf8")))
  );
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL, provider);

  const owner = walletKeypair;
  const agentIndex = 0;
  const [policy] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), owner.publicKey.toBuffer(), Buffer.from([agentIndex, 0])],
    program.programId
  );
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(nonce);
  const [intent] = PublicKey.findProgramAddressSync(
    [Buffer.from("intent"), policy.toBuffer(), nonceBuf],
    program.programId
  );

  await program.methods.approveIntent().accountsPartial({ owner: owner.publicKey, policy, intent }).rpc();
  console.log(`Approved intent nonce=${nonce} (${intent.toBase58()})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
