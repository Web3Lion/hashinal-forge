/**
 * boot.js — UI orchestration for Hashinal Forge
 */

import {
  connectWallet, disconnectWallet, isConnected, getAccountId, getNetwork,
} from './wallet.js'

import {
  createCollectionTopic,
  inscribeFileToTopic,
  inscribeMetadataToTopic,
  createNFTCollection,
  mintNFT,
  generateKeyPair,
  downloadKeyFile,
  estimateApprovals,
  estimateChunks,
  fetchNFTFromMirror,
  resizeImage,
} from './hedera.js'

// ─── KEY ROLES ────────────────────────────────────────────────────────────────
// All supported key roles — matches the checkboxes in app.js
const KEY_ROLES = ['supply', 'admin', 'metadata', 'freeze', 'pause', 'kyc', 'wipe']

// ─── STATE ────────────────────────────────────────────────────────────────────
const S = {
  network: 'testnet',
  mintStep: 1,
  collectionTopicId: null,
  tokenId: null,
  tokenMode: 'new',
  // Image
  file: null, fileMime: null, fileName: null,
  resizedBlob: null, resizedBuf: null, resizedMime: null, resizedSize: 0,
  resizeTarget: 128,
  // Metadata
  attrs: [],
  // Keys: per-role state
  keyState: {
    supply:   { enabled: true,  custom: false, data: null },
    admin:    { enabled: true,  custom: false, data: null },
    metadata: { enabled: true,  custom: false, data: null },
    freeze:   { enabled: false, custom: false, data: null },
    pause:    { enabled: false, custom: false, data: null },
    kyc:      { enabled: false, custom: false, data: null },
    wipe:     { enabled: false, custom: false, data: null },
  },
  // Results
  imageHRL: null,
  metadataHRL: null,
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
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
  updateApprovalBreakdown()
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
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
  document.getElementById(`page-${id}`)?.classList.add('active')
  document.querySelector(`.nav-tab[data-page="${id}"]`)?.classList.add('active')
}

// ─── WALLET ───────────────────────────────────────────────────────────────────
function wireWallet() {
  document.getElementById('walletBtn')?.addEventListener('click', () => {
    if (isConnected()) disconnectWallet().then(updateWalletUI)
    else document.getElementById('walletModal').style.display = 'flex'
  })
  document.getElementById('modalClose')?.addEventListener('click', () => {
    document.getElementById('walletModal').style.display = 'none'
  })
  document.getElementById('walletModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('walletModal'))
      document.getElementById('walletModal').style.display = 'none'
  })
  document.getElementById('netPill')?.addEventListener('click', () => {
    S.network = S.network === 'testnet' ? 'mainnet' : 'testnet'
    updateNetUI()
  })
  document.querySelectorAll('.wallet-option').forEach(opt => {
    opt.addEventListener('click', handleWalletConnect)
  })
}

async function handleWalletConnect() {
  const projectId = document.getElementById('wcProjectId')?.value.trim()
  if (!projectId) {
    alert('Please enter your WalletConnect Project ID.\nGet one free at https://cloud.walletconnect.com')
    return
  }
  const opts = document.getElementById('walletOptions')
  const connecting = document.getElementById('walletConnecting')
  const msgEl = document.getElementById('connectingMsg')
  opts.style.display = 'none'
  connecting.style.display = 'block'
  try {
    await connectWallet(projectId, S.network, msg => { msgEl.textContent = msg })
    document.getElementById('walletModal').style.display = 'none'
    updateWalletUI()
    updateWalletGate()
  } catch (err) {
    alert(`Connection failed: ${err.message}`)
  } finally {
    opts.style.display = 'block'
    connecting.style.display = 'none'
  }
}

function updateWalletUI() {
  const btn = document.getElementById('walletBtn')
  const label = document.getElementById('walletBtnLabel')
  if (isConnected()) {
    btn?.classList.add('connected')
    if (label) label.textContent = getAccountId()
  } else {
    btn?.classList.remove('connected')
    if (label) label.textContent = 'Connect Wallet'
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
  document.getElementById('netPill')?.classList.toggle('mainnet', S.network === 'mainnet')
}

// ─── STEP NAV ─────────────────────────────────────────────────────────────────
function wireMintStepNav() {
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
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`fstep-${i}`)
    if (!el) continue
    el.classList.remove('active', 'done')
    if (i < n) el.classList.add('done')
    else if (i === n) el.classList.add('active')
  }
  if (n === 3) updateMetaPreview()
  if (n === 5) { buildSummary(); updateCost(); updateApprovalBreakdown() }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ─── MINT WIRING ──────────────────────────────────────────────────────────────
