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
  const { LedgerId } = await import('@hashgraph/sdk')

  sdk = HashinalsWalletConnectSDK.getInstance()

  const ledgerId = net === 'mainnet' ? LedgerId.MAINNET : LedgerId.TESTNET

  await sdk.init(
    projectId,
    {
      name: 'Hashinal Forge',
      description: 'Mint HCS-5 Hashinal NFTs on Hedera',
      url: window.location.href,
      icons: ['https://hol.org/Logo_Icon.webp'],
    },
    ledgerId
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
    const info = await sdk.getAccountInfo()
    accountId = info.accountId
    connected = true

    onStatusChange(`Connected: ${accountId}`)
    return { accountId, network: info.network }
  } catch (err) {
    connected = false
    accountId = null
    throw err
  }
}

export async function disconnectWallet() {
  if (sdk) await sdk.disconnect()
  connected = false
  accountId = null
  sdk = null
}

export async function getBalance() {
  if (!sdk || !connected) return null
  return sdk.getAccountBalance()
}
