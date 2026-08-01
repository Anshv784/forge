// One-off manual verification: fetches an unsigned transaction from the
// Blinks POST endpoint exactly as a wallet would, signs it with the local
// owner keypair, and submits it — proving the endpoint's output is a real,
// valid, executable transaction and not just well-formed JSON.
// Usage: node manual/verify-blink-tx.js <intentAddress> <approve|deny>
const { Connection, Keypair, Transaction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const [intentAddress, decision] = process.argv.slice(2);
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const owner = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".config/solana/id.json"), "utf8")))
  );

  const res = await fetch(
    `http://localhost:3000/api/actions/intent/${intentAddress}?cluster=localnet&decision=${decision}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account: owner.publicKey.toBase58() }) }
  );
  const body = await res.json();
  if (!res.ok) {
    console.error("Blinks endpoint returned an error:", body);
    process.exit(1);
  }
  console.log("Blinks endpoint returned:", body.message);

  const tx = Transaction.from(Buffer.from(body.transaction, "base64"));
  tx.partialSign(owner);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(signature, "confirmed");
  console.log("Submitted and confirmed:", signature);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
