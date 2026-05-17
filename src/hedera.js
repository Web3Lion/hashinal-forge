/**
 * hedera.js — Real Hedera transactions via WalletConnect
 *
 * Architecture: Shared Collection Topic
 * - One HCS-1 topic per collection, reused for all inscriptions
 * - Each inscription identified by a unique inscription_id
 * - HRL format: hcs://1/<topicId>?inscription_id=<id>
 * - Dramatically reduces wallet approvals vs per-NFT topics
 */

import { getSdk, getAccountId, getNetwork } from "./wallet.js";

const MIRROR = {
  testnet: "https://testnet.mirrornode.hedera.com/api/v1",
  mainnet: "https://mainnet.mirrornode.hedera.com/api/v1",
};

function mirror() {
  return MIRROR[getNetwork()] || MIRROR.testnet;
}

const CHUNK_SIZE = 4096;

function chunkBuffer(buf) {
  const chunks = [];
  let offset = 0;
  while (offset < buf.byteLength) {
    const slice = buf.slice(offset, offset + CHUNK_SIZE);
    chunks.push(btoa(String.fromCharCode(...new Uint8Array(slice))));
    offset += CHUNK_SIZE;
  }
  return chunks;
}

function generateInscriptionId(prefix = "ins") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── SIGNER HELPERS ──────────────────────────────────────────────────────────

function getSigner() {
  const sdk = getSdk();
  if (!sdk) throw new Error("Wallet not connected");
  const accountInfo = sdk.getAccountInfo?.();
  const accountId = accountInfo?.accountId;
  const signers = sdk.dAppConnector?.signers;
  if (!signers?.length)
    throw new Error("No signers available — reconnect your wallet");
  const signer = accountId
    ? signers.find((s) => s.getAccountId().toString() === accountId) ??
      signers[0]
    : signers[0];
  if (!signer) throw new Error("No matching signer found");
  return signer;
}

async function execTx(tx) {
  const signer = getSigner();
  const { AccountId, Client } = await import("@hashgraph/sdk");

  if (typeof tx.setAutoRenewAccountId === "function") {
    const accountIdStr = signer.getAccountId().toString();
    tx.setAutoRenewAccountId(AccountId.fromString(accountIdStr));
  }

  await signer.populateTransaction(tx);
  const response = await tx.executeWithSigner(signer);

  const client =
    getNetwork() === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  return response.getReceipt(client);
}

// ─── TOPIC MANAGEMENT ────────────────────────────────────────────────────────

export async function createCollectionTopic(collectionName) {
  const { TopicCreateTransaction } = await import("@hashgraph/sdk");
  const tx = new TopicCreateTransaction().setTopicMemo(
    `Hashinal Collection: ${collectionName}`
  );
  const receipt = await execTx(tx);
  if (!receipt?.topicId) throw new Error("Failed to create collection topic");
  return receipt.topicId.toString();
}

// ─── INSCRIPTION ─────────────────────────────────────────────────────────────

async function submitMessage(topicId, message) {
  const { TopicMessageSubmitTransaction } = await import("@hashgraph/sdk");
  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message);
  return execTx(tx);
}

export async function inscribeFileToTopic(
  topicId,
  fileBuffer,
  mimeType,
  fileName,
  onProgress
) {
  const inscriptionId = generateInscriptionId("img");
  onProgress(0, `Inscribing ${fileName}...`);

  await submitMessage(
    topicId,
    JSON.stringify({
      p: "hcs-1",
      op: "register",
      t_id: topicId,
      inscription_id: inscriptionId,
      m: fileName,
      type: mimeType,
    })
  );
  onProgress(10, "Image header sent");

  const chunks = chunkBuffer(new Uint8Array(fileBuffer));
  for (let i = 0; i < chunks.length; i++) {
    const pct = Math.round(10 + ((i + 1) / chunks.length) * 75);
    onProgress(
      pct,
      `Image chunk ${i + 1}/${chunks.length} — approve in wallet`
    );
    await submitMessage(
      topicId,
      JSON.stringify({
        p: "hcs-1",
        op: "data",
        t_id: topicId,
        inscription_id: inscriptionId,
        chunk: i + 1,
        total_chunks: chunks.length,
        data: chunks[i],
      })
    );
  }

  await submitMessage(
    topicId,
    JSON.stringify({
      p: "hcs-1",
      op: "end",
      t_id: topicId,
      inscription_id: inscriptionId,
      total_chunks: chunks.length,
    })
  );
  onProgress(95, "Image inscribed ✓");

  const hrl = `hcs://1/${topicId}?inscription_id=${inscriptionId}`;
  return { inscriptionId, hrl, chunkCount: chunks.length };
}

