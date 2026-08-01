import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import type { Connection } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "./idl.json";
import type { Carapace } from "./carapace-idl-types";

/** A read-only wallet stub so we can build a Program/Provider (for account
 * fetches and simulation) before a real wallet is connected. Anchor's
 * `AnchorProvider` requires a wallet-shaped object even for reads. */
function readOnlyWallet(): AnchorWallet {
  const { PublicKey } = require("@solana/web3.js") as typeof import("@solana/web3.js");
  const noop = new PublicKey("11111111111111111111111111111111");
  return {
    publicKey: noop,
    signTransaction: async () => {
      throw new Error("read-only provider cannot sign transactions");
    },
    signAllTransactions: async () => {
      throw new Error("read-only provider cannot sign transactions");
    },
  } as unknown as AnchorWallet;
}

export function getCarapaceProgram(connection: Connection, wallet?: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet ?? readOnlyWallet(), {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider) as unknown as Program<Carapace>;
}

export type { Carapace };
