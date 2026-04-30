use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::ChainTrustError;
use crate::state::*;

// ---------------------------------------------------------------------------
// register_user
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(username: String, metadata_uri: String)]
pub struct RegisterUser<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [USER_SEED, signer.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    /// Proof-of-personhood gate. Must be created by the registry admin via
    /// `attest_human_proof` before this user can register, and must be bound
    /// to this exact wallet.
    #[account(
        seeds = [HUMANPROOF_SEED, signer.key().as_ref()],
        bump = human_proof.bump,
        constraint = human_proof.wallet == signer.key() @ ChainTrustError::HumanProofWalletMismatch,
    )]
    pub human_proof: Account<'info, HumanProof>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn register_user(
    ctx: Context<RegisterUser>,
    username: String,
    metadata_uri: String,
) -> Result<()> {
    require!(
        !username.is_empty() && username.len() <= MAX_USERNAME_LEN,
        ChainTrustError::InvalidUsername
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
    profile.metadata_uri = metadata_uri;
    profile.registered_at = Clock::get()?.unix_timestamp;
    profile.bump = ctx.bumps.user_profile;
    Ok(())
}

// ---------------------------------------------------------------------------
// attest_human_proof  (admin-only — anti-sybil gate)
// ---------------------------------------------------------------------------
//
// Issued by the server after it (a) verifies a World ID nullifier upstream and
// (b) verifies a wallet ed25519 signature over the nullifier hash. This binds
// `wallet` and `nullifier_hash` 1:1 on chain, so:
//   - register_user requires HumanProof[wallet] to exist;
//   - attempting to attest another wallet to the same nullifier fails because
//     `init` on NullifierRecord[nullifier_hash] would conflict.

#[derive(Accounts)]
#[instruction(nullifier_hash: [u8; 32])]
pub struct AttestHumanProof<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = registry_config.bump,
        constraint = admin.key() == registry_config.admin_authority
            @ ChainTrustError::UnauthorizedRegistryAdmin,
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    #[account(
        init,
        payer = admin,
        space = 8 + HumanProof::INIT_SPACE,
        seeds = [HUMANPROOF_SEED, wallet.key().as_ref()],
        bump
    )]
    pub human_proof: Account<'info, HumanProof>,
    #[account(
        init,
        payer = admin,
        space = 8 + NullifierRecord::INIT_SPACE,
        seeds = [NULLIFIER_SEED, &nullifier_hash],
        bump
    )]
    pub nullifier_record: Account<'info, NullifierRecord>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: only the pubkey is consumed (as a seed for the HumanProof PDA);
    /// the account itself is never deserialized.
    pub wallet: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn attest_human_proof(
    ctx: Context<AttestHumanProof>,
    nullifier_hash: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let proof = &mut ctx.accounts.human_proof;
    proof.wallet = ctx.accounts.wallet.key();
    proof.nullifier_hash = nullifier_hash;
    proof.verified_at = now;
    proof.attested_by = ctx.accounts.admin.key();
    proof.bump = ctx.bumps.human_proof;

    let nul = &mut ctx.accounts.nullifier_record;
    nul.wallet = ctx.accounts.wallet.key();
    nul.nullifier_hash = nullifier_hash;
    nul.verified_at = now;
    nul.bump = ctx.bumps.nullifier_record;
    Ok(())
}

// ---------------------------------------------------------------------------
// update_user_metadata_uri
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct UpdateUserMetadataUri<'info> {
    #[account(
        mut,
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.wallet == signer.key(),
    )]
    pub user_profile: Account<'info, UserProfile>,
    pub signer: Signer<'info>,
}

pub fn update_user_metadata_uri(
    ctx: Context<UpdateUserMetadataUri>,
    metadata_uri: String,
) -> Result<()> {
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        ChainTrustError::InvalidMetadataUri
    );
    let profile = &mut ctx.accounts.user_profile;
    profile.metadata_uri = metadata_uri;
    Ok(())
}

