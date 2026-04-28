import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt",
);

const USER = Buffer.from("user");
const ISSUER = Buffer.from("issuer");
const ENTITY = Buffer.from("entity");
const PROJECT = Buffer.from("project");
const REL = Buffer.from("rel");
const COMMENT = Buffer.from("comment");
const LIKE = Buffer.from("like");

export function userProfilePda(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([USER, wallet.toBuffer()], PROGRAM_ID);
}

export function issuerPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ISSUER, authority.toBuffer()], PROGRAM_ID);
}

export function entityPda(entityId: number[] | Uint8Array): [PublicKey, number] {
  const id = Buffer.from(entityId);
  if (id.length !== 8) throw new Error("entity_id must be 8 bytes");
  return PublicKey.findProgramAddressSync([ENTITY, id], PROGRAM_ID);
}

export function projectPda(
  entity: PublicKey,
  projectId: number[] | Uint8Array,
): [PublicKey, number] {
  const id = Buffer.from(projectId);
  if (id.length !== 8) throw new Error("project_id must be 8 bytes");
  return PublicKey.findProgramAddressSync(
    [PROJECT, entity.toBuffer(), id],
    PROGRAM_ID,
  );
}

export function relationshipPda(
  entity: PublicKey,
  kind: number,
  targetRef: number[] | Uint8Array,
  issuer: PublicKey,
): [PublicKey, number] {
  const ref = Buffer.from(targetRef);
  if (ref.length !== 32) throw new Error("target_ref must be 32 bytes");
  return PublicKey.findProgramAddressSync(
    [REL, entity.toBuffer(), Buffer.from([kind]), ref, issuer.toBuffer()],
    PROGRAM_ID,
  );
}

export function commentPda(
  entity: PublicKey,
  commenter: PublicKey,
  commentIndex: number,
): [PublicKey, number] {
  const idx = Buffer.alloc(4);
  idx.writeUInt32LE(commentIndex >>> 0, 0);
  return PublicKey.findProgramAddressSync(
    [COMMENT, entity.toBuffer(), commenter.toBuffer(), idx],
    PROGRAM_ID,
  );
}

export function likeRecordPda(
  comment: PublicKey,
  liker: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [LIKE, comment.toBuffer(), liker.toBuffer()],
    PROGRAM_ID,
  );
}