function wireMint() {
  wireMintStepNav()
  wireFileInput()
  wireAttrs()
  wireTokenMode()
  wireKeyOptions()
  wireCollectionTopic()

  document.getElementById('step1Next')?.addEventListener('click', () => {
    if (!isConnected()) { alert('Connect your wallet first'); return }
    const topicId = document.getElementById('m_topicId')?.value.trim()
    if (topicId) {
      if (!topicId.match(/^0\.0\.\d+$/)) { alert('Enter a valid Topic ID'); return }
      S.collectionTopicId = topicId
    }
    gotoStep(2)
  })

  document.getElementById('step2Next')?.addEventListener('click', () => {
    if (!S.resizedBlob && !S.file) { alert('Upload your NFT artwork'); return }
    gotoStep(3)
  })

  document.getElementById('step3Next')?.addEventListener('click', () => {
    if (!document.getElementById('m_name')?.value.trim()) { alert('Enter an NFT name'); return }
    gotoStep(4)
  })

  document.getElementById('step4Next')?.addEventListener('click', () => {
    if (S.tokenMode === 'new') {
      if (!document.getElementById('m_tokenName')?.value.trim()) { alert('Enter token name'); return }
      if (!document.getElementById('m_tokenSymbol')?.value.trim()) { alert('Enter token symbol'); return }
    } else {
      if (!document.getElementById('m_existingToken')?.value.trim().match(/^0\.0\.\d+$/)) {
        alert('Enter a valid Token ID'); return
      }
    }
    gotoStep(5)
  })

  document.getElementById('mintBtn')?.addEventListener('click', startMint)

  ;['m_name','m_creator','m_desc','m_collection','m_cat'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateMetaPreview)
  })
  document.getElementById('m_mintCount')?.addEventListener('input', () => {
    updateCost(); updateApprovalBreakdown()
  })
  document.getElementById('m_network')?.addEventListener('change', e => {
    S.network = e.target.value; updateNetUI()
  })
  document.getElementById('resizeOption')?.addEventListener('change', e => {
    S.resizeTarget = parseInt(e.target.value) || 0
    if (S.file) processFile(S.file)
  })
}

// ─── COLLECTION TOPIC ─────────────────────────────────────────────────────────
function wireCollectionTopic() {
  document.getElementById('createTopicBtn')?.addEventListener('click', async () => {
    if (!isConnected()) { alert('Connect your wallet first'); return }
    const name = document.getElementById('m_collectionName2')?.value.trim() || 'Hashinal Collection'
    const btn = document.getElementById('createTopicBtn')
    btn.disabled = true
    btn.innerHTML = '<span class="spin"></span> Creating...'
    try {
      const topicId = await createCollectionTopic(name)
      document.getElementById('m_topicId').value = topicId
      S.collectionTopicId = topicId
      const el = document.getElementById('topicSuccess')
      if (el) {
        el.style.display = 'block'
        el.innerHTML = `<strong>✓ Topic created: ${topicId}</strong> — Save this ID to reuse for future mints.`
      }
    } catch (err) {
      alert(`Failed: ${err.message}`)
    } finally {
      btn.disabled = false
      btn.innerHTML = '+ Create New Topic'
    }
  })
}

// ─── FILE + RESIZE ────────────────────────────────────────────────────────────
function wireFileInput() {
  const drop = document.getElementById('imgDrop')
  const input = document.getElementById('imgInput')
  drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover') })
  drop?.addEventListener('dragleave', () => drop.classList.remove('dragover'))
  drop?.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('dragover')
    const f = e.dataTransfer?.files?.[0]; if (f) processFile(f)
  })
  input?.addEventListener('change', e => { if (e.target.files?.[0]) processFile(e.target.files[0]) })
  document.getElementById('imgClear')?.addEventListener('click', clearFile)
}

