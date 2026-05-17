/**
 * hedera.js — Real Hedera transactions via WalletConnect
 *
 * Key fix in batchSignAndBroadcast:
 * - Use signer._getHederaClient() for BOTH signing and broadcasting
 * - This ensures the same nodes are used for signing and execution
 * - Avoids INVALID_SIGNATURE from node account ID mismatch
 */

import { getSdk, getAccountId, getNetwork } from './wallet.js'

const MIRROR = {
  testnet: 'https://testnet.mirrornode.hedera.com/api/v1',
  mainnet:  'https://mainnet.mirrornode.hedera.com/api/v1',
}

function mirrorBase() { return MIRROR[getNetwork()] || MIRROR.testnet }

const CHUNK_SIZE = 4096

// ─── IMAGE RESIZE ─────────────────────────────────────────────────────────────

export async function resizeImage(file, targetSize = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetSize, targetSize)
      const scale = Math.min(targetSize / img.width, targetSize / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (targetSize - w) / 2, (targetSize - h) / 2, w, h)
      const mimeOut = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
      canvas.toBlob(blob => {
        if (!blob) reject(new Error('Canvas resize failed'))
        else resolve({ blob, mimeType: mimeOut })
      }, mimeOut, 0.92)
    }
    img.onerror = () => reject(new Error('Failed to load image for resize'))
    img.src = url
  })
}

// ─── CHUNKING ─────────────────────────────────────────────────────────────────

function chunkBuffer(buf) {
  const chunks = []
  let offset = 0
  while (offset < buf.byteLength) {
    const slice = buf.slice(offset, offset + CHUNK_SIZE)
    chunks.push(btoa(String.fromCharCode(...new Uint8Array(slice))))
    offset += CHUNK_SIZE
  }
  return chunks
}

function generateInscriptionId(prefix = 'ins') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── SIGNER ───────────────────────────────────────────────────────────────────

function getSigner() {
  const sdk = getSdk()
  if (!sdk) throw new Error('Wallet not connected')
  const accountInfo = sdk.getAccountInfo?.()
  const accountId = accountInfo?.accountId
  const signers = sdk.dAppConnector?.signers
  if (!signers?.length) throw new Error('No signers — reconnect wallet')
  return accountId
    ? (signers.find(s => s.getAccountId().toString() === accountId) ?? signers[0])
    : signers[0]
}

/**
 * Execute a single transaction through WalletConnect (one wallet approval).
 */
async function execTx(tx) {
  const signer = getSigner()
  const { AccountId, Client } = await import('@hashgraph/sdk')

  if (typeof tx.setAutoRenewAccountId === 'function') {
    tx.setAutoRenewAccountId(AccountId.fromString(signer.getAccountId().toString()))
  }

  await signer.populateTransaction(tx)
  const response = await tx.executeWithSigner(signer)
  const client = getNetwork() === 'mainnet' ? Client.forMainnet() : Client.forTestnet()
  return response.getReceipt(client)
}

/**
 * BATCH SIGN AND BROADCAST
 *
 * Critical fix: use the signer's own internal Hedera client (_getHederaClient)
 * for BOTH signing and executing. This ensures the node account IDs selected
 * during freezeWith/signTransaction are the same nodes used during execute(),
 * avoiding INVALID_SIGNATURE from node mismatches.
 *
 * Flow:
 * 1. Get signer's internal client (has correct network + node list)
 * 2. Populate transaction IDs via signer.populateTransaction
 * 3. signTransaction freezes with the signer's client → picks nodes
 * 4. execute(signerClient) → broadcasts to SAME nodes → signature valid ✓
 */
