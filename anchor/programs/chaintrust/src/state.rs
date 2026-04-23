use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub wallet: Pubkey,
    #[max_len(MAX_USERNAME_LEN)]
    pub username: String,
    #[max_len(MAX_DISPLAY_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_METADATA_URI_LEN)]
    pub metadata_uri: String,
    pub registered_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CompanyEntry {
    pub entry_id: [u8; 8],
    pub created_by: Pubkey,
    pub company_name_hash: [u8; 32],
    pub project_name_hash: [u8; 32],
    #[max_len(MAX_JURISDICTION_LEN)]
    pub jurisdiction: String,
    pub domain_hash: [u8; 32],
    pub primary_wallet: Pubkey,
    pub status: u8,
    pub is_claimed: bool,
    pub official_wallet: Pubkey,
    #[max_len(MAX_METADATA_URI_LEN)]
    pub metadata_uri: String,
    pub comment_count: u32,
    pub created_at: i64,
    pub claimed_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CommentRecord {
    pub entry: Pubkey,
    pub commenter: Pubkey,
    pub comment_index: u32,
    pub relation_type: u8,
    pub contract_score: u8,
    pub team_score: u8,
    pub product_score: u8,
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
pub struct WalletMapping {
    pub target_wallet: Pubkey,
    pub entry: Pubkey,
    pub wallet_role: u8,
    pub evidence_hash: [u8; 32],
    #[max_len(MAX_EVIDENCE_URI_LEN)]
    pub evidence_uri: String,
    pub added_by: Pubkey,
    pub is_official: bool,
    pub added_at: i64,
    pub bump: u8,
}
