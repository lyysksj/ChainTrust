// End-to-end smoke test for the ChainTrust program.
// Exercises: register_user -> create_entry -> add_wallet_mapping ->
//            submit_comment -> submit_reply -> like/unlike ->
//            claim_entry -> add_official_response.
// Asserts: no delete_comment, official response does not change content_hash,
// non-official responses rejected, official response on a reply rejected,
// reply depth cap, like toggling round-trips.

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, setProvider, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

function loadIdl() {
  const idlPath = path.join(__dirname, "..", "target", "idl", "chaintrust.json");
  return JSON.parse(fs.readFileSync(idlPath, "utf8"));
}

function sha256Bytes(s: string | null): number[] {
  if (!s) return new Array(32).fill(0);
  return Array.from(createHash("sha256").update(s).digest());
}

function entryIdBytes(): number[] {
  return Array.from(randomBytes(8));
}

function userPda(programId: PublicKey, wallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user"), wallet.toBuffer()],
    programId,
  )[0];
}
function entryPda(programId: PublicKey, id: number[]): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("entry"), Buffer.from(id)],
    programId,
  )[0];
}
function commentPda(
  programId: PublicKey,
  entry: PublicKey,
  commenter: PublicKey,
  index: number,
): PublicKey {
  const idx = Buffer.alloc(4);
  idx.writeUInt32LE(index, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("comment"), entry.toBuffer(), commenter.toBuffer(), idx],
    programId,
  )[0];
}
function walletMapPda(
  programId: PublicKey,
  target: PublicKey,
  entry: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("wallet_map"), target.toBuffer(), entry.toBuffer()],
    programId,
  )[0];
}
function likePda(
  programId: PublicKey,
  comment: PublicKey,
  liker: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("like"), comment.toBuffer(), liker.toBuffer()],
    programId,
  )[0];
}

async function airdrop(
  connection: anchor.web3.Connection,
  key: PublicKey,
  lamports: number,
) {
  const sig = await connection.requestAirdrop(key, lamports);
  await connection.confirmTransaction(sig, "confirmed");
}

