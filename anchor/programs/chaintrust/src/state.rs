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
pub struct Entity {
    pub entity_id: [u8; 8],
    pub created_by: Pubkey,
    pub legal_name_hash: [u8; 32],
    pub registry_id_hash: [u8; 32],
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
    pub created_at: i64,
    pub claimed_at: i64,
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
