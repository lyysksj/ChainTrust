import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

// ---- On-chain account snapshots (deserialized) ----

export type UserProfile = {
  wallet: PublicKey;
  username: string;
  displayName: string;
  metadataUri: string;
  registeredAt: BN;
  bump: number;
};

export type CompanyEntry = {
  entryId: number[];
  createdBy: PublicKey;
  companyNameHash: number[];
  projectNameHash: number[];
  jurisdiction: string;
  domainHash: number[];
  primaryWallet: PublicKey;
  status: number;
  isClaimed: boolean;
  officialWallet: PublicKey;
  metadataUri: string;
  commentCount: number;
  createdAt: BN;
  claimedAt: BN;
  bump: number;
};

export type CommentRecord = {
  entry: PublicKey;
  commenter: PublicKey;
  commentIndex: number;
  relationType: number;
  contractScore: number;
  teamScore: number;
  productScore: number;
  contentHash: number[];
  evidenceHash: number[];
  contentUri: string;
  officialResponseUri: string;
  submittedAt: BN;
  officialResponseAt: BN;
  bump: number;
};

export type WalletMapping = {
  targetWallet: PublicKey;
  entry: PublicKey;
  walletRole: number;
  evidenceHash: number[];
  evidenceUri: string;
  addedBy: PublicKey;
  isOfficial: boolean;
  addedAt: BN;
  bump: number;
};

// ---- Entry metadata stored off-chain (mock storage) ----
export type EntryMetadata = {
  companyName: string;
  projectName: string;
  domain: string;
  description?: string;
  links?: { label: string; url: string }[];
  evidenceNote?: string;
};

// ---- Review body off-chain ----
export type CommentBody = {
  headline: string;
  body: string;
  relationType: number;
  contractScore: number;
  teamScore: number;
  productScore: number;
};

// ---- User profile metadata off-chain ----
export type UserMetadata = {
  bio?: string;
  twitter?: string;
  site?: string;
};

// ---- Attestation (mock) ----
export type Attestation = {
  id: string;
  issuer: string;
  issuerRole: "platform" | "third-party";
  type: string;
  status: string;
  issuedAt: number;
  note?: string;
};

// ---- Display helpers ----
export const ENTRY_STATUS: Record<number, "unverified" | "platform_verified" | "claimed"> = {
  0: "unverified",
  1: "platform_verified",
  2: "claimed",
};

export const RELATION_LABELS: Record<number, string> = {
  1: "Employee",
  2: "Partner",
  3: "Investor",
  4: "Customer",
  5: "Other",
};

export const WALLET_ROLE_LABELS: Record<number, string> = {
  1: "Treasury",
  2: "Deployer",
  3: "Team",
  4: "Other",
};
