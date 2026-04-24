use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::ChainTrustError;
use crate::state::*;

// ---------------------------------------------------------------------------
// register_user
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(username: String, display_name: String, metadata_uri: String)]
pub struct RegisterUser<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [USER_SEED, signer.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn register_user(
    ctx: Context<RegisterUser>,
    username: String,
    display_name: String,
    metadata_uri: String,
) -> Result<()> {
    require!(
        !username.is_empty() && username.len() <= MAX_USERNAME_LEN,
        ChainTrustError::InvalidUsername
    );
    require!(
        !display_name.is_empty() && display_name.len() <= MAX_DISPLAY_NAME_LEN,
        ChainTrustError::InvalidDisplayName
    );
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        ChainTrustError::InvalidMetadataUri
    );
    require!(
        username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'),
        ChainTrustError::InvalidUsername
    );

    let profile = &mut ctx.accounts.user_profile;
    profile.wallet = ctx.accounts.signer.key();
    profile.username = username;
    profile.display_name = display_name;
    profile.metadata_uri = metadata_uri;
    profile.registered_at = Clock::get()?.unix_timestamp;
    profile.bump = ctx.bumps.user_profile;
    Ok(())
}

// ---------------------------------------------------------------------------
// create_entry
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(
    entry_id: [u8; 8],
    company_name_hash: [u8; 32],
    project_name_hash: [u8; 32],
    ein_hash: [u8; 32],
    jurisdiction: String,
    domain_hash: [u8; 32],
    metadata_uri: String,
)]
pub struct CreateEntry<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + CompanyEntry::INIT_SPACE,
        seeds = [ENTRY_SEED, &entry_id],
        bump
    )]
    pub entry: Account<'info, CompanyEntry>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.wallet == signer.key(),
    )]
    pub creator_profile: Account<'info, UserProfile>,
    /// CHECK: optional. Any wallet key is acceptable as the primary wallet;
    /// pass the System Program id as a sentinel when the user did not specify one.
    pub primary_wallet: UncheckedAccount<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_entry(
    ctx: Context<CreateEntry>,
    entry_id: [u8; 8],
    company_name_hash: [u8; 32],
    project_name_hash: [u8; 32],
    ein_hash: [u8; 32],
    jurisdiction: String,
    domain_hash: [u8; 32],
    metadata_uri: String,
) -> Result<()> {
    require!(
        !jurisdiction.is_empty() && jurisdiction.len() <= MAX_JURISDICTION_LEN,
        ChainTrustError::InvalidJurisdiction
    );
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        ChainTrustError::InvalidMetadataUri
    );

    let primary_wallet_key = ctx.accounts.primary_wallet.key();
    let stored_primary = if primary_wallet_key == ctx.accounts.system_program.key() {
        // Sentinel: user declined to set a primary wallet.
        Pubkey::default()
    } else {
        primary_wallet_key
    };

    let entry = &mut ctx.accounts.entry;
    entry.entry_id = entry_id;
    entry.created_by = ctx.accounts.signer.key();
    entry.company_name_hash = company_name_hash;
    entry.project_name_hash = project_name_hash;
    entry.ein_hash = ein_hash;
    entry.jurisdiction = jurisdiction;
    entry.domain_hash = domain_hash;
    entry.primary_wallet = stored_primary;
    entry.status = STATUS_UNVERIFIED;
    entry.is_claimed = false;
    entry.official_wallet = Pubkey::default();
    entry.metadata_uri = metadata_uri;
    entry.comment_count = 0;
    entry.created_at = Clock::get()?.unix_timestamp;
    entry.claimed_at = 0;
    entry.bump = ctx.bumps.entry;
    Ok(())
}

// ---------------------------------------------------------------------------
// add_wallet_mapping
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(wallet_role: u8, evidence_hash: [u8; 32], evidence_uri: String, is_official: bool)]
pub struct AddWalletMapping<'info> {
    #[account(mut)]
    pub entry: Account<'info, CompanyEntry>,
    #[account(
        init,
        payer = signer,
        space = 8 + WalletMapping::INIT_SPACE,
        seeds = [WALLET_MAP_SEED, target_wallet.key().as_ref(), entry.key().as_ref()],
        bump
    )]
    pub wallet_mapping: Account<'info, WalletMapping>,
    /// CHECK: arbitrary wallet being linked; identity not verified on-chain.
    pub target_wallet: UncheckedAccount<'info>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.wallet == signer.key(),
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn add_wallet_mapping(
    ctx: Context<AddWalletMapping>,
    wallet_role: u8,
    evidence_hash: [u8; 32],
    evidence_uri: String,
    is_official: bool,
) -> Result<()> {
    require!(
        wallet_role >= 1 && wallet_role <= MAX_WALLET_ROLE,
        ChainTrustError::InvalidWalletRole
    );
    require!(
        evidence_uri.len() <= MAX_EVIDENCE_URI_LEN,
        ChainTrustError::InvalidEvidenceUri
    );

    if is_official {
        let entry = &ctx.accounts.entry;
        require!(entry.is_claimed, ChainTrustError::NotClaimed);
        require!(
            entry.official_wallet == ctx.accounts.signer.key(),
            ChainTrustError::NotOfficial
        );
    }

    let mapping = &mut ctx.accounts.wallet_mapping;
    mapping.target_wallet = ctx.accounts.target_wallet.key();
    mapping.entry = ctx.accounts.entry.key();
    mapping.wallet_role = wallet_role;
    mapping.evidence_hash = evidence_hash;
    mapping.evidence_uri = evidence_uri;
    mapping.added_by = ctx.accounts.signer.key();
    mapping.is_official = is_official;
    mapping.added_at = Clock::get()?.unix_timestamp;
    mapping.bump = ctx.bumps.wallet_mapping;
    Ok(())
}

