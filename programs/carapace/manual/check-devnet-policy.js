// One-off manual script: dumps the devnet Policy account and every Intent
// created against it (status/amount/destination), to find pending intents
// that need owner approval. Usage: node manual/check-devnet-policy.js <rpc_url>
const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const IDL = require("../target/idl/carapace.json");

async function main() {
  const rpcUrl = process.argv[2];
  if (!rpcUrl) {
    console.error("Usage: node manual/check-devnet-policy.js <rpc_url>");
    process.exit(1);
  }
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
  const policyAccount = await program.account.policy.fetch(policy);
  console.log("policy:", policy.toBase58());
  console.log("next_intent_nonce:", policyAccount.nextIntentNonce.toString());

  for (let nonce = 0; nonce < policyAccount.nextIntentNonce.toNumber(); nonce++) {
    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigUInt64LE(BigInt(nonce));
    const [intent] = PublicKey.findProgramAddressSync(
      [Buffer.from("intent"), policy.toBuffer(), nonceBuf],
      program.programId
    );
    try {
      const intentAccount = await program.account.intent.fetch(intent);
      console.log(
        `nonce=${nonce} status=${JSON.stringify(intentAccount.status)} amount=${intentAccount.amount.toString()} destination=${intentAccount.destination.toBase58()}`
      );
    } catch (e) {
      console.log(`nonce=${nonce} - account not found (closed?)`);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