// ---------------------------------------------------------------------------
// registry_config
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(admin_authority: Pubkey)]
pub struct InitializeRegistryConfig<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + RegistryConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_registry_config(
    ctx: Context<InitializeRegistryConfig>,
    admin_authority: Pubkey,
) -> Result<()> {
    // Bootstrap race fix: only the hardcoded REGISTRY_BOOTSTRAP_ADMIN can
    // perform the singleton init. The first non-bootstrap caller (an attacker)
    // who tries to grab admin rights post-deploy hits this require!.
    require!(
        ctx.accounts.signer.key() == REGISTRY_BOOTSTRAP_ADMIN,
        ChainTrustError::UnauthorizedBootstrapAdmin
    );
    require!(
        ctx.accounts.signer.key() == admin_authority,
        ChainTrustError::UnauthorizedRegistryAdmin
    );

    let config = &mut ctx.accounts.registry_config;
    config.admin_authority = admin_authority;
    config.initialized_at = Clock::get()?.unix_timestamp;
    config.bump = ctx.bumps.registry_config;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateRegistryAdmin<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = registry_config.bump,
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    pub signer: Signer<'info>,
}

pub fn update_registry_admin(
    ctx: Context<UpdateRegistryAdmin>,
    new_admin_authority: Pubkey,
) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.registry_config.admin_authority,
        ChainTrustError::UnauthorizedRegistryAdmin
    );

    ctx.accounts.registry_config.admin_authority = new_admin_authority;
    Ok(())
}

// ---------------------------------------------------------------------------
// register_issuer
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(kind: u8, trust_tier: u8, name_hash: [u8; 32], metadata_uri: String)]
pub struct RegisterIssuer<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + Issuer::INIT_SPACE,
        seeds = [ISSUER_SEED, signer.key().as_ref()],
        bump
    )]
    pub issuer: Account<'info, Issuer>,
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

pub fn register_issuer(
    ctx: Context<RegisterIssuer>,
    kind: u8,
    trust_tier: u8,
    name_hash: [u8; 32],
    metadata_uri: String,
) -> Result<()> {
    require!(
        kind >= ISSUER_KIND_MIN && kind <= ISSUER_KIND_MAX,
        ChainTrustError::InvalidIssuerKind
    );
    require!(
        trust_tier >= ISSUER_TIER_MIN && trust_tier <= ISSUER_TIER_MAX,
        ChainTrustError::InvalidIssuerTier
    );
    require!(
        trust_tier == ISSUER_TIER_DEFAULT,
        ChainTrustError::SelfRegistrationRequiresTierThree
    );
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        ChainTrustError::InvalidMetadataUri
    );

    let issuer = &mut ctx.accounts.issuer;
    issuer.authority = ctx.accounts.signer.key();
    issuer.kind = kind;
    issuer.trust_tier = trust_tier;
    issuer.name_hash = name_hash;
    issuer.metadata_uri = metadata_uri;
    issuer.registered_at = Clock::get()?.unix_timestamp;
    issuer.bump = ctx.bumps.issuer;
    Ok(())
}

// ---------------------------------------------------------------------------
// request_issuer_tier
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(requested_tier: u8, note_hash: [u8; 32], note_uri: String)]
pub struct RequestIssuerTier<'info> {
    #[account(
        mut,
        seeds = [ISSUER_SEED, signer.key().as_ref()],
        bump = issuer.bump,
        constraint = issuer.authority == signer.key() @ ChainTrustError::IssuerAuthorityMismatch,
    )]
    pub issuer: Account<'info, Issuer>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + IssuerTierRequest::INIT_SPACE,
        seeds = [
            ISSUER_TIER_REQUEST_SEED,
            issuer.key().as_ref(),
            &[requested_tier],
        ],
        bump
    )]
    pub tier_request: Account<'info, IssuerTierRequest>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn request_issuer_tier(
    ctx: Context<RequestIssuerTier>,
    requested_tier: u8,
    note_hash: [u8; 32],
    note_uri: String,
) -> Result<()> {
    require!(
        requested_tier == ISSUER_TIER_PLATFORM
            || requested_tier == ISSUER_TIER_KNOWN_THIRD_PARTY,
        ChainTrustError::InvalidTierReviewTarget
    );
    require!(
        requested_tier < ctx.accounts.issuer.trust_tier,
        ChainTrustError::InvalidTierReviewTarget
    );
    require!(
        note_uri.len() <= MAX_REVIEW_NOTE_URI_LEN,
        ChainTrustError::InvalidMetadataUri
    );

    let tier_request = &mut ctx.accounts.tier_request;
    // Distinguish a freshly init'd account (requested_at == 0) from an existing
    // pending one. Only block when there is already a real pending request on
    // record. Previously this require! short-circuited every first-time call
    // because the freshly-allocated account's status is 0 == PENDING.
    require!(
        tier_request.requested_at == 0 || tier_request.status != TIER_REQUEST_PENDING,
        ChainTrustError::TierRequestAlreadyPending
    );

    tier_request.issuer = ctx.accounts.issuer.key();
    tier_request.requester = ctx.accounts.signer.key();
    tier_request.requested_tier = requested_tier;
    tier_request.status = TIER_REQUEST_PENDING;
    tier_request.note_hash = note_hash;
    tier_request.note_uri = note_uri;
    tier_request.requested_at = Clock::get()?.unix_timestamp;
    tier_request.resolved_at = 0;
    tier_request.reviewed_by = Pubkey::default();
    tier_request.bump = ctx.bumps.tier_request;
    Ok(())
}

