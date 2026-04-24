export function validateUsername(v: string): string | null {
  if (!v || !v.trim()) return "Username is required";
  if (v.length > 32) return "Username must be 32 characters or fewer";
  if (!/^[A-Za-z0-9_-]+$/.test(v))
    return "Use only letters, digits, underscores, and dashes";
  return null;
}

export function validateDisplayName(v: string): string | null {
  if (!v || !v.trim()) return "Display name is required";
  if (v.length > 64) return "Display name must be 64 characters or fewer";
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
// EIN / business ID validation by country
// ---------------------------------------------------------------------------

// US EIN: 9 digits, optionally formatted as XX-XXXXXXX
function validateUsEin(v: string): string | null {
  const digits = v.replace(/-/g, "");
  if (!/^\d{9}$/.test(digits))
    return "US EIN must be 9 digits (e.g. 12-3456789)";
  return null;
}

// China Unified Social Credit Code: 18 alphanumeric uppercase (letters + digits)
// Allowed charset excludes I, O, S, V, Z per GB 32100-2015
function validateChinaUscc(v: string): string | null {
  const s = v.toUpperCase();
  if (!/^[0-9A-HJ-NPQR-UWY]{18}$/.test(s))
    return "China Unified Social Credit Code must be 18 chars (digits + uppercase letters, excluding I/O/S/V/Z)";
  return null;
}

// Hong Kong BR: 8 digits (may be shown with leading 0, some formats are 8 + 3)
function validateHkBr(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{8}(\d{3})?$/.test(digits))
    return "Hong Kong BR No. must be 8 digits (or 11 digits with branch)";
  return null;
}

// Singapore UEN: 9 or 10 alphanumeric
function validateSgUen(v: string): string | null {
  const s = v.toUpperCase();
  if (!/^[0-9A-Z]{9,10}$/.test(s))
    return "Singapore UEN must be 9 or 10 alphanumeric characters";
  return null;
}

// UK Company Number: 8 alphanumeric (often 2 letters + 6 digits, or 8 digits)
function validateGbCompanyNo(v: string): string | null {
  const s = v.toUpperCase().replace(/\s/g, "");
  if (!/^[0-9A-Z]{8}$/.test(s))
    return "UK Company Number must be 8 alphanumeric characters";
  return null;
}

// Japan Corporate Number: 13 digits
function validateJpCorpNo(v: string): string | null {
  const digits = v.replace(/[-\s]/g, "");
  if (!/^\d{13}$/.test(digits))
    return "Japan Corporate Number must be 13 digits";
  return null;
}

// Korea Business Registration No.: 10 digits (often XXX-XX-XXXXX)
function validateKrBrn(v: string): string | null {
  const digits = v.replace(/-/g, "");
  if (!/^\d{10}$/.test(digits))
    return "Korea BRN must be 10 digits (e.g. 123-45-67890)";
  return null;
}

// Canada BN: 9 digits
function validateCaBn(v: string): string | null {
  const digits = v.replace(/-/g, "");
  if (!/^\d{9}$/.test(digits)) return "Canada BN must be 9 digits";
  return null;
}

// Australia ABN: 11 digits
function validateAuAbn(v: string): string | null {
  const digits = v.replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return "Australia ABN must be 11 digits";
  return null;
}

// Generic fallback: at least 4 chars, alphanumeric + dashes
function validateGenericId(v: string): string | null {
  if (v.length < 4) return "Company ID is too short";
  if (v.length > 40) return "Company ID is too long";
  if (!/^[A-Za-z0-9\-\/ ]+$/.test(v))
    return "Use only letters, digits, dashes, slashes, and spaces";
  return null;
}

export function validateEin(countryCode: string, v: string): string | null {
  if (!v || !v.trim()) return "Company ID is required";
  const trimmed = v.trim();
  switch (countryCode) {
    case "US":
      return validateUsEin(trimmed);
    case "CN":
      return validateChinaUscc(trimmed);
    case "HK":
      return validateHkBr(trimmed);
    case "SG":
      return validateSgUen(trimmed);
    case "GB":
      return validateGbCompanyNo(trimmed);
    case "JP":
      return validateJpCorpNo(trimmed);
    case "KR":
      return validateKrBrn(trimmed);
    case "CA":
      return validateCaBn(trimmed);
    case "AU":
      return validateAuAbn(trimmed);
    default:
      return validateGenericId(trimmed);
  }
}