// ---------------------------------------------------------------------------
// submit_comment (top-level review)
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(
    comment_index: u32,
    relation_type: u8,
    content_hash: [u8; 32],
    evidence_hash: [u8; 32],
    content_uri: String,
)]
pub struct SubmitComment<'info> {
    #[account(mut)]
    pub entry: Account<'info, CompanyEntry>,
    #[account(
        init,
        payer = signer,
        space = 8 + CommentRecord::INIT_SPACE,
        seeds = [
            COMMENT_SEED,
            entry.key().as_ref(),
            signer.key().as_ref(),
            &comment_index.to_le_bytes()
        ],
        bump
    )]
    pub comment: Account<'info, CommentRecord>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = commenter_profile.bump,
        constraint = commenter_profile.wallet == signer.key(),
    )]
    pub commenter_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn submit_comment(
    ctx: Context<SubmitComment>,
    comment_index: u32,
    relation_type: u8,
    content_hash: [u8; 32],
    evidence_hash: [u8; 32],
    content_uri: String,
) -> Result<()> {
    require!(
        relation_type >= 1 && relation_type <= MAX_RELATION_TYPE,
        ChainTrustError::InvalidRelationType
    );
    require!(
        content_uri.len() <= MAX_CONTENT_URI_LEN,
        ChainTrustError::InvalidContentUri
    );

    let entry = &mut ctx.accounts.entry;
    require!(
        comment_index == entry.comment_count,
        ChainTrustError::CommentEntryMismatch
    );
    entry.comment_count = entry
        .comment_count
        .checked_add(1)
        .ok_or(ChainTrustError::CommentCountOverflow)?;

    let comment = &mut ctx.accounts.comment;
    comment.entry = entry.key();
    comment.commenter = ctx.accounts.signer.key();
    comment.comment_index = comment_index;
    comment.relation_type = relation_type;
    comment.parent_comment = None;
    comment.depth = 0;
    comment.like_count = 0;
    comment.content_hash = content_hash;
    comment.evidence_hash = evidence_hash;
    comment.content_uri = content_uri;
    comment.official_response_uri = String::new();
    comment.submitted_at = Clock::get()?.unix_timestamp;
    comment.official_response_at = 0;
    comment.bump = ctx.bumps.comment;
    Ok(())
}

// ---------------------------------------------------------------------------
// submit_reply (nested reply)
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(
    comment_index: u32,
    content_hash: [u8; 32],
    evidence_hash: [u8; 32],
    content_uri: String,
)]
pub struct SubmitReply<'info> {
    #[account(mut)]
    pub entry: Account<'info, CompanyEntry>,
    #[account(
        constraint = parent_comment.entry == entry.key() @ ChainTrustError::ParentEntryMismatch,
    )]
    pub parent_comment: Account<'info, CommentRecord>,
    #[account(
        init,
        payer = signer,
        space = 8 + CommentRecord::INIT_SPACE,
        seeds = [
            COMMENT_SEED,
            entry.key().as_ref(),
            signer.key().as_ref(),
            &comment_index.to_le_bytes()
        ],
        bump
    )]
    pub comment: Account<'info, CommentRecord>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = commenter_profile.bump,
        constraint = commenter_profile.wallet == signer.key(),
    )]
    pub commenter_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn submit_reply(
    ctx: Context<SubmitReply>,
    comment_index: u32,
    content_hash: [u8; 32],
    evidence_hash: [u8; 32],
    content_uri: String,
) -> Result<()> {
    require!(
        content_uri.len() <= MAX_CONTENT_URI_LEN,
        ChainTrustError::InvalidContentUri
    );

    let parent = &ctx.accounts.parent_comment;
    let new_depth = parent
        .depth
        .checked_add(1)
        .ok_or(ChainTrustError::MaxReplyDepthExceeded)?;
    require!(
        new_depth <= MAX_REPLY_DEPTH,
        ChainTrustError::MaxReplyDepthExceeded
    );

    let entry = &mut ctx.accounts.entry;
    require!(
        comment_index == entry.comment_count,
        ChainTrustError::CommentEntryMismatch
    );
    entry.comment_count = entry
        .comment_count
        .checked_add(1)
        .ok_or(ChainTrustError::CommentCountOverflow)?;

    let parent_key = parent.key();
    let comment = &mut ctx.accounts.comment;
    comment.entry = entry.key();
    comment.commenter = ctx.accounts.signer.key();
    comment.comment_index = comment_index;
    // Replies inherit relation_type=0 to indicate "not applicable" — they are
    // responses to a review, not a review themselves.
    comment.relation_type = 0;
    comment.parent_comment = Some(parent_key);
    comment.depth = new_depth;
    comment.like_count = 0;
    comment.content_hash = content_hash;
    comment.evidence_hash = evidence_hash;
    comment.content_uri = content_uri;
    comment.official_response_uri = String::new();
    comment.submitted_at = Clock::get()?.unix_timestamp;
    comment.official_response_at = 0;
    comment.bump = ctx.bumps.comment;
    Ok(())
}

