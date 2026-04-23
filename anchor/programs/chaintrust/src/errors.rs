use anchor_lang::prelude::*;

#[error_code]
pub enum ChainTrustError {
    #[msg("Username is empty or exceeds max length")]
    InvalidUsername,
    #[msg("Display name is empty or exceeds max length")]
    InvalidDisplayName,
    #[msg("Metadata URI exceeds max length")]
    InvalidMetadataUri,
    #[msg("Jurisdiction is empty or exceeds max length")]
    InvalidJurisdiction,
    #[msg("Content URI exceeds max length")]
    InvalidContentUri,
    #[msg("Evidence URI exceeds max length")]
    InvalidEvidenceUri,
    #[msg("Official response URI exceeds max length")]
    InvalidOfficialResponseUri,
    #[msg("Invalid relation type")]
    InvalidRelationType,
    #[msg("Score must be 0 or between 1 and 5")]
    InvalidScore,
    #[msg("Invalid wallet role")]
    InvalidWalletRole,
    #[msg("Entry is already claimed")]
    AlreadyClaimed,
    #[msg("Entry is not claimed yet")]
    NotClaimed,
    #[msg("Caller is not the official representative of this entry")]
    NotOfficial,
    #[msg("Comment does not belong to this entry")]
    CommentEntryMismatch,
    #[msg("Comment count overflow")]
    CommentCountOverflow,
}