export async function inscribeMetadataToTopic(
  topicId,
  metadataObj,
  onProgress
) {
  const inscriptionId = generateInscriptionId("meta");
  const encoded = btoa(
    unescape(encodeURIComponent(JSON.stringify(metadataObj)))
  );

  onProgress(0, "Inscribing metadata...");

  await submitMessage(
    topicId,
    JSON.stringify({
      p: "hcs-1",
      op: "register",
      t_id: topicId,
      inscription_id: inscriptionId,
      m: "metadata.json",
      type: "application/json",
    })
  );
  onProgress(30, "Metadata header sent");

  await submitMessage(
    topicId,
    JSON.stringify({
      p: "hcs-1",
      op: "data",
      t_id: topicId,
      inscription_id: inscriptionId,
      chunk: 1,
      total_chunks: 1,
      data: encoded,
    })
  );
  onProgress(70, "Metadata content sent");

  await submitMessage(
    topicId,
    JSON.stringify({
      p: "hcs-1",
      op: "end",
      t_id: topicId,
      inscription_id: inscriptionId,
      total_chunks: 1,
    })
  );
  onProgress(95, "Metadata inscribed ✓");

  const hrl = `hcs://1/${topicId}?inscription_id=${inscriptionId}`;
  return { inscriptionId, hrl };
}

// ─── KEY MANAGEMENT ──────────────────────────────────────────────────────────

export async function generateKeyPair() {
  const { PrivateKey } = await import("@hashgraph/sdk");
  const privateKey = PrivateKey.generateED25519();
  return {
    privateKey: privateKey.toString(),
    publicKey: privateKey.publicKey.toString(),
  };
}

