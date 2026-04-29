"use client";

import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import type { Wallet } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  type Commitment,
} from "@solana/web3.js";
import idlJson from "./idl/chaintrust.json";
import type { Chaintrust } from "./idl/chaintrust";
import {
  PROGRAM_ID,
  commentPda,
  entityPda,
  issuerPda,
  likeRecordPda,
  projectPda,
  relationshipPda,
  userProfilePda,
} from "./pdas";
import {
  sasCredentialAuthority,
  sasDualWriteEnabled,
} from "@/lib/sas/config";
import {
  sasAttestationPda,
  sasCredentialPda,
  sasSchemaPda,
} from "@/lib/sas/pdas";
import {
  buildCloseAttestationIx,
  buildCreateAttestationIx,
  encodeChainTrustAttestationData,
} from "@/lib/sas/instructions";

const COMMITMENT: Commitment = "confirmed";

export function buildProvider(
  connection: Connection,
  wallet: AnchorWallet,
): AnchorProvider {
  return new AnchorProvider(connection, wallet as unknown as Wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  });
}

export function buildProgram(provider: AnchorProvider): Program<Chaintrust> {
  return new Program(idlJson as Chaintrust, provider);
}

// ---- read helpers ----

export async function fetchUserProfile(
  program: Program<Chaintrust>,
  wallet: PublicKey,
) {
  const [pda] = userProfilePda(wallet);
  return program.account.userProfile.fetchNullable(pda);
}

export async function fetchIssuer(
  program: Program<Chaintrust>,
  authority: PublicKey,
) {
  const [pda] = issuerPda(authority);
  return program.account.issuer.fetchNullable(pda);
}

export async function fetchAllIssuers(program: Program<Chaintrust>) {
  return program.account.issuer.all();
}

export async function fetchEntity(
  program: Program<Chaintrust>,
  entityId: number[] | Uint8Array,
) {
  const [pda] = entityPda(entityId);
  const acc = await program.account.entity.fetchNullable(pda);
  return acc ? { pda, account: acc } : null;
}

export async function fetchEntityByPda(
  program: Program<Chaintrust>,
  pda: PublicKey,
) {
  return program.account.entity.fetchNullable(pda);
}

export async function fetchAllEntities(program: Program<Chaintrust>) {
  return program.account.entity.all();
}

export async function fetchEntitiesCreatedBy(
  program: Program<Chaintrust>,
  wallet: PublicKey,
) {
  // created_by is after 8-byte discriminator + 8-byte entity_id
  return program.account.entity.all([
    { memcmp: { offset: 8 + 8, bytes: wallet.toBase58() } },
  ]);
}

export async function fetchEntitiesByOfficialWallet(
  program: Program<Chaintrust>,
  wallet: PublicKey,
) {
  // official_wallet sits after a variable-length jurisdiction string, so we
  // fall back to client-side filtering.
  const all = await program.account.entity.all();
  const target = wallet.toBase58();
  return all.filter(
    (e) => e.account.officialWallet.toBase58() === target && e.account.isClaimed,
  );
}

export async function fetchProjectsForEntity(
  program: Program<Chaintrust>,
  entity: PublicKey,
) {
  // entity is after 8-byte discriminator + 8-byte project_id
  return program.account.project.all([
    { memcmp: { offset: 8 + 8, bytes: entity.toBase58() } },
  ]);
}

export async function fetchAllProjects(program: Program<Chaintrust>) {
  return program.account.project.all();
}

export async function fetchRelationshipsForEntity(
  program: Program<Chaintrust>,
  entity: PublicKey,
) {
  return program.account.relationship.all([
    { memcmp: { offset: 8, bytes: entity.toBase58() } },
  ]);
}

export async function fetchAllRelationships(program: Program<Chaintrust>) {
  return program.account.relationship.all();
}

export async function fetchRelationshipsForTargetWallet(
  program: Program<Chaintrust>,
  target: PublicKey,
) {
  // target_ref offset = 8 (disc) + 32 (entity) + 1 (kind) = 41
  // The bytes filter accepts a base58 string of exactly the bytes at that
  // offset — for a 32-byte pubkey ref, we use the wallet's base58.
  return program.account.relationship.all([
    { memcmp: { offset: 8 + 32 + 1, bytes: target.toBase58() } },
  ]);
}

export async function fetchCommentsForEntity(
  program: Program<Chaintrust>,
  entity: PublicKey,
) {
  return program.account.commentRecord.all([
    { memcmp: { offset: 8, bytes: entity.toBase58() } },
  ]);
}

