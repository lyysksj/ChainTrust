// End-to-end smoke test for the ChainTrust program.
// Exercises: register_user -> create_entry -> add_wallet_mapping ->
//            submit_comment -> claim_entry -> add_official_response.
// Also asserts there is no delete_comment instruction and that official
// response does not change content_hash / content_uri.

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

  // Ensure creator has lamports
  const bal = await connection.getBalance(kp.publicKey);
  if (bal < 1e9) await airdrop(connection, kp.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);

  // ------------------------------------------------------------------
  // 1) register_user (creator)
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 2) create_entry
  // ------------------------------------------------------------------
  const id = entryIdBytes();
  const entry = entryPda(programId, id);
  const primaryWallet = Keypair.generate().publicKey;
  console.log("create_entry…");
  await program.methods
    .createEntry(
      id,
      sha256Bytes("Acme Protocol Pte. Ltd."),
      sha256Bytes("Acme"),
      "Hong Kong",
      sha256Bytes("acme.xyz"),
      "",
    )
    .accountsPartial({
      entry,
      creatorProfile: creatorUser,
      primaryWallet,
      signer: kp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  let entryAcc = await program.account.companyEntry.fetch(entry);
  assert.equal(entryAcc.status, 0, "entry must start unverified");
  assert.equal(entryAcc.isClaimed, false, "entry must not be claimed on create");
  assert.equal(entryAcc.commentCount, 0, "comment_count starts at 0");

  // ------------------------------------------------------------------
  // 3) add_wallet_mapping (community)
  // ------------------------------------------------------------------
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

  // Attempting to mark a mapping as official while entry is not claimed must fail
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
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, "official mapping before claim must fail");

  // ------------------------------------------------------------------
  // 4) submit_comment (as reviewer B)
  // ------------------------------------------------------------------
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
  });
  const commentHash = sha256Bytes(commentContent);
  const commentPdaKey = commentPda(programId, entry, reviewerKp.publicKey, 0);
  console.log("submit_comment…");
  await reviewerProgram.methods
    .submitComment(0, 2, 5, 4, 4, commentHash, sha256Bytes(null), "mock://abcdef")
    .accountsPartial({
      entry,
      comment: commentPdaKey,
      commenterProfile: reviewerUser,
      signer: reviewerKp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  const commentAcc = await program.account.commentRecord.fetch(commentPdaKey);
  const originalHash = Buffer.from(commentAcc.contentHash).toString("hex");
  const originalUri = commentAcc.contentUri;
  assert.equal(commentAcc.officialResponseUri, "", "no response yet");

  entryAcc = await program.account.companyEntry.fetch(entry);
  assert.equal(entryAcc.commentCount, 1, "comment_count increments");

  // Double submit with stale index must fail
  threw = false;
  try {
    await reviewerProgram.methods
      .submitComment(0, 2, 5, 4, 4, commentHash, sha256Bytes(null), "mock://zzz")
      .accountsPartial({
        entry,
        comment: commentPdaKey,
        commenterProfile: reviewerUser,
        signer: reviewerKp.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch {
    threw = true;
  }
  assert.ok(threw, "duplicate comment index must fail");

  // ------------------------------------------------------------------
  // 5) claim_entry (as creator — representing the company)
  // ------------------------------------------------------------------
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
  assert.equal(entryAcc.isClaimed, true, "entry must be claimed");
  assert.equal(entryAcc.status, 2, "status must be claimed");
  assert.ok(
    entryAcc.officialWallet.equals(kp.publicKey),
    "official_wallet must equal claimer",
  );

  // Double claim must fail
  threw = false;
  try {
    await program.methods
      .claimEntry()
      .accountsPartial({ entry, claimerProfile: creatorUser, signer: kp.publicKey })
      .rpc();
  } catch {
    threw = true;
  }
  assert.ok(threw, "double claim must fail");

  // ------------------------------------------------------------------
  // 6) add_official_response (as official representative)
  // ------------------------------------------------------------------
  console.log("add_official_response…");
  await program.methods
    .addOfficialResponse("mock://official-response")
    .accountsPartial({ entry, comment: commentPdaKey, signer: kp.publicKey })
    .rpc();
  const commentAfter = await program.account.commentRecord.fetch(commentPdaKey);
  assert.equal(
    Buffer.from(commentAfter.contentHash).toString("hex"),
    originalHash,
    "content_hash must NOT change after official response",
  );
  assert.equal(
    commentAfter.contentUri,
    originalUri,
    "content_uri must NOT change after official response",
  );
  assert.equal(
    commentAfter.officialResponseUri,
    "mock://official-response",
    "official_response_uri must be set",
  );

  // Non-official attempting to respond must fail
  threw = false;
  try {
    await reviewerProgram.methods
      .addOfficialResponse("mock://imposter")
      .accountsPartial({ entry, comment: commentPdaKey, signer: reviewerKp.publicKey })
      .rpc();
  } catch {
    threw = true;
  }
  assert.ok(threw, "non-official response must fail");

  // Now: after claim, creator can mark an official mapping
  const officialTarget = Keypair.generate().publicKey;
  const officialMapPda = walletMapPda(programId, officialTarget, entry);
  console.log("add_wallet_mapping (official)…");
  await program.methods
    .addWalletMapping(2, sha256Bytes("official-deployer"), "", true)
    .accountsPartial({
      entry,
      walletMapping: officialMapPda,
      targetWallet: officialTarget,
      userProfile: creatorUser,
      signer: kp.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  const officialMap = await program.account.walletMapping.fetch(officialMapPda);
  assert.equal(officialMap.isOfficial, true, "official mapping flag must be true");

  // Assert the IDL has no delete_comment instruction (compile-time invariant)
  const names = (idl.instructions as { name: string }[]).map((i) => i.name);
  assert.ok(!names.includes("deleteComment"), "there must be NO delete_comment");
  assert.ok(!names.includes("delete_comment"), "there must be NO delete_comment");

  console.log("\n✓ All smoke checks passed");
  console.log("entry pda:", entry.toBase58());
  console.log("entry id hex:", Buffer.from(id).toString("hex"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
