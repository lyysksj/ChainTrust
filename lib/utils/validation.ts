export function validateUsername(v: string): string | null {
  if (!v || !v.trim()) return "Username is required";
  if (v.length > 32) return "Username must be 32 characters or fewer";
  if (!/^[A-Za-z0-9_-]+$/.test(v))
    return "Use only letters, digits, underscores, and dashes";
  return null;
}

export function validateHeadline(v: string): string | null {
  if (!v || !v.trim()) return "Headline is required";
  if (v.length > 120) return "Headline must be 120 characters or fewer";
  return null;
}

export function validateOptionalUrl(v: string): string | null {
  if (!v) return null;
  if (!/^https?:\/\/[^\s]+$/i.test(v))
    return "URL must start with http:// or https://";
  if (v.length > 200) return "URL too long";
  return null;
}

export function validateCompanyName(v: string): string | null {
  if (!v || !v.trim()) return "Company name is required";
  if (v.length > 200) return "Company name too long";
  return null;
}

export function validateJurisdiction(v: string): string | null {
  if (!v || !v.trim()) return "Jurisdiction is required";
  if (v.length > 64) return "Jurisdiction must be 64 characters or fewer";
  return null;
}

export function validateDomain(v: string): string | null {
  if (!v || !v.trim()) return "Domain is required";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(v))
    return "Enter a valid domain (e.g. example.xyz)";
  return null;
}

export function validateWebsite(v: string): string | null {
  if (!v || !v.trim()) return "Website is required";
  if (!/^https?:\/\/[^\s]+$/i.test(v))
    return "Enter a full URL starting with http:// or https://";
  if (v.length > 200) return "URL too long";
  return null;
}

export function validatePubkey(v: string): string | null {
  if (!v) return "Public key is required";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))
    return "Enter a valid Solana address";
  return null;
}

// ---------------------------------------------------------------------------
// Identifier validation
// ---------------------------------------------------------------------------
//
// Each identifier goes through two passes:
//   1. `validateIdentifierValue(country, type, raw)` checks the raw user input
//      matches the expected format for that type — digit count, alphanumeric
//      shape, etc. Different types in the same country (US EIN vs CIK) have
//      different formats.
//   2. The form then hashes `normalizeIdValue(raw)` and feeds it into
//      ct-number derivation. The on-chain validator re-runs the
//      uppercase-alphanumeric check on the normalized value.

// US EIN: 9 digits, displayed as XX-XXXXXXX.
function validateUsEin(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{9}$/.test(digits))
    return "US EIN must be 9 digits (e.g. 12-3456789)";
  return null;
}

// SEC CIK: 1–10 digits (assigned sequentially; older filers have shorter).
function validateUsCik(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{1,10}$/.test(digits))
    return "SEC CIK must be up to 10 digits";
  return null;
}

// China Unified Social Credit Code: 18 chars, GB 32100-2015 charset (no I/O/S/V/Z).
function validateChinaUscc(v: string): string | null {
  const s = v.toUpperCase();
  if (!/^[0-9A-HJ-NPQR-UWY]{18}$/.test(s))
    return "China Unified Social Credit Code must be 18 chars (digits + uppercase letters, excluding I/O/S/V/Z)";
  return null;
}

// China legacy 工商注册号: 15 digits.
function validateChinaIcr(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{15}$/.test(digits))
    return "中国工商注册号 must be 15 digits";
  return null;
}

function validateHkBr(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{8}(\d{3})?$/.test(digits))
    return "Hong Kong BR No. must be 8 digits (or 11 with branch)";
  return null;
}

function validateHkCr(v: string): string | null {
  const s = v.toUpperCase().replace(/[-\s]/g, "");
  if (!/^[0-9A-Z]{6,12}$/.test(s))
    return "Hong Kong CR No. must be 6–12 alphanumeric characters";
  return null;
}