// ---------------------------------------------------------------------------
// review_issuer_tier
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(requested_tier: u8)]
pub struct ReviewIssuerTier<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = registry_config.bump,
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    #[account(mut)]
    pub issuer: Account<'info, Issuer>,
    #[account(
        mut,
        seeds = [
            ISSUER_TIER_REQUEST_SEED,
            issuer.key().as_ref(),
            &[requested_tier],
        ],
        bump = tier_request.bump,
        constraint = tier_request.issuer == issuer.key(),
    )]
    pub tier_request: Account<'info, IssuerTierRequest>,
    pub signer: Signer<'info>,
}

pub fn review_issuer_tier(
    ctx: Context<ReviewIssuerTier>,
    requested_tier: u8,
    approve: bool,
) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.registry_config.admin_authority,
        ChainTrustError::UnauthorizedRegistryAdmin
    );
    require!(
        requested_tier == ISSUER_TIER_PLATFORM
            || requested_tier == ISSUER_TIER_KNOWN_THIRD_PARTY,
        ChainTrustError::InvalidTierReviewTarget
    );

    let tier_request = &mut ctx.accounts.tier_request;
    require!(
        tier_request.status == TIER_REQUEST_PENDING,
        ChainTrustError::TierRequestNotPending
    );

    tier_request.status = if approve {
        TIER_REQUEST_APPROVED
    } else {
        TIER_REQUEST_REJECTED
    };
    tier_request.resolved_at = Clock::get()?.unix_timestamp;
    tier_request.reviewed_by = ctx.accounts.signer.key();

    if approve {
        ctx.accounts.issuer.trust_tier = requested_tier;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// create_entity
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(
    entity_id: [u8; 8],
    legal_name_hash: [u8; 32],
    registry_id_hash: [u8; 32],
    jurisdiction: String,
    metadata_uri: String,
)]
pub struct CreateEntity<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + Entity::INIT_SPACE,
        seeds = [ENTITY_SEED, &entity_id],
        bump
    )]
    pub entity: Account<'info, Entity>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.wallet == signer.key(),
    )]
    pub creator_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_entity(
    ctx: Context<CreateEntity>,
    entity_id: [u8; 8],
    legal_name_hash: [u8; 32],
    registry_id_hash: [u8; 32],
    jurisdiction: String,
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

    let entity = &mut ctx.accounts.entity;
    entity.entity_id = entity_id;
    entity.created_by = ctx.accounts.signer.key();
    entity.legal_name_hash = legal_name_hash;
    entity.registry_id_hash = registry_id_hash;
    entity.jurisdiction = jurisdiction;
    entity.status = STATUS_UNVERIFIED;
    entity.is_claimed = false;
    entity.official_wallet = Pubkey::default();
    entity.metadata_uri = metadata_uri;
    entity.project_count = 0;
    entity.relationship_count = 0;
    entity.comment_count = 0;
    entity.created_at = Clock::get()?.unix_timestamp;
    entity.claimed_at = 0;
    entity.bump = ctx.bumps.entity;
    Ok(())
}

