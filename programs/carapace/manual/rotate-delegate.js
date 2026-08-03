// One-off manual script: rotates the policy's delegate to a fresh keypair
// and funds it for transaction fees. Used to burn a delegate key that leaked
// (e.g. got committed to git) without needing to redeploy or re-init anything.
// Usage: node manual/rotate-delegate.js <rpc_url>
const anchor = require("@coral-xyz/anchor");
const { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Connection } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const IDL = require("../target/idl/carapace.json");

async function main() {
  const rpcUrl = process.argv[2];
  if (!rpcUrl) {
    console.error("Usage: node manual/rotate-delegate.js <rpc_url>");
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

  const newDelegate = Keypair.generate();

  console.log("Rotating delegate...");
  await program.methods
    .rotateDelegate(newDelegate.publicKey)
    .accountsPartial({ owner: owner.publicKey, policy })
    .rpc();

  console.log("Funding new delegate with 0.05 SOL for transaction fees...");
  const fundTx = new anchor.web3.Transaction().add(
    SystemProgram.transfer({
      fromPubkey: owner.publicKey,
      toPubkey: newDelegate.publicKey,
      lamports: 0.05 * LAMPORTS_PER_SOL,
    })
  );
  await anchor.web3.sendAndConfirmTransaction(connection, fundTx, [owner]);

  const delegateSecretHex = Buffer.from(newDelegate.secretKey.slice(0, 32)).toString("hex");
  console.log("\n=== New delegate ===");
  console.log(JSON.stringify(
    { delegate_pubkey: newDelegate.publicKey.toBase58(), delegate_secret_key: delegateSecretHex },
    null,
    2
  ));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
