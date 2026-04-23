"use client";

import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import type { Wallet } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  type Commitment,
} from "@solana/web3.js";
import idlJson from "./idl/chaintrust.json";
import type { Chaintrust } from "./idl/chaintrust";
import {
  PROGRAM_ID,
  commentPda,
  entryPda,
  userProfilePda,
  walletMappingPda,
} from "./pdas";

const COMMITMENT: Commitment = "confirmed";

export function buildProvider(
  connection: Connection,
  wallet: AnchorWallet,
): AnchorProvider {
  return new AnchorProvider(connection, wallet as unknown as Wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  });
}

export function buildProgram(provider: AnchorProvider): Program<Chaintrust> {
  // @coral-xyz/anchor 0.30 expects the IDL and optional provider.
  return new Program(idlJson as Chaintrust, provider);
}

// --- read helpers ---

export async function fetchUserProfile(
  program: Program<Chaintrust>,
  wallet: PublicKey,
) {
  const [pda] = userProfilePda(wallet);
  return program.account.userProfile.fetchNullable(pda);
}

export async function fetchEntry(
  program: Program<Chaintrust>,
  entryId: number[] | Uint8Array,
) {
  const [pda] = entryPda(entryId);
  const acc = await program.account.companyEntry.fetchNullable(pda);
  return acc ? { pda, account: acc } : null;
}

export async function fetchEntryByPda(
  program: Program<Chaintrust>,
  pda: PublicKey,
) {
  return program.account.companyEntry.fetchNullable(pda);
}

export async function fetchWalletMappingsForEntry(
  program: Program<Chaintrust>,
  entry: PublicKey,
) {
  return program.account.walletMapping.all([
    { memcmp: { offset: 8 + 32, bytes: entry.toBase58() } },
  ]);
}

export async function fetchCommentsForEntry(
  program: Program<Chaintrust>,
  entry: PublicKey,
) {
  return program.account.commentRecord.all([
    { memcmp: { offset: 8, bytes: entry.toBase58() } },
  ]);
}

export async function fetchEntriesCreatedBy(
  program: Program<Chaintrust>,
  wallet: PublicKey,
) {
  // created_by is the 2nd field: after 8-byte discriminator + 8-byte entry_id
  return program.account.companyEntry.all([
    { memcmp: { offset: 8 + 8, bytes: wallet.toBase58() } },
  ]);
}

export async function fetchCommentsByCommenter(
  program: Program<Chaintrust>,
  wallet: PublicKey,
) {
  return program.account.commentRecord.all([
    { memcmp: { offset: 8 + 32, bytes: wallet.toBase58() } },
  ]);
}

// --- write helpers ---

export async function registerUser(
  program: Program<Chaintrust>,
  signer: PublicKey,
  username: string,
  displayName: string,
  metadataUri: string,
): Promise<string> {
  const [userPda] = userProfilePda(signer);
  return program.methods
    .registerUser(username, displayName, metadataUri)
    .accountsPartial({
      userProfile: userPda,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function createEntry(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    entryId: number[];
    companyNameHash: number[];
    projectNameHash: number[];
    jurisdiction: string;
    domainHash: number[];
    metadataUri: string;
    primaryWallet: PublicKey;
  },
): Promise<string> {
  const [entry] = entryPda(params.entryId);
  const [creatorProfile] = userProfilePda(signer);
  return program.methods
    .createEntry(
      params.entryId,
      params.companyNameHash,
      params.projectNameHash,
      params.jurisdiction,
      params.domainHash,
      params.metadataUri,
    )
    .accountsPartial({
      entry,
      creatorProfile,
      primaryWallet: params.primaryWallet,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function addWalletMapping(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    entry: PublicKey;
    targetWallet: PublicKey;
    walletRole: number;
    evidenceHash: number[];
    evidenceUri: string;
    isOfficial: boolean;
  },
): Promise<string> {
  const [userProfile] = userProfilePda(signer);
  const [mapping] = walletMappingPda(params.targetWallet, params.entry);
  return program.methods
    .addWalletMapping(
      params.walletRole,
      params.evidenceHash,
      params.evidenceUri,
      params.isOfficial,
    )
    .accountsPartial({
      entry: params.entry,
      walletMapping: mapping,
      targetWallet: params.targetWallet,
      userProfile,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function submitComment(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    entry: PublicKey;
    commentIndex: number;
    relationType: number;
    contractScore: number;
    teamScore: number;
    productScore: number;
    contentHash: number[];
    evidenceHash: number[];
    contentUri: string;
  },
): Promise<string> {
  const [commenterProfile] = userProfilePda(signer);
  const [comment] = commentPda(params.entry, signer, params.commentIndex);
  return program.methods
    .submitComment(
      params.commentIndex,
      params.relationType,
      params.contractScore,
      params.teamScore,
      params.productScore,
      params.contentHash,
      params.evidenceHash,
      params.contentUri,
    )
    .accountsPartial({
      entry: params.entry,
      comment,
      commenterProfile,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function claimEntry(
  program: Program<Chaintrust>,
  signer: PublicKey,
  entry: PublicKey,
): Promise<string> {
  const [claimerProfile] = userProfilePda(signer);
  return program.methods
    .claimEntry()
    .accountsPartial({
      entry,
      claimerProfile,
      signer,
    })
    .rpc();
}

export async function addOfficialResponse(
  program: Program<Chaintrust>,
  signer: PublicKey,
  entry: PublicKey,
  comment: PublicKey,
  officialResponseUri: string,
): Promise<string> {
  return program.methods
    .addOfficialResponse(officialResponseUri)
    .accountsPartial({
      entry,
      comment,
      signer,
    })
    .rpc();
}

export { PROGRAM_ID, BN };