// ---------------------------------------------------------------------------
// like_comment
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct LikeComment<'info> {
    #[account(mut)]
    pub comment: Account<'info, CommentRecord>,
    #[account(
        init,
        payer = signer,
        space = 8 + LikeRecord::INIT_SPACE,
        seeds = [LIKE_SEED, comment.key().as_ref(), signer.key().as_ref()],
        bump
    )]
    pub like_record: Account<'info, LikeRecord>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = liker_profile.bump,
        constraint = liker_profile.wallet == signer.key(),
    )]
    pub liker_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn like_comment(ctx: Context<LikeComment>) -> Result<()> {
    let comment = &mut ctx.accounts.comment;
    comment.like_count = comment
        .like_count
        .checked_add(1)
        .ok_or(ChainTrustError::LikeCountOverflow)?;

    let like = &mut ctx.accounts.like_record;
    like.comment = comment.key();
    like.liker = ctx.accounts.signer.key();
    like.liked_at = Clock::get()?.unix_timestamp;
    like.bump = ctx.bumps.like_record;
    Ok(())
}

// ---------------------------------------------------------------------------
// unlike_comment
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct UnlikeComment<'info> {
    #[account(mut)]
    pub comment: Account<'info, CommentRecord>,
    #[account(
        mut,
        close = signer,
        seeds = [LIKE_SEED, comment.key().as_ref(), signer.key().as_ref()],
        bump = like_record.bump,
        constraint = like_record.liker == signer.key(),
        constraint = like_record.comment == comment.key(),
    )]
    pub like_record: Account<'info, LikeRecord>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn unlike_comment(ctx: Context<UnlikeComment>) -> Result<()> {
    let comment = &mut ctx.accounts.comment;
    comment.like_count = comment
        .like_count
        .checked_sub(1)
        .ok_or(ChainTrustError::LikeCountOverflow)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// claim_entry
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct ClaimEntry<'info> {
    #[account(mut)]
    pub entry: Account<'info, CompanyEntry>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = claimer_profile.bump,
        constraint = claimer_profile.wallet == signer.key(),
    )]
    pub claimer_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn claim_entry(ctx: Context<ClaimEntry>) -> Result<()> {
    let entry = &mut ctx.accounts.entry;
    require!(!entry.is_claimed, ChainTrustError::AlreadyClaimed);
    entry.is_claimed = true;
    entry.official_wallet = ctx.accounts.signer.key();
    entry.status = STATUS_CLAIMED;
    entry.claimed_at = Clock::get()?.unix_timestamp;
    Ok(())
}

// ---------------------------------------------------------------------------
// add_official_response
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct AddOfficialResponse<'info> {
    pub entry: Account<'info, CompanyEntry>,
    #[account(
        mut,
        constraint = comment.entry == entry.key() @ ChainTrustError::CommentEntryMismatch,
    )]
    pub comment: Account<'info, CommentRecord>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn add_official_response(
    ctx: Context<AddOfficialResponse>,
    official_response_uri: String,
) -> Result<()> {
    require!(
        official_response_uri.len() <= MAX_OFFICIAL_RESPONSE_URI_LEN,
        ChainTrustError::InvalidOfficialResponseUri
    );
    let entry = &ctx.accounts.entry;
    require!(entry.is_claimed, ChainTrustError::NotClaimed);
    require!(
        entry.official_wallet == ctx.accounts.signer.key(),
        ChainTrustError::NotOfficial
    );
    let comment = &ctx.accounts.comment;
    require!(
        comment.parent_comment.is_none(),
        ChainTrustError::CannotRespondToReply
    );

    let comment = &mut ctx.accounts.comment;
    // Intentional invariant: we never touch content_hash, content_uri,
    // commenter, relation_type, or submitted_at. "Claim gives voice,
    // not control."
    comment.official_response_uri = official_response_uri;
    comment.official_response_at = Clock::get()?.unix_timestamp;
    Ok(())
}
