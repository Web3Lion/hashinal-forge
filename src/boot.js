/**
 * boot.js — Wires all UI interactions and drives the minting flow.
 * Imports wallet.js and hedera.js for real network transactions.
 */

import {
  connectWallet, disconnectWallet, isConnected, getAccountId, getNetwork,
} from './wallet.js'
import {
  inscribeFile, inscribeJSON, createNFTToken, mintNFT, fetchNFTFromMirror,
} from './hedera.js'

// ─── APP STATE ───────────────────────────────────────────────────────────────
const S = {
  network: 'testnet',
  mintStep: 1,
  file: null, fileBuf: null, fileMime: null, fileName: null,
  attrs: [],
  tokenMode: 'new',
  // Results stored between steps
  imageHRL: null,
  metadataHRL: null,
  tokenId: null,
}

// ─── BOOT ────────────────────────────────────────────────────────────────────
export function boot() {
  wireNav()
  wireWallet()
  wireMint()
  wireViewer()
  wireDirections()
  updateWalletUI()
  addDefaultAttrs()
  updateMetaPreview()
  updateCost()
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function wireNav() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page))
  })
  document.querySelectorAll('[data-page]').forEach(btn => {
    if (!btn.classList.contains('nav-tab')) {
      btn.addEventListener('click', () => showPage(btn.dataset.page))
    }
  })
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'))
  const page = document.getElementById(`page-${id}`)
  const tab = document.querySelector(`.nav-tab[data-page="${id}"]`)
  if (page) page.classList.add('active')
  if (tab) tab.classList.add('active')
}

// ─── WALLET ──────────────────────────────────────────────────────────────────
function wireWallet() {
  const btn = document.getElementById('walletBtn')
  const modal = document.getElementById('walletModal')
  const closeBtn = document.getElementById('modalClose')
  const netPill = document.getElementById('netPill')

  btn.addEventListener('click', () => {
    if (isConnected()) {
      disconnectWallet().then(updateWalletUI)
    } else {
      modal.style.display = 'flex'
    }
  })

  closeBtn.addEventListener('click', () => { modal.style.display = 'none' })
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none' })

  netPill.addEventListener('click', () => {
    S.network = S.network === 'testnet' ? 'mainnet' : 'testnet'
    updateNetUI()
  })

  document.querySelectorAll('.wallet-option').forEach(opt => {
    opt.addEventListener('click', () => handleWalletConnect())
  })
}

async function handleWalletConnect() {
  const projectId = document.getElementById('wcProjectId').value.trim()
  if (!projectId) {
    alert('Please enter your WalletConnect Project ID.\n\nGet one free at https://cloud.walletconnect.com')
    return
  }

  const opts = document.getElementById('walletOptions')
  const connecting = document.getElementById('walletConnecting')
  const msgEl = document.getElementById('connectingMsg')

  opts.style.display = 'none'
  connecting.style.display = 'block'

  try {
    const result = await connectWallet(projectId, S.network, (msg) => {
      msgEl.textContent = msg
    })

    document.getElementById('walletModal').style.display = 'none'
    updateWalletUI()
    updateWalletGate()
    log(`Wallet connected: ${result.accountId}`, 'ok')
  } catch (err) {
    alert(`Connection failed: ${err.message}`)
  } finally {
    opts.style.display = 'block'
    connecting.style.display = 'none'
  }
}

function updateWalletUI() {
  const btn = document.getElementById('walletBtn')
  const dot = document.getElementById('walletDot')
  const label = document.getElementById('walletBtnLabel')

  if (isConnected()) {
    btn.classList.add('connected')
    dot.style.background = 'var(--accent3)'
    const shortId = getAccountId()
    label.textContent = shortId
  } else {
    btn.classList.remove('connected')
    dot.style.background = 'var(--text-muted)'
    label.textContent = 'Connect Wallet'
  }
  updateWalletGate()
  updateNetUI()
}

function updateWalletGate() {
  const gate = document.getElementById('walletGate')
  if (gate) gate.style.display = isConnected() ? 'none' : 'block'
}