async function batchSignAndBroadcast(transactions, onProgress, baseLabel) {
  const signer = getSigner()
  const { AccountId } = await import('@hashgraph/sdk')
  const accountIdStr = signer.getAccountId().toString()

  // Use the signer's own internal Hedera client for consistent node selection
  // This is the same client used internally by signTransaction()
  const signerClient = signer._getHederaClient()

  onProgress(0, `Preparing ${transactions.length} transactions...`)

  // Step 1: Set autoRenewAccountId and populate transaction IDs
  for (const tx of transactions) {
    if (typeof tx.setAutoRenewAccountId === 'function') {
      tx.setAutoRenewAccountId(AccountId.fromString(accountIdStr))
    }
    await signer.populateTransaction(tx)
  }

  onProgress(10, `Sign all ${transactions.length} — approve in wallet...`)

  // Step 2: Sign each transaction
  // signer.signTransaction internally calls freezeWith(signerClient) which
  // assigns specific node account IDs from that client's network
  const signed = []
  for (let i = 0; i < transactions.length; i++) {
    const signedTx = await signer.signTransaction(transactions[i])
    signed.push(signedTx)
    const pct = Math.round(10 + ((i + 1) / transactions.length) * 60)
    onProgress(pct, `Signed ${i + 1}/${transactions.length} — ${baseLabel}`)
  }

  onProgress(75, `Broadcasting ${signed.length} transactions...`)

  // Step 3: Execute via THE SAME signer client
  // The signed transaction has node IDs locked to nodes in signerClient's network.
  // Using signerClient guarantees execute() sends to those same nodes.
  const receipts = []
  for (let i = 0; i < signed.length; i++) {
    const response = await signed[i].execute(signerClient)
    const receipt = await response.getReceipt(signerClient)
    receipts.push(receipt)
    const pct = Math.round(75 + ((i + 1) / signed.length) * 22)
    onProgress(pct, `Confirmed ${i + 1}/${signed.length}`)
  }

  onProgress(98, 'All confirmed ✓')
  return receipts
}

// ─── TOPIC ────────────────────────────────────────────────────────────────────

export async function createCollectionTopic(collectionName) {
  const { TopicCreateTransaction } = await import('@hashgraph/sdk')
  const tx = new TopicCreateTransaction().setTopicMemo(`Hashinal Collection: ${collectionName}`)
  const receipt = await execTx(tx)
  if (!receipt?.topicId) throw new Error('Failed to create collection topic')
  return receipt.topicId.toString()
}

// ─── INSCRIPTION ──────────────────────────────────────────────────────────────

export async function inscribeFileToTopic(topicId, fileBuffer, mimeType, fileName, onProgress) {
  const { TopicMessageSubmitTransaction } = await import('@hashgraph/sdk')
  const inscriptionId = generateInscriptionId('img')

  onProgress(0, 'Preparing image inscription...')

  const chunks = chunkBuffer(new Uint8Array(fileBuffer))
  const txs = []

  // Header
  txs.push(new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify({
      p: 'hcs-1', op: 'register', t_id: topicId,
      inscription_id: inscriptionId, m: fileName, type: mimeType,
    }))
  )

  // Data chunks
  for (let i = 0; i < chunks.length; i++) {
    txs.push(new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify({
        p: 'hcs-1', op: 'data', t_id: topicId,
        inscription_id: inscriptionId,
        chunk: i + 1, total_chunks: chunks.length, data: chunks[i],
      }))
    )
  }

  // End sentinel
  txs.push(new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify({
      p: 'hcs-1', op: 'end', t_id: topicId,
      inscription_id: inscriptionId, total_chunks: chunks.length,
    }))
  )

  onProgress(5, `${txs.length} transactions ready — approve in wallet...`)
  await batchSignAndBroadcast(txs, onProgress, 'image chunk')
  onProgress(100, 'Image inscribed ✓')

  const hrl = `hcs://1/${topicId}?inscription_id=${inscriptionId}`
  return { inscriptionId, hrl, chunkCount: chunks.length }
}