async function processFile(file) {
  S.file = file; S.fileMime = file.type; S.fileName = file.name

  const origUrl = URL.createObjectURL(file)
  document.getElementById('imgThumb').src = origUrl
  document.getElementById('imgName').textContent = file.name
  document.getElementById('imgMeta').textContent = `${fmtBytes(file.size)} · ${file.type}`
  document.getElementById('imgPreview').style.display = 'flex'

  const target = S.resizeTarget || 0
  const resizeWrap = document.getElementById('resizedPreviewWrap')

  if (target > 0) {
    try {
      const { blob, mimeType } = await resizeImage(file, target)
      S.resizedBlob = blob
      S.resizedMime = mimeType
      S.resizedSize = blob.size
      S.resizedBuf = await blob.arrayBuffer()

      document.getElementById('resizedThumb').src = URL.createObjectURL(blob)
      document.getElementById('resizedName').textContent = `${target}×${target} · ${mimeType.split('/')[1].toUpperCase()}`
      document.getElementById('resizedMeta').textContent = `${fmtBytes(blob.size)} (was ${fmtBytes(file.size)})`
      const chunks = estimateChunks(blob.size)
      document.getElementById('resizedChunks').textContent = `~${chunks} chunks → 1 signing session (batch)`
      if (resizeWrap) resizeWrap.style.display = 'block'
    } catch (err) {
      console.warn('Resize failed, using original:', err)
      S.resizedBlob = file; S.resizedBuf = await file.arrayBuffer()
      S.resizedMime = file.type; S.resizedSize = file.size
      if (resizeWrap) resizeWrap.style.display = 'none'
    }
  } else {
    S.resizedBlob = file; S.resizedBuf = await file.arrayBuffer()
    S.resizedMime = file.type; S.resizedSize = file.size
    const chunks = estimateChunks(file.size)
    document.getElementById('resizedThumb').src = origUrl
    document.getElementById('resizedName').textContent = `Original · ${file.type.split('/')[1].toUpperCase()}`
    document.getElementById('resizedMeta').textContent = fmtBytes(file.size)
    document.getElementById('resizedChunks').textContent = `~${chunks} chunks → 1 signing session`
    if (resizeWrap) resizeWrap.style.display = 'block'
  }

  updateCost(); updateApprovalBreakdown()
}

function clearFile() {
  S.file = null; S.resizedBlob = null; S.resizedBuf = null
  document.getElementById('imgInput').value = ''
  document.getElementById('imgPreview').style.display = 'none'
  document.getElementById('resizedPreviewWrap').style.display = 'none'
}

// ─── ATTRIBUTES ───────────────────────────────────────────────────────────────
function wireAttrs() {
  document.getElementById('addAttrBtn')?.addEventListener('click', () => addAttr())
}
function addDefaultAttrs() { addAttr('Standard', 'HCS-5'); addAttr('Type', 'Hashinal') }
function addAttr(t = '', v = '') {
  S.attrs.push({ id: Date.now() + Math.random(), t, v }); renderAttrs()
}
function removeAttr(id) { S.attrs = S.attrs.filter(a => a.id !== id); renderAttrs(); updateMetaPreview() }
function renderAttrs() {
  const list = document.getElementById('attrList'); if (!list) return
  list.innerHTML = ''
  S.attrs.forEach(a => {
    const row = document.createElement('div'); row.className = 'attr-row'
    row.innerHTML = `
      <input type="text" placeholder="Trait type" value="${escHtml(a.t)}" oninput="window.__updAttr(${a.id},'t',this.value)" />
      <input type="text" placeholder="Value" value="${escHtml(a.v)}" oninput="window.__updAttr(${a.id},'v',this.value)" />
      <button class="attr-remove" onclick="window.__removeAttr(${a.id})">−</button>`
    list.appendChild(row)
  })
  window.__updAttr = (id, f, v) => { const a = S.attrs.find(x => x.id === id); if(a) a[f]=v; updateMetaPreview() }
  window.__removeAttr = removeAttr
}

// ─── META PREVIEW ─────────────────────────────────────────────────────────────
function buildMeta(imageHRL = 'hcs://1/0.0.TOPIC?inscription_id=img-PENDING') {
  const clean = v => v?.trim() || undefined
  return {
    name: document.getElementById('m_name')?.value.trim() || 'Hashinal #001',
    creator: clean(document.getElementById('m_creator')?.value) || undefined,
    description: clean(document.getElementById('m_desc')?.value) || undefined,
    image: imageHRL,
    type: S.resizedMime || S.fileMime || 'image/png',
    format: 'HIP412@2.0.0',
    attributes: S.attrs.filter(a => a.t && a.v).map(a => ({ trait_type: a.t, value: a.v })),
    properties: {
      category: document.getElementById('m_cat')?.value || 'art',
      collection: clean(document.getElementById('m_collection')?.value) || undefined,
    },
  }
}

function updateMetaPreview() {
  const el = document.getElementById('metaPreview'); if (!el) return
  el.innerHTML = syntaxHighlight(JSON.stringify(buildMeta(), null, 2))
}

