/**
 * hedera.js — Real Hedera transactions via WalletConnect + standards-sdk
 *
 * Flow:
 *   1. Inscribe image  → imageTopicId  → imageHRL
 *   2. Build metadata JSON referencing imageHRL
 *   3. Inscribe metadata JSON → metaTopicId → metadataHRL
 *   4. (optional) Create HTS NFT token collection
 *   5. Mint NFT with metadataHRL as on-chain metadata bytes
 */

import { getSdk, getAccountId, getNetwork } from './wallet.js'

// Mirror node base URLs
const MIRROR = {
  testnet: 'https://testnet.mirrornode.hedera.com/api/v1',
  mainnet: 'https://mainnet.mirrornode.hedera.com/api/v1',
}

function mirror() {
  return MIRROR[getNetwork()] || MIRROR.testnet
}

/**
 * Chunk a Uint8Array into base64 strings of at most `chunkBytes` bytes each.
 * HCS messages are limited to ~1KB of base64 safely; we use 800 bytes.
 */
function chunkBuffer(buf, chunkBytes = 800) {
  const chunks = []
  let offset = 0
  while (offset < buf.byteLength) {
    const slice = buf.slice(offset, offset + chunkBytes)
    chunks.push(btoa(String.fromCharCode(...new Uint8Array(slice))))
    offset += chunkBytes
  }
  return chunks
}

/**
 * Create a new HCS-1 topic (no keys — public topic).
 * Returns topicId string e.g. "0.0.123456"
 */
async function createTopic(memo) {
  const sdk = getSdk()
  const topicId = await sdk.createTopic(memo)
  // Ensure we always return a plain string regardless of what the SDK returns
  return topicId.toString()
}

/**
 * Submit a single chunk to a topic.
 */
async function submitChunk(topicId, message) {
  const sdk = getSdk()
  await sdk.submitMessageToTopic(topicId.toString(), message)
}

/**
 * Inscribe a file (Uint8Array) to HCS-1.
 * Creates a topic, sends all chunks as separate messages.
 * Returns: { topicId, hrl, chunkCount }
 */
export async function inscribeFile(fileBuffer, mimeType, fileName, onProgress) {
  const sdk = getSdk()
  if (!sdk) throw new Error('Wallet not connected')

  onProgress(0, `Creating HCS-1 topic for ${fileName}...`)

  // 1. Create topic
  const topicId = await createTopic(`HCS-1 inscription: ${fileName}`)
  onProgress(10, `Topic created: ${topicId}`)

  // 2. Send HCS-1 header message so indexers know this is an inscription
  const header = JSON.stringify({
    p: 'hcs-1',
    op: 'register',
    t_id: topicId,
    m: fileName,
    type: mimeType,
  })
  await submitChunk(topicId, header)
  onProgress(15, 'Sent inscription header')

  // 3. Chunk the file and send
  const chunks = chunkBuffer(new Uint8Array(fileBuffer))
  for (let i = 0; i < chunks.length; i++) {
    const pct = Math.round(15 + ((i + 1) / chunks.length) * 70)
    onProgress(pct, `Sending chunk ${i + 1}/${chunks.length} — approve in wallet`)
    await submitChunk(topicId, chunks[i])
  }

  // 4. Send end sentinel
  await submitChunk(topicId, JSON.stringify({ p: 'hcs-1', op: 'end', t_id: topicId }))
  onProgress(90, 'Inscription complete')

  const hrl = `hcs://1/${topicId}`
  return { topicId, hrl, chunkCount: chunks.length }
}

/**
 * Inscribe a JSON object to HCS-1.
 * Returns: { topicId, hrl }
 */
export async function inscribeJSON(obj, onProgress) {
  const sdk = getSdk()
  if (!sdk) throw new Error('Wallet not connected')

  const json = JSON.stringify(obj)
  onProgress(0, 'Creating HCS-1 topic for metadata JSON...')

  const topicId = await createTopic('HCS-1 inscription: metadata.json')
  onProgress(30, `Metadata topic created: ${topicId}`)

  // Header
  await submitChunk(topicId, JSON.stringify({
    p: 'hcs-1',
    op: 'register',
    t_id: topicId,
    m: 'metadata.json',
    type: 'application/json',
  }))
  onProgress(50, 'Sent metadata header — approve in wallet')

  // Metadata as base64
  const encoded = btoa(unescape(encodeURIComponent(json)))
  await submitChunk(topicId, encoded)
  onProgress(80, 'Metadata inscribed')

  // End sentinel
  await submitChunk(topicId, JSON.stringify({ p: 'hcs-1', op: 'end', t_id: topicId }))
  onProgress(95, 'Metadata inscription complete')

  const hrl = `hcs://1/${topicId}`
  return { topicId, hrl }
}