function updateNetUI() {
  document.getElementById('netLabel').textContent = S.network.toUpperCase()
  document.getElementById('netPill').classList.toggle('mainnet', S.network === 'mainnet')
}

// ─── MINT STEP NAV ────────────────────────────────────────────────────────────
function wireMintNav() {
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => gotoStep(parseInt(btn.dataset.goto)))
  })
  document.querySelectorAll('.flow-step').forEach(el => {
    el.addEventListener('click', () => {
      const n = parseInt(el.dataset.step)
      if (n <= S.mintStep) gotoStep(n)
    })
  })
}

function gotoStep(n) {
  S.mintStep = n
  document.querySelectorAll('.mint-panel').forEach(p => p.classList.remove('active'))
  document.getElementById(`mp-${n}`)?.classList.add('active')
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`fstep-${i}`)
    if (!el) continue
    el.classList.remove('active', 'done')
    if (i < n) el.classList.add('done')
    else if (i === n) el.classList.add('active')
  }
  if (n === 2) updateMetaPreview()
  if (n === 3) updateCost()
  if (n === 4) buildSummary()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ─── MINT WIRING ─────────────────────────────────────────────────────────────
function wireMint() {
  wireMintNav()
  wireFileInput()
  wireAttrs()
  wireTokenMode()

  // Step 1 next
  document.getElementById('step1Next')?.addEventListener('click', () => {
    if (!isConnected()) { alert('Connect your wallet first'); return }
    if (!S.file) { alert('Upload your NFT artwork'); return }
    gotoStep(2)
  })

  // Step 2 next
  document.getElementById('step2Next')?.addEventListener('click', () => {
    const name = document.getElementById('m_name')?.value.trim()
    if (!name) { alert('Enter an NFT name'); return }
    gotoStep(3)
  })

  // Step 3 next
  document.getElementById('step3Next')?.addEventListener('click', () => {
    if (S.tokenMode === 'new') {
      const tn = document.getElementById('m_tokenName')?.value.trim()
      const ts = document.getElementById('m_tokenSymbol')?.value.trim()
      if (!tn || !ts) { alert('Enter token name and symbol'); return }
    } else {
      const tid = document.getElementById('m_existingToken')?.value.trim()
      if (!tid?.match(/^0\.0\.\d+$/)) { alert('Enter a valid existing Token ID'); return }
    }
    gotoStep(4)
  })

  // Mint button
  document.getElementById('mintBtn')?.addEventListener('click', startRealMint)

  // Live updates
  ;['m_name','m_creator','m_desc','m_collection','m_cat'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { updateMetaPreview() })
  })
  document.getElementById('m_mintCount')?.addEventListener('input', updateCost)
  document.getElementById('m_network')?.addEventListener('change', e => {
    S.network = e.target.value; updateNetUI()
  })
}

// ─── FILE HANDLING ────────────────────────────────────────────────────────────
function wireFileInput() {
  const drop = document.getElementById('imgDrop')
  const input = document.getElementById('imgInput')
  const clearBtn = document.getElementById('imgClear')

  if (!drop) return

  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover') })
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'))
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('dragover')
    const f = e.dataTransfer?.files?.[0]
    if (f) processFile(f)
  })
  input?.addEventListener('change', e => {
    if (e.target.files?.[0]) processFile(e.target.files[0])
  })
  clearBtn?.addEventListener('click', clearFile)
}

function processFile(file) {
  S.file = file; S.fileMime = file.type; S.fileName = file.name
  const reader = new FileReader()
  reader.onload = e => {
    S.fileBuf = e.target.result
    const preview = document.getElementById('imgPreview')
    if (preview) {
      document.getElementById('imgThumb').src = S.fileBuf
      document.getElementById('imgName').textContent = file.name
      document.getElementById('imgMeta').textContent = `${fmtBytes(file.size)} · ${file.type}`
      preview.classList.add('show')
    }
    updateCost()
  }
  reader.readAsDataURL(file)
}

