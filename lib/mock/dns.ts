// Mock DNS verification. In production this would check a TXT record on the
// domain that contains the wallet pubkey. For the hackathon, any confirm call
// succeeds with an explicit "mock" note.

export type DnsVerifyRequest = {
  domain: string;
  wallet: string;
  challenge: string;
};

export type DnsVerifyResult = {
  ok: boolean;
  method: "mock";
  note: string;
  verifiedAt: number;
};

export function verifyDnsClaim(req: DnsVerifyRequest): DnsVerifyResult {
  return {
    ok: Boolean(req.domain && req.wallet && req.challenge),
    method: "mock",
    note:
      "Mock DNS verification: no real TXT lookup was performed. A production adapter would resolve " +
      `_chaintrust.${req.domain} and match the challenge against wallet ${req.wallet}.`,
    verifiedAt: Math.floor(Date.now() / 1000),
  };
}

export function dnsChallenge(wallet: string): string {
  // Deterministic enough for a demo.
  return `chaintrust-claim:${wallet.slice(0, 12)}`;
}
