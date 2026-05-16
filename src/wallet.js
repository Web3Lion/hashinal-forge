/**
 * wallet.js — Manages HashPack / WalletConnect connection
 * Uses @hashgraphonline/hashinal-wc
 */

let sdk = null
let connected = false
let accountId = null
let network = 'testnet'

export function getAccountId() { return accountId }
export function isConnected() { return connected }
export function getNetwork() { return network }
export function getSdk() { return sdk }

export async function initWallet(projectId, net = 'testnet') {
  network = net

  const { HashinalsWalletConnectSDK } = await import('@hashgraphonline/hashinal-wc')

  sdk = HashinalsWalletConnectSDK.getInstance()

  // Pass network as a plain string — NOT a LedgerId object
  await sdk.init(
    projectId,
    {
      name: 'Hashinal Forge',
      description: 'Mint HCS-5 Hashinal NFTs on Hedera',
      url: window.location.href,
      icons: ['https://hol.org/Logo_Icon.webp'],
    },
    net  // <-- plain string: 'testnet' or 'mainnet'
  )

  return sdk
}

export async function connectWallet(projectId, net, onStatusChange) {
  try {
    onStatusChange('Initializing WalletConnect...')
    await initWallet(projectId, net)

    onStatusChange('Opening wallet — approve the connection request...')
    const session = await sdk.connect()

    if (!session) throw new Error('Connection cancelled or timed out')

    onStatusChange('Fetching account info...')

    // getAccountInfo may return an object or just an accountId string depending on version
    let resolvedAccountId
    try {
      const info = await sdk.getAccountInfo()
      resolvedAccountId = info?.accountId
        ? info.accountId.toString()
        : info.toString()
    } catch {
      // Fallback: pull from the session accounts list
      const accounts = session?.namespaces?.hedera?.accounts || []
      const raw = accounts[0] || ''
      // Format is "hedera:testnet:0.0.12345" — take the last segment
      resolvedAccountId = raw.split(':').pop()
    }

    accountId = resolvedAccountId
    connected = true

    onStatusChange(`Connected: ${accountId}`)
    return { accountId, network: net }
  } catch (err) {
    connected = false
    accountId = null
    throw err
  }
}

export async function disconnectWallet() {
  if (sdk) {
    try { await sdk.disconnect() } catch { /* ignore */ }
  }
  connected = false
  accountId = null
  sdk = null
}

export async function getBalance() {
  if (!sdk || !connected) return null
  try {
    return await sdk.getAccountBalance()
  } catch {
    return null
  }
}