// ---------------------------------------------------------------------------
// create_project
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(
    project_id: [u8; 8],
    name_hash: [u8; 32],
    domain_hash: [u8; 32],
    metadata_uri: String,
)]
pub struct CreateProject<'info> {
    #[account(mut)]
    pub entity: Account<'info, Entity>,
    #[account(
        init,
        payer = signer,
        space = 8 + Project::INIT_SPACE,
        seeds = [PROJECT_SEED, entity.key().as_ref(), &project_id],
        bump
    )]
    pub project: Account<'info, Project>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.wallet == signer.key(),
    )]
    pub creator_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_project(
    ctx: Context<CreateProject>,
    project_id: [u8; 8],
    name_hash: [u8; 32],
    domain_hash: [u8; 32],
    metadata_uri: String,
) -> Result<()> {
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        ChainTrustError::InvalidMetadataUri
    );

    let entity = &mut ctx.accounts.entity;
    entity.project_count = entity
        .project_count
        .checked_add(1)
        .ok_or(ChainTrustError::ProjectCountOverflow)?;

    let project = &mut ctx.accounts.project;
    project.project_id = project_id;
    project.entity = entity.key();
    project.created_by = ctx.accounts.signer.key();
    project.name_hash = name_hash;
    project.domain_hash = domain_hash;
    project.metadata_uri = metadata_uri;
    project.created_at = Clock::get()?.unix_timestamp;
    project.bump = ctx.bumps.project;
    Ok(())
}

// ---------------------------------------------------------------------------
// attest_relationship
// ---------------------------------------------------------------------------
//
// Creates a signed, time-bounded edge from `entity` to `target_ref`.
// The signing wallet must be the authority of the provided Issuer PDA.
// Multiple issuers can attest the same (entity, kind, target_ref) tuple
// independently — the issuer pubkey is part of the PDA seed.

#[derive(Accounts)]
#[instruction(
    kind: u8,
    target_ref: [u8; 32],
    evidence_hash: [u8; 32],
    evidence_uri: String,
    valid_from: i64,
    valid_until: i64,
)]
pub struct AttestRelationship<'info> {
    #[account(mut)]
    pub entity: Account<'info, Entity>,
    #[account(
        seeds = [ISSUER_SEED, signer.key().as_ref()],
        bump = issuer.bump,
        constraint = issuer.authority == signer.key() @ ChainTrustError::IssuerAuthorityMismatch,
    )]
    pub issuer: Account<'info, Issuer>,
    #[account(
        init,
        payer = signer,
        space = 8 + Relationship::INIT_SPACE,
        seeds = [
            REL_SEED,
            entity.key().as_ref(),
            &[kind],
            &target_ref,
            issuer.key().as_ref(),
        ],
        bump
    )]
    pub relationship: Account<'info, Relationship>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn attest_relationship<'info>(
    ctx: Context<'_, '_, '_, 'info, AttestRelationship<'info>>,
    kind: u8,
    target_ref: [u8; 32],
    evidence_hash: [u8; 32],
    evidence_uri: String,
    valid_from: i64,
    valid_until: i64,
) -> Result<()> {
    require!(
        kind >= REL_KIND_MIN && kind <= REL_KIND_MAX,
        ChainTrustError::InvalidRelationshipKind
    );
    require!(
        evidence_uri.len() <= MAX_EVIDENCE_URI_LEN,
        ChainTrustError::InvalidEvidenceUri
    );
    // valid_until == 0 means "no expiry"
    require!(
        valid_until == 0 || valid_until > valid_from,
        ChainTrustError::InvalidValidityWindow
    );

    // Cross-account validation by kind. For relationship kinds whose
    // target_ref is a Pubkey to another on-chain account owned by this
    // program, require the caller to pass that account in remaining_accounts
    // so we can verify it's the right type and (where applicable) that it
    // belongs to the subject entity. This blocks attestations like
    // "Entity A operates Entity B's project" or "Entity A audited by some
    // random PDA".
    let entity_key = ctx.accounts.entity.key();
    match kind {
        REL_OPERATES_PROJECT => {
            let target = ctx
                .remaining_accounts
                .first()
                .ok_or(ChainTrustError::TargetAccountRequired)?;
            require!(
                target.key().to_bytes() == target_ref,
                ChainTrustError::TargetRefAccountMismatch
            );
            let project = Account::<Project>::try_from(target)?;
            require!(
                project.entity == entity_key,
                ChainTrustError::ProjectEntityMismatch
            );
        }
        REL_AUDITED_BY => {
            let target = ctx
                .remaining_accounts
                .first()
                .ok_or(ChainTrustError::TargetAccountRequired)?;
            require!(
                target.key().to_bytes() == target_ref,
                ChainTrustError::TargetRefAccountMismatch
            );
            // Just deserialising as Issuer is enough — Anchor checks owner +
            // discriminator. We don't tie its tier to anything here; the
            // attesting issuer's tier is what's published on the edge.
            let _issuer = Account::<Issuer>::try_from(target)?;
        }
        REL_SUBSIDIARY_OF | REL_PARENT_OF => {
            let target = ctx
                .remaining_accounts
                .first()
                .ok_or(ChainTrustError::TargetAccountRequired)?;
            require!(
                target.key().to_bytes() == target_ref,
                ChainTrustError::TargetRefAccountMismatch
            );
            let _other = Account::<Entity>::try_from(target)?;
        }
        // wallet kinds (DEPLOYS_WALLET, CONTROLS_WALLET) and pure-hash kinds
        // (HAS_DOMAIN, HAS_UBO, HAS_OFFICER) do not refer to a program-owned
        // PDA, so there's nothing extra to check on-chain. The off-chain
        // evidence hash is the binding for those.
        _ => {}
    }

    let entity = &mut ctx.accounts.entity;
    entity.relationship_count = entity
        .relationship_count
        .checked_add(1)
        .ok_or(ChainTrustError::RelationshipCountOverflow)?;

    // If a Tier-1 issuer attests a relationship and the entity is still
    // unverified, promote it to platform_verified. Claimed status is sticky.
    if entity.status == STATUS_UNVERIFIED && ctx.accounts.issuer.trust_tier == ISSUER_TIER_MIN {
        entity.status = STATUS_PLATFORM_VERIFIED;
    }

    let rel = &mut ctx.accounts.relationship;
    rel.entity = entity.key();
    rel.kind = kind;
    rel.target_ref = target_ref;
    rel.issuer = ctx.accounts.issuer.key();
    rel.attestor_authority = ctx.accounts.signer.key();
    rel.evidence_hash = evidence_hash;
    rel.evidence_uri = evidence_uri;
    rel.valid_from = valid_from;
    rel.valid_until = valid_until;
    rel.revoked_at = 0;
    rel.created_at = Clock::get()?.unix_timestamp;
    rel.bump = ctx.bumps.relationship;
    Ok(())
}

