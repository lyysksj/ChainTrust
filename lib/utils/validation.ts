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

export function validatePubkey(v: string): string | null {
  if (!v) return "Public key is required";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))
    return "Enter a valid Solana address";
  return null;
}
