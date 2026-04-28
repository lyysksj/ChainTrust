use anchor_lang::prelude::*;

#[error_code]
pub enum ChainTrustError {
    #[msg("Username is empty or exceeds max length")]
    InvalidUsername,
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
    #[msg("Invalid comment relation type")]
    InvalidRelationType,
    #[msg("Invalid issuer kind")]
    InvalidIssuerKind,
    #[msg("Invalid issuer tier")]
    InvalidIssuerTier,
    #[msg("Invalid relationship kind")]
    InvalidRelationshipKind,
    #[msg("Invalid validity window — valid_until must be 0 or greater than valid_from")]
    InvalidValidityWindow,
    #[msg("Project does not belong to the given Entity")]
    ProjectEntityMismatch,
    #[msg("Issuer authority does not match signer")]
    IssuerAuthorityMismatch,
    #[msg("Relationship has already been revoked")]
    AlreadyRevoked,
    #[msg("Entity is already claimed")]
    AlreadyClaimed,
    #[msg("Entity is not claimed yet")]
    NotClaimed,
    #[msg("Caller is not the official representative of this entity")]
    NotOfficial,
    #[msg("Comment does not belong to this entity")]
    CommentEntityMismatch,
    #[msg("Comment count overflow")]
    CommentCountOverflow,
    #[msg("Project count overflow")]
    ProjectCountOverflow,
    #[msg("Relationship count overflow")]
    RelationshipCountOverflow,
    #[msg("Parent comment belongs to a different entity")]
    ParentEntityMismatch,
    #[msg("Reply depth exceeds the maximum allowed nesting")]
    MaxReplyDepthExceeded,
    #[msg("Official response can only target a top-level comment, not a reply")]
    CannotRespondToReply,
    #[msg("Like count underflow / overflow")]
    LikeCountOverflow,
}
