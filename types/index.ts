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
  einHash: number[];
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
  parentComment: PublicKey | null;
  depth: number;
  likeCount: number;
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

export type LikeRecord = {
  comment: PublicKey;
  liker: PublicKey;
  likedAt: BN;
  bump: number;
};

// ---- Entry metadata stored off-chain (mock storage) ----
export type EntryMetadata = {
  legalName: string;
  ein: string;
  countryCode: string;
  countryLabel: string;
  projectName: string;
  websites: string[];
  primaryWallet?: string | null;
  description?: string;
  evidenceNote?: string;
};

// ---- Review body off-chain ----
export type CommentBody = {
  headline?: string;
  body: string;
  images?: string[];
  relationType?: number;
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
  0: "Reply",
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

// ---- Country list for entry form ----
export type CountryOption = {
  code: string; // ISO 3166-1 alpha-2
  label: string;
  idLabel: string; // what to call the business ID in this country
  idFormat: string; // human-readable hint
};

export const COUNTRIES: CountryOption[] = [
  { code: "US", label: "United States", idLabel: "EIN", idFormat: "9 digits, e.g. 12-3456789" },
  { code: "CN", label: "China", idLabel: "Unified Social Credit Code", idFormat: "18 chars, letters + digits" },
  { code: "HK", label: "Hong Kong", idLabel: "Business Registration No.", idFormat: "8 digits" },
  { code: "SG", label: "Singapore", idLabel: "UEN", idFormat: "9–10 alphanumeric" },
  { code: "GB", label: "United Kingdom", idLabel: "Company Number", idFormat: "8 alphanumeric" },
  { code: "JP", label: "Japan", idLabel: "Corporate Number", idFormat: "13 digits" },
  { code: "KR", label: "South Korea", idLabel: "Business Registration No.", idFormat: "10 digits" },
  { code: "CA", label: "Canada", idLabel: "BN / CRA", idFormat: "9 digits" },
  { code: "AU", label: "Australia", idLabel: "ABN", idFormat: "11 digits" },
  { code: "DE", label: "Germany", idLabel: "Handelsregisternummer", idFormat: "alphanumeric" },
  { code: "OTHER", label: "Other", idLabel: "Company ID", idFormat: "any identifier" },
];