export async function inscribeMetadataToTopic(topicId, metadataObj, onProgress) {
  const { TopicMessageSubmitTransaction } = await import('@hashgraph/sdk')
  const inscriptionId = generateInscriptionId('meta')
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(metadataObj))))

  onProgress(0, 'Preparing metadata inscription...')

  const txs = [
    new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(JSON.stringify({
      p: 'hcs-1', op: 'register', t_id: topicId,
      inscription_id: inscriptionId, m: 'metadata.json', type: 'application/json',
    })),
    new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(JSON.stringify({
      p: 'hcs-1', op: 'data', t_id: topicId,
      inscription_id: inscriptionId, chunk: 1, total_chunks: 1, data: encoded,
    })),
    new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(JSON.stringify({
      p: 'hcs-1', op: 'end', t_id: topicId,
      inscription_id: inscriptionId, total_chunks: 1,
    })),
  ]

  onProgress(5, 'Approve metadata inscription in wallet...')
  await batchSignAndBroadcast(txs, onProgress, 'metadata')
  onProgress(100, 'Metadata inscribed ✓')

  const hrl = `hcs://1/${topicId}?inscription_id=${inscriptionId}`
  return { inscriptionId, hrl }
}

// ─── KEY MANAGEMENT ───────────────────────────────────────────────────────────

export async function generateKeyPair() {
  const { PrivateKey } = await import('@hashgraph/sdk')
  const privateKey = PrivateKey.generateED25519()
  return {
    privateKey: privateKey.toString(),
    publicKey: privateKey.publicKey.toString(),
  }
}

