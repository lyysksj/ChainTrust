import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

// ---- On-chain account snapshots (deserialized) ----

export type UserProfile = {
  wallet: PublicKey;
  username: string;
  metadataUri: string;
  registeredAt: BN;
  bump: number;
};

export type Issuer = {
  authority: PublicKey;
  kind: number;
  trustTier: number;
  nameHash: number[];
  metadataUri: string;
  registeredAt: BN;
  bump: number;
};

export type Entity = {
  entityId: number[];
  createdBy: PublicKey;
  legalNameHash: number[];
  registryIdHash: number[];
  jurisdiction: string;
  status: number;
  isClaimed: boolean;
  officialWallet: PublicKey;
  metadataUri: string;
  projectCount: number;
  relationshipCount: number;
  commentCount: number;
  createdAt: BN;
  claimedAt: BN;
  bump: number;
};

export type Project = {
  projectId: number[];
  entity: PublicKey;
  createdBy: PublicKey;
  nameHash: number[];
  domainHash: number[];
  metadataUri: string;
  createdAt: BN;
  bump: number;
};

export type Relationship = {
  entity: PublicKey;
  kind: number;
  targetRef: number[];
  issuer: PublicKey;
  attestorAuthority: PublicKey;
  evidenceHash: number[];
  evidenceUri: string;
  validFrom: BN;
  validUntil: BN;
  revokedAt: BN;
  createdAt: BN;
  bump: number;
};

