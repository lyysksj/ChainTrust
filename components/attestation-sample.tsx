"use client";

import { Stamp } from "@/components/registry-bits";

export function AttestationSample() {
  return (
    <div className="att-sample" aria-hidden="true">
      <div className="att-sample-head">
        <span>CT-XXXX-XXXX</span>
        <span>T1 · OFFICIAL ATTESTATION</span>
      </div>

      <h3 className="att-sample-name">
        ABC Corporation, Inc.
      </h3>
      <div className="att-sample-meta">
        Jurisdiction XX · INC YYYY-MM-DD
      </div>
      <div className="att-sample-mono">Entity PDA: aBcD...678Z</div>

      <div className="att-sample-status">
        <span className="status status-claimed">◆ Claimed · Verified</span>
      </div>

      <div className="att-sample-block">
        <div className="att-sample-edge">
          <span>[Entity Node] ── controls ──&gt; [Wallet Node]</span>
        </div>
        <div className="att-sample-mono dim">
          effective YYYY-MM-DD · no expiry
        </div>
        <div className="att-sample-mono dim">
          Evidence Ref: ipfs://xxxxx
        </div>
      </div>

      <div className="att-sample-block">
        <div className="att-sample-cap">Issued by</div>
        <div className="att-sample-issuer">
          T1 · NATIONAL REGISTRY OF EXAMPLE
        </div>
        <div className="att-sample-mono">authority · XXXX…XXXX</div>
      </div>

      <div className="att-sample-foot">
        tx XXXX…XXXX · slot XXX,XXX,XXX · YYYY-MM-DD
      </div>

      <div className="att-sample-stamp">
        <Stamp text="Verified · T1" sub="CHAINTRUST" />
      </div>
    </div>
  );
}