export function downloadKeyFile(keyData, role, filename) {
  const content = [
    '# Hashinal Forge — Generated Key',
    `# Role: ${role}`,
    '# Keep this file safe. Anyone with the private key controls this token role.',
    '# Generated: ' + new Date().toISOString(),
    '',
    'PRIVATE_KEY=' + keyData.privateKey,
    'PUBLIC_KEY=' + keyData.publicKey,
    '',
    `# Node.js usage:`,
    `# const ${role}Key = PrivateKey.fromString(process.env.${role.toUpperCase()}_PRIVATE_KEY)`,
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `hashinal-${role}-key.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── TOKEN CREATION ───────────────────────────────────────────────────────────

export async function createNFTCollection({ name, symbol, maxSupply, supplyType, collectionTopicId, keys = {} }) {
  const sdk = getSdk()
  const operatorAccountId = getAccountId()
  if (!sdk) throw new Error('Wallet not connected')

  const { TokenCreateTransaction, TokenType, TokenSupplyType, PrivateKey, AccountId } = await import('@hashgraph/sdk')
  const signer = getSigner()

  const resolveKey = async (keyStr) => {
    if (!keyStr) return null
    return PrivateKey.fromString(keyStr).publicKey
  }

  let walletPublicKey = null
  try { walletPublicKey = signer.getAccountKey?.() } catch { /* ignore */ }

  const supplyKey   = keys.supplyKey   ? await resolveKey(keys.supplyKey)   : (keys.enableSupply   !== false ? walletPublicKey : null)
  const adminKey    = keys.adminKey    ? await resolveKey(keys.adminKey)    : (keys.enableAdmin    ? walletPublicKey : null)
  const freezeKey   = keys.freezeKey   ? await resolveKey(keys.freezeKey)   : (keys.enableFreeze   ? walletPublicKey : null)
  const pauseKey    = keys.pauseKey    ? await resolveKey(keys.pauseKey)    : (keys.enablePause    ? walletPublicKey : null)
  const wipeKey     = keys.wipeKey     ? await resolveKey(keys.wipeKey)     : (keys.enableWipe     ? walletPublicKey : null)
  const kycKey      = keys.kycKey      ? await resolveKey(keys.kycKey)      : (keys.enableKyc      ? walletPublicKey : null)
  const metadataKey = keys.metadataKey ? await resolveKey(keys.metadataKey) : (keys.enableMetadata ? walletPublicKey : null)

  let tx = new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setMaxSupply(maxSupply || 0)
    .setSupplyType(supplyType === 'INFINITE' ? TokenSupplyType.Infinite : TokenSupplyType.Finite)
    .setTreasuryAccountId(AccountId.fromString(operatorAccountId))
    .setTokenMemo(collectionTopicId ? `hcs://1/${collectionTopicId}` : '')

  if (supplyKey)   tx = tx.setSupplyKey(supplyKey)
  if (adminKey)    tx = tx.setAdminKey(adminKey)
  if (freezeKey)   tx = tx.setFreezeKey(freezeKey)
  if (pauseKey)    tx = tx.setPauseKey(pauseKey)
  if (wipeKey)     tx = tx.setWipeKey(wipeKey)
  if (kycKey)      tx = tx.setKycKey(kycKey)
  if (metadataKey && typeof tx.setMetadataKey === 'function') {
    tx = tx.setMetadataKey(metadataKey)
  }

  const receipt = await execTx(tx)
  if (!receipt?.tokenId) throw new Error('Token creation failed')
  return receipt.tokenId.toString()
}

export async function mintNFT(tokenId, metadataHRL, count = 1) {
  const sdk = getSdk()
  if (!sdk) throw new Error('Wallet not connected')

  const { TokenMintTransaction } = await import('@hashgraph/sdk')
  const metadataBuffers = Array(count).fill(new TextEncoder().encode(metadataHRL))

  const tx = new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata(metadataBuffers)

  const receipt = await execTx(tx)
  if (!receipt?.serials) throw new Error('Mint failed — no serials')
  return receipt.serials.map(s => s.toString())
}

// ─── APPROVAL ESTIMATOR ───────────────────────────────────────────────────────

export function estimateApprovals({ fileSizeBytes, isNewTopic, isNewToken, mintCount = 1 }) {
  let approvals = 0
  if (isNewTopic) approvals += 1  // create topic
  approvals += 1                   // image batch (1 signing session)
  approvals += 1                   // metadata batch (1 signing session)
  if (isNewToken) approvals += 1   // create token
  approvals += mintCount           // mint
  return approvals
}

export function estimateChunks(fileSizeBytes) {
  return Math.ceil(fileSizeBytes / CHUNK_SIZE)
}

// ─── VIEWER ───────────────────────────────────────────────────────────────────

export async function fetchNFTFromMirror(tokenId, serial) {
  const base = mirrorBase()

  const nftRes = await fetch(`${base}/tokens/${tokenId}/nfts/${serial}`)
  if (!nftRes.ok) throw new Error(`NFT not found: ${tokenId}/${serial}`)
  const nftData = await nftRes.json()

  const metadataRaw = nftData.metadata
  let metadataHRL = ''
  if (metadataRaw) {
    try { metadataHRL = atob(metadataRaw) } catch { metadataHRL = metadataRaw }
  }

  const tokenRes = await fetch(`${base}/tokens/${tokenId}`)
  const tokenData = tokenRes.ok ? await tokenRes.json() : {}

  let metaJson = null
  if (metadataHRL.startsWith('hcs://')) {
    const url = new URL(metadataHRL.replace('hcs://', 'https://hcs/'))
    const parts = url.pathname.split('/').filter(Boolean)
    const topicId = parts[parts.length - 1]
    const inscriptionId = url.searchParams.get('inscription_id')
    metaJson = await fetchHCSContent(topicId, inscriptionId)
  }

  return {
    tokenId, serial, metadataHRL, metaJson,
    tokenName: tokenData.name, tokenSymbol: tokenData.symbol,
    createdTimestamp: nftData.created_timestamp, accountId: nftData.account_id,
  }
}

export async function fetchHCSContent(topicId, inscriptionId = null) {
  const base = mirrorBase()
  const res = await fetch(`${base}/topics/${topicId}/messages?limit=200&order=asc`)
  if (!res.ok) throw new Error(`Topic not found: ${topicId}`)
  const data = await res.json()

  const chunks = {}
  for (const msg of data.messages || []) {
    try {
      const decoded = atob(msg.message)
      const parsed = JSON.parse(decoded)
      if (inscriptionId && parsed.inscription_id !== inscriptionId) continue
      if (parsed.op === 'register' || parsed.op === 'end') continue
      if (parsed.op === 'data' && parsed.data) chunks[parsed.chunk || 1] = parsed.data
    } catch {
      if (!inscriptionId) chunks[Object.keys(chunks).length + 1] = msg.message
    }
  }

  const assembled = Object.keys(chunks)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(k => chunks[k]).join('')

  if (!assembled) return null
  try { return JSON.parse(decodeURIComponent(escape(atob(assembled)))) }
  catch { try { return JSON.parse(assembled) } catch { return assembled } }
}