export type CommentRecord = {
  entity: PublicKey;
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

export type LikeRecord = {
  comment: PublicKey;
  liker: PublicKey;
  likedAt: BN;
  bump: number;
};

// ---- Off-chain metadata (mock storage / IPFS) ----

export type FilerRole = "first-party" | "third-party";

export type EntityMetadata = {
  legalName: string;
  tradeName?: string;
  registryId: string;
  countryCode: string;
  countryLabel: string;
  entityType?: string;
  incorporationDate?: string; // ISO YYYY-MM-DD
  industry?: string;
  operatingRegions?: string[];
  websites?: string[];
  parentEntityCt?: string;
  lei?: string;
  contactEmail?: string;
  description?: string;
  filerRole?: FilerRole;
  filerStatement?: string;
  evidenceNote?: string;
};

export type ProjectMetadata = {
  name: string;
  domain?: string;
  description?: string;
  links?: string[];
};

export type IssuerMetadata = {
  name: string;
  description?: string;
  website?: string;
  contact?: string;
};

export type CommentBody = {
  headline?: string;
  body: string;
  images?: string[];
  relationType?: number;
};

export type WorkExperienceItem = {
  company: string;
  role: string;
  fromYear?: number | null;
  toYear?: number | null;
};

export type UserMetadata = {
  headline?: string;
  expertise?: string[];
  workExperience?: WorkExperienceItem[];
  links?: {
    x?: string;
    github?: string;
    linkedin?: string;
    site?: string;
  };
  about?: string;
};

// ---- Display helpers ----

export const ENTITY_STATUS: Record<number, "unverified" | "platform_verified" | "claimed"> = {
  0: "unverified",
  1: "platform_verified",
  2: "claimed",
};

// Issuer kinds (must match constants.rs)
export const ISSUER_KIND = {
  KYB_PROVIDER: 1,
  AUDIT: 2,
  CHAIN_ANALYTICS: 3,
  REGULATOR: 4,
  SELF: 5,
  COMMUNITY: 6,
} as const;

export const ISSUER_KIND_LABELS: Record<number, string> = {
  1: "KYB Provider",
  2: "Audit Firm",
  3: "Chain Analytics",
  4: "Regulator",
  5: "Self-asserted",
  6: "Community",
};

export const ISSUER_TIER_LABELS: Record<number, string> = {
  1: "Tier 1 · Platform / Regulated",
  2: "Tier 2 · Known Third-party",
  3: "Tier 3 · Community / Self",
};

// Relationship kinds (must match constants.rs)
export const REL_KIND = {
  OPERATES_PROJECT: 1,
  DEPLOYS_WALLET: 2,
  CONTROLS_WALLET: 3,
  HAS_DOMAIN: 4,
  SUBSIDIARY_OF: 5,
  PARENT_OF: 6,
  HAS_UBO: 7,
  HAS_OFFICER: 8,
  AUDITED_BY: 9,
} as const;

export type RelTargetType =
  | "project"
  | "wallet"
  | "domain"
  | "entity"
  | "person"
  | "issuer";

export const REL_KIND_META: Record<
  number,
  { label: string; verb: string; targetType: RelTargetType }
> = {
  1: { label: "Operates project", verb: "operates", targetType: "project" },
  2: { label: "Deploys wallet", verb: "deploys", targetType: "wallet" },
  3: { label: "Controls wallet", verb: "controls", targetType: "wallet" },
  4: { label: "Has domain", verb: "claims domain", targetType: "domain" },
  5: { label: "Subsidiary of", verb: "is subsidiary of", targetType: "entity" },
  6: { label: "Parent of", verb: "is parent of", targetType: "entity" },
  7: { label: "Has UBO", verb: "has UBO", targetType: "person" },
  8: { label: "Has officer", verb: "has officer", targetType: "person" },
  9: { label: "Audited by", verb: "audited by", targetType: "issuer" },
};

// Comment relation types — community-signal categories. 0 reserved for replies.
export const COMMENT_RELATION_LABELS: Record<number, string> = {
  0: "Reply",
  1: "Dispute",
  2: "Addendum",
  3: "Praise",
  4: "Incident",
  5: "Other",
};

// ---- Country list for entity form ----
export type CountryOption = {
  code: string;
  label: string;
  idLabel: string;
  idFormat: string;
};

export const COUNTRIES: CountryOption[] = [
  { code: "SG", label: "Singapore", idLabel: "UEN", idFormat: "9–10 alphanumeric" },
  { code: "HK", label: "Hong Kong SAR", idLabel: "Business Registration No.", idFormat: "8 digits" },
  { code: "US", label: "United States", idLabel: "EIN", idFormat: "9 digits, e.g. 12-3456789" },
  { code: "CN", label: "China", idLabel: "Unified Social Credit Code", idFormat: "18 chars, letters + digits" },
  { code: "GB", label: "United Kingdom", idLabel: "Company Number", idFormat: "8 alphanumeric" },
  { code: "JP", label: "Japan", idLabel: "Corporate Number", idFormat: "13 digits" },
  { code: "KR", label: "South Korea", idLabel: "Business Registration No.", idFormat: "10 digits" },
  { code: "CA", label: "Canada", idLabel: "BN / CRA", idFormat: "9 digits" },
  { code: "AU", label: "Australia", idLabel: "ABN", idFormat: "11 digits" },
  { code: "DE", label: "Germany", idLabel: "Handelsregisternummer", idFormat: "alphanumeric" },
  { code: "KY", label: "Cayman Islands", idLabel: "Registration No.", idFormat: "any identifier" },
  { code: "BVI", label: "British Virgin Islands", idLabel: "Registration No.", idFormat: "any identifier" },
  { code: "CH", label: "Switzerland", idLabel: "CHE / UID", idFormat: "CHE-XXX.XXX.XXX" },
  { code: "OTHER", label: "Other", idLabel: "Registration ID", idFormat: "any identifier" },
];

// ---- Entity types (D&B style classification) ----
export type EntityTypeOption = { code: string; label: string };
export const ENTITY_TYPES: EntityTypeOption[] = [
  { code: "LLC", label: "Limited Liability Company (LLC)" },
  { code: "PTE", label: "Private Limited (Pte. / Sdn. Bhd.)" },
  { code: "PLC", label: "Public Limited Company (PLC / Ltd)" },
  { code: "INC", label: "Corporation (Inc / Corp)" },
  { code: "DAO_LLC", label: "DAO LLC" },
  { code: "FOUNDATION", label: "Foundation (Stiftung / Verein)" },
  { code: "TRUST", label: "Trust" },
  { code: "NPO", label: "Non-profit / NGO" },
  { code: "COOP", label: "Cooperative" },
  { code: "SOLE", label: "Sole Proprietorship" },
  { code: "OTHER", label: "Other" },
];

// ---- Industry classification (Web3-flavored, top-of-the-pyramid only) ----
export type IndustryOption = { code: string; label: string };
export const INDUSTRIES: IndustryOption[] = [
  { code: "DEFI", label: "DeFi · Trading · Payments" },
  { code: "INFRA", label: "Infrastructure · RPC · Wallets" },
  { code: "GAMING_NFT", label: "Gaming · NFT · Consumer" },
  { code: "DATA", label: "Data · Analytics · Oracles" },
  { code: "INVESTMENT", label: "Investment · Funds · Market Making" },
  { code: "LEGAL_KYB", label: "Legal · KYB · Audit" },
  { code: "FOUNDATION_PG", label: "Foundation · Public Goods" },
  { code: "MEDIA_RESEARCH", label: "Media · Research · Education" },
  { code: "ENTERPRISE", label: "Enterprise · B2B · SaaS" },
  { code: "OTHER", label: "Other" },
];

// ---- Operating regions ----
export type RegionOption = { code: string; label: string };
export const REGIONS: RegionOption[] = [
  { code: "GLOBAL", label: "Global" },
  { code: "NA", label: "North America" },
  { code: "EU", label: "Europe" },
  { code: "GC", label: "Greater China" },
  { code: "SEA", label: "Southeast Asia" },
  { code: "SA", label: "South Asia" },
  { code: "ME", label: "Middle East" },
  { code: "AF", label: "Africa" },
  { code: "LATAM", label: "Latin America" },
];
