/**
 * wallet.js — Manages HashPack / WalletConnect connection
 *
 * Root cause fix: HashinalsWalletConnectSDK uses localStorage to persist
 * the connected accountId between init() and executeTransaction(). In iframe
 * environments (CodeSandbox, embedded previews) localStorage is blocked.
 * We patch it with a fallback in-memory store so the SDK can read/write
 * connection info normally.
 */

// ─── PATCH localStorage FOR IFRAME ENVIRONMENTS ──────────────────────────────
// Must run before any SDK import. If localStorage is blocked, all reads return
// null and executeTransaction() fails with "t38.startsWith is not a function"
// because getAccountInfo() returns null and the signer lookup fails.
;(function patchLocalStorage() {
  const store = {}
  let broken = false

  try {
    localStorage.setItem('__test__', '1')
    localStorage.removeItem('__test__')
  } catch {
    broken = true
  }

  if (!broken) {
    // Also test that reads actually work (some iframes silently fail)
    try {
      localStorage.setItem('__test2__', 'x')
      const val = localStorage.getItem('__test2__')
      localStorage.removeItem('__test2__')
      if (val !== 'x') broken = true
    } catch {
      broken = true
    }
  }

  if (broken) {
    console.warn('[wallet] localStorage unavailable — using in-memory fallback')
    const mock = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) },
      key: (i) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length },
    }
    try {
      Object.defineProperty(window, 'localStorage', {
        value: mock, writable: false, configurable: true,
      })
    } catch {
      window.localStorage = mock
    }
  }
})()

// ─── STATE ────────────────────────────────────────────────────────────────────
let sdk = null
let connected = false
let accountId = null
let network = 'testnet'

export function getAccountId() { return accountId }
export function isConnected() { return connected }
export function getNetwork() { return network }
export function getSdk() { return sdk }

// ─── CONNECT ─────────────────────────────────────────────────────────────────
export async function connectWallet(projectId, net, onStatusChange) {
  network = net

  try {
    onStatusChange('Loading WalletConnect SDK...')
    const { HashinalsWalletConnectSDK } = await import('@hashgraphonline/hashinal-wc')
    const { LedgerId } = await import('@hashgraph/sdk')

    sdk = HashinalsWalletConnectSDK.getInstance()

    const ledgerId = net === 'mainnet' ? LedgerId.MAINNET : LedgerId.TESTNET

    onStatusChange('Opening wallet — approve the connection request...')

    // Use connectWallet() which handles init + connect + saveConnectionInfo
    // in one call, ensuring the accountId is saved before executeTransaction
    const result = await sdk.connectWallet(
      projectId,
      {
        name: 'Hashinal Forge',
        description: 'Mint HCS-5 Hashinal NFTs on Hedera',
        url: window.location.href,
        icons: ['https://hol.org/Logo_Icon.webp'],
      },
      ledgerId
    )

    if (!result?.accountId) {
      throw new Error('Connection succeeded but no accountId returned')
    }

    accountId = result.accountId.toString()
    connected = true

    onStatusChange(`Connected: ${accountId}`)
    return { accountId, network: net }

  } catch (err) {
    connected = false
    accountId = null
    sdk = null
    throw err
  }
}

// ─── DISCONNECT ───────────────────────────────────────────────────────────────
export async function disconnectWallet() {
  if (sdk) {
    try { await sdk.disconnectWallet() } catch { /* ignore */ }
  }
  connected = false
  accountId = null
  sdk = null
}

export async function getBalance() {
  if (!sdk || !connected) return null
  try { return await sdk.getAccountBalance() } catch { return null }
}