export async function fetchCommentsByCommenter(
  program: Program<Chaintrust>,
  wallet: PublicKey,
) {
  return program.account.commentRecord.all([
    { memcmp: { offset: 8 + 32, bytes: wallet.toBase58() } },
  ]);
}

export async function fetchAllComments(program: Program<Chaintrust>) {
  return program.account.commentRecord.all();
}

export async function fetchAllUsers(program: Program<Chaintrust>) {
  return program.account.userProfile.all();
}

export async function fetchLikeRecord(
  program: Program<Chaintrust>,
  comment: PublicKey,
  liker: PublicKey,
) {
  const [pda] = likeRecordPda(comment, liker);
  return program.account.likeRecord.fetchNullable(pda);
}

export async function fetchLikesByLiker(
  program: Program<Chaintrust>,
  liker: PublicKey,
) {
  return program.account.likeRecord.all([
    { memcmp: { offset: 8 + 32, bytes: liker.toBase58() } },
  ]);
}

// ---- write helpers ----

export async function registerUser(
  program: Program<Chaintrust>,
  signer: PublicKey,
  username: string,
  metadataUri: string,
): Promise<string> {
  const [userPda] = userProfilePda(signer);
  return program.methods
    .registerUser(username, metadataUri)
    .accountsPartial({
      userProfile: userPda,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function updateUserMetadataUri(
  program: Program<Chaintrust>,
  signer: PublicKey,
  metadataUri: string,
): Promise<string> {
  const [userPda] = userProfilePda(signer);
  return program.methods
    .updateUserMetadataUri(metadataUri)
    .accountsPartial({
      userProfile: userPda,
      signer,
    })
    .rpc();
}

export async function registerIssuer(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    kind: number;
    trustTier: number;
    nameHash: number[];
    metadataUri: string;
  },
): Promise<string> {
  const [issuer] = issuerPda(signer);
  const [userProfile] = userProfilePda(signer);
  return program.methods
    .registerIssuer(
      params.kind,
      params.trustTier,
      params.nameHash,
      params.metadataUri,
    )
    .accountsPartial({
      issuer,
      userProfile,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function createEntity(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    entityId: number[];
    legalNameHash: number[];
    registryIdHash: number[];
    jurisdiction: string;
    metadataUri: string;
  },
): Promise<string> {
  const [entity] = entityPda(params.entityId);
  const [creatorProfile] = userProfilePda(signer);
  return program.methods
    .createEntity(
      params.entityId,
      params.legalNameHash,
      params.registryIdHash,
      params.jurisdiction,
      params.metadataUri,
    )
    .accountsPartial({
      entity,
      creatorProfile,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function createProject(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    entity: PublicKey;
    projectId: number[];
    nameHash: number[];
    domainHash: number[];
    metadataUri: string;
  },
): Promise<string> {
  const [project] = projectPda(params.entity, params.projectId);
  const [creatorProfile] = userProfilePda(signer);
  return program.methods
    .createProject(
      params.projectId,
      params.nameHash,
      params.domainHash,
      params.metadataUri,
    )
    .accountsPartial({
      entity: params.entity,
      project,
      creatorProfile,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function attestRelationship(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    entity: PublicKey;
    kind: number;
    targetRef: number[];
    evidenceHash: number[];
    evidenceUri: string;
    validFrom: number;
    validUntil: number;
  },
): Promise<string> {
  const [issuer] = issuerPda(signer);
  const [relationship] = relationshipPda(
    params.entity,
    params.kind,
    params.targetRef,
    issuer,
  );

  const builder = program.methods
    .attestRelationship(
      params.kind,
      params.targetRef,
      params.evidenceHash,
      params.evidenceUri,
      new BN(params.validFrom),
      new BN(params.validUntil),
    )
    .accountsPartial({
      entity: params.entity,
      issuer,
      relationship,
      signer,
      systemProgram: SystemProgram.programId,
    });

  // Path C — SAS dual-write. Bundles a SAS create_attestation IX into the
  // SAME transaction so that either both succeed or both fail. Opt-in via
  // NEXT_PUBLIC_SAS_DUAL_WRITE=true; requires bootstrap script to have
  // provisioned the platform Credential + Schema PDAs and added the
  // signer's wallet to authorized_signers.
  if (sasDualWriteEnabled()) {
    const credAuthority = sasCredentialAuthority();
    if (credAuthority) {
      const credential = sasCredentialPda(credAuthority);
      const schema = sasSchemaPda(credential, params.kind);
      const sasAttestation = sasAttestationPda(credential, schema, relationship);
      const data = encodeChainTrustAttestationData({
        entity: params.entity,
        kind: params.kind,
        targetRef: params.targetRef,
        evidenceHash: params.evidenceHash,
        validFrom: params.validFrom,
        validUntil: params.validUntil,
        revokedAt: 0,
      });
      const sasIx = buildCreateAttestationIx({
        payer: signer,
        authority: signer, // must be in credential.authorized_signers
        credential,
        schema,
        attestation: sasAttestation,
        nonce: relationship,
        data,
        expiry: params.validUntil, // 0 = never expires
      });
      builder.postInstructions([sasIx]);
    }
  }

  return builder.rpc();
}

export async function revokeRelationship(
  program: Program<Chaintrust>,
  signer: PublicKey,
  relationship: PublicKey,
): Promise<string> {
  const [issuer] = issuerPda(signer);

  const builder = program.methods
    .revokeRelationship()
    .accountsPartial({
      relationship,
      issuer,
      signer,
    });

  // Path C — when revoking on ChainTrust, also close the mirrored SAS
  // attestation. SAS doesn't support tombstones (close deletes the PDA),
  // so the SAS view shows the attestation has been retracted while our
  // on-chain Relationship.revoked_at preserves the full audit trail.
  if (sasDualWriteEnabled()) {
    const credAuthority = sasCredentialAuthority();
    if (credAuthority) {
      // Need the relationship account to find its kind so we can derive the
      // matching SAS schema + attestation PDA. Fetch it once.
      const rel = await program.account.relationship.fetchNullable(
        relationship,
      );
      if (rel) {
        const credential = sasCredentialPda(credAuthority);
        const schema = sasSchemaPda(credential, rel.kind);
        const sasAttestation = sasAttestationPda(
          credential,
          schema,
          relationship,
        );
        const sasIx = buildCloseAttestationIx({
          payer: signer,
          authority: signer,
          credential,
          attestation: sasAttestation,
        });
        builder.postInstructions([sasIx]);
      }
    }
  }

  return builder.rpc();
}

export async function claimEntity(
  program: Program<Chaintrust>,
  signer: PublicKey,
  entity: PublicKey,
): Promise<string> {
  const [claimerProfile] = userProfilePda(signer);
  return program.methods
    .claimEntity()
    .accountsPartial({
      entity,
      claimerProfile,
      signer,
    })
    .rpc();
}

export async function submitComment(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    entity: PublicKey;
    commentIndex: number;
    relationType: number;
    contentHash: number[];
    evidenceHash: number[];
    contentUri: string;
  },
): Promise<string> {
  const [commenterProfile] = userProfilePda(signer);
  const [comment] = commentPda(params.entity, signer, params.commentIndex);
  return program.methods
    .submitComment(
      params.commentIndex,
      params.relationType,
      params.contentHash,
      params.evidenceHash,
      params.contentUri,
    )
    .accountsPartial({
      entity: params.entity,
      comment,
      commenterProfile,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function submitReply(
  program: Program<Chaintrust>,
  signer: PublicKey,
  params: {
    entity: PublicKey;
    parentComment: PublicKey;
    commentIndex: number;
    contentHash: number[];
    evidenceHash: number[];
    contentUri: string;
  },
): Promise<string> {
  const [commenterProfile] = userProfilePda(signer);
  const [comment] = commentPda(params.entity, signer, params.commentIndex);
  return program.methods
    .submitReply(
      params.commentIndex,
      params.contentHash,
      params.evidenceHash,
      params.contentUri,
    )
    .accountsPartial({
      entity: params.entity,
      parentComment: params.parentComment,
      comment,
      commenterProfile,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function likeComment(
  program: Program<Chaintrust>,
  signer: PublicKey,
  comment: PublicKey,
): Promise<string> {
  const [likerProfile] = userProfilePda(signer);
  const [like] = likeRecordPda(comment, signer);
  return program.methods
    .likeComment()
    .accountsPartial({
      comment,
      likeRecord: like,
      likerProfile,
      signer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function unlikeComment(
  program: Program<Chaintrust>,
  signer: PublicKey,
  comment: PublicKey,
): Promise<string> {
  const [like] = likeRecordPda(comment, signer);
  return program.methods
    .unlikeComment()
    .accountsPartial({
      comment,
      likeRecord: like,
      signer,
    })
    .rpc();
}

export async function addOfficialResponse(
  program: Program<Chaintrust>,
  signer: PublicKey,
  entity: PublicKey,
  comment: PublicKey,
  officialResponseUri: string,
): Promise<string> {
  return program.methods
    .addOfficialResponse(officialResponseUri)
    .accountsPartial({
      entity,
      comment,
      signer,
    })
    .rpc();
}

export { PROGRAM_ID, BN };