function clearFile() {
  S.file = null; S.fileBuf = null
  document.getElementById('imgInput').value = ''
  document.getElementById('imgPreview')?.classList.remove('show')
}

// ─── ATTRIBUTES ───────────────────────────────────────────────────────────────
function wireAttrs() {
  document.getElementById('addAttrBtn')?.addEventListener('click', () => addAttr())
}

function addDefaultAttrs() {
  addAttr('Standard', 'HCS-5')
  addAttr('Type', 'Hashinal')
}

function addAttr(t = '', v = '') {
  const id = Date.now() + Math.random()
  S.attrs.push({ id, t, v })
  renderAttrs()
}

function removeAttr(id) {
  S.attrs = S.attrs.filter(a => a.id !== id)
  renderAttrs(); updateMetaPreview()
}

function renderAttrs() {
  const list = document.getElementById('attrList')
  if (!list) return
  list.innerHTML = ''
  S.attrs.forEach(a => {
    const row = document.createElement('div')
    row.className = 'attr-row'
    row.innerHTML = `
      <input type="text" placeholder="Trait type" value="${escHtml(a.t)}"
        oninput="window.__updAttr(${a.id},'t',this.value)" />
      <input type="text" placeholder="Value" value="${escHtml(a.v)}"
        oninput="window.__updAttr(${a.id},'v',this.value)" />
      <button class="attr-remove" onclick="window.__removeAttr(${a.id})">−</button>
    `
    list.appendChild(row)
  })
  // Expose helpers for inline handlers
  window.__updAttr = (id, field, val) => {
    const a = S.attrs.find(x => x.id === id); if (a) a[field] = val; updateMetaPreview()
  }
  window.__removeAttr = removeAttr
}

// ─── METADATA PREVIEW ────────────────────────────────────────────────────────
function buildMeta(imageHRL = 'hcs://1/0.0.PENDING') {
  const clean = v => v?.trim() || undefined
  return {
    name: document.getElementById('m_name')?.value.trim() || 'Hashinal #001',
    creator: clean(document.getElementById('m_creator')?.value) || undefined,
    description: clean(document.getElementById('m_desc')?.value) || undefined,
    image: imageHRL,
    type: S.fileMime || 'image/png',
    format: 'HIP412@2.0.0',
    attributes: S.attrs.filter(a => a.t && a.v).map(a => ({ trait_type: a.t, value: a.v })),
    properties: {
      category: document.getElementById('m_cat')?.value || 'art',
      collection: clean(document.getElementById('m_collection')?.value) || undefined,
    },
  }
}

function updateMetaPreview() {
  const el = document.getElementById('metaPreview')
  if (!el) return
  const json = JSON.stringify(buildMeta(), null, 2)
  el.innerHTML = syntaxHighlight(json)
}

function syntaxHighlight(str) {
  return str
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"([^"]+)":/g, '<span class="jk">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="js">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="jn">$1</span>')
}

// ─── TOKEN MODE ───────────────────────────────────────────────────────────────
function wireTokenMode() {
  document.getElementById('tmode-new')?.addEventListener('click', () => setTMode('new'))
  document.getElementById('tmode-existing')?.addEventListener('click', () => setTMode('existing'))
}

function setTMode(m) {
  S.tokenMode = m
  document.getElementById('tmode-new')?.classList.toggle('active', m === 'new')
  document.getElementById('tmode-existing')?.classList.toggle('active', m === 'existing')
  document.getElementById('tfields-new').style.display = m === 'new' ? '' : 'none'
  document.getElementById('tfields-existing').style.display = m === 'existing' ? '' : 'none'
  document.getElementById('c-token-lbl').textContent = m === 'new' ? 'Token creation (HTS)' : 'Token creation (skipped)'
  document.getElementById('c-token').textContent = m === 'new' ? '~$1.00' : '$0.00'
  updateCost()
}