export function downloadKeyFile(keyData, filename = "hashinal-key.txt") {
  const content = [
    "# Hashinal Forge — Generated Key",
    "# Keep this file safe. Anyone with the private key controls this token.",
    "# Generated: " + new Date().toISOString(),
    "",
    "PRIVATE_KEY=" + keyData.privateKey,
    "PUBLIC_KEY=" + keyData.publicKey,
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── TOKEN CREATION ──────────────────────────────────────────────────────────

export async function createNFTCollection({
  name,
  symbol,
  maxSupply,
  supplyType,
  collectionTopicId,
  keys = {},
}) {
  const sdk = getSdk();
  const operatorAccountId = getAccountId();
  if (!sdk) throw new Error("Wallet not connected");

  const {
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    PrivateKey,
    AccountId,
  } = await import("@hashgraph/sdk");

  const signer = getSigner();

  // Resolve a key string to a PublicKey object
  const resolveKey = async (keyStr) => {
    if (!keyStr) return null;
    return PrivateKey.fromString(keyStr).publicKey;
  };

  // Get wallet's public key — used as default for all roles
  let walletPublicKey = null;
  try {
    walletPublicKey = signer.getAccountKey?.();
  } catch {
    /* some signers don't expose this */
  }

  // Each key role: use provided custom key, else wallet key if enabled, else null
  const supplyKey = keys.supplyKey
    ? await resolveKey(keys.supplyKey)
    : walletPublicKey;
  const adminKey = keys.adminKey
    ? await resolveKey(keys.adminKey)
    : keys.enableAdmin
    ? walletPublicKey
    : null;
  const freezeKey = keys.freezeKey
    ? await resolveKey(keys.freezeKey)
    : keys.enableFreeze
    ? walletPublicKey
    : null;
  const pauseKey = keys.pauseKey
    ? await resolveKey(keys.pauseKey)
    : keys.enablePause
    ? walletPublicKey
    : null;
  const wipeKey = keys.wipeKey ? await resolveKey(keys.wipeKey) : null; // off by default

  let tx = new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setMaxSupply(maxSupply || 0)
    .setSupplyType(
      supplyType === "INFINITE"
        ? TokenSupplyType.Infinite
        : TokenSupplyType.Finite
    )
    .setTreasuryAccountId(AccountId.fromString(operatorAccountId))
    .setTokenMemo(collectionTopicId ? `hcs://1/${collectionTopicId}` : "");

  if (supplyKey) tx = tx.setSupplyKey(supplyKey);
  if (adminKey) tx = tx.setAdminKey(adminKey);
  if (freezeKey) tx = tx.setFreezeKey(freezeKey);
  if (pauseKey) tx = tx.setPauseKey(pauseKey);
  if (wipeKey) tx = tx.setWipeKey(wipeKey);

  const receipt = await execTx(tx);
  if (!receipt?.tokenId)
    throw new Error("Token creation failed — no tokenId in receipt");
  return receipt.tokenId.toString();
}

export async function mintNFT(tokenId, metadataHRL, count = 1) {
  const sdk = getSdk();
  if (!sdk) throw new Error("Wallet not connected");

  const { TokenMintTransaction } = await import("@hashgraph/sdk");

  const metadataBuffers = Array(count).fill(
    new TextEncoder().encode(metadataHRL)
  );

  const tx = new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata(metadataBuffers);

  const receipt = await execTx(tx);
  if (!receipt?.serials) throw new Error("Mint failed — no serials in receipt");
  return receipt.serials.map((s) => s.toString());
}

// ─── APPROVAL ESTIMATOR ──────────────────────────────────────────────────────

export function estimateApprovals({
  fileSizeBytes,
  isNewTopic,
  isNewToken,
  mintCount = 1,
}) {
  const chunks = Math.ceil(fileSizeBytes / CHUNK_SIZE);
  let approvals = 0;
  if (isNewTopic) approvals += 1; // create collection topic
  approvals += 1; // image header
  approvals += chunks; // image data chunks
  approvals += 1; // image end sentinel
  approvals += 1; // metadata header
  approvals += 1; // metadata data
  approvals += 1; // metadata end sentinel
  if (isNewToken) approvals += 1; // create HTS token
  approvals += mintCount; // mint
  return approvals;
}

// ─── VIEWER ──────────────────────────────────────────────────────────────────

export async function fetchNFTFromMirror(tokenId, serial) {
  const base = mirror();

  const nftRes = await fetch(`${base}/tokens/${tokenId}/nfts/${serial}`);
  if (!nftRes.ok) throw new Error(`NFT not found: ${tokenId}/${serial}`);
  const nftData = await nftRes.json();

  const metadataRaw = nftData.metadata;
  let metadataHRL = "";
  if (metadataRaw) {
    try {
      metadataHRL = atob(metadataRaw);
    } catch {
      metadataHRL = metadataRaw;
    }
  }

  const tokenRes = await fetch(`${base}/tokens/${tokenId}`);
  const tokenData = tokenRes.ok ? await tokenRes.json() : {};

  let metaJson = null;
  if (metadataHRL.startsWith("hcs://")) {
    const url = new URL(
      metadataHRL.replace("hcs://", "https://hcs-placeholder/")
    );
    const parts = url.pathname.split("/").filter(Boolean);
    const topicId = parts[parts.length - 1];
    const inscriptionId = url.searchParams.get("inscription_id");
    metaJson = await fetchHCSContent(topicId, inscriptionId);
  }

  return {
    tokenId,
    serial,
    metadataHRL,
    metaJson,
    tokenName: tokenData.name,
    tokenSymbol: tokenData.symbol,
    createdTimestamp: nftData.created_timestamp,
    accountId: nftData.account_id,
  };
}

export async function fetchHCSContent(topicId, inscriptionId = null) {
  const base = mirror();
  const res = await fetch(
    `${base}/topics/${topicId}/messages?limit=200&order=asc`
  );
  if (!res.ok) throw new Error(`Topic not found: ${topicId}`);
  const data = await res.json();

  const messages = data.messages || [];
  const chunks = {};

  for (const msg of messages) {
    try {
      const decoded = atob(msg.message);
      const parsed = JSON.parse(decoded);
      if (inscriptionId && parsed.inscription_id !== inscriptionId) continue;
      if (parsed.op === "register" || parsed.op === "end") continue;
      if (parsed.op === "data" && parsed.data) {
        chunks[parsed.chunk || 1] = parsed.data;
      }
    } catch {
      if (!inscriptionId) {
        chunks[Object.keys(chunks).length + 1] = msg.message;
      }
    }
  }

  const assembled = Object.keys(chunks)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((k) => chunks[k])
    .join("");

  if (!assembled) return null;

  try {
    return JSON.parse(decodeURIComponent(escape(atob(assembled))));
  } catch {
    try {
      return JSON.parse(assembled);
    } catch {
      return assembled;
    }
  }
}