// ---------------------------------------------------------------------------
// revoke_relationship
// ---------------------------------------------------------------------------
//
// Sets `revoked_at` on the relationship. The PDA is preserved — nothing is
// closed or deleted — so the revocation itself is part of the public record.

#[derive(Accounts)]
pub struct RevokeRelationship<'info> {
    #[account(
        mut,
        constraint = relationship.issuer == issuer.key(),
    )]
    pub relationship: Account<'info, Relationship>,
    #[account(
        seeds = [ISSUER_SEED, signer.key().as_ref()],
        bump = issuer.bump,
        constraint = issuer.authority == signer.key() @ ChainTrustError::IssuerAuthorityMismatch,
    )]
    pub issuer: Account<'info, Issuer>,
    pub signer: Signer<'info>,
}

pub fn revoke_relationship(ctx: Context<RevokeRelationship>) -> Result<()> {
    let rel = &mut ctx.accounts.relationship;
    require!(rel.revoked_at == 0, ChainTrustError::AlreadyRevoked);
    rel.revoked_at = Clock::get()?.unix_timestamp;
    Ok(())
}

// ---------------------------------------------------------------------------
// claim_entity
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct ClaimEntity<'info> {
    #[account(mut)]
    pub entity: Account<'info, Entity>,
    #[account(
        seeds = [USER_SEED, signer.key().as_ref()],
        bump = claimer_profile.bump,
        constraint = claimer_profile.wallet == signer.key(),
    )]
    pub claimer_profile: Account<'info, UserProfile>,
    /// Proof: a non-revoked Relationship of kind HAS_OFFICER pointing this
    /// signer at this entity, signed by an issuer with tier T1 or T2.
    /// Fix for the first-come-first-claim attack: the chain itself now
    /// witnesses that someone outside the claimer trusted them as an officer.
    #[account(
        constraint = officer_proof.entity == entity.key()
            @ ChainTrustError::OfficerProofEntityMismatch,
        constraint = officer_proof.kind == REL_HAS_OFFICER
            @ ChainTrustError::OfficerProofWrongKind,
        constraint = officer_proof.target_ref == signer.key().to_bytes()
            @ ChainTrustError::OfficerProofTargetMismatch,
        constraint = officer_proof.revoked_at == 0
            @ ChainTrustError::OfficerProofRevoked,
    )]
    pub officer_proof: Account<'info, Relationship>,
    #[account(
        constraint = officer_issuer.key() == officer_proof.issuer
            @ ChainTrustError::OfficerProofIssuerMismatch,
        constraint = officer_issuer.trust_tier <= ISSUER_TIER_KNOWN_THIRD_PARTY
            @ ChainTrustError::OfficerProofTierTooLow,
    )]
    pub officer_issuer: Account<'info, Issuer>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

