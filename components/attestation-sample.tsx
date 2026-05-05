"use client";

const BAR_HEIGHTS = [
  "100%",
  "60%",
  "90%",
  "40%",
  "80%",
  "55%",
  "95%",
  "70%",
  "45%",
  "85%",
  "60%",
];

export function AttestationSample() {
  return (
    <div className="receipt" role="img" aria-label="Sample attestation receipt">
      <div className="r-seal">
        Verified
        <div className="r-seal-date">T1 · 2025</div>
      </div>

      <div className="r-top">
        <span className="r-ct">CT-9X4F-7QM2</span>
        <span>PDA · 7vA2…kRp9</span>
      </div>

      <h3 className="r-title">Attestation</h3>
      <div className="r-subtitle">Entity → Wallet · Control</div>

      <div className="r-entity">
        <div className="r-entity-name">ABC Corporation, Inc.</div>
        <div className="r-entity-meta">
          <span>Delaware, US</span>
          <span className="sep">·</span>
          <span>INC 2024-06-11</span>
          <span className="sep">·</span>
          <span>Reg # 8392041</span>
        </div>
      </div>

      <div className="r-statement">
        <span className="r-verb">Subject controls →</span>
        <span className="r-object">
          Wallet <b>4Hn8GqLpZx…m3WjN</b>
        </span>
      </div>

      <div className="r-rows">
        <div className="r-row">
          <span className="k">Effective</span>
          <span className="leader" />
          <span className="v mono-num">2024-08-22</span>
        </div>
        <div className="r-row">
          <span className="k">Expires</span>
          <span className="leader" />
          <span className="v">No expiry</span>
        </div>
        <div className="r-row">
          <span className="k">Evidence</span>
          <span className="leader" />
          <span className="v mono-num">ipfs://Qm…b4e1</span>
        </div>
      </div>

      <div className="r-sig">
        <div className="k">Issued by</div>
        <div className="issuer">
          <span className="tier-tag">T1</span>
          <span className="iss-name">ChainTrust Platform</span>
        </div>
        <div className="iss-sub">signer · NREx…9fK2</div>
      </div>

      <div className="r-foot">
        <span>TX 5Bm7…XQ04</span>
        <div className="r-bars" aria-hidden="true">
          {BAR_HEIGHTS.map((h, i) => (
            <i key={i} style={{ height: h }} />
          ))}
        </div>
      </div>
    </div>
  );
}