function syntaxHighlight(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"([^"]+)":/g,'<span class="jk">"$1"</span>:')
    .replace(/: "([^"]*)"/g,': <span class="js">"$1"</span>')
    .replace(/: (\d+)/g,': <span class="jn">$1</span>')
}

// ─── TOKEN MODE ───────────────────────────────────────────────────────────────
function wireTokenMode() {
  document.getElementById('tmode-new')?.addEventListener('click', () => setTMode('new'))
  document.getElementById('tmode-existing')?.addEventListener('click', () => setTMode('existing'))
}
function setTMode(m) {
  S.tokenMode = m
  document.getElementById('tmode-new')?.classList.toggle('active', m==='new')
  document.getElementById('tmode-existing')?.classList.toggle('active', m==='existing')
  document.getElementById('tfields-new').style.display = m==='new' ? '' : 'none'
  document.getElementById('tfields-existing').style.display = m==='existing' ? '' : 'none'
  updateCost(); updateApprovalBreakdown()
}

// ─── KEY OPTIONS ──────────────────────────────────────────────────────────────
function wireKeyOptions() {
  KEY_ROLES.forEach(role => {
    const enableCb = document.getElementById(`key_${role}`)
    const customCb = document.getElementById(`customkey_${role}`)
    const genBtn   = document.getElementById(`genkey_${role}`)
    const customRow = document.getElementById(`customkeyrow_${role}`)

    // Sync initial state from S.keyState
    if (enableCb) enableCb.checked = S.keyState[role].enabled

    // Enable/disable role
    enableCb?.addEventListener('change', e => {
      S.keyState[role].enabled = e.target.checked
      if (customRow) customRow.style.display = e.target.checked ? 'flex' : 'none'
      if (!e.target.checked) {
        // Reset custom key state when role is disabled
        S.keyState[role].custom = false
        if (customCb) customCb.checked = false
        if (genBtn) genBtn.style.display = 'none'
      }
    })

    // Custom key toggle
    customCb?.addEventListener('change', e => {
      S.keyState[role].custom = e.target.checked
      if (genBtn) genBtn.style.display = e.target.checked ? 'inline-flex' : 'none'
    })

    // Generate key button
    genBtn?.addEventListener('click', async () => {
      await handleGenerateKey(role)
    })
  })
}

async function handleGenerateKey(role) {
  const btn = document.getElementById(`genkey_${role}`)
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...' }
  try {
    const keyData = await generateKeyPair()
    S.keyState[role].data = keyData
    const display = document.getElementById(`keydisplay_${role}`)
    if (display) {
      display.style.display = 'block'
      display.textContent = `✓ ${keyData.publicKey.slice(0,24)}... (downloaded)`
    }
    downloadKeyFile(keyData, role, `hashinal-${role}-key.txt`)
  } catch (err) {
    alert(`Key generation failed: ${err.message}`)
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '⬇ Generate' }
  }
}

// Build key config object for createNFTCollection()
function buildKeyConfig() {
  const cfg = {}
  KEY_ROLES.forEach(role => {
    const k = S.keyState[role]
    if (!k.enabled) return
    // If custom key was generated, pass the private key string
    if (k.custom && k.data) {
      cfg[`${role}Key`] = k.data.privateKey
    } else {
      // Use wallet key for this role
      cfg[`enable${role.charAt(0).toUpperCase() + role.slice(1)}`] = true
    }
  })
  return cfg
}

// Readable summary of which keys are enabled
function keysSummary() {
  const enabled = KEY_ROLES.filter(r => S.keyState[r].enabled)
  if (!enabled.length) return 'None (immutable token)'
  return enabled.map(r => {
    const k = S.keyState[r]
    return `${r}${k.custom && k.data ? ' (custom)' : ' (wallet)'}`
  }).join(', ')
}

// ─── COST & APPROVALS ─────────────────────────────────────────────────────────
function updateCost() {
  const cnt = parseInt(document.getElementById('m_mintCount')?.value || 1)
  const fileSize = S.resizedSize || S.file?.size || 15000
  document.getElementById('c-cnt').textContent = cnt
  const imgCost = Math.max(0.001, fileSize / 1024 * 0.00005)
  document.getElementById('c-img').textContent = `~$${imgCost.toFixed(4)}`
  document.getElementById('c-mint').textContent = `~$${(0.05*cnt).toFixed(2)}`
  document.getElementById('c-token-lbl').textContent =
    S.tokenMode === 'new' ? 'Token creation (HTS)' : 'Token (existing, skipped)'
  document.getElementById('c-token').textContent =
    S.tokenMode === 'new' ? '~$1.00' : '$0.00'
  const topicCost = S.collectionTopicId ? 0 : 0.01
  const tokenCost = S.tokenMode === 'new' ? 1.0 : 0
  const total = topicCost + imgCost + 0.0001 + tokenCost + 0.05*cnt
  document.getElementById('c-total').innerHTML = `<strong>~$${total.toFixed(3)}</strong>`
}

