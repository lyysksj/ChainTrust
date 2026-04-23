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
        display_name: String,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::register_user(ctx, username, display_name, metadata_uri)
    }

    pub fn create_entry(
        ctx: Context<CreateEntry>,
        entry_id: [u8; 8],
        company_name_hash: [u8; 32],
        project_name_hash: [u8; 32],
        jurisdiction: String,
        domain_hash: [u8; 32],
        metadata_uri: String,
    ) -> Result<()> {
        instructions::create_entry(
            ctx,
            entry_id,
            company_name_hash,
            project_name_hash,
            jurisdiction,
            domain_hash,
            metadata_uri,
        )
    }

    pub fn add_wallet_mapping(
        ctx: Context<AddWalletMapping>,
        wallet_role: u8,
        evidence_hash: [u8; 32],
        evidence_uri: String,
        is_official: bool,
    ) -> Result<()> {
        instructions::add_wallet_mapping(ctx, wallet_role, evidence_hash, evidence_uri, is_official)
    }

    pub fn submit_comment(
        ctx: Context<SubmitComment>,
        comment_index: u32,
        relation_type: u8,
        contract_score: u8,
        team_score: u8,
        product_score: u8,
        content_hash: [u8; 32],
        evidence_hash: [u8; 32],
        content_uri: String,
    ) -> Result<()> {
        instructions::submit_comment(
            ctx,
            comment_index,
            relation_type,
            contract_score,
            team_score,
            product_score,
            content_hash,
            evidence_hash,
            content_uri,
        )
    }

    pub fn claim_entry(ctx: Context<ClaimEntry>) -> Result<()> {
        instructions::claim_entry(ctx)
    }

    pub fn add_official_response(
        ctx: Context<AddOfficialResponse>,
        official_response_uri: String,
    ) -> Result<()> {
        instructions::add_official_response(ctx, official_response_uri)
    }
}
