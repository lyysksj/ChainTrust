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
    #[msg("Parent comment belongs to a different entry")]
    ParentEntryMismatch,
    #[msg("Reply depth exceeds the maximum allowed nesting")]
    MaxReplyDepthExceeded,
    #[msg("Official response can only target a top-level review, not a reply")]
    CannotRespondToReply,
    #[msg("Like count underflow / overflow")]
    LikeCountOverflow,
}