pub fn claim_entity(ctx: Context<ClaimEntity>) -> Result<()> {
    let entity = &mut ctx.accounts.entity;
    require!(!entity.is_claimed, ChainTrustError::AlreadyClaimed);
    entity.is_claimed = true;
    entity.official_wallet = ctx.accounts.signer.key();
    entity.status = STATUS_CLAIMED;
    entity.claimed_at = Clock::get()?.unix_timestamp;
    Ok(())
}

// ---------------------------------------------------------------------------
// submit_comment (top-level community signal)
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
    pub entity: Account<'info, Entity>,
    #[account(
        init,
        payer = signer,
        space = 8 + CommentRecord::INIT_SPACE,
        seeds = [
            COMMENT_SEED,
            entity.key().as_ref(),
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
        relation_type >= 1 && relation_type <= MAX_COMMENT_RELATION_TYPE,
        ChainTrustError::InvalidRelationType
    );
    require!(
        content_uri.len() <= MAX_CONTENT_URI_LEN,
        ChainTrustError::InvalidContentUri
    );

    let entity = &mut ctx.accounts.entity;
    require!(
        comment_index == entity.comment_count,
        ChainTrustError::CommentEntityMismatch
    );
    entity.comment_count = entity
        .comment_count
        .checked_add(1)
        .ok_or(ChainTrustError::CommentCountOverflow)?;

    let comment = &mut ctx.accounts.comment;
    comment.entity = entity.key();
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
    pub entity: Account<'info, Entity>,
    #[account(
        constraint = parent_comment.entity == entity.key() @ ChainTrustError::ParentEntityMismatch,
    )]
    pub parent_comment: Account<'info, CommentRecord>,
    #[account(
        init,
        payer = signer,
        space = 8 + CommentRecord::INIT_SPACE,
        seeds = [
            COMMENT_SEED,
            entity.key().as_ref(),
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

    let entity = &mut ctx.accounts.entity;
    require!(
        comment_index == entity.comment_count,
        ChainTrustError::CommentEntityMismatch
    );
    entity.comment_count = entity
        .comment_count
        .checked_add(1)
        .ok_or(ChainTrustError::CommentCountOverflow)?;

    let parent_key = parent.key();
    let comment = &mut ctx.accounts.comment;
    comment.entity = entity.key();
    comment.commenter = ctx.accounts.signer.key();
    comment.comment_index = comment_index;
    // Replies inherit relation_type=0 to indicate "not applicable" — they are
    // responses to a comment, not a top-level community signal.
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
// like_comment / unlike_comment
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
// add_official_response
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct AddOfficialResponse<'info> {
    pub entity: Account<'info, Entity>,
    #[account(
        mut,
        constraint = comment.entity == entity.key() @ ChainTrustError::CommentEntityMismatch,
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
    let entity = &ctx.accounts.entity;
    require!(entity.is_claimed, ChainTrustError::NotClaimed);
    require!(
        entity.official_wallet == ctx.accounts.signer.key(),
        ChainTrustError::NotOfficial
    );
    let comment = &ctx.accounts.comment;
    require!(
        comment.parent_comment.is_none(),
        ChainTrustError::CannotRespondToReply
    );
    // One-shot: prevent silent overwrites. The first response is the response
    // of record. To "amend", the official wallet must post a new top-level
    // signal (or reply) — both of which leave a hash trail.
    require!(
        comment.official_response_uri.is_empty(),
        ChainTrustError::OfficialResponseAlreadyExists
    );

    let comment = &mut ctx.accounts.comment;
    // Intentional invariant: we never touch content_hash, content_uri,
    // commenter, relation_type, or submitted_at. "Claim gives voice,
    // not control."
    comment.official_response_uri = official_response_uri;
    comment.official_response_at = Clock::get()?.unix_timestamp;
    Ok(())
}