function updateApprovalBreakdown() {
  const fileSize = S.resizedSize || S.file?.size || 15000
  const chunks = estimateChunks(fileSize)
  const isNewTopic = !S.collectionTopicId
  const isNewToken = S.tokenMode === 'new'
  const mintCount = parseInt(document.getElementById('m_mintCount')?.value || 1)

  const lines = []
  let total = 0

  if (isNewTopic) { lines.push(['1 session', 'Create collection topic']); total += 1 }
  lines.push([`1 session`, `Image inscription batch (${chunks + 2} msgs)`]); total += 1
  lines.push(['1 session', 'Metadata inscription batch (3 msgs)']); total += 1
  if (isNewToken) { lines.push(['1 session', 'Create HTS token collection']); total += 1 }
  lines.push([`${mintCount} session${mintCount > 1 ? 's' : ''}`, `Mint NFT × ${mintCount}`]); total += mintCount

  const breakdownEl = document.getElementById('approvalBreakdown')
  if (breakdownEl) {
    breakdownEl.innerHTML = lines.map(([sessions, label]) =>
      `<div><span style="color:var(--warn);font-weight:700;">${sessions}</span> &nbsp;·&nbsp; ${label}</div>`
    ).join('')
  }
  const totalEl = document.getElementById('c-approvals')
  if (totalEl) totalEl.textContent = total
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
function buildSummary() {
  const el = document.getElementById('summaryContent'); if (!el) return
  const fileSize = S.resizedSize || S.file?.size || 0
  const chunks = estimateChunks(fileSize)

  el.innerHTML = grid([
    ['Network',          S.network.toUpperCase()],
    ['Wallet',           getAccountId() || '—'],
    ['Collection Topic', S.collectionTopicId || 'Will create new'],
    ['Artwork',          `${S.fileName || '—'} → ${S.resizeTarget > 0 ? `${S.resizeTarget}×${S.resizeTarget}` : 'original'} (${fmtBytes(fileSize)})`],
    ['Image Chunks',     `${chunks} chunks → 1 signing session`],
    ['NFT Name',         document.getElementById('m_name')?.value || '—'],
    ['Token',            S.tokenMode === 'new'
      ? `New: ${document.getElementById('m_tokenName')?.value} (${document.getElementById('m_tokenSymbol')?.value})`
      : `Existing: ${document.getElementById('m_existingToken')?.value}`],
    ['Token Keys',       keysSummary()],
    ['Mint Count',       document.getElementById('m_mintCount')?.value || '1'],
  ])
}

function grid(pairs) {
  return `<div style="display:grid;grid-template-columns:150px 1fr;gap:6px 12px;">${
    pairs.map(([l,v]) =>
      `<span style="color:var(--text-muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;align-self:start;padding-top:2px;">${l}</span>
       <span style="font-size:13px;color:var(--text);">${v}</span>`
    ).join('')
  }</div>`
}

// ─── MINT ─────────────────────────────────────────────────────────────────────
async function startMint() {
  if (!isConnected()) { alert('Connect your wallet first'); return }
  if (!S.resizedBuf && !S.file) { alert('Upload an image first'); return }

  const btn = document.getElementById('mintBtn')
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>&nbsp;Minting...'

  document.getElementById('progressCard').style.display = 'block'
  document.getElementById('mintResult').classList.remove('show')
  document.getElementById('txLog').innerHTML = ''
  document.getElementById('mintActions').querySelector('[data-goto]').style.display = 'none'

  try {
    // Phase 1: Topic
    let topicId = S.collectionTopicId
    if (!topicId) {
      setPhase('Creating collection topic...', 3)
      log('Creating shared collection topic...', 'info')
      topicId = await createCollectionTopic(
        document.getElementById('m_collection')?.value.trim() || 'Hashinal Collection'
      )
      S.collectionTopicId = topicId
      log(`✓ Topic: ${topicId}`, 'ok')
    } else {
      log(`Using topic: ${topicId}`, 'info')
    }

    // Phase 2: Image inscription (batch)
    setPhase('Phase 2 — Batch signing image...', 10)
    log(`Inscribing image (${fmtBytes(S.resizedSize || S.file.size)}) — approve batch in HashPack...`, 'info')

    const fileBuffer = S.resizedBuf || await fileToArrayBuffer(S.file)
    const mimeType = S.resizedMime || S.fileMime
    const fileName = S.resizeTarget > 0
      ? `${S.resizeTarget}x${S.resizeTarget}_${S.fileName}`
      : S.fileName

    const { hrl: imageHRL } = await inscribeFileToTopic(
      topicId, fileBuffer, mimeType, fileName,
      (pct, msg) => { setPhase(msg, Math.round(10 + pct * 0.3)); log(msg, 'info') }
    )
    S.imageHRL = imageHRL
    log(`✓ Image HRL: ${imageHRL}`, 'ok')

    // Phase 3: Metadata (batch)
    setPhase('Phase 3 — Batch signing metadata...', 42)
    const metadata = buildMeta(imageHRL)
    const { hrl: metadataHRL } = await inscribeMetadataToTopic(
      topicId, metadata,
      (pct, msg) => { setPhase(msg, Math.round(42 + pct * 0.2)); log(msg, 'info') }
    )
    S.metadataHRL = metadataHRL
    log(`✓ Metadata HRL: ${metadataHRL}`, 'ok')

    // Phase 4: Token
    let tokenId
    if (S.tokenMode === 'new') {
      setPhase('Phase 4 — Creating token...', 64)
      log('Creating token — approve in wallet...', 'info')
      tokenId = await createNFTCollection({
        name: document.getElementById('m_tokenName').value.trim(),
        symbol: document.getElementById('m_tokenSymbol').value.trim(),
        maxSupply: parseInt(document.getElementById('m_maxSupply').value) || 0,
        supplyType: document.getElementById('m_supplyType').value,
        collectionTopicId: topicId,
        keys: buildKeyConfig(),
      })
      S.tokenId = tokenId
      log(`✓ Token: ${tokenId}`, 'ok')
    } else {
      tokenId = document.getElementById('m_existingToken').value.trim()
      S.tokenId = tokenId
      log(`Using token: ${tokenId}`, 'info')
    }

    // Phase 5: Mint
    const mintCount = parseInt(document.getElementById('m_mintCount').value) || 1
    setPhase(`Phase 5 — Minting ${mintCount} serial(s)...`, 82)
    log('Minting — approve in wallet...', 'info')
    const serials = await mintNFT(tokenId, metadataHRL, mintCount)
    setPhase('Minted! ✓', 100)
    log(`✓ Serials: ${serials.join(', ')}`, 'ok')

    showSuccess({ tokenId, serials, imageHRL, metadataHRL, topicId, network: S.network })

  } catch (err) {
    const msg = err?.message || String(err)
    setPhase(`Error: ${msg}`, null)
    log(`✗ ${msg}`, 'err')
    btn.disabled = false; btn.innerHTML = '⬡ &nbsp;Retry Mint'
    document.getElementById('mintActions').querySelector('[data-goto]').style.display = ''
  }
}

function showSuccess({ tokenId, serials, imageHRL, metadataHRL, topicId, network }) {
  document.getElementById('resultGrid').innerHTML = [
    ['Token ID', tokenId],
    ['Serial(s)', serials.join(', ')],
    ['Collection Topic', topicId],
    ['Image HRL', imageHRL],
    ['Metadata HRL', metadataHRL],
    ['Network', network.toUpperCase()],
  ].map(([l,v]) =>
    `<div class="result-item"><div class="ri-label">${l}</div>
     <div class="ri-value"><span>${v}</span>
     <button class="ri-copy" onclick="navigator.clipboard.writeText('${v.replace(/'/g,"\\'")}')">⧉</button></div></div>`
  ).join('')

  document.getElementById('hashscanBtns').innerHTML = `
    <a class="hs-btn" href="https://hashscan.io/${network}/token/${tokenId}/${serials[0]}" target="_blank">⬡ View NFT</a>
    <a class="hs-btn" href="https://hashscan.io/${network}/token/${tokenId}" target="_blank">⬡ Collection</a>
    <a class="hs-btn" href="https://hashscan.io/${network}/topic/${topicId}" target="_blank">⬡ Topic</a>`

  document.getElementById('mintResult').classList.add('show')
  document.getElementById('mintActions').innerHTML = `
    <button class="btn btn-secondary" onclick="location.reload()">↺ Mint Another</button>
    <div style="text-align:right;">
      <div style="font-size:10px;color:var(--text-muted);font-family:var(--mono);margin-bottom:3px;">COLLECTION TOPIC — SAVE THIS</div>
      <div style="font-family:var(--mono);font-size:14px;color:var(--accent3);font-weight:700;">${topicId}</div>
    </div>`
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
function setPhase(label, pct) {
  if (pct != null) {
    document.getElementById('progFill').style.width = `${pct}%`
    document.getElementById('progPct').textContent = `${pct}%`
  }
  document.getElementById('progLabel').textContent = label
}

function log(msg, type = 'info') {
  const el = document.getElementById('txLog'); if (!el) return
  const ts = new Date().toTimeString().slice(0,8)
  const d = document.createElement('div'); d.className = 'log-line'
  d.innerHTML = `<span class="log-ts">${ts}</span><span class="log-${type}">${escHtml(msg)}</span>`
  el.appendChild(d); el.scrollTop = el.scrollHeight
}

// ─── VIEWER ───────────────────────────────────────────────────────────────────
function wireViewer() {
  document.getElementById('lookupBtn')?.addEventListener('click', lookupNFT)
  document.getElementById('demoBtn')?.addEventListener('click', () => {
    document.getElementById('viewerEmpty').style.display = 'none'
    renderNFT({
      name: 'Demo Hashinal #1', creator: 'Hashinal Forge',
      description: 'Fully on-chain NFT using shared collection topic architecture.',
      image: 'hcs://1/0.0.999111?inscription_id=img-demo',
      type: 'image/png', format: 'HIP412@2.0.0',
      attributes: [
        { trait_type: 'Standard', value: 'HCS-5' },
        { trait_type: 'Architecture', value: 'Shared Topic' },
      ],
      properties: { category: 'art' },
    }, {
      tokenId: '0.0.1234567', serial: '1',
      metadataHRL: 'hcs://1/0.0.999111?inscription_id=meta-demo',
      imgHRL: 'hcs://1/0.0.999111?inscription_id=img-demo',
      tokenName: 'Demo', tokenSymbol: 'DEMO',
    }, true)
  })
}

async function lookupNFT() {
  const tokenId = document.getElementById('v_tokenId').value.trim()
  const serial = document.getElementById('v_serial').value.trim()
  if (!tokenId.match(/^0\.0\.\d+$/) || !serial) { alert('Enter valid Token ID and serial'); return }
  document.getElementById('viewerEmpty').style.display = 'none'
  document.getElementById('nftDisplay').classList.remove('show')
  document.getElementById('viewerLoading').style.display = 'block'
  try {
    const data = await fetchNFTFromMirror(tokenId, serial)
    document.getElementById('viewerLoading').style.display = 'none'
    if (!data.metaJson) throw new Error('Could not resolve metadata from HRL')
    renderNFT(data.metaJson, {
      tokenId, serial,
      metadataHRL: data.metadataHRL,
      imgHRL: data.metaJson?.image,
      tokenName: data.tokenName,
      tokenSymbol: data.tokenSymbol,
    })
  } catch (err) {
    document.getElementById('viewerLoading').style.display = 'none'
    document.getElementById('viewerEmpty').style.display = 'block'
    document.getElementById('viewerEmpty').innerHTML = `
      <span class="viewer-empty-icon">⚠</span>
      <div style="color:var(--error);">${escHtml(err.message)}</div>`
  }
}

function renderNFT(meta, refs, isDemo = false) {
  document.getElementById('nftName').textContent = meta.name || '—'
  document.getElementById('nftCreator').textContent = meta.creator ? `by ${meta.creator}` : ''
  document.getElementById('nftDescText').textContent = meta.description || ''

  const imgWrap = document.getElementById('nftImgWrap')
  imgWrap.innerHTML = (S.imageHRL && refs.imgHRL === S.imageHRL && S.resizedBlob)
    ? `<img src="${URL.createObjectURL(S.resizedBlob)}" alt="${meta.name}" />`
    : genPlaceholderSVG(meta.name || 'H')

  document.getElementById('nftTraits').innerHTML = (meta.attributes || []).map(a =>
    `<div class="trait-pill"><div class="trait-type">${escHtml(a.trait_type)}</div><div class="trait-val">${escHtml(a.value)}</div></div>`
  ).join('')

  const metaItems = []
  if (refs.tokenId) metaItems.push(['Token ID', refs.tokenId])
  if (refs.serial) metaItems.push(['Serial', `#${refs.serial}`])
  if (refs.tokenName) metaItems.push(['Collection', `${refs.tokenName} (${refs.tokenSymbol})`])
  if (meta.type) metaItems.push(['Type', meta.type])
  if (meta.format) metaItems.push(['Standard', meta.format])
  document.getElementById('nftMetaRows').innerHTML = metaItems.map(([l,v]) =>
    `<div class="meta-row"><span class="meta-label">${l}</span><span class="meta-val">${escHtml(v)}</span></div>`
  ).join('')

  document.getElementById('nftHRLs').innerHTML = [
    ['Metadata HRL', refs.metadataHRL],
    ['Image HRL', refs.imgHRL],
  ].filter(([,v]) => v).map(([l, hrl]) =>
    `<div style="margin-bottom:10px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:5px;">${l}</div>
      <div class="hrl-box"><span>⬡</span><span class="hrl-val">${escHtml(hrl)}</span>
        <button class="hrl-copy" onclick="navigator.clipboard.writeText('${hrl.replace(/'/g,"\\'")}')">COPY</button>
      </div>
    </div>`
  ).join('')

  document.getElementById('nftLinks').innerHTML =
    (refs.tokenId && refs.serial)
      ? `<a class="hs-btn" href="https://hashscan.io/${S.network}/token/${refs.tokenId}/${refs.serial}" target="_blank">⬡ HashScan</a>`
      : ''
  if (isDemo) document.getElementById('nftLinks').innerHTML += `<span class="status-badge pending">Demo</span>`

  document.getElementById('nftDisplay').classList.add('show')
}

function genPlaceholderSVG(name) {
  const colors = ['#3dd6f5','#8b5cf6','#10e6a0','#f59e0b']
  const c1 = colors[Math.abs(name.charCodeAt(0)) % 4]
  const c2 = colors[(Math.abs(name.charCodeAt(0)) + 2) % 4]
  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}" stop-opacity=".25"/><stop offset="1" stop-color="${c2}" stop-opacity=".25"/>
    </linearGradient></defs>
    <rect width="300" height="300" fill="#06080e"/><rect width="300" height="300" fill="url(#g)"/>
    <circle cx="150" cy="150" r="90" fill="none" stroke="${c1}" stroke-width="1" opacity=".3"/>
    <text x="150" y="172" text-anchor="middle" font-size="96" font-weight="900" fill="${c1}" font-family="Arial" opacity=".85">${(name[0]||'H').toUpperCase()}</text>
  </svg>`
}

// ─── DIRECTIONS ───────────────────────────────────────────────────────────────
function wireDirections() {
  const el = document.getElementById('dirTimeline'); if (!el) return
  el.innerHTML = `<div style="position:absolute;left:10px;top:8px;bottom:8px;width:2px;background:linear-gradient(to bottom,var(--accent),var(--accent2));opacity:0.3;"></div>` + [
    ['Create Collection Topic', 'One shared HCS-1 topic for your entire collection. Paste the Topic ID back in Step 1 for every future mint — all images and metadata share this single topic, identified by unique <code>inscription_id</code>s.'],
    ['Upload & Auto-Resize Image', 'Images are auto-resized to 128×128 using the browser Canvas API before inscription. Smaller files = fewer chunks. With batch signing, all chunks are signed in one HashPack session.'],
    ['Build Metadata JSON', 'HIP-412 metadata JSON is built with the image HRL as the <code>image</code> field: <code>hcs://1/&lt;topicId&gt;?inscription_id=img-xxx</code>. Preview updates live as you type.'],
    ['Batch Sign Metadata', 'The metadata JSON (header + content + end) is also batch-signed in one HashPack session and inscribed to the shared topic.'],
    ['Configure Token Keys', 'Supply, Admin, and Metadata keys are enabled by default using your wallet key. Enable Freeze, Pause, KYC, or Wipe as needed. Generate separate keys for any role and download them as a .txt file.'],
    ['Mint the NFT', 'One final approval: TokenMintTransaction stores the metadata HRL on-chain. Total: ~4-5 signing sessions for a new collection, ~3 for subsequent mints.'],
  ].map(([title, body], i) => `
    <div style="position:relative;margin-bottom:28px;padding-left:4px;">
      <div style="position:absolute;left:-26px;top:4px;width:20px;height:20px;border-radius:50%;background:var(--surface);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:var(--mono);color:var(--accent);">${i+1}</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:7px;">${title}</div>
      <div style="font-size:13px;color:var(--text-dim);line-height:1.7;">${body}</div>
    </div>`
  ).join('')
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (!b) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`
  return `${(b/1048576).toFixed(2)} MB`
}
function escHtml(str) {
  return String(str??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = e => resolve(e.target.result)
    r.onerror = reject
    r.readAsArrayBuffer(file)
  })
}
