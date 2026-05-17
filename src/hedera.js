/**
 * hedera.js — Real Hedera transactions via WalletConnect + standards-sdk
 *
 * Key fix: freezeWithSigner() triggers setAutoRenewAccountId() which calls
 * AccountId.fromString() on a LedgerId object, crashing with "startsWith is
 * not a function". We bypass this by calling signer.signTransaction() directly,
 * which internally calls freezeWith(this._getHederaClient()) — the correct path.
 */

import { getSdk, getAccountId, getNetwork } from "./wallet.js";

const MIRROR = {
  testnet: "https://testnet.mirrornode.hedera.com/api/v1",
  mainnet: "https://mainnet.mirrornode.hedera.com/api/v1",
};

function mirror() {
  return MIRROR[getNetwork()] || MIRROR.testnet;
}

function chunkBuffer(buf, chunkBytes = 800) {
  const chunks = [];
  let offset = 0;
  while (offset < buf.byteLength) {
    const slice = buf.slice(offset, offset + chunkBytes);
    chunks.push(btoa(String.fromCharCode(...new Uint8Array(slice))));
    offset += chunkBytes;
  }
  return chunks;
}

/**
 * Get the best available signer from the connected wallet.
 * Prefers the signer whose accountId matches the connected account.
 */
function getSigner() {
  const sdk = getSdk();
  if (!sdk) throw new Error("Wallet not connected");

  const accountInfo = sdk.getAccountInfo?.();
  const accountId = accountInfo?.accountId;

  const signers = sdk.dAppConnector?.signers;
  if (!signers?.length)
    throw new Error("No signers available — reconnect your wallet");

  // Prefer the signer that matches our connected account
  const signer = accountId
    ? signers.find((s) => s.getAccountId().toString() === accountId) ??
      signers[0]
    : signers[0];

  if (!signer) throw new Error("No matching signer found");
  return signer;
}

/**
 * Execute a transaction using the signer directly.
 * Uses signer.signTransaction() which handles freezeWith(client) internally,
 * bypassing the buggy freezeWithSigner() → setAutoRenewAccountId() path.
 */
async function execTx(tx) {
  const signer = getSigner();
  const { AccountId } = await import("@hashgraph/sdk");

  // Set autoRenewAccountId explicitly before populateTransaction
  if (typeof tx.setAutoRenewAccountId === "function") {
    const accountIdStr = signer.getAccountId().toString();
    tx.setAutoRenewAccountId(AccountId.fromString(accountIdStr));
  }

  // populateTransaction sets the TransactionId
  await signer.populateTransaction(tx);

  // executeWithSigner handles freeze + sign + execute
  const response = await tx.executeWithSigner(signer);

  // getReceiptWithSigner fails in WalletConnect environments —
  // use getReceipt with a plain client instead
  const { Client } = await import("@hashgraph/sdk");
  const client =
    getNetwork() === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  return response.getReceipt(client);
}
/**
 * Create a new HCS-1 topic.
 * Returns topicId as a plain string e.g. "0.0.123456"
 */
async function createTopic(memo) {
  const { TopicCreateTransaction, AccountId } = await import("@hashgraph/sdk");
  const signer = getSigner();

  // Get accountId as plain string and convert to AccountId object
  const accountIdStr = signer.getAccountId().toString();
  const accountId = AccountId.fromString(accountIdStr);

  const tx = new TopicCreateTransaction()
    .setAutoRenewAccountId(accountId) // set explicitly so freezeWith skips auto-set
    .setAutoRenewPeriod(7776000); // 90 days in seconds

  if (memo) tx.setTopicMemo(memo);

  const receipt = await execTx(tx);

  if (!receipt?.topicId) {
    throw new Error(`createTopic failed — no topicId in receipt`);
  }

  return receipt.topicId.toString();
}

/**
 * Submit a single message to an HCS-1 topic.
 */
async function submitChunk(topicId, message) {
  const { TopicMessageSubmitTransaction } = await import("@hashgraph/sdk");

  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message);

  return execTx(tx);
}

/**
 * Inscribe a file to HCS-1.
 * Returns: { topicId, hrl, chunkCount }
 */
