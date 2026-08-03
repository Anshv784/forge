// One-off manual script: allow-lists an additional destination wallet on an
// existing policy, without needing to recreate the policy from scratch.
// Usage: node manual/add-allowlist-entry.js <destination_pubkey> <rpc_url>
const anchor = require("@coral-xyz/anchor");
const { Keypair, PublicKey, SystemProgram, Connection } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const IDL = require("../target/idl/carapace.json");

async function main() {
  const destinationArg = process.argv[2];
  const rpcUrl = process.argv[3];
  if (!destinationArg || !rpcUrl) {
    console.error("Usage: node manual/add-allowlist-entry.js <destination_pubkey> <rpc_url>");
    process.exit(1);
  }
  const destination = new PublicKey(destinationArg);

  const connection = new Connection(rpcUrl, "confirmed");
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
  const [allowlistEntry] = PublicKey.findProgramAddressSync(
    [Buffer.from("allow"), policy.toBuffer(), destination.toBuffer()],
    program.programId
  );

  console.log(`Allow-listing ${destination.toBase58()} on policy ${policy.toBase58()}...`);
  const sig = await program.methods
    .addAllowlistEntry(destination)
    .accountsPartial({ owner: owner.publicKey, policy, allowlistEntry, systemProgram: SystemProgram.programId })
    .rpc();

  console.log(`Done. Signature: ${sig}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