async function main() {
  const rpc = process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899";
  const walletPath =
    process.env.ANCHOR_WALLET ?? path.join(process.env.HOME!, ".config/solana/id.json");
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8"))),
  );
  const connection = new anchor.web3.Connection(rpc, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(kp), {
    commitment: "confirmed",
  });
  setProvider(provider);

  const idl = loadIdl();
  const program = new Program(idl, provider) as any;
  const programId = program.programId;
  console.log("program id:", programId.toBase58());

  const bal = await connection.getBalance(kp.publicKey);
  if (bal < 1e9)
    await airdrop(connection, kp.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);

  // 1) register creator
  const creatorUser = userPda(programId, kp.publicKey);
  const existing = await program.account.userProfile.fetchNullable(creatorUser);
  if (!existing) {
    console.log("register creator…");
    await program.methods
      .registerUser("creator_" + Date.now().toString(36), "Creator", "")
      .accountsPartial({
        userProfile: creatorUser,
        signer: kp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // 2) create_entry with ein_hash and no primary wallet (sentinel)
  const id = entryIdBytes();
  const entry = entryPda(programId, id);
  console.log("create_entry (no primary wallet)…");
  await program.methods
    .createEntry(
      id,
      sha256Bytes("Acme Protocol Pte. Ltd."),
      sha256Bytes("Acme"),
      sha256Bytes("US:123456789"),
      "US",
      sha256Bytes("acme.xyz"),
      "",
    )
    .accountsPartial({
      entry,
      creatorProfile: creatorUser,
      primaryWallet: SystemProgram.programId, // sentinel = no primary wallet
      signer: kp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  let entryAcc = await program.account.companyEntry.fetch(entry);
  assert.equal(entryAcc.status, 0, "entry must start unverified");
  assert.equal(entryAcc.isClaimed, false, "entry must not be claimed on create");
  assert.equal(entryAcc.commentCount, 0, "comment_count starts at 0");
  assert.ok(
    entryAcc.primaryWallet.equals(PublicKey.default),
    "primary_wallet=None stored as Pubkey::default",
  );

  // 3) add_wallet_mapping (community)
  const treasuryWallet = Keypair.generate().publicKey;
  const mappingPda = walletMapPda(programId, treasuryWallet, entry);
  console.log("add_wallet_mapping (community)…");
  await program.methods
    .addWalletMapping(1, sha256Bytes("treasury"), "", false)
    .accountsPartial({
      entry,
      walletMapping: mappingPda,
      targetWallet: treasuryWallet,
      userProfile: creatorUser,
      signer: kp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  const map1 = await program.account.walletMapping.fetch(mappingPda);
  assert.equal(map1.isOfficial, false);

  // official mapping before claim must fail
  const otherWallet = Keypair.generate().publicKey;
  const mappingPdaOther = walletMapPda(programId, otherWallet, entry);
  let threw = false;
  try {
    await program.methods
      .addWalletMapping(2, sha256Bytes("deployer"), "", true)
      .accountsPartial({
        entry,
        walletMapping: mappingPdaOther,
        targetWallet: otherWallet,
        userProfile: creatorUser,
        signer: kp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch {
    threw = true;
  }
  assert.ok(threw, "official mapping before claim must fail");

  // 4) submit_comment (top-level review from reviewer)
  const reviewerKp = Keypair.generate();
  await airdrop(connection, reviewerKp.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  const reviewerProvider = new AnchorProvider(
    connection,
    new Wallet(reviewerKp),
    { commitment: "confirmed" },
  );
  const reviewerProgram = new Program(idl, reviewerProvider) as any;
  const reviewerUser = userPda(programId, reviewerKp.publicKey);
  console.log("register reviewer…");
  await reviewerProgram.methods
    .registerUser("reviewer_" + Date.now().toString(36), "Reviewer B", "")
    .accountsPartial({
      userProfile: reviewerUser,
      signer: reviewerKp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const commentContent = JSON.stringify({
    headline: "Paid on time, solid comms",
    body: "Worked with them for 3 months. Contract scope stayed stable; no fee surprises.",
    images: [],
  });
  const commentHash = sha256Bytes(commentContent);
  const topLevelPda = commentPda(programId, entry, reviewerKp.publicKey, 0);
  console.log("submit_comment (top-level)…");
  await reviewerProgram.methods
    .submitComment(0, 4, commentHash, sha256Bytes(null), "mock://abcdef")
    .accountsPartial({
      entry,
      comment: topLevelPda,
      commenterProfile: reviewerUser,
      signer: reviewerKp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  let commentAcc = await program.account.commentRecord.fetch(topLevelPda);
  const originalHash = Buffer.from(commentAcc.contentHash).toString("hex");
  const originalUri = commentAcc.contentUri;
  assert.equal(commentAcc.officialResponseUri, "", "no response yet");
  assert.equal(commentAcc.depth, 0, "top-level depth = 0");
  assert.equal(commentAcc.parentComment, null, "top-level parent = None");
  assert.equal(commentAcc.likeCount, 0, "initial like count = 0");

  entryAcc = await program.account.companyEntry.fetch(entry);
  assert.equal(entryAcc.commentCount, 1, "comment_count = 1 after top-level");

  // 5) submit_reply (depth 1, creator replies)
  const reply1Pda = commentPda(programId, entry, kp.publicKey, 1);
  console.log("submit_reply (depth 1)…");
  await program.methods
    .submitReply(
      1,
      sha256Bytes("reply-1-content"),
      sha256Bytes(null),
      "mock://reply1",
    )
    .accountsPartial({
      entry,
      parentComment: topLevelPda,
      comment: reply1Pda,
      commenterProfile: creatorUser,
      signer: kp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  const reply1Acc = await program.account.commentRecord.fetch(reply1Pda);
  assert.equal(reply1Acc.depth, 1, "depth-1 reply");
  assert.ok(
    reply1Acc.parentComment.equals(topLevelPda),
    "reply parent = top-level",
  );

  // depth-2 reply
  const reply2Pda = commentPda(programId, entry, reviewerKp.publicKey, 2);
  console.log("submit_reply (depth 2)…");
  await reviewerProgram.methods
    .submitReply(
      2,
      sha256Bytes("reply-2-content"),
      sha256Bytes(null),
      "mock://reply2",
    )
    .accountsPartial({
      entry,
      parentComment: reply1Pda,
      comment: reply2Pda,
      commenterProfile: reviewerUser,
      signer: reviewerKp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  const reply2Acc = await program.account.commentRecord.fetch(reply2Pda);
  assert.equal(reply2Acc.depth, 2, "depth-2 reply");

  // depth-3 must fail
  const reply3Pda = commentPda(programId, entry, kp.publicKey, 3);
  threw = false;
  try {
    await program.methods
      .submitReply(
        3,
        sha256Bytes("reply-3-content"),
        sha256Bytes(null),
        "mock://reply3",
      )
      .accountsPartial({
        entry,
        parentComment: reply2Pda,
        comment: reply3Pda,
        commenterProfile: creatorUser,
        signer: kp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch {
    threw = true;
  }
  assert.ok(threw, "depth-3 reply must fail (max depth = 2)");

  // 6) like / unlike
  const likeAcc = likePda(programId, topLevelPda, kp.publicKey);
  console.log("like_comment…");
  await program.methods
    .likeComment()
    .accountsPartial({
      comment: topLevelPda,
      likeRecord: likeAcc,
      likerProfile: creatorUser,
      signer: kp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  commentAcc = await program.account.commentRecord.fetch(topLevelPda);
  assert.equal(commentAcc.likeCount, 1, "like_count incremented");

  // Double-like must fail
  threw = false;
  try {
    await program.methods
      .likeComment()
      .accountsPartial({
        comment: topLevelPda,
        likeRecord: likeAcc,
        likerProfile: creatorUser,
        signer: kp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch {
    threw = true;
  }
  assert.ok(threw, "double-like must fail");

  console.log("unlike_comment…");
  await program.methods
    .unlikeComment()
    .accountsPartial({
      comment: topLevelPda,
      likeRecord: likeAcc,
      signer: kp.publicKey,
    })
    .rpc();
  commentAcc = await program.account.commentRecord.fetch(topLevelPda);
  assert.equal(commentAcc.likeCount, 0, "like_count decremented");

  // 7) claim_entry
  console.log("claim_entry…");
  await program.methods
    .claimEntry()
    .accountsPartial({
      entry,
      claimerProfile: creatorUser,
      signer: kp.publicKey,
    })
    .rpc();
  entryAcc = await program.account.companyEntry.fetch(entry);
  assert.equal(entryAcc.isClaimed, true, "entry claimed");
  assert.equal(entryAcc.status, 2, "status = claimed");

  // 8) add_official_response on top-level
  console.log("add_official_response…");
  await program.methods
    .addOfficialResponse("mock://official-response")
    .accountsPartial({
      entry,
      comment: topLevelPda,
      signer: kp.publicKey,
    })
    .rpc();
  const commentAfter = await program.account.commentRecord.fetch(topLevelPda);
  assert.equal(
    Buffer.from(commentAfter.contentHash).toString("hex"),
    originalHash,
    "content_hash unchanged",
  );
  assert.equal(commentAfter.contentUri, originalUri, "content_uri unchanged");
  assert.equal(commentAfter.officialResponseUri, "mock://official-response");

  // Official response on a reply must fail
  threw = false;
  try {
    await program.methods
      .addOfficialResponse("mock://reply-response")
      .accountsPartial({
        entry,
        comment: reply1Pda,
        signer: kp.publicKey,
      })
      .rpc();
  } catch {
    threw = true;
  }
  assert.ok(threw, "official response on a reply must fail");

  // Non-official response must fail
  threw = false;
  try {
    await reviewerProgram.methods
      .addOfficialResponse("mock://imposter")
      .accountsPartial({
        entry,
        comment: topLevelPda,
        signer: reviewerKp.publicKey,
      })
      .rpc();
  } catch {
    threw = true;
  }
  assert.ok(threw, "non-official response must fail");

  const names = (idl.instructions as { name: string }[]).map((i) => i.name);
  assert.ok(!names.includes("deleteComment"), "no delete_comment");
  assert.ok(!names.includes("delete_comment"), "no delete_comment");

  console.log("\n✓ All smoke checks passed");
  console.log("entry pda:", entry.toBase58());
  console.log("entry id hex:", Buffer.from(id).toString("hex"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
