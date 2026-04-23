// Mock platform verification. Always marks demo inputs as platform_verified.

export type PlatformVerifyRequest = {
  entryPda: string;
  companyName: string;
  domain: string;
};

export type PlatformVerifyResult = {
  verified: boolean;
  issuer: "chaintrust-platform";
  issuedAt: number;
  note: string;
};

export function platformVerify(req: PlatformVerifyRequest): PlatformVerifyResult {
  return {
    verified: Boolean(req.companyName && req.domain),
    issuer: "chaintrust-platform",
    issuedAt: Math.floor(Date.now() / 1000),
    note:
      "Mock platform verification. A production adapter would check business-registry records, " +
      "domain ownership, and social proof before issuing the attestation.",
  };
}
