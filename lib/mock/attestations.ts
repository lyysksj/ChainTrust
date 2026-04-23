import type { Attestation } from "@/types";

// Mock issuers for the demo. The point is to prove the aggregator model —
// multiple issuers, different roles, different trust weights.

export function platformAttestation(entryPda: string): Attestation {
  return {
    id: `platform-${entryPda.slice(0, 8)}`,
    issuer: "ChainTrust",
    issuerRole: "platform",
    type: "Platform Verification",
    status: "Verified",
    issuedAt: Math.floor(Date.now() / 1000),
    note: "Platform has checked identity artifacts. Mock issuer — not a legal attestation.",
  };
}

export function thirdPartyAttestation(entryPda: string): Attestation {
  return {
    id: `thirdparty-${entryPda.slice(0, 8)}`,
    issuer: "Example Audit Co.",
    issuerRole: "third-party",
    type: "Smart-Contract Audit (sample)",
    status: "Sample / Mock",
    issuedAt: Math.floor(Date.now() / 1000) - 86400 * 14,
    note:
      "Illustrative third-party attestation. In production, issuers publish on-chain attestations " +
      "referencing this entry PDA.",
  };
}

export function allAttestations(entryPda: string): Attestation[] {
  return [platformAttestation(entryPda), thirdPartyAttestation(entryPda)];
}
