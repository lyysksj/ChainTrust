import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt",
);

const USER = Buffer.from("user");
const ENTRY = Buffer.from("entry");
const COMMENT = Buffer.from("comment");
const WALLET_MAP = Buffer.from("wallet_map");
const LIKE = Buffer.from("like");

export function userProfilePda(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([USER, wallet.toBuffer()], PROGRAM_ID);
}

export function entryPda(entryId: number[] | Uint8Array): [PublicKey, number] {
  const id = Buffer.from(entryId);
  if (id.length !== 8) throw new Error("entry_id must be 8 bytes");
  return PublicKey.findProgramAddressSync([ENTRY, id], PROGRAM_ID);
}

export function commentPda(
  entry: PublicKey,
  commenter: PublicKey,
  commentIndex: number,
): [PublicKey, number] {
  const idx = Buffer.alloc(4);
  idx.writeUInt32LE(commentIndex >>> 0, 0);
  return PublicKey.findProgramAddressSync(
    [COMMENT, entry.toBuffer(), commenter.toBuffer(), idx],
    PROGRAM_ID,
  );
}

export function walletMappingPda(
  targetWallet: PublicKey,
  entry: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [WALLET_MAP, targetWallet.toBuffer(), entry.toBuffer()],
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
