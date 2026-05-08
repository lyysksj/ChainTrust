use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub wallet: Pubkey,
    #[max_len(MAX_USERNAME_LEN)]
    pub username: String,
    #[max_len(MAX_METADATA_URI_LEN)]
    pub metadata_uri: String,
    pub registered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RegistryConfig {
    pub admin_authority: Pubkey,
    pub initialized_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Issuer {
    pub authority: Pubkey,
    pub kind: u8,
    pub trust_tier: u8,
    pub name_hash: [u8; 32],
    #[max_len(MAX_METADATA_URI_LEN)]
    pub metadata_uri: String,
    pub registered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct IssuerTierRequest {
    pub issuer: Pubkey,
    pub requester: Pubkey,
    pub requested_tier: u8,
    pub status: u8,
    pub note_hash: [u8; 32],
    #[max_len(MAX_REVIEW_NOTE_URI_LEN)]
    pub note_uri: String,
    pub requested_at: i64,
    pub resolved_at: i64,
    pub reviewed_by: Pubkey,
    pub bump: u8,
}

/// Entity — the on-chain identity anchor for a real-world legal entity.
///
/// `entity_id` is **deterministically derived** from the primary identifier
/// (country | id_type | normalized id_value), not random. This means:
///   - The CT-Number is a 1:1 encoding of `entity_id` (no truncation, no
///     dead bytes), which is itself a stable function of (country, id_type,
///     id_value). The same primary identifier always produces the same CT.
///   - Anchor's `init` constraint on `[ENTITY_SEED, &entity_id]` is what
///     enforces global uniqueness for the primary identifier.
///   - Legal name and other descriptive fields live in IPFS metadata (mutable
///     by `official_wallet` post-claim) so a company rename does NOT change
///     the CT-Number.
///
/// The previous `legal_name_hash` / `registry_id_hash` fields have been
/// removed. They were a privacy theater (legal name was already plaintext on
/// IPFS; registry IDs have a search space small enough to brute-force). The
/// authoritative copies of those values now live in the public IPFS metadata.
#[account]
#[derive(InitSpace)]
pub struct Entity {
    pub entity_id: [u8; 5],
    pub created_by: Pubkey,
    #[max_len(MAX_JURISDICTION_LEN)]
    pub jurisdiction: String,
    pub status: u8,
    pub is_claimed: bool,
    pub official_wallet: Pubkey,
    #[max_len(MAX_METADATA_URI_LEN)]
    pub metadata_uri: String,
    pub project_count: u32,
    pub relationship_count: u32,
    pub comment_count: u32,
    pub identifier_count: u8,
    pub created_at: i64,
    pub claimed_at: i64,
    pub bump: u8,
}

/// IdClaim — global unique reservation for a single (country, id_type,
/// id_value) tuple, pointing back at the Entity that owns it.
///
/// One Entity may have multiple identifiers (e.g. a US company with both
/// EIN and SEC CIK). Each identifier gets its own IdClaim PDA. The PDA seed
/// hashes the normalized inputs so:
///   - Anchor's `init` enforces global uniqueness for that identifier.
///   - Third parties can compute the PDA address from public inputs and
///     resolve `(country, id_type, id_value) → Entity` in O(1).
///
/// The account stores only the entity pointer and a creation timestamp; the
/// human-readable identifiers live in the Entity's IPFS metadata.
#[account]
#[derive(InitSpace)]
pub struct IdClaim {
    pub entity: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Project {
    pub project_id: [u8; 8],
    pub entity: Pubkey,
    pub created_by: Pubkey,
    pub name_hash: [u8; 32],
    pub domain_hash: [u8; 32],
    #[max_len(MAX_METADATA_URI_LEN)]
    pub metadata_uri: String,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Relationship {
    pub entity: Pubkey,
    pub kind: u8,
    pub target_ref: [u8; 32],
    pub issuer: Pubkey,
    pub attestor_authority: Pubkey,
    pub evidence_hash: [u8; 32],
    #[max_len(MAX_EVIDENCE_URI_LEN)]
    pub evidence_uri: String,
    pub valid_from: i64,
    pub valid_until: i64,
    pub revoked_at: i64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CommentRecord {
    pub entity: Pubkey,
    pub commenter: Pubkey,
    pub comment_index: u32,
    pub relation_type: u8,
    pub parent_comment: Option<Pubkey>,
    pub depth: u8,
    pub like_count: u32,
    pub content_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    #[max_len(MAX_CONTENT_URI_LEN)]
    pub content_uri: String,
    #[max_len(MAX_OFFICIAL_RESPONSE_URI_LEN)]
    pub official_response_uri: String,
    pub submitted_at: i64,
    pub official_response_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LikeRecord {
    pub comment: Pubkey,
    pub liker: Pubkey,
    pub liked_at: i64,
    pub bump: u8,
}

/// Anti-sybil gate: existence of this PDA at seed `["humanproof", wallet]`
/// proves that `wallet` has been bound (server-side) to a unique World ID
/// nullifier through the registry admin. `register_user` requires it.
#[account]
#[derive(InitSpace)]
pub struct HumanProof {
    pub wallet: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub verified_at: i64,
    pub attested_by: Pubkey,
    pub bump: u8,
}

/// Companion record indexed by nullifier_hash so the admin can refuse to
/// re-bind the same World ID to a second wallet without a full table scan.
/// Seed: `["nullifier", nullifier_hash]`.
#[account]
#[derive(InitSpace)]
pub struct NullifierRecord {
    pub wallet: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub verified_at: i64,
    pub bump: u8,
}
