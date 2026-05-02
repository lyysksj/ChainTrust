import type { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { Chaintrust } from "@/lib/anchor/idl/chaintrust";
import { fetchRegistryConfig } from "@/lib/anchor/client";
import {
  humanProofPda,
  nullifierRecordPda,
  registryConfigPda,
} from "@/lib/anchor/pdas";

const POLL_INTERVAL_MS = 400;
const MAX_WAIT_MS = 30_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendIxAndConfirmByPolling(
  provider: AnchorProvider,
  signer: Keypair,
  ix: TransactionInstruction,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await provider.connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: blockhash,
  }).add(ix);
  tx.sign(signer);

  const sig = await provider.connection.sendRawTransaction(tx.serialize(), {
    preflightCommitment: "confirmed",
    skipPreflight: false,
    maxRetries: 3,
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const [status, currentHeight] = await Promise.all([
      provider.connection
        .getSignatureStatuses([sig])
        .then((r) => r.value[0] ?? null),
      provider.connection.getBlockHeight("confirmed"),
    ]);

    if (status?.err) {
      throw new Error(`transaction failed: ${JSON.stringify(status.err)}`);
    }
    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return sig;
    }
    if (currentHeight > lastValidBlockHeight) {
      throw new Error(
        "transaction expired before confirmation (blockhash is no longer valid)",
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("timed out waiting for transaction confirmation");
}

export async function ensureRegistryConfigInitialized(
  program: Program<Chaintrust>,
  provider: AnchorProvider,
  admin: Keypair,
): Promise<void> {
  const config = await fetchRegistryConfig(program);
  if (config) return;

  const [registryConfig] = registryConfigPda();
  const ix = await (program.methods as any)
    .initializeRegistryConfig(admin.publicKey)
    .accountsPartial({
      registryConfig,
      signer: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  await sendIxAndConfirmByPolling(provider, admin, ix);
}

export async function attestHumanProofNoWs(
  program: Program<Chaintrust>,
  provider: AnchorProvider,
  admin: Keypair,
  wallet: PublicKey,
  nullifierHash: number[],
): Promise<string> {
  const [registryConfig] = registryConfigPda();
  const [humanProof] = humanProofPda(wallet);
  const [nullifierRecord] = nullifierRecordPda(nullifierHash);

  const ix = await (program.methods as any)
    .attestHumanProof(nullifierHash)
    .accountsPartial({
      registryConfig,
      humanProof,
      nullifierRecord,
      admin: admin.publicKey,
      wallet,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return sendIxAndConfirmByPolling(provider, admin, ix);
}