export async function inscribeFile(fileBuffer, mimeType, fileName, onProgress) {
  const sdk = getSdk();
  if (!sdk) throw new Error("Wallet not connected");

  onProgress(0, `Creating HCS-1 topic for ${fileName}...`);

  const topicId = await createTopic(`HCS-1 inscription: ${fileName}`);
  onProgress(10, `Topic created: ${topicId}`);

  // Header
  const header = JSON.stringify({
    p: "hcs-1",
    op: "register",
    t_id: topicId,
    m: fileName,
    type: mimeType,
  });
  await submitChunk(topicId, header);
  onProgress(15, "Sent inscription header — approve in wallet");

  // Chunks
  const chunks = chunkBuffer(new Uint8Array(fileBuffer));
  for (let i = 0; i < chunks.length; i++) {
    const pct = Math.round(15 + ((i + 1) / chunks.length) * 70);
    onProgress(pct, `Chunk ${i + 1}/${chunks.length} — approve in wallet`);
    await submitChunk(topicId, chunks[i]);
  }

  // End sentinel
  await submitChunk(
    topicId,
    JSON.stringify({ p: "hcs-1", op: "end", t_id: topicId })
  );
  onProgress(90, "Image inscription complete");

  const hrl = `hcs://1/${topicId}`;
  return { topicId, hrl, chunkCount: chunks.length };
}

/**
 * Inscribe a JSON object to HCS-1.
 * Returns: { topicId, hrl }
 */
export async function inscribeJSON(obj, onProgress) {
  const sdk = getSdk();
  if (!sdk) throw new Error("Wallet not connected");

  onProgress(0, "Creating HCS-1 topic for metadata JSON...");

  const topicId = await createTopic("HCS-1 inscription: metadata.json");
  onProgress(30, `Metadata topic created: ${topicId}`);

  await submitChunk(
    topicId,
    JSON.stringify({
      p: "hcs-1",
      op: "register",
      t_id: topicId,
      m: "metadata.json",
      type: "application/json",
    })
  );
  onProgress(50, "Sent metadata header — approve in wallet");

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  await submitChunk(topicId, encoded);
  onProgress(80, "Metadata content sent");

  await submitChunk(
    topicId,
    JSON.stringify({ p: "hcs-1", op: "end", t_id: topicId })
  );
  onProgress(95, "Metadata inscription complete");

  const hrl = `hcs://1/${topicId}`;
  return { topicId, hrl };
}

/**
 * Create a new HTS NonFungibleUnique token.
 * Returns tokenId string.
 */
export async function createNFTToken({ name, symbol, maxSupply, supplyType }) {
  const sdk = getSdk();
  const accountId = getAccountId();
  if (!sdk) throw new Error("Wallet not connected");

  const { TokenCreateTransaction, TokenType, TokenSupplyType } = await import(
    "@hashgraph/sdk"
  );

  const tx = new TokenCreateTransaction()
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
    .setTreasuryAccountId(accountId);

  const receipt = await execTx(tx);

  if (!receipt?.tokenId) {
    throw new Error(
      `createNFTToken failed — no tokenId in receipt: ${JSON.stringify(
        receipt
      )}`
    );
  }

  return receipt.tokenId.toString();
}

/**
 * Mint NFT serials with the given metadata HRL.
 * Returns array of serial number strings.
 */
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

  if (!receipt?.serials) {
    throw new Error(
      `mintNFT failed — no serials in receipt: ${JSON.stringify(receipt)}`
    );
  }

  return receipt.serials.map((s) => s.toString());
}

/**
 * Fetch NFT info from Hedera Mirror Node.
 */
export async function fetchNFTFromMirror(tokenId, serial) {
  const base = mirror();

  const nftRes = await fetch(`${base}/tokens/${tokenId}/nfts/${serial}`);
  if (!nftRes.ok)
    throw new Error(
      `NFT not found: ${tokenId}/${serial} (HTTP ${nftRes.status})`
    );
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
    const topicId = metadataHRL.split("/")[2];
    metaJson = await fetchHCSContent(topicId);
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

/**
 * Fetch and reassemble content from an HCS-1 topic via Mirror Node.
 */
export async function fetchHCSContent(topicId) {
  const base = mirror();
  const res = await fetch(
    `${base}/topics/${topicId}/messages?limit=100&order=asc`
  );
  if (!res.ok) throw new Error(`Topic not found: ${topicId}`);
  const data = await res.json();

  const messages = data.messages || [];
  let assembled = "";

  for (const msg of messages) {
    try {
      const decoded = atob(msg.message);
      const parsed = JSON.parse(decoded);
      if (parsed.op === "register" || parsed.op === "end") continue;
      return parsed;
    } catch {
      try {
        assembled += atob(msg.message);
      } catch {
        assembled += msg.message;
      }
    }
  }

  try {
    return JSON.parse(assembled);
  } catch {
    return assembled;
  }
}
