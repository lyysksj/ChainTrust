use anchor_lang::prelude::*;

#[constant]
pub const USER_SEED: &[u8] = b"user";
#[constant]
pub const ENTRY_SEED: &[u8] = b"entry";
#[constant]
pub const COMMENT_SEED: &[u8] = b"comment";
#[constant]
pub const WALLET_MAP_SEED: &[u8] = b"wallet_map";
#[constant]
pub const LIKE_SEED: &[u8] = b"like";

pub const MAX_USERNAME_LEN: usize = 32;
pub const MAX_DISPLAY_NAME_LEN: usize = 64;
pub const MAX_METADATA_URI_LEN: usize = 200;
pub const MAX_JURISDICTION_LEN: usize = 64;
pub const MAX_CONTENT_URI_LEN: usize = 200;
pub const MAX_EVIDENCE_URI_LEN: usize = 200;
pub const MAX_OFFICIAL_RESPONSE_URI_LEN: usize = 200;

// Status values
pub const STATUS_UNVERIFIED: u8 = 0;
pub const STATUS_PLATFORM_VERIFIED: u8 = 1;
pub const STATUS_CLAIMED: u8 = 2;

// Relation types: 1=employee, 2=partner, 3=investor, 4=customer, 5=other
pub const MAX_RELATION_TYPE: u8 = 5;

// Wallet roles: 1=treasury, 2=deployer, 3=team, 4=other
pub const MAX_WALLET_ROLE: u8 = 4;

// Comment nesting: top-level=0, reply=1, reply-to-reply=2. Hard cap at 2.
pub const MAX_REPLY_DEPTH: u8 = 2;