/**
 * Create a new HTS NonFungibleUnique token.
 * The connected wallet account becomes the supply key holder.
 * Returns tokenId string.
 */
export async function createNFTToken({ name, symbol, maxSupply, supplyType }) {
  const sdk = getSdk()
  const accountId = getAccountId()
  if (!sdk) throw new Error('Wallet not connected')

  const {
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
  } = await import('@hashgraph/sdk')

  const tx = new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setMaxSupply(maxSupply || 0)
    .setSupplyType(supplyType === 'INFINITE' ? TokenSupplyType.Infinite : TokenSupplyType.Finite)
    .setTreasuryAccountId(accountId)

  const receipt = await sdk.executeTransaction(tx)
  return receipt.tokenId.toString()
}

/**
 * Mint one or more NFT serials with the given metadata HRL.
 * Returns array of serial numbers.
 */
export async function mintNFT(tokenId, metadataHRL, count = 1) {
  const sdk = getSdk()
  if (!sdk) throw new Error('Wallet not connected')

  const { TokenMintTransaction } = await import('@hashgraph/sdk')

  const metadataBuffers = Array(count).fill(
    new TextEncoder().encode(metadataHRL)
  )

  const tx = new TokenMintTransaction()
    .setTokenId(tokenId.toString())
    .setMetadata(metadataBuffers)

  const receipt = await sdk.executeTransaction(tx)
  return receipt.serials.map(s => s.toString())
}

/**
 * Fetch NFT info from Hedera Mirror Node.
 * Returns { metadata (decoded), tokenInfo }
 */
export async function fetchNFTFromMirror(tokenId, serial) {
  const base = mirror()

  // Get the NFT serial info
  const nftRes = await fetch(`${base}/tokens/${tokenId}/nfts/${serial}`)
  if (!nftRes.ok) throw new Error(`NFT not found: ${tokenId}/${serial}`)
  const nftData = await nftRes.json()

  // Decode metadata bytes → HRL string
  const metadataRaw = nftData.metadata
  let metadataHRL = ''
  if (metadataRaw) {
    try {
      metadataHRL = atob(metadataRaw)
    } catch {
      metadataHRL = metadataRaw
    }
  }

  // Get token info
  const tokenRes = await fetch(`${base}/tokens/${tokenId}`)
  const tokenData = tokenRes.ok ? await tokenRes.json() : {}

  // Resolve the metadata JSON from the HRL if it's an hcs:// reference
  let metaJson = null
  if (metadataHRL.startsWith('hcs://')) {
    const topicId = metadataHRL.split('/')[2]
    metaJson = await fetchHCSContent(topicId)
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
  }
}

/**
 * Fetch and reassemble content from an HCS-1 topic via Mirror Node.
 * Skips header/end control messages, reassembles base64 content chunks.
 * Returns parsed JSON if valid, otherwise raw string.
 */
export async function fetchHCSContent(topicId) {
  const base = mirror()
  const res = await fetch(`${base}/topics/${topicId}/messages?limit=100&order=asc`)
  if (!res.ok) throw new Error(`Topic not found: ${topicId}`)
  const data = await res.json()

  const messages = data.messages || []
  let assembled = ''

  for (const msg of messages) {
    try {
      const decoded = atob(msg.message)
      // Skip JSON control messages (header / end sentinel)
      const parsed = JSON.parse(decoded)
      if (parsed.op === 'register' || parsed.op === 'end') continue
      // If it's valid JSON that's not a control message, return it
      return parsed
    } catch {
      // Not JSON — it's a base64 data chunk
      try {
        assembled += atob(msg.message)
      } catch {
        // raw string chunk
        assembled += msg.message
      }
    }
  }

  // Try to parse assembled content as JSON (metadata)
  try {
    return JSON.parse(assembled)
  } catch {
    return assembled
  }
}
