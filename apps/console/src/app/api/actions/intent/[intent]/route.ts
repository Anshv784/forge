import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getCarapaceProgram } from "@/lib/carapace/program";
import { CLUSTERS, DEFAULT_CLUSTER_ID } from "@/lib/config";
import { actionsError, actionsJson, actionsOptions } from "@/lib/actions/cors";

// Route Handlers run in the Node.js runtime by default, which is what we
// want here — @coral-xyz/anchor and @solana/web3.js are not edge-safe.
export const runtime = "nodejs";

function resolveCluster(searchParams: URLSearchParams) {
  const id = searchParams.get("cluster") ?? DEFAULT_CLUSTER_ID;
  return CLUSTERS.find((c) => c.id === id) ?? CLUSTERS[0];
}

function formatAmount(assetKey: string, amount: { toString(): string }) {
  if (assetKey === "sol") {
    const sol = Number(amount.toString()) / 1_000_000_000;
    return `${sol.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`;
  }
  return `${amount.toString()} base units of the policy's SPL mint`;
}

export async function OPTIONS() {
  return actionsOptions();
}

/**
 * GET renders the Blink card: what's being asked for, and two buttons
 * (Approve / Deny) that both point back at this same route via POST with a
 * `decision` query param. Any Blink-aware wallet — including from a phone,
 * away from the ZeroClaw host entirely — can render this.
 */
export async function GET(req: Request, { params }: { params: Promise<{ intent: string }> }) {
  const { intent: intentParam } = await params;
  const { searchParams, origin } = new URL(req.url);
  const cluster = resolveCluster(searchParams);

  let intentAddress: PublicKey;
  try {
    intentAddress = new PublicKey(intentParam);
  } catch {
    return actionsError("Invalid intent address");
  }

  const connection = new Connection(cluster.endpoint, "confirmed");
  const program = getCarapaceProgram(connection);

  const intentAccount = await program.account.intent.fetch(intentAddress).catch(() => null);
  if (!intentAccount) {
    return actionsError(`Intent not found on ${cluster.label}`, 404);
  }

  const statusKey = Object.keys(intentAccount.status as object)[0];
  const assetKey = Object.keys(intentAccount.asset as object)[0];
  const amountLabel = formatAmount(assetKey, intentAccount.amount as { toString(): string });
  const icon = `${origin}/icon.svg`;

  if (statusKey !== "pending") {
    return actionsJson({
      type: "completed",
      icon,
      title: "Carapace approval",
      description: `Intent #${intentAccount.nonce.toString()} is already ${statusKey} — nothing left to do here.`,
      label: statusKey,
    });
  }

  const base = `${origin}/api/actions/intent/${intentParam}?cluster=${cluster.id}`;

  return actionsJson({
    type: "action",
    icon,
    title: "Carapace: approve agent payment",
    description: `Your ZeroClaw agent proposed sending ${amountLabel} to ${(
      intentAccount.destination as PublicKey
    ).toBase58()}. This requires your approval before it can execute — approving or denying is final for this Intent.`,
    label: "Approve",
    links: {
      actions: [
        { type: "transaction", href: `${base}&decision=approve`, label: "Approve" },
        { type: "transaction", href: `${base}&decision=deny`, label: "Deny" },
      ],
    },
  });
}

/**
 * POST builds and returns an unsigned approve_intent/deny_intent
 * transaction for the wallet to sign. We only build it for the account the
 * wallet says it is — the program itself is the actual authority check
 * (has_one = owner), this is just a friendlier pre-flight error.
 */
export async function POST(req: Request, { params }: { params: Promise<{ intent: string }> }) {
  const { intent: intentParam } = await params;
  const { searchParams } = new URL(req.url);
  const cluster = resolveCluster(searchParams);
  const decision = searchParams.get("decision");

  if (decision !== "approve" && decision !== "deny") {
    return actionsError("Missing or invalid \"decision\" query param (expected approve or deny)");
  }

  let intentAddress: PublicKey;
  try {
    intentAddress = new PublicKey(intentParam);
  } catch {
    return actionsError("Invalid intent address");
  }

  let account: PublicKey;
  try {
    const body = (await req.json()) as { account?: string };
    if (!body.account) throw new Error("missing account");
    account = new PublicKey(body.account);
  } catch {
    return actionsError('Invalid request body: expected { "account": "<base58 pubkey>" }');
  }

  const connection = new Connection(cluster.endpoint, "confirmed");
  const program = getCarapaceProgram(connection);

  const intentAccount = await program.account.intent.fetch(intentAddress).catch(() => null);
  if (!intentAccount) return actionsError("Intent not found", 404);

  const statusKey = Object.keys(intentAccount.status as object)[0];
  if (statusKey !== "pending") {
    return actionsError(`This Intent is already ${statusKey} and can no longer be decided`, 409);
  }

  const policyAddress = intentAccount.policy as PublicKey;
  const policyAccount = await program.account.policy.fetch(policyAddress).catch(() => null);
  if (!policyAccount) return actionsError("Policy not found", 404);

  const owner = policyAccount.owner as PublicKey;
  if (!owner.equals(account)) {
    return actionsError("Only this policy's owner wallet can approve or deny this Intent");
  }

  const instruction =
    decision === "approve"
      ? await program.methods
          .approveIntent()
          .accountsPartial({ owner, policy: policyAddress, intent: intentAddress })
          .instruction()
      : await program.methods
          .denyIntent()
          .accountsPartial({ owner, policy: policyAddress, intent: intentAddress })
          .instruction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(instruction);
  const serialized = transaction
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");

  return actionsJson({
    transaction: serialized,
    message:
      decision === "approve"
        ? `Approve Intent #${intentAccount.nonce.toString()}`
        : `Deny Intent #${intentAccount.nonce.toString()}`,
  });
}
