// One-off manual script (not part of the automated test suite) used to spin
// up a real Policy on a local validator so the WASM tool plugins can be
// exercised against a real signing+submission flow without needing devnet
// faucet funds. Run with: node manual/init-test-policy.js
const anchor = require("@coral-xyz/anchor");
const { BN } = anchor;
const {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Connection } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const IDL = require("../target/idl/carapace.json");

async function main() {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".config/solana/id.json"), "utf8")))
  );
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL, provider);

  const owner = walletKeypair;
  const delegate = Keypair.generate();
  const destination = Keypair.generate();
  const agentIndex = 0;

  const [policy] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), owner.publicKey.toBuffer(), Buffer.from([agentIndex, 0])],
    program.programId
  );
  const [solVault] = PublicKey.findProgramAddressSync([Buffer.from("sol-vault"), policy.toBuffer()], program.programId);
  const [tokenVaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("tv-auth"), policy.toBuffer()],
    program.programId
  );

  console.log("Creating test SPL mint...");
  const mint = await createMint(connection, owner, owner.publicKey, null, 6);
  const tokenVault = getAssociatedTokenAddressSync(mint, tokenVaultAuthority, true);

  console.log("Initializing policy...");
  await program.methods
    .initializePolicy({
      agentIndex,
      delegate: delegate.publicKey,
      maxPerTxLamports: new BN(0.5 * LAMPORTS_PER_SOL),
      maxDailyLamports: new BN(2 * LAMPORTS_PER_SOL),
      approvalThresholdLamports: new BN(0.1 * LAMPORTS_PER_SOL),
      maxPerTxSpl: new BN(500_000),
      maxDailySpl: new BN(2_000_000),
      approvalThresholdSpl: new BN(200_000),
      expiresAt: new BN(0),
    })
    .accountsPartial({
      owner: owner.publicKey,
      policy,
      solVault,
      tokenVaultAuthority,
      splMint: mint,
      tokenVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Funding SOL vault with 1 SOL...");
  await program.methods
    .depositSol(new BN(1 * LAMPORTS_PER_SOL))
    .accountsPartial({ depositor: owner.publicKey, policy, solVault, systemProgram: SystemProgram.programId })
    .rpc();

  const [allowlistEntry] = PublicKey.findProgramAddressSync(
    [Buffer.from("allow"), policy.toBuffer(), destination.publicKey.toBuffer()],
    program.programId
  );
  console.log("Allow-listing destination...");
  await program.methods
    .addAllowlistEntry(destination.publicKey)
    .accountsPartial({ owner: owner.publicKey, policy, allowlistEntry, systemProgram: SystemProgram.programId })
    .rpc();

  const delegateSecretHex = Buffer.from(delegate.secretKey.slice(0, 32)).toString("hex");

  console.log("\n=== Test fixture ready ===");
  console.log(JSON.stringify(
    {
      rpc_url: "http://127.0.0.1:8899",
      program_id: program.programId.toBase58(),
      owner: owner.publicKey.toBase58(),
      agent_index: agentIndex,
      delegate_secret_key: delegateSecretHex,
      delegate_pubkey: delegate.publicKey.toBase58(),
      destination: destination.publicKey.toBase58(),
      policy_address: policy.toBase58(),
    },
    null,
    2
  ));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
