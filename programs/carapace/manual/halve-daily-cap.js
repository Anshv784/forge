// One-off manual script: the zero-redeploy mitigation for the fixed-reset
// daily-cap boundary exploit (see docs/DAILY_CAP_EXPLOIT.md). Halves
// max_daily_{lamports,spl} via the program's own EXISTING update_limits
// instruction — no code change, no redeploy — which directly bounds the
// worst case of "spend the cap right before reset, spend it again right
// after" back down to the operator's actually-intended daily budget.
// Leaves every other field (per-tx caps, approval thresholds) untouched.
// Usage: node manual/halve-daily-cap.js <rpc_url>
const anchor = require("@coral-xyz/anchor");
const { BN } = anchor;
const { Keypair, PublicKey, Connection } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const IDL = require("../target/idl/carapace.json");

async function main() {
  const rpcUrl = process.argv[2];
  if (!rpcUrl) {
    console.error("Usage: node manual/halve-daily-cap.js <rpc_url>");
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

  const current = await program.account.policy.fetch(policy);
  const newDailyLamports = current.maxDailyLamports.div(new BN(2));
  const newDailySpl = current.maxDailySpl.div(new BN(2));

  console.log(`Current max_daily_lamports: ${current.maxDailyLamports.toString()}`);
  console.log(`New max_daily_lamports:     ${newDailyLamports.toString()}`);
  console.log(`Current max_daily_spl:      ${current.maxDailySpl.toString()}`);
  console.log(`New max_daily_spl:          ${newDailySpl.toString()}`);
  console.log(
    "\nThis bounds the worst-case 'spend the cap right before reset, spend it\n" +
    "again right after' exploit back down to your original intended daily\n" +
    "budget (2x half = the old full cap), at the cost of the legitimate\n" +
    "steady-state daily budget also being half of what it was. Per-tx caps\n" +
    "and approval thresholds are left untouched.\n"
  );

  await program.methods
    .updateLimits({
      maxPerTxLamports: current.maxPerTxLamports,
      maxDailyLamports: newDailyLamports,
      approvalThresholdLamports: current.approvalThresholdLamports,
      maxPerTxSpl: current.maxPerTxSpl,
      maxDailySpl: newDailySpl,
      approvalThresholdSpl: current.approvalThresholdSpl,
    })
    .accountsPartial({ owner: owner.publicKey, policy })
    .rpc();

  console.log("Done.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
