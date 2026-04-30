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
    #[msg("Self-registration is restricted to Tier 3")]
    SelfRegistrationRequiresTierThree,
    #[msg("Only Tier 1 or Tier 2 can be requested through review")]
    InvalidTierReviewTarget,
    #[msg("The connected wallet is not the registry admin")]
    UnauthorizedRegistryAdmin,
    #[msg("A pending tier request already exists for this issuer and target tier")]
    TierRequestAlreadyPending,
    #[msg("Tier request is no longer pending")]
    TierRequestNotPending,
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
    #[msg("Bootstrap admin pubkey does not match the hardcoded constant")]
    UnauthorizedBootstrapAdmin,
    #[msg("Officer proof entity does not match the entity being claimed")]
    OfficerProofEntityMismatch,
    #[msg("Officer proof must be of kind HAS_OFFICER")]
    OfficerProofWrongKind,
    #[msg("Officer proof target does not match the claimer wallet")]
    OfficerProofTargetMismatch,
    #[msg("Officer proof has been revoked")]
    OfficerProofRevoked,
    #[msg("Officer proof issuer account does not match issuer recorded on the proof")]
    OfficerProofIssuerMismatch,
    #[msg("Officer proof issuer tier is below the required claim threshold (T1/T2 only)")]
    OfficerProofTierTooLow,
    #[msg("This relationship kind requires a target account to be passed in remaining_accounts")]
    TargetAccountRequired,
    #[msg("Target account pubkey does not match target_ref")]
    TargetRefAccountMismatch,
    #[msg("Official response has already been published for this comment")]
    OfficialResponseAlreadyExists,
    #[msg("HumanProof PDA missing — wallet has not passed the proof-of-personhood gate")]
    HumanProofMissing,
    #[msg("HumanProof wallet field does not match signer")]
    HumanProofWalletMismatch,
}
