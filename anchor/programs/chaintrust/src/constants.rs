use anchor_lang::prelude::*;

#[constant]
pub const USER_SEED: &[u8] = b"user";
#[constant]
pub const ISSUER_SEED: &[u8] = b"issuer";
#[constant]
pub const ENTITY_SEED: &[u8] = b"entity";
#[constant]
pub const PROJECT_SEED: &[u8] = b"project";
#[constant]
pub const REL_SEED: &[u8] = b"rel";
#[constant]
pub const COMMENT_SEED: &[u8] = b"comment";
#[constant]
pub const LIKE_SEED: &[u8] = b"like";

pub const MAX_USERNAME_LEN: usize = 32;
pub const MAX_METADATA_URI_LEN: usize = 200;
pub const MAX_JURISDICTION_LEN: usize = 64;
pub const MAX_CONTENT_URI_LEN: usize = 200;
pub const MAX_EVIDENCE_URI_LEN: usize = 200;
pub const MAX_OFFICIAL_RESPONSE_URI_LEN: usize = 200;

// Entity status
pub const STATUS_UNVERIFIED: u8 = 0;
pub const STATUS_PLATFORM_VERIFIED: u8 = 1;
pub const STATUS_CLAIMED: u8 = 2;

// Issuer kinds
// 1=kyb_provider, 2=audit, 3=chain_analytics, 4=regulator, 5=self, 6=community
pub const ISSUER_KIND_MIN: u8 = 1;
pub const ISSUER_KIND_MAX: u8 = 6;

// Issuer trust tiers (1=highest, 3=community)
pub const ISSUER_TIER_MIN: u8 = 1;
pub const ISSUER_TIER_MAX: u8 = 3;
pub const ISSUER_TIER_DEFAULT: u8 = 3;

// Relationship kinds — verb encodes both target type and verb.
// Target ref interpretation depends on kind (see TARGET_KIND_* below).
pub const REL_OPERATES_PROJECT: u8 = 1; // target = Project PDA
pub const REL_DEPLOYS_WALLET: u8 = 2; // target = wallet pubkey
pub const REL_CONTROLS_WALLET: u8 = 3; // target = wallet pubkey
pub const REL_HAS_DOMAIN: u8 = 4; // target = domain hash
pub const REL_SUBSIDIARY_OF: u8 = 5; // target = parent Entity PDA
pub const REL_PARENT_OF: u8 = 6; // target = child Entity PDA
pub const REL_HAS_UBO: u8 = 7; // target = person hash
pub const REL_HAS_OFFICER: u8 = 8; // target = person hash
pub const REL_AUDITED_BY: u8 = 9; // target = Issuer PDA
pub const REL_KIND_MIN: u8 = 1;
pub const REL_KIND_MAX: u8 = 9;

// Comment relation types — community-signal categories.
// 0 reserved for replies (relation_type not applicable).
// 1=dispute, 2=addendum, 3=praise, 4=incident, 5=other
pub const MAX_COMMENT_RELATION_TYPE: u8 = 5;

// Comment nesting: top-level=0, reply=1, reply-to-reply=2. Hard cap at 2.
pub const MAX_REPLY_DEPTH: u8 = 2;
