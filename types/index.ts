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

export type RegistryConfig = {
  adminAuthority: PublicKey;
  initializedAt: BN;
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

export type IssuerTierRequest = {
  issuer: PublicKey;
  requester: PublicKey;
  requestedTier: number;
  status: number;
  noteHash: number[];
  noteUri: string;
  requestedAt: BN;
  resolvedAt: BN;
  reviewedBy: PublicKey;
  bump: number;
};

export type Entity = {
  entityId: number[];
  createdBy: PublicKey;
  jurisdiction: string;
  status: number;
  isClaimed: boolean;
  officialWallet: PublicKey;
  metadataUri: string;
  projectCount: number;
  relationshipCount: number;
  commentCount: number;
  identifierCount: number;
  createdAt: BN;
  claimedAt: BN;
  bump: number;
};

export type IdClaim = {
  entity: PublicKey;
  createdAt: BN;
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

export type HumanProof = {
  wallet: PublicKey;
  nullifierHash: number[];
  verifiedAt: BN;
  attestedBy: PublicKey;
  bump: number;
};

export type NullifierRecord = {
  wallet: PublicKey;
  nullifierHash: number[];
  verifiedAt: BN;
  bump: number;
};

// ---- Off-chain metadata (mock storage / IPFS) ----

export type FilerRole = "first-party" | "third-party";

/**
 * EntityIdentifier — one row in the identifiers array.
 *
 * `type` is the canonical machine code (e.g. "EIN", "CIK", "UEN"). When
 * `custom === true`, `typeLabel` carries the user-supplied display name for
 * a type that's not in the predefined catalog; otherwise `typeLabel` mirrors
 * the catalog's human label.
 *
 * `value` is the **raw** identifier as the user typed it — preserved for
 * display. The on-chain hash uses `normalizedValue` (uppercase, separators
 * stripped); both are stored so consumers can render the original string
 * but verify against the on-chain IdClaim PDA without re-asking the user.
 */
export type EntityIdentifier = {
  type: string;
  typeLabel: string;
  value: string;
  normalizedValue: string;
  primary: boolean;
  custom: boolean;
};

/**
 * EntityMetadata — public, plaintext IPFS payload.
 *
 * Privacy contract:
 *   - This object is uploaded to PUBLIC IPFS. Anyone with the metadataUri
 *     CID can read every field. Treat as published.
 *   - There is no privacy hash layer. legal_name and identifiers are stored
 *     plaintext; the on-chain `entity_id` is a deterministic 5-byte slice of
 *     SHA-256(country | id_type | normalized_value) of the *primary*
 *     identifier, and each identifier has a corresponding IdClaim PDA for
 *     global uniqueness. Both the chain layer and IPFS expose the same
 *     truth — there is no "raw value stays local" pretense.
 *   - For genuinely sensitive evidence (UBO docs, audit work papers, internal
 *     compliance), use EvidenceMetadata + sensitivity="sensitive" instead;
 *     that path is what the Lit-encrypted slot is reserved for.
 */
export type EntityMetadata = {
  legalName: string;
  tradeName?: string;
  identifiers: EntityIdentifier[];
  countryCode: string;
  countryLabel: string;
  // Subdivision of registration (US state, CA province, AU state/territory,
  // CN province, DE Bundesland, etc.). Public; stored as the country-specific
  // code (e.g. "DE" for Delaware, "NSW" for New South Wales).
  subdivision?: string;
  entityType?: string;
  // D&B-style operating status — self-declared by the filer. The platform
  // does not verify this; consumers should treat it as one input among many.
  operatingStatus?: "active" | "dormant" | "dissolved";
  // Headquarters of operations. May differ from the jurisdiction of
  // registration (Cayman-registered, Singapore-operating is common). Stored
  // as plain text city + ISO country code.
  hqCity?: string;
  hqCountryCode?: string;
  // Employee count band. Banded (not exact) so an entity can disclose scale
  // without leaking sensitive headcount.
  employeeBand?: string;
  incorporationDate?: string; // ISO YYYY-MM-DD
  industry?: string;
  operatingRegions?: string[];
  websites?: string[];
  parentEntityCt?: string;
  contactEmail?: string;
  description?: string;
  filerRole?: FilerRole;
  filerStatement?: string;
  evidenceNote?: string;
};

/**
 * EvidenceMetadata — payload referenced by Relationship.evidence_uri.
 *
 * `sensitivity: "public"`  — uploaded to plaintext IPFS, anyone can read.
 * `sensitivity: "sensitive"` — uploaded to plaintext IPFS for now BUT the
 *   client is expected to wrap it in a `LitEnvelope` before upload once Lit
 *   Protocol integration ships. The schema reserves the field; consumers
 *   must fall back gracefully when `litCondition` is absent.
 */
export type EvidenceSensitivity = "public" | "sensitive";

export type EvidenceMetadata = {
  sensitivity: EvidenceSensitivity;
  notes?: string;
  /** When sensitivity === "sensitive", the actual encrypted payload + Lit
   * access conditions live here. Until Lit is wired, this is undefined and
   * the body lives in `notes` (still public). Mark sensitive intent so
   * consumers can refuse to display until decrypt is supported. */
  litCondition?: {
    chain: string;
    accessControlConditions: unknown;
    ciphertext: string; // base64
    dataToEncryptHash: string;
  };
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

export const ISSUER_TIER_REQUEST_STATUS_LABELS: Record<number, string> = {
  0: "Pending",
  1: "Approved",
  2: "Rejected",
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
};

export const COUNTRIES: CountryOption[] = [
  { code: "SG", label: "Singapore" },
  { code: "HK", label: "Hong Kong SAR" },
  { code: "US", label: "United States" },
  { code: "CN", label: "China" },
  { code: "GB", label: "United Kingdom" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "KY", label: "Cayman Islands" },
  { code: "BVI", label: "British Virgin Islands" },
  { code: "CH", label: "Switzerland" },
  { code: "OTHER", label: "Other" },
];

// ---- Identifier catalog (per-country ID types for Step 1 dropdown) -------
//
// Each country exposes one or more ID *types* the filer can pick. The first
// entry in each list is the recommended default (and what the UI marks as
// `primary` when added first). Filers can also pick "CUSTOM" to enter any
// type label (e.g. a state-level filing number not in this list); custom
// entries store both `value` and the user-supplied `typeLabel`.
//
// `format` is shown as the input placeholder. `validate` is a lightweight
// per-type sanity check applied in addition to the global
// uppercase-alphanumeric normalization rule. Returning a string aborts the
// step; returning null lets the value through.
export type IdTypeOption = {
  code: string;
  label: string;
  format: string;
  // Hint for what the ID identifies, shown under the input.
  description?: string;
};

export const ID_TYPES_BY_COUNTRY: Record<string, IdTypeOption[]> = {
  US: [
    {
      code: "EIN",
      label: "EIN",
      format: "9 digits, e.g. 12-3456789",
      description: "Employer Identification Number issued by the IRS.",
    },
    {
      code: "CIK",
      label: "SEC CIK",
      format: "up to 10 digits, e.g. 0001234567",
      description: "Central Index Key assigned by the SEC for filings.",
    },
  ],
  SG: [
    {
      code: "UEN",
      label: "UEN",
      format: "9–10 alphanumeric",
      description: "Unique Entity Number issued by ACRA.",
    },
  ],
  HK: [
    {
      code: "BR",
      label: "Business Registration No.",
      format: "8 digits",
      description: "Issued by the Inland Revenue Department.",
    },
    {
      code: "CR",
      label: "Companies Registry No.",
      format: "alphanumeric",
      description: "Issued by the Companies Registry.",
    },
  ],
  CN: [
    {
      code: "USCC",
      label: "Unified Social Credit Code",
      format: "18 chars, letters + digits",
      description: "统一社会信用代码 — primary registry ID.",
    },
    {
      code: "ICR",
      label: "工商注册号 (legacy)",
      format: "15 digits",
      description: "Pre-2015 industrial & commercial registration number.",
    },
  ],
  GB: [
    {
      code: "CH",
      label: "Companies House No.",
      format: "8 alphanumeric",
      description: "Issued by Companies House.",
    },
  ],
  JP: [
    {
      code: "CORP",
      label: "法人番号 (Corporate Number)",
      format: "13 digits",
      description: "National Tax Agency 法人番号.",
    },
    {
      code: "REG",
      label: "商業登記番号",
      format: "12 digits",
      description: "Commercial registry number.",
    },
  ],
  KR: [
    {
      code: "BRN",
      label: "Business Registration No.",
      format: "10 digits",
      description: "사업자등록번호.",
    },
  ],
  CA: [
    {
      code: "BN",
      label: "Business Number / CRA",
      format: "9 digits",
      description: "CRA-assigned Business Number.",
    },
  ],
  AU: [
    {
      code: "ABN",
      label: "ABN",
      format: "11 digits",
      description: "Australian Business Number.",
    },
  ],
  DE: [
    {
      code: "HRB",
      label: "Handelsregisternummer",
      format: "alphanumeric",
      description: "Commercial register entry number.",
    },
  ],
  KY: [
    {
      code: "REG",
      label: "Registration No.",
      format: "any identifier",
    },
  ],
  BVI: [
    {
      code: "REG",
      label: "Registration No.",
      format: "any identifier",
    },
  ],
  CH: [
    {
      code: "UID",
      label: "CHE / UID",
      format: "CHE-XXX.XXX.XXX",
      description: "Unique Enterprise Identifier (Bundesamt für Statistik).",
    },
  ],
  OTHER: [
    {
      code: "REG",
      label: "Registration No.",
      format: "any identifier",
    },
  ],
};

export const ID_TYPE_CUSTOM_CODE = "CUSTOM";

/** Look up an ID type definition for a given country + code. Returns null
 *  for the synthetic `CUSTOM` code; callers fall back to the user-supplied
 *  typeLabel in that case. */
export function findIdType(
  countryCode: string,
  typeCode: string,
): IdTypeOption | null {
  const list = ID_TYPES_BY_COUNTRY[countryCode] ?? [];
  return list.find((t) => t.code === typeCode) ?? null;
}

// ---- Subdivisions (state / province / region of registration) ------------
//
// First-class lists for jurisdictions where the registration subdivision is
// load-bearing on a public registry (US Delaware vs. Wyoming vs. CA, Canada
// federal vs. provincial, AU state corp registrations, mainland China
// provinces, German Bundesländer). For everything else, the form falls back
// to a free-text input so the user isn't forced to pick "Other".
//
// `subdivisionLabel` overrides the generic "State / Province" label per
// country (e.g. AU = "State / Territory", CN = "Province / Region", DE =
// "Bundesland").
export type SubdivisionOption = { code: string; label: string };

export const SUBDIVISION_LABEL_BY_COUNTRY: Record<string, string> = {
  US: "State",
  CA: "Province / Territory",
  AU: "State / Territory",
  CN: "Province / Region",
  DE: "Bundesland",
  JP: "Prefecture",
  GB: "Country",
  CH: "Canton",
  SG: "Region (CDC)",
  HK: "District",
  KR: "Province / City",
  KY: "District",
  BVI: "Island",
  OTHER: "Subdivision",
};

export const SUBDIVISIONS_BY_COUNTRY: Record<string, SubdivisionOption[]> = {
  US: [
    { code: "DE", label: "Delaware" },
    { code: "WY", label: "Wyoming" },
    { code: "NV", label: "Nevada" },
    { code: "CA", label: "California" },
    { code: "NY", label: "New York" },
    { code: "TX", label: "Texas" },
    { code: "FL", label: "Florida" },
    { code: "WA", label: "Washington" },
    { code: "MA", label: "Massachusetts" },
    { code: "CO", label: "Colorado" },
    { code: "IL", label: "Illinois" },
    { code: "GA", label: "Georgia" },
    { code: "NJ", label: "New Jersey" },
    { code: "PA", label: "Pennsylvania" },
    { code: "VA", label: "Virginia" },
    { code: "DC", label: "District of Columbia" },
    { code: "AL", label: "Alabama" },
    { code: "AK", label: "Alaska" },
    { code: "AZ", label: "Arizona" },
    { code: "AR", label: "Arkansas" },
    { code: "CT", label: "Connecticut" },
    { code: "HI", label: "Hawaii" },
    { code: "ID", label: "Idaho" },
    { code: "IN", label: "Indiana" },
    { code: "IA", label: "Iowa" },
    { code: "KS", label: "Kansas" },
    { code: "KY", label: "Kentucky" },
    { code: "LA", label: "Louisiana" },
    { code: "ME", label: "Maine" },
    { code: "MD", label: "Maryland" },
    { code: "MI", label: "Michigan" },
    { code: "MN", label: "Minnesota" },
    { code: "MS", label: "Mississippi" },
    { code: "MO", label: "Missouri" },
    { code: "MT", label: "Montana" },
    { code: "NE", label: "Nebraska" },
    { code: "NH", label: "New Hampshire" },
    { code: "NM", label: "New Mexico" },
    { code: "NC", label: "North Carolina" },
    { code: "ND", label: "North Dakota" },
    { code: "OH", label: "Ohio" },
    { code: "OK", label: "Oklahoma" },
    { code: "OR", label: "Oregon" },
    { code: "RI", label: "Rhode Island" },
    { code: "SC", label: "South Carolina" },
    { code: "SD", label: "South Dakota" },
    { code: "TN", label: "Tennessee" },
    { code: "UT", label: "Utah" },
    { code: "VT", label: "Vermont" },
    { code: "WV", label: "West Virginia" },
    { code: "WI", label: "Wisconsin" },
    { code: "PR", label: "Puerto Rico" },
  ],
  CA: [
    { code: "FED", label: "Federal (CBCA)" },
    { code: "ON", label: "Ontario" },
    { code: "QC", label: "Québec" },
    { code: "BC", label: "British Columbia" },
    { code: "AB", label: "Alberta" },
    { code: "MB", label: "Manitoba" },
    { code: "SK", label: "Saskatchewan" },
    { code: "NS", label: "Nova Scotia" },
    { code: "NB", label: "New Brunswick" },
    { code: "NL", label: "Newfoundland and Labrador" },
    { code: "PE", label: "Prince Edward Island" },
    { code: "YT", label: "Yukon" },
    { code: "NT", label: "Northwest Territories" },
    { code: "NU", label: "Nunavut" },
  ],
  AU: [
    { code: "NSW", label: "New South Wales" },
    { code: "VIC", label: "Victoria" },
    { code: "QLD", label: "Queensland" },
    { code: "WA", label: "Western Australia" },
    { code: "SA", label: "South Australia" },
    { code: "TAS", label: "Tasmania" },
    { code: "ACT", label: "Australian Capital Territory" },
    { code: "NT", label: "Northern Territory" },
  ],
  CN: [
    { code: "BJ", label: "Beijing 北京" },
    { code: "SH", label: "Shanghai 上海" },
    { code: "TJ", label: "Tianjin 天津" },
    { code: "CQ", label: "Chongqing 重庆" },
    { code: "GD", label: "Guangdong 广东" },
    { code: "ZJ", label: "Zhejiang 浙江" },
    { code: "JS", label: "Jiangsu 江苏" },
    { code: "SD", label: "Shandong 山东" },
    { code: "HE", label: "Hebei 河北" },
    { code: "HA", label: "Henan 河南" },
    { code: "HB", label: "Hubei 湖北" },
    { code: "HN", label: "Hunan 湖南" },
    { code: "AH", label: "Anhui 安徽" },
    { code: "FJ", label: "Fujian 福建" },
    { code: "JX", label: "Jiangxi 江西" },
    { code: "SX", label: "Shanxi 山西" },
    { code: "SN", label: "Shaanxi 陕西" },
    { code: "GS", label: "Gansu 甘肃" },
    { code: "QH", label: "Qinghai 青海" },
    { code: "SC", label: "Sichuan 四川" },
    { code: "GZ", label: "Guizhou 贵州" },
    { code: "YN", label: "Yunnan 云南" },
    { code: "LN", label: "Liaoning 辽宁" },
    { code: "JL", label: "Jilin 吉林" },
    { code: "HL", label: "Heilongjiang 黑龙江" },
    { code: "HI", label: "Hainan 海南" },
    { code: "GX", label: "Guangxi 广西 (ZAR)" },
    { code: "NM", label: "Inner Mongolia 内蒙古 (ZAR)" },
    { code: "NX", label: "Ningxia 宁夏 (ZAR)" },
    { code: "XJ", label: "Xinjiang 新疆 (ZAR)" },
    { code: "XZ", label: "Tibet 西藏 (ZAR)" },
  ],
  DE: [
    { code: "BW", label: "Baden-Württemberg" },
    { code: "BY", label: "Bayern" },
    { code: "BE", label: "Berlin" },
    { code: "BB", label: "Brandenburg" },
    { code: "HB", label: "Bremen" },
    { code: "HH", label: "Hamburg" },
    { code: "HE", label: "Hessen" },
    { code: "MV", label: "Mecklenburg-Vorpommern" },
    { code: "NI", label: "Niedersachsen" },
    { code: "NW", label: "Nordrhein-Westfalen" },
    { code: "RP", label: "Rheinland-Pfalz" },
    { code: "SL", label: "Saarland" },
    { code: "SN", label: "Sachsen" },
    { code: "ST", label: "Sachsen-Anhalt" },
    { code: "SH", label: "Schleswig-Holstein" },
    { code: "TH", label: "Thüringen" },
  ],
  JP: [
    { code: "13", label: "Tokyo 東京都" },
    { code: "27", label: "Osaka 大阪府" },
    { code: "26", label: "Kyoto 京都府" },
    { code: "14", label: "Kanagawa 神奈川県" },
    { code: "23", label: "Aichi 愛知県" },
    { code: "28", label: "Hyogo 兵庫県" },
    { code: "11", label: "Saitama 埼玉県" },
    { code: "12", label: "Chiba 千葉県" },
    { code: "01", label: "Hokkaido 北海道" },
    { code: "40", label: "Fukuoka 福岡県" },
  ],
  GB: [
    { code: "ENG", label: "England" },
    { code: "SCT", label: "Scotland" },
    { code: "WLS", label: "Wales" },
    { code: "NIR", label: "Northern Ireland" },
  ],
  CH: [
    { code: "ZG", label: "Zug" },
    { code: "ZH", label: "Zürich" },
    { code: "GE", label: "Genève" },
    { code: "VD", label: "Vaud" },
    { code: "BS", label: "Basel-Stadt" },
    { code: "BE", label: "Bern" },
    { code: "TI", label: "Ticino" },
    { code: "LU", label: "Luzern" },
  ],
  // Singapore is a unitary city-state; the CDC regions are the closest formal
  // sub-units, used for community administration rather than incorporation.
  SG: [
    { code: "SG_CENTRAL", label: "Central Singapore" },
    { code: "SG_NE", label: "North East" },
    { code: "SG_NW", label: "North West" },
    { code: "SG_SE", label: "South East" },
    { code: "SG_SW", label: "South West" },
  ],
  HK: [
    { code: "HK_CW", label: "Central & Western" },
    { code: "HK_E", label: "Eastern" },
    { code: "HK_S", label: "Southern" },
    { code: "HK_WC", label: "Wan Chai" },
    { code: "HK_KC", label: "Kowloon City" },
    { code: "HK_KT", label: "Kwun Tong" },
    { code: "HK_SSP", label: "Sham Shui Po" },
    { code: "HK_WTS", label: "Wong Tai Sin" },
    { code: "HK_YTM", label: "Yau Tsim Mong" },
    { code: "HK_IS", label: "Islands" },
    { code: "HK_KTS", label: "Kwai Tsing" },
    { code: "HK_NTH", label: "North" },
    { code: "HK_SK", label: "Sai Kung" },
    { code: "HK_ST", label: "Sha Tin" },
    { code: "HK_TP", label: "Tai Po" },
    { code: "HK_TW", label: "Tsuen Wan" },
    { code: "HK_TM", label: "Tuen Mun" },
    { code: "HK_YL", label: "Yuen Long" },
  ],
  KR: [
    { code: "KR_11", label: "Seoul 서울특별시" },
    { code: "KR_26", label: "Busan 부산광역시" },
    { code: "KR_27", label: "Daegu 대구광역시" },
    { code: "KR_28", label: "Incheon 인천광역시" },
    { code: "KR_29", label: "Gwangju 광주광역시" },
    { code: "KR_30", label: "Daejeon 대전광역시" },
    { code: "KR_31", label: "Ulsan 울산광역시" },
    { code: "KR_36", label: "Sejong 세종특별자치시" },
    { code: "KR_41", label: "Gyeonggi 경기도" },
    { code: "KR_42", label: "Gangwon 강원도" },
    { code: "KR_43", label: "North Chungcheong 충청북도" },
    { code: "KR_44", label: "South Chungcheong 충청남도" },
    { code: "KR_45", label: "North Jeolla 전라북도" },
    { code: "KR_46", label: "South Jeolla 전라남도" },
    { code: "KR_47", label: "North Gyeongsang 경상북도" },
    { code: "KR_48", label: "South Gyeongsang 경상남도" },
    { code: "KR_50", label: "Jeju 제주특별자치도" },
  ],
  KY: [
    { code: "KY_GT", label: "George Town" },
    { code: "KY_WB", label: "West Bay" },
    { code: "KY_BT", label: "Bodden Town" },
    { code: "KY_NS", label: "North Side" },
    { code: "KY_ES", label: "East End" },
    { code: "KY_SI", label: "Sister Islands (Cayman Brac & Little Cayman)" },
  ],
  BVI: [
    { code: "BVI_TO", label: "Tortola" },
    { code: "BVI_VG", label: "Virgin Gorda" },
    { code: "BVI_AN", label: "Anegada" },
    { code: "BVI_JV", label: "Jost Van Dyke" },
  ],
  // Generic fallback when "Other" is selected as country: a single
  // "Not specified" so the field stays consistent (a select, never a text
  // input) and the user has to make a deliberate choice rather than typing
  // a free-form value.
  OTHER: [{ code: "NA", label: "Not specified" }],
};

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

// ---- Industry classification (Web3-native subsectors) ----
//
// Codes are stable: existing on-chain metadata referencing old top-level codes
// (DEFI / INFRA / GAMING_NFT / DATA / INVESTMENT / LEGAL_KYB / FOUNDATION_PG /
//  MEDIA_RESEARCH / ENTERPRISE / OTHER) is preserved as aliases at the bottom
// so old entries still render their label. Pick one of the new codes for any
// new filing.
export type IndustryGroup =
  | "Protocol layer"
  | "DeFi"
  | "Infrastructure"
  | "Consumer & creator"
  | "Frontier"
  | "Compliance & services"
  | "Capital & markets"
  | "Foundations & comms"
  | "Other";

export type IndustryOption = {
  code: string;
  label: string;
  group: IndustryGroup;
  alias?: boolean; // legacy code preserved for back-compat; hide from UI
};

export const INDUSTRIES: IndustryOption[] = [
  // Protocol layer
  { code: "L1_BLOCKCHAIN", label: "Layer 1 blockchain", group: "Protocol layer" },
  { code: "L2_ROLLUP", label: "Layer 2 / rollup", group: "Protocol layer" },
  { code: "APPCHAIN", label: "Appchain / sidechain", group: "Protocol layer" },
  { code: "DA_LAYER", label: "Data availability", group: "Protocol layer" },
  { code: "RESTAKING_AVS", label: "Restaking / AVS", group: "Protocol layer" },
  { code: "BRIDGE", label: "Cross-chain bridge", group: "Protocol layer" },
  { code: "MEV", label: "MEV / sequencer / block-builder", group: "Protocol layer" },

  // DeFi
  { code: "DEX_AMM", label: "DEX / AMM", group: "DeFi" },
  { code: "DEX_AGGREGATOR", label: "DEX aggregator", group: "DeFi" },
  { code: "PERP_DEX", label: "Perpetuals / derivatives DEX", group: "DeFi" },
  { code: "LENDING", label: "Lending & borrowing", group: "DeFi" },
  { code: "STABLECOIN", label: "Stablecoin issuer", group: "DeFi" },
  { code: "LST_LRT", label: "Liquid (re)staking", group: "DeFi" },
  { code: "YIELD_VAULT", label: "Yield / vaults / structured", group: "DeFi" },
  { code: "PAYMENTS_ONRAMP", label: "Payments / on-ramp / off-ramp", group: "DeFi" },

  // Infrastructure
  { code: "WALLET", label: "Wallet", group: "Infrastructure" },
  { code: "RPC_NODE", label: "RPC / node provider", group: "Infrastructure" },
  { code: "INDEXER", label: "Indexer / data API", group: "Infrastructure" },
  { code: "ORACLE", label: "Oracle", group: "Infrastructure" },
  { code: "DEV_TOOLING", label: "Developer tooling / SDKs", group: "Infrastructure" },
  { code: "ANALYTICS", label: "Analytics / on-chain data", group: "Infrastructure" },

  // Consumer & creator
  { code: "GAMING", label: "Gaming / GameFi", group: "Consumer & creator" },
  { code: "NFT_MARKETPLACE", label: "NFT marketplace", group: "Consumer & creator" },
  { code: "NFT_PROJECT", label: "NFT collection / studio", group: "Consumer & creator" },
  { code: "SOCIAL_FI", label: "Social / SocialFi", group: "Consumer & creator" },
  { code: "CREATOR", label: "Creator / fan economy", group: "Consumer & creator" },

  // Frontier
  { code: "DEPIN", label: "DePIN", group: "Frontier" },
  { code: "AI_CRYPTO", label: "AI × Crypto", group: "Frontier" },
  { code: "RWA", label: "RWA / tokenization", group: "Frontier" },
  { code: "PRIVACY_ZK", label: "Privacy / ZK", group: "Frontier" },
  { code: "IDENTITY_DID", label: "Identity / DID / reputation", group: "Frontier" },
  { code: "DAO_TOOLING", label: "DAO tooling / governance", group: "Frontier" },

  // Compliance & services
  { code: "SECURITY_AUDIT", label: "Security audit", group: "Compliance & services" },
  { code: "KYB_COMPLIANCE", label: "KYB / KYC / compliance", group: "Compliance & services" },
  { code: "CHAIN_ANALYTICS", label: "Chain analytics / forensics", group: "Compliance & services" },
  { code: "LEGAL_SERVICES", label: "Legal services", group: "Compliance & services" },
  { code: "TAX_ACCOUNTING", label: "Tax / accounting", group: "Compliance & services" },

  // Capital & markets
  { code: "VC_FUND", label: "Venture / fund", group: "Capital & markets" },
  { code: "MARKET_MAKER", label: "Market maker / liquidity", group: "Capital & markets" },
  { code: "CEX", label: "Centralized exchange", group: "Capital & markets" },
  { code: "CUSTODY", label: "Custody", group: "Capital & markets" },
  { code: "OTC_DESK", label: "OTC desk", group: "Capital & markets" },

  // Foundations & comms
  { code: "FOUNDATION", label: "Foundation / public goods", group: "Foundations & comms" },
  { code: "MEDIA", label: "Media / news / podcast", group: "Foundations & comms" },
  { code: "RESEARCH", label: "Research", group: "Foundations & comms" },
  { code: "EDUCATION", label: "Education / academy", group: "Foundations & comms" },
  { code: "EVENT", label: "Events / hackathons", group: "Foundations & comms" },

  // Other
  { code: "ENTERPRISE_B2B", label: "Enterprise / B2B SaaS", group: "Other" },
  { code: "CONSUMER_NONCRYPTO", label: "Consumer / non-crypto", group: "Other" },
  { code: "OTHER", label: "Other / unspecified", group: "Other" },

  // ---- Legacy aliases (don't render in the picker, keep for old metadata) ----
  { code: "DEFI", label: "DeFi · Trading · Payments", group: "DeFi", alias: true },
  { code: "INFRA", label: "Infrastructure · RPC · Wallets", group: "Infrastructure", alias: true },
  { code: "GAMING_NFT", label: "Gaming · NFT · Consumer", group: "Consumer & creator", alias: true },
  { code: "DATA", label: "Data · Analytics · Oracles", group: "Infrastructure", alias: true },
  { code: "INVESTMENT", label: "Investment · Funds · Market Making", group: "Capital & markets", alias: true },
  { code: "LEGAL_KYB", label: "Legal · KYB · Audit", group: "Compliance & services", alias: true },
  { code: "FOUNDATION_PG", label: "Foundation · Public Goods", group: "Foundations & comms", alias: true },
  { code: "MEDIA_RESEARCH", label: "Media · Research · Education", group: "Foundations & comms", alias: true },
  { code: "ENTERPRISE", label: "Enterprise · B2B · SaaS", group: "Other", alias: true },
];

/**
 * Group new (non-alias) industry options by their `group` field, preserving
 * the order they're declared in INDUSTRIES. Useful for rendering optgroups.
 */
export const INDUSTRY_GROUPS: { group: IndustryGroup; items: IndustryOption[] }[] =
  (() => {
    const seen = new Map<IndustryGroup, IndustryOption[]>();
    for (const opt of INDUSTRIES) {
      if (opt.alias) continue;
      const arr = seen.get(opt.group) ?? [];
      arr.push(opt);
      seen.set(opt.group, arr);
    }
    return Array.from(seen.entries()).map(([group, items]) => ({ group, items }));
  })();

// ---- Operating status (self-declared) -------------------------------------
export type OperatingStatusOption = {
  code: "active" | "dormant" | "dissolved";
  label: string;
  hint: string;
};
export const OPERATING_STATUSES: OperatingStatusOption[] = [
  {
    code: "active",
    label: "Active — operating normally",
    hint: "The entity is currently operating, filing taxes, and meeting registry obligations.",
  },
  {
    code: "dormant",
    label: "Dormant — incorporated but not actively trading",
    hint: "Formally registered but with no material business activity in the current period.",
  },
  {
    code: "dissolved",
    label: "Dissolved — wound up or struck off",
    hint: "The entity has been dissolved, struck off, or is in formal liquidation. The record is retained for audit.",
  },
];

// ---- Employee count bands -------------------------------------------------
//
// Banded so entities can disclose scale without committing to an exact head-
// count. Mirrors the D&B / Crunchbase size buckets used in B2B data.
export type EmployeeBandOption = { code: string; label: string };
export const EMPLOYEE_BANDS: EmployeeBandOption[] = [
  { code: "1-10", label: "1–10 (founders & early team)" },
  { code: "11-50", label: "11–50 (seed–Series A)" },
  { code: "51-200", label: "51–200 (Series B–C)" },
  { code: "201-1000", label: "201–1,000" },
  { code: "1001-5000", label: "1,001–5,000" },
  { code: "5001+", label: "5,001+" },
];

// ---- Operating regions ----
//
// Modeled on D&B's regional cuts of WorldBase / Hoovers (Americas / EMEA /
// APAC, broken down further) crossed with UN M49 sub-regions so neither
// "Australia" nor "Eastern Europe" falls between the cracks.
export type RegionOption = { code: string; label: string };
export const REGIONS: RegionOption[] = [
  { code: "GLOBAL", label: "Global" },

  // Americas
  { code: "NA", label: "North America (US · Canada · Mexico)" },
  { code: "LATAM", label: "Latin America & Caribbean" },

  // EMEA
  { code: "UK_IE", label: "UK & Ireland" },
  { code: "EU_W", label: "Western Europe" },
  { code: "NORDIC", label: "Nordics" },
  { code: "EU_CE", label: "Central & Eastern Europe" },
  { code: "MENA", label: "Middle East & North Africa" },
  { code: "SSA", label: "Sub-Saharan Africa" },

  // APAC
  { code: "GC", label: "Greater China (CN · HK · MO · TW)" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "SEA", label: "Southeast Asia (ASEAN)" },
  { code: "SA", label: "South Asia" },
  { code: "ANZ", label: "Australia & New Zealand" },
  { code: "CA", label: "Central Asia" },
];
