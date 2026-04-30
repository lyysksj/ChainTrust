use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt");

#[program]
pub mod chaintrust {
    use super::*;

    pub fn register_user(
        ctx: Context<RegisterUser>,
        username: String,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::register_user(ctx, username, metadata_uri)
    }

    pub fn attest_human_proof(
        ctx: Context<AttestHumanProof>,
        nullifier_hash: [u8; 32],
    ) -> Result<()> {
        instructions::attest_human_proof(ctx, nullifier_hash)
    }

    pub fn update_user_metadata_uri(
        ctx: Context<UpdateUserMetadataUri>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::update_user_metadata_uri(ctx, metadata_uri)
    }

    pub fn initialize_registry_config(
        ctx: Context<InitializeRegistryConfig>,
        admin_authority: Pubkey,
    ) -> Result<()> {
        instructions::initialize_registry_config(ctx, admin_authority)
    }

    pub fn update_registry_admin(
        ctx: Context<UpdateRegistryAdmin>,
        new_admin_authority: Pubkey,
    ) -> Result<()> {
        instructions::update_registry_admin(ctx, new_admin_authority)
    }

    pub fn register_issuer(
        ctx: Context<RegisterIssuer>,
        kind: u8,
        trust_tier: u8,
        name_hash: [u8; 32],
        metadata_uri: String,
    ) -> Result<()> {
        instructions::register_issuer(ctx, kind, trust_tier, name_hash, metadata_uri)
    }

    pub fn request_issuer_tier(
        ctx: Context<RequestIssuerTier>,
        requested_tier: u8,
        note_hash: [u8; 32],
        note_uri: String,
    ) -> Result<()> {
        instructions::request_issuer_tier(ctx, requested_tier, note_hash, note_uri)
    }

    pub fn review_issuer_tier(
        ctx: Context<ReviewIssuerTier>,
        requested_tier: u8,
        approve: bool,
    ) -> Result<()> {
        instructions::review_issuer_tier(ctx, requested_tier, approve)
    }

    pub fn create_entity(
        ctx: Context<CreateEntity>,
        entity_id: [u8; 8],
        legal_name_hash: [u8; 32],
        registry_id_hash: [u8; 32],
        jurisdiction: String,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::create_entity(
            ctx,
            entity_id,
            legal_name_hash,
            registry_id_hash,
            jurisdiction,
            metadata_uri,
        )
    }

    pub fn create_project(
        ctx: Context<CreateProject>,
        project_id: [u8; 8],
        name_hash: [u8; 32],
        domain_hash: [u8; 32],
        metadata_uri: String,
    ) -> Result<()> {
        instructions::create_project(ctx, project_id, name_hash, domain_hash, metadata_uri)
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
        instructions::attest_relationship(
            ctx,
            kind,
            target_ref,
            evidence_hash,
            evidence_uri,
            valid_from,
            valid_until,
        )
    }

    pub fn revoke_relationship(ctx: Context<RevokeRelationship>) -> Result<()> {
        instructions::revoke_relationship(ctx)
    }

    pub fn claim_entity(ctx: Context<ClaimEntity>) -> Result<()> {
        instructions::claim_entity(ctx)
    }

    pub fn submit_comment(
        ctx: Context<SubmitComment>,
        comment_index: u32,
        relation_type: u8,
        content_hash: [u8; 32],
        evidence_hash: [u8; 32],
        content_uri: String,
    ) -> Result<()> {
        instructions::submit_comment(
            ctx,
            comment_index,
            relation_type,
            content_hash,
            evidence_hash,
            content_uri,
        )
    }

    pub fn submit_reply(
        ctx: Context<SubmitReply>,
        comment_index: u32,
        content_hash: [u8; 32],
        evidence_hash: [u8; 32],
        content_uri: String,
    ) -> Result<()> {
        instructions::submit_reply(
            ctx,
            comment_index,
            content_hash,
            evidence_hash,
            content_uri,
        )
    }

    pub fn like_comment(ctx: Context<LikeComment>) -> Result<()> {
        instructions::like_comment(ctx)
    }

    pub fn unlike_comment(ctx: Context<UnlikeComment>) -> Result<()> {
        instructions::unlike_comment(ctx)
    }

    pub fn add_official_response(
        ctx: Context<AddOfficialResponse>,
        official_response_uri: String,
    ) -> Result<()> {
        instructions::add_official_response(ctx, official_response_uri)
    }
}