function validateSgUen(v: string): string | null {
  const s = v.toUpperCase();
  if (!/^[0-9A-Z]{9,10}$/.test(s))
    return "Singapore UEN must be 9 or 10 alphanumeric characters";
  return null;
}

function validateGbCh(v: string): string | null {
  const s = v.toUpperCase().replace(/\s/g, "");
  if (!/^[0-9A-Z]{8}$/.test(s))
    return "UK Companies House No. must be 8 alphanumeric characters";
  return null;
}

function validateJpCorp(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{13}$/.test(digits))
    return "Japan 法人番号 must be 13 digits";
  return null;
}

function validateJpReg(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{12}$/.test(digits))
    return "Japan 商業登記番号 must be 12 digits";
  return null;
}

function validateKrBrn(v: string): string | null {
  const digits = v.replace(/-/g, "");
  if (!/^\d{10}$/.test(digits))
    return "Korea BRN must be 10 digits (e.g. 123-45-67890)";
  return null;
}

function validateCaBn(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{9}$/.test(digits)) return "Canada BN must be 9 digits";
  return null;
}

function validateAuAbn(v: string): string | null {
  const digits = v.replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return "Australia ABN must be 11 digits";
  return null;
}

function validateChUid(v: string): string | null {
  const s = v.toUpperCase().replace(/[\s.\-]/g, "");
  if (!/^CHE\d{9}$/.test(s))
    return "Switzerland CHE/UID must be CHE-XXX.XXX.XXX";
  return null;
}

// Generic fallback: 3-40 chars, alphanumeric + common separators.
function validateGenericId(v: string): string | null {
  if (v.length < 3) return "Identifier is too short";
  if (v.length > 40) return "Identifier is too long";
  if (!/^[A-Za-z0-9\-./\s]+$/.test(v))
    return "Use only letters, digits, dashes, slashes, dots, and spaces";
  return null;
}

/**
 * Validate the raw user input for one identifier (country, type, value).
 * `type` is the catalog code from `ID_TYPES_BY_COUNTRY` (e.g. "EIN", "CIK").
 * Returns null on success, or a user-facing error string.
 */
export function validateIdentifierValue(
  countryCode: string,
  typeCode: string,
  v: string,
): string | null {
  if (!v || !v.trim()) return "Identifier value is required";
  const trimmed = v.trim();
  const key = `${countryCode}:${typeCode}`;
  switch (key) {
    case "US:EIN":
      return validateUsEin(trimmed);
    case "US:CIK":
      return validateUsCik(trimmed);
    case "CN:USCC":
      return validateChinaUscc(trimmed);
    case "CN:ICR":
      return validateChinaIcr(trimmed);
    case "HK:BR":
      return validateHkBr(trimmed);
    case "HK:CR":
      return validateHkCr(trimmed);
    case "SG:UEN":
      return validateSgUen(trimmed);
    case "GB:CH":
      return validateGbCh(trimmed);
    case "JP:CORP":
      return validateJpCorp(trimmed);
    case "JP:REG":
      return validateJpReg(trimmed);
    case "KR:BRN":
      return validateKrBrn(trimmed);
    case "CA:BN":
      return validateCaBn(trimmed);
    case "AU:ABN":
      return validateAuAbn(trimmed);
    case "CH:UID":
      return validateChUid(trimmed);
    default:
      return validateGenericId(trimmed);
  }
}

/**
 * Validate a custom (user-defined) ID type label. The label feeds into the
 * on-chain hash, so it must be deterministic and on-chain-friendly: ASCII
 * uppercase letters, digits, underscores, dashes; 1–32 chars.
 */
export function validateCustomIdTypeLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return "Custom type label is required";
  if (trimmed.length > 32) return "Custom type label must be 32 chars or fewer";
  if (!/^[A-Z0-9_\-]+$/.test(trimmed))
    return "Custom type label: uppercase letters, digits, underscore, dash only";
  return null;
}