// ─── COST ─────────────────────────────────────────────────────────────────────
function updateCost() {
  const cnt = parseInt(document.getElementById('m_mintCount')?.value || 1)
  document.getElementById('c-cnt').textContent = cnt
  const imgCost = S.file ? Math.max(0.003, S.file.size / 1024 * 0.0001) : 0.005
  document.getElementById('c-img').textContent = `~$${imgCost.toFixed(4)}`
  document.getElementById('c-mint').textContent = `~$${(0.05 * cnt).toFixed(2)}`
  const tkCost = S.tokenMode === 'new' ? 1.0 : 0
  const total = imgCost + 0.0001 + tkCost + 0.05 * cnt
  document.getElementById('c-total').innerHTML = `<strong>~$${total.toFixed(3)}</strong>`
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
function buildSummary() {
  const el = document.getElementById('summaryContent')
  if (!el) return
  const tokenInfo = S.tokenMode === 'new'
    ? `${document.getElementById('m_tokenName')?.value} (${document.getElementById('m_tokenSymbol')?.value})`
    : `Existing: ${document.getElementById('m_existingToken')?.value}`
  const attrs = S.attrs.filter(a => a.t && a.v).map(a => `${a.t}: ${a.v}`).join(', ') || 'None'
  el.innerHTML = rows([
    ['Network', S.network.toUpperCase()],
    ['Wallet', getAccountId() || '—'],
    ['Artwork', `${S.fileName || '—'} (${S.file ? fmtBytes(S.file.size) : '—'})`],
    ['NFT Name', document.getElementById('m_name')?.value || '—'],
    ['Token', tokenInfo],
    ['Mint count', document.getElementById('m_mintCount')?.value || '1'],
    ['Traits', attrs],
  ])
}

function rows(pairs) {
  return `<div style="display:grid;grid-template-columns:130px 1fr;gap:5px;">${
    pairs.map(([l, v]) =>
      `<span style="color:var(--text-muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">${l}</span><span style="font-size:13px;">${v}</span>`
    ).join('')
  }</div>`
}

// ─── REAL MINTING FLOW ────────────────────────────────────────────────────────
async function startRealMint() {
  if (!isConnected()) { alert('Connect your wallet first'); return }
  if (!S.file) { alert('No image file found — go back to Step 1'); return }

  const btn = document.getElementById('mintBtn')
  btn.disabled = true
  btn.innerHTML = '<span class="spin"></span>&nbsp;Minting...'

  const progCard = document.getElementById('progressCard')
  progCard.style.display = 'block'
  document.getElementById('mintResult').classList.remove('show')
  document.getElementById('txLog').innerHTML = ''
  document.getElementById('mintActions').querySelector('button[data-goto]').style.display = 'none'

  try {
    // ── PHASE 1: Inscribe Image ─────────────────────────────────────────────
    setPhase('Phase 1/4 — Inscribing image to HCS-1', 5)
    log('Starting image inscription...', 'info')
    log(`File: ${S.fileName} (${fmtBytes(S.file.size)})`, 'info')

    // Convert dataURL to ArrayBuffer
    const arrayBuf = await fileToArrayBuffer(S.file)

    const { hrl: imageHRL, topicId: imgTopicId, chunkCount } = await inscribeFile(
      arrayBuf,
      S.fileMime,
      S.fileName,
      (pct, msg) => {
        setPhase(msg, Math.round(5 + pct * 0.2)) // Phase 1 = 5-25%
        log(msg, 'info')
      }
    )

    S.imageHRL = imageHRL
    setPhase(`Image inscribed: ${imageHRL}`, 25)
    log(`✓ Image HRL: ${imageHRL} (${chunkCount} chunks)`, 'ok')

    // ── PHASE 2: Inscribe Metadata JSON ────────────────────────────────────
    setPhase('Phase 2/4 — Building & inscribing metadata JSON', 28)
    log('Building HIP-412 metadata JSON...', 'info')

    const metadata = buildMeta(imageHRL)
    log(`Metadata JSON ready (image: ${imageHRL})`, 'info')

    const { hrl: metadataHRL, topicId: metaTopicId } = await inscribeJSON(
      metadata,
      (pct, msg) => {
        setPhase(msg, Math.round(28 + pct * 0.2)) // Phase 2 = 28-48%
        log(msg, 'info')
      }
    )

    S.metadataHRL = metadataHRL
    setPhase(`Metadata inscribed: ${metadataHRL}`, 50)
    log(`✓ Metadata HRL: ${metadataHRL}`, 'ok')

    // ── PHASE 3: Create Token (if new) ─────────────────────────────────────
    let tokenId
    if (S.tokenMode === 'new') {
      setPhase('Phase 3/4 — Creating HTS NFT token collection', 52)
      log('Creating NFT token collection — approve in wallet...', 'info')

      tokenId = await createNFTToken({
        name: document.getElementById('m_tokenName').value.trim(),
        symbol: document.getElementById('m_tokenSymbol').value.trim(),
        maxSupply: parseInt(document.getElementById('m_maxSupply').value) || 0,
        supplyType: document.getElementById('m_supplyType').value,
      })

      S.tokenId = tokenId
      setPhase(`Token created: ${tokenId}`, 70)
      log(`✓ Token created: ${tokenId}`, 'ok')
    } else {
      tokenId = document.getElementById('m_existingToken').value.trim()
      S.tokenId = tokenId
      setPhase('Phase 3/4 — Using existing token', 70)
      log(`Using existing token: ${tokenId}`, 'info')
    }

    // ── PHASE 4: Mint NFT ──────────────────────────────────────────────────
    const mintCount = parseInt(document.getElementById('m_mintCount').value) || 1
    setPhase(`Phase 4/4 — Minting ${mintCount} NFT serial(s)`, 72)
    log(`Minting ${mintCount} serial(s) with metadata HRL — approve in wallet...`, 'info')
    log(`Metadata: ${metadataHRL}`, 'info')

    const serials = await mintNFT(tokenId, metadataHRL, mintCount)

    setPhase('Minting complete!', 100)
    log(`✓ Minted serials: ${serials.join(', ')}`, 'ok')
    log(`✓ View on HashScan: https://hashscan.io/${S.network}/token/${tokenId}/${serials[0]}`, 'ok')

    showSuccess({
      tokenId,
      serials,
      imageHRL,
      metadataHRL,
      imgTopicId,
      metaTopicId,
      network: S.network,
    })

  } catch (err) {
    const msg = err?.message || String(err)
    setPhase(`Error: ${msg}`, null)
    log(`✗ Error: ${msg}`, 'err')
    btn.disabled = false
    btn.innerHTML = '⬡ &nbsp;Retry Mint'
    document.getElementById('mintActions').querySelector('button[data-goto]').style.display = ''
    throw err
  }
}

function showSuccess({ tokenId, serials, imageHRL, metadataHRL, imgTopicId, metaTopicId, network }) {
  const grid = document.getElementById('resultGrid')
  const items = [
    ['Token ID', tokenId],
    ['Serial(s)', serials.join(', ')],
    ['Image HRL', imageHRL],
    ['Metadata HRL', metadataHRL],
    ['Network', network.toUpperCase()],
    ['Standard', 'HCS-5 Hashinal'],
  ]
  grid.innerHTML = items.map(([l, v]) =>
    `<div class="result-item">
      <div class="ri-label">${l}</div>
      <div class="ri-value">
        <span>${v}</span>
        <button class="ri-copy" onclick="navigator.clipboard.writeText('${v}')" title="Copy">⧉</button>
      </div>
    </div>`
  ).join('')

  document.getElementById('hashscanBtns').innerHTML = `
    <a class="hs-btn" href="https://hashscan.io/${network}/token/${tokenId}/${serials[0]}" target="_blank">⬡ View NFT</a>
    <a class="hs-btn" href="https://hashscan.io/${network}/token/${tokenId}" target="_blank">⬡ Collection</a>
    <a class="hs-btn" href="https://hashscan.io/${network}/topic/${metaTopicId}" target="_blank">⬡ Metadata Topic</a>
    <a class="hs-btn" href="https://hashscan.io/${network}/topic/${imgTopicId}" target="_blank">⬡ Image Topic</a>
  `

  document.getElementById('mintResult').classList.add('show')

  document.getElementById('mintActions').innerHTML = `
    <button class="btn btn-secondary" onclick="location.reload()">↺ Mint Another</button>
    <span class="status-badge success">✓ On-chain</span>
  `
}

// ─── PROGRESS/LOG HELPERS ─────────────────────────────────────────────────────
function setPhase(label, pct) {
  if (pct !== null) {
    document.getElementById('progFill').style.width = `${pct}%`
    document.getElementById('progPct').textContent = `${pct}%`
  }
  document.getElementById('progLabel').textContent = label
}

function log(msg, type = 'info') {
  const el = document.getElementById('txLog')
  if (!el) return
  const ts = new Date().toTimeString().slice(0, 8)
  const d = document.createElement('div')
  d.className = 'log-line'
  d.innerHTML = `<span class="log-ts">${ts}</span><span class="log-${type}">${escHtml(msg)}</span>`
  el.appendChild(d)
  el.scrollTop = el.scrollHeight
}

// ─── VIEWER ───────────────────────────────────────────────────────────────────
function wireViewer() {
  document.getElementById('lookupBtn')?.addEventListener('click', lookupNFT)
  document.getElementById('demoBtn')?.addEventListener('click', loadDemo)
  document.getElementById('v_tokenId')?.addEventListener('keydown', e => { if (e.key === 'Enter') lookupNFT() })
  document.getElementById('v_serial')?.addEventListener('keydown', e => { if (e.key === 'Enter') lookupNFT() })
}

async function loadDemo() {
  // Use a known Hashinal from mainnet — fall back to a testnet demo if needed
  document.getElementById('v_tokenId').value = '0.0.1234567'
  document.getElementById('v_serial').value = '1'
  // Show a synthetic demo since we can't guarantee a specific token exists
  renderNFTDemo()
}

function renderNFTDemo() {
  const demoMeta = {
    name: 'Demo Hashinal #1',
    creator: 'Hashinal Forge',
    description: 'A fully on-chain NFT minted using HCS-5 on Hedera Consensus Service. No external storage — image and metadata live on Hedera permanently.',
    image: 'hcs://1/0.0.999111',
    type: 'image/svg+xml',
    format: 'HIP412@2.0.0',
    attributes: [
      { trait_type: 'Standard', value: 'HCS-5' },
      { trait_type: 'Background', value: 'Cosmic Blue' },
      { trait_type: 'Rarity', value: 'Rare' },
    ],
    properties: { category: 'art', collection: 'Demo Hashinals' },
  }
  renderNFT(demoMeta, {
    tokenId: '0.0.1234567', serial: '1',
    metadataHRL: 'hcs://1/0.0.999222',
    imgHRL: 'hcs://1/0.0.999111',
    tokenName: 'Demo Hashinals', tokenSymbol: 'DHASH',
  }, true)
}

async function lookupNFT() {
  const tokenId = document.getElementById('v_tokenId').value.trim()
  const serial = document.getElementById('v_serial').value.trim()
  if (!tokenId.match(/^0\.0\.\d+$/) || !serial) {
    alert('Enter a valid Token ID (e.g. 0.0.123456) and serial number')
    return
  }

  document.getElementById('viewerEmpty').style.display = 'none'
  document.getElementById('nftDisplay').classList.remove('show')
  document.getElementById('viewerLoading').style.display = 'block'

  try {
    const data = await fetchNFTFromMirror(tokenId, serial)
    document.getElementById('viewerLoading').style.display = 'none'

    if (!data.metaJson) {
      throw new Error('Could not resolve metadata from HRL')
    }

    renderNFT(data.metaJson, {
      tokenId, serial,
      metadataHRL: data.metadataHRL,
      imgHRL: data.metaJson?.image,
      tokenName: data.tokenName,
      tokenSymbol: data.tokenSymbol,
      createdTimestamp: data.createdTimestamp,
    })
  } catch (err) {
    document.getElementById('viewerLoading').style.display = 'none'
    document.getElementById('viewerEmpty').style.display = 'block'
    document.getElementById('viewerEmpty').innerHTML = `
      <span class="viewer-empty-icon">⚠</span>
      <div style="color:var(--error);font-size:14px;">Error: ${escHtml(err.message)}</div>
      <div style="margin-top:8px;font-size:13px;color:var(--text-muted);">Check the Token ID and serial, and make sure you're on the right network.</div>
    `
  }
}

function renderNFT(meta, refs, isDemo = false) {
  document.getElementById('nftName').textContent = meta.name || '—'
  document.getElementById('nftCreator').textContent = meta.creator ? `by ${meta.creator}` : ''
  document.getElementById('nftDescText').textContent = meta.description || ''

  // Image — if we have the recently minted file in memory show it; else show placeholder SVG
  const imgWrap = document.getElementById('nftImgWrap')
  if (S.imageHRL && refs.imgHRL === S.imageHRL && S.fileBuf) {
    imgWrap.innerHTML = `<img src="${S.fileBuf}" alt="${meta.name}" />`
  } else {
    imgWrap.innerHTML = generatePlaceholderSVG(meta.name || 'H')
  }

  // Traits
  document.getElementById('nftTraits').innerHTML = (meta.attributes || []).map(a =>
    `<div class="trait-pill"><div class="trait-type">${escHtml(a.trait_type)}</div><div class="trait-val">${escHtml(a.value)}</div></div>`
  ).join('')

  // Meta rows
  const metaRowsEl = document.getElementById('nftMetaRows')
  const metaItems = []
  if (refs.tokenId) metaItems.push(['Token ID', refs.tokenId])
  if (refs.serial) metaItems.push(['Serial', `#${refs.serial}`])
  if (refs.tokenName) metaItems.push(['Collection', `${refs.tokenName} (${refs.tokenSymbol})`])
  if (meta.type) metaItems.push(['Type', meta.type])
  if (meta.format) metaItems.push(['Standard', meta.format])
  metaRowsEl.innerHTML = metaItems.map(([l, v]) =>
    `<div class="meta-row"><span class="meta-label">${l}</span><span class="meta-val">${escHtml(v)}</span></div>`
  ).join('')

  // HRLs
  const hrlsEl = document.getElementById('nftHRLs')
  const hrls = []
  if (refs.metadataHRL) hrls.push(['Metadata HRL', refs.metadataHRL])
  if (refs.imgHRL) hrls.push(['Image HRL', refs.imgHRL])
  hrlsEl.innerHTML = hrls.map(([l, hrl]) =>
    `<div style="margin-bottom:12px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:6px;">${l}</div>
      <div class="hrl-box"><span style="font-size:16px;">⬡</span><span class="hrl-val">${escHtml(hrl)}</span>
        <button class="hrl-copy" onclick="navigator.clipboard.writeText('${hrl}')">COPY</button>
      </div>
    </div>`
  ).join('')

  // Links
  const linksEl = document.getElementById('nftLinks')
  linksEl.innerHTML = ''
  if (refs.tokenId && refs.serial) {
    linksEl.innerHTML += `<a class="hs-btn" href="https://hashscan.io/${S.network}/token/${refs.tokenId}/${refs.serial}" target="_blank">⬡ HashScan</a>`
  }
  if (refs.metadataHRL?.startsWith('hcs://')) {
    const tid = refs.metadataHRL.split('/')[2]
    linksEl.innerHTML += `<a class="hs-btn" href="https://hashscan.io/${S.network}/topic/${tid}" target="_blank">⬡ Metadata Topic</a>`
  }
  if (refs.imgHRL?.startsWith('hcs://')) {
    const tid = refs.imgHRL.split('/')[2]
    linksEl.innerHTML += `<a class="hs-btn" href="https://hashscan.io/${S.network}/topic/${tid}" target="_blank">⬡ Image Topic</a>`
  }
  if (isDemo) {
    linksEl.innerHTML += `<span class="status-badge pending">Demo Data</span>`
  }

  document.getElementById('nftDisplay').classList.add('show')
}

function generatePlaceholderSVG(name) {
  const colors = ['#3dd6f5','#8b5cf6','#10e6a0','#f59e0b']
  const c1 = colors[Math.abs(name.charCodeAt(0)) % colors.length]
  const c2 = colors[(Math.abs(name.charCodeAt(0)) + 2) % colors.length]
  const letter = (name[0] || 'H').toUpperCase()
  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}" stop-opacity="0.25"/>
      <stop offset="1" stop-color="${c2}" stop-opacity="0.25"/>
    </linearGradient></defs>
    <rect width="300" height="300" fill="#06080e"/>
    <rect width="300" height="300" fill="url(#g)"/>
    <circle cx="150" cy="150" r="90" fill="none" stroke="${c1}" stroke-width="1" opacity="0.3"/>
    <text x="150" y="172" text-anchor="middle" font-size="96" font-weight="900"
      fill="${c1}" font-family="Arial" opacity="0.85">${letter}</text>
    <text x="150" y="270" text-anchor="middle" font-size="12" fill="${c1}"
      font-family="monospace" opacity="0.5">hcs://1 inscription</text>
  </svg>`
}

// ─── DIRECTIONS TIMELINE ──────────────────────────────────────────────────────
function wireDirections() {
  const el = document.getElementById('dirTimeline')
  if (!el) return
  el.innerHTML = `
    <div style="position:absolute;left:10px;top:8px;bottom:8px;width:2px;background:linear-gradient(to bottom,var(--accent),var(--accent2));opacity:0.3;"></div>
    ${[
      ['Inscribe Image to HCS-1', 'Your artwork file is split into chunks and submitted as HCS-1 consensus messages. Each message is finalized by Hedera consensus (~3–5 seconds). You receive a <strong>Image HRL</strong>: <code>hcs://1/&lt;topicId&gt;</code>.'],
      ['Build Metadata JSON', 'Construct a HIP-412 compatible JSON object. The <code>image</code> field <strong>must reference the Image HRL from step 1</strong>. Include name, description, traits, and collection info.'],
      ['Inscribe Metadata JSON to HCS-1', 'The metadata JSON is also inscribed to its own HCS-1 topic. This gives you a <strong>Metadata HRL</strong>: <code>hcs://1/&lt;metaTopicId&gt;</code>. This is the HRL that gets embedded in the NFT.'],
      ['Create HTS NFT Token (if new)', 'Create a <code>NonFungibleUnique</code> token on Hedera Token Service. The connected wallet account becomes the treasury and supply key holder. One-time per collection (~$1 USD).'],
      ['Mint the NFT', 'Call <code>TokenMintTransaction</code> with <code>setMetadata([Buffer.from(metadataHRL)])</code>. The Metadata HRL string is stored as the NFT\'s on-chain metadata bytes. Your wallet signs and broadcasts the transaction.'],
      ['Verify on HashScan', 'Navigate to <code>hashscan.io/testnet/token/&lt;tokenId&gt;/&lt;serial&gt;</code>. The metadata field shows your HRL. Click the topic ID to see the raw inscribed messages — your image and metadata, permanently on Hedera.'],
    ].map(([title, body], i) => `
      <div style="position:relative;margin-bottom:28px;padding-left:4px;">
        <div style="position:absolute;left:-26px;top:4px;width:20px;height:20px;border-radius:50%;background:var(--surface);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:var(--mono);color:var(--accent);">${i+1}</div>
        <div style="font-size:15px;font-weight:800;margin-bottom:7px;">${title}</div>
        <div style="font-size:13px;color:var(--text-dim);line-height:1.7;">${body}</div>
      </div>
    `).join('')}
  `
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
