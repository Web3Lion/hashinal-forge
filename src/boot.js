/**
 * boot.js — UI orchestration for Hashinal Forge
 * Shared collection topic architecture with key management
 */

import {
  connectWallet,
  disconnectWallet,
  isConnected,
  getAccountId,
  getNetwork,
} from "./wallet.js";

import {
  createCollectionTopic,
  inscribeFileToTopic,
  inscribeMetadataToTopic,
  createNFTCollection,
  mintNFT,
  generateKeyPair,
  downloadKeyFile,
  estimateApprovals,
  fetchNFTFromMirror,
} from "./hedera.js";

// ─── STATE ────────────────────────────────────────────────────────────────────
const S = {
  network: "testnet",
  mintStep: 1,
  // Collection
  collectionTopicId: null, // shared HCS-1 topic for this collection
  tokenId: null, // existing or newly created HTS token
  tokenMode: "new", // 'new' | 'existing'
  // Image
  file: null,
  fileBuf: null,
  fileMime: null,
  fileName: null,
  // Metadata
  attrs: [],
  // Keys
  keys: {
    useWalletKeyForAll: true,
    supplyKeyCustom: false,
    supplyKeyData: null,
    adminKeyEnabled: false,
    adminKeyCustom: false,
    adminKeyData: null,
    freezeKeyEnabled: false,
    freezeKeyCustom: false,
    freezeKeyData: null,
    pauseKeyEnabled: false,
    pauseKeyCustom: false,
    pauseKeyData: null,
    wipeKeyEnabled: false,
    wipeKeyCustom: false,
    wipeKeyData: null,
  },
  // Results
  imageHRL: null,
  metadataHRL: null,
};

// ─── BOOT ─────────────────────────────────────────────────────────────────────
export function boot() {
  wireNav();
  wireWallet();
  wireMint();
  wireViewer();
  wireDirections();
  updateWalletUI();
  addDefaultAttrs();
  updateMetaPreview();
  updateCost();
  updateApprovalEstimate();
}

// ─── PAGE NAV ─────────────────────────────────────────────────────────────────
function wireNav() {
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });
  document.querySelectorAll("[data-page]").forEach((btn) => {
    if (!btn.classList.contains("nav-tab")) {
      btn.addEventListener("click", () => showPage(btn.dataset.page));
    }
  });
}

function showPage(id) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById(`page-${id}`)?.classList.add("active");
  document
    .querySelector(`.nav-tab[data-page="${id}"]`)
    ?.classList.add("active");
}

// ─── WALLET ───────────────────────────────────────────────────────────────────
function wireWallet() {
  const btn = document.getElementById("walletBtn");
  const modal = document.getElementById("walletModal");
  const closeBtn = document.getElementById("modalClose");

  btn?.addEventListener("click", () => {
    if (isConnected()) {
      disconnectWallet().then(updateWalletUI);
    } else {
      modal.style.display = "flex";
    }
  });

  closeBtn?.addEventListener("click", () => {
    modal.style.display = "none";
  });
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  document.getElementById("netPill")?.addEventListener("click", () => {
    S.network = S.network === "testnet" ? "mainnet" : "testnet";
    updateNetUI();
  });

  document.querySelectorAll(".wallet-option").forEach((opt) => {
    opt.addEventListener("click", () => handleWalletConnect());
  });
}

async function handleWalletConnect() {
  const projectId = document.getElementById("wcProjectId")?.value.trim();
  if (!projectId) {
    alert(
      "Please enter your WalletConnect Project ID.\nGet one free at https://cloud.walletconnect.com"
    );
    return;
  }

  const opts = document.getElementById("walletOptions");
  const connecting = document.getElementById("walletConnecting");
  const msgEl = document.getElementById("connectingMsg");

  opts.style.display = "none";
  connecting.style.display = "block";

  try {
    await connectWallet(projectId, S.network, (msg) => {
      msgEl.textContent = msg;
    });
    document.getElementById("walletModal").style.display = "none";
    updateWalletUI();
    updateWalletGate();
  } catch (err) {
    alert(`Connection failed: ${err.message}`);
  } finally {
    opts.style.display = "block";
    connecting.style.display = "none";
  }
}

function updateWalletUI() {
  const btn = document.getElementById("walletBtn");
  const label = document.getElementById("walletBtnLabel");
  if (isConnected()) {
    btn?.classList.add("connected");
    if (label) label.textContent = getAccountId();
  } else {
    btn?.classList.remove("connected");
    if (label) label.textContent = "Connect Wallet";
  }
  updateWalletGate();
  updateNetUI();
}

function updateWalletGate() {
  const gate = document.getElementById("walletGate");
  if (gate) gate.style.display = isConnected() ? "none" : "block";
}

function updateNetUI() {
  const label = document.getElementById("netLabel");
  const pill = document.getElementById("netPill");
  if (label) label.textContent = S.network.toUpperCase();
  pill?.classList.toggle("mainnet", S.network === "mainnet");
}

// ─── MINT STEP NAV ────────────────────────────────────────────────────────────
function wireMintStepNav() {
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => gotoStep(parseInt(btn.dataset.goto)));
  });
  document.querySelectorAll(".flow-step").forEach((el) => {
    el.addEventListener("click", () => {
      const n = parseInt(el.dataset.step);
      if (n <= S.mintStep) gotoStep(n);
    });
  });
}

function gotoStep(n) {
  S.mintStep = n;
  document
    .querySelectorAll(".mint-panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(`mp-${n}`)?.classList.add("active");
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`fstep-${i}`);
    if (!el) continue;
    el.classList.remove("active", "done");
    if (i < n) el.classList.add("done");
    else if (i === n) el.classList.add("active");
  }
  if (n === 3) updateMetaPreview();
  if (n === 4) updateKeyUI();
  if (n === 5) {
    buildSummary();
    updateCost();
    updateApprovalEstimate();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── MINT WIRING ──────────────────────────────────────────────────────────────
function wireMint() {
  wireMintStepNav();
  wireFileInput();
  wireAttrs();
  wireTokenMode();
  wireKeyOptions();
  wireCollectionTopic();

  // Step 1: Collection topic
  document.getElementById("step1Next")?.addEventListener("click", () => {
    if (!isConnected()) {
      alert("Connect your wallet first");
      return;
    }
    const topicId = document.getElementById("m_topicId")?.value.trim();
    if (topicId) {
      if (!topicId.match(/^0\.0\.\d+$/)) {
        alert("Enter a valid Topic ID (e.g. 0.0.123456)");
        return;
      }
      S.collectionTopicId = topicId;
    }
    // topicId can be blank — will create new one during mint
    gotoStep(2);
  });

  // Step 2: Image
  document.getElementById("step2Next")?.addEventListener("click", () => {
    if (!S.file) {
      alert("Upload your NFT artwork");
      return;
    }
    gotoStep(3);
  });

  // Step 3: Metadata
  document.getElementById("step3Next")?.addEventListener("click", () => {
    if (!document.getElementById("m_name")?.value.trim()) {
      alert("Enter an NFT name");
      return;
    }
    gotoStep(4);
  });

  // Step 4: Token & Keys
  document.getElementById("step4Next")?.addEventListener("click", () => {
    if (S.tokenMode === "new") {
      if (!document.getElementById("m_tokenName")?.value.trim()) {
        alert("Enter token name");
        return;
      }
      if (!document.getElementById("m_tokenSymbol")?.value.trim()) {
        alert("Enter token symbol");
        return;
      }
    } else {
      if (
        !document
          .getElementById("m_existingToken")
          ?.value.trim()
          .match(/^0\.0\.\d+$/)
      ) {
        alert("Enter a valid Token ID");
        return;
      }
    }
    gotoStep(5);
  });

  // Step 5: Mint
  document.getElementById("mintBtn")?.addEventListener("click", startMint);

  // Live updates
  ["m_name", "m_creator", "m_desc", "m_collection", "m_cat"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      updateMetaPreview();
    });
  });
  document.getElementById("m_mintCount")?.addEventListener("input", () => {
    updateCost();
    updateApprovalEstimate();
  });
  document.getElementById("m_network")?.addEventListener("change", (e) => {
    S.network = e.target.value;
    updateNetUI();
  });
}

// ─── COLLECTION TOPIC ─────────────────────────────────────────────────────────
function wireCollectionTopic() {
  document
    .getElementById("createTopicBtn")
    ?.addEventListener("click", async () => {
      if (!isConnected()) {
        alert("Connect your wallet first");
        return;
      }
      const name =
        document.getElementById("m_collectionName2")?.value.trim() ||
        "Hashinal Collection";
      const btn = document.getElementById("createTopicBtn");
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span> Creating...';
      try {
        const topicId = await createCollectionTopic(name);
        document.getElementById("m_topicId").value = topicId;
        S.collectionTopicId = topicId;
        showTopicSuccess(topicId);
      } catch (err) {
        alert(`Failed to create topic: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.innerHTML = "+ Create New Topic";
      }
    });
}

function showTopicSuccess(topicId) {
  const el = document.getElementById("topicSuccess");
  if (el) {
    el.style.display = "block";
    el.innerHTML = `<strong>✓ Topic created:</strong> ${topicId} — save this ID to reuse for future mints in this collection.`;
  }
}

// ─── FILE HANDLING ────────────────────────────────────────────────────────────
function wireFileInput() {
  const drop = document.getElementById("imgDrop");
  const input = document.getElementById("imgInput");

  drop?.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
  });
  drop?.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop?.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    const f = e.dataTransfer?.files?.[0];
    if (f) processFile(f);
  });
  input?.addEventListener("change", (e) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  });
  document.getElementById("imgClear")?.addEventListener("click", clearFile);
}

function processFile(file) {
  S.file = file;
  S.fileMime = file.type;
  S.fileName = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    S.fileBuf = e.target.result;
    const preview = document.getElementById("imgPreview");
    if (preview) {
      document.getElementById("imgThumb").src = S.fileBuf;
      document.getElementById("imgName").textContent = file.name;
      document.getElementById("imgMeta").textContent = `${fmtBytes(
        file.size
      )} · ${file.type} · ~${estimateApprovals({
        fileSizeBytes: file.size,
        isNewTopic: !S.collectionTopicId,
        isNewToken: S.tokenMode === "new",
      })} wallet approvals`;
      preview.classList.add("show");
    }
    updateCost();
    updateApprovalEstimate();
  };
  reader.readAsDataURL(file);
}

function clearFile() {
  S.file = null;
  S.fileBuf = null;
  document.getElementById("imgInput").value = "";
  document.getElementById("imgPreview")?.classList.remove("show");
}

// ─── ATTRIBUTES ───────────────────────────────────────────────────────────────
function wireAttrs() {
  document
    .getElementById("addAttrBtn")
    ?.addEventListener("click", () => addAttr());
}

function addDefaultAttrs() {
  addAttr("Standard", "HCS-5");
  addAttr("Type", "Hashinal");
}

function addAttr(t = "", v = "") {
  const id = Date.now() + Math.random();
  S.attrs.push({ id, t, v });
  renderAttrs();
}

function removeAttr(id) {
  S.attrs = S.attrs.filter((a) => a.id !== id);
  renderAttrs();
  updateMetaPreview();
}

function renderAttrs() {
  const list = document.getElementById("attrList");
  if (!list) return;
  list.innerHTML = "";
  S.attrs.forEach((a) => {
    const row = document.createElement("div");
    row.className = "attr-row";
    row.innerHTML = `
      <input type="text" placeholder="Trait type" value="${escHtml(a.t)}"
        oninput="window.__updAttr(${a.id},'t',this.value)" />
      <input type="text" placeholder="Value" value="${escHtml(a.v)}"
        oninput="window.__updAttr(${a.id},'v',this.value)" />
      <button class="attr-remove" onclick="window.__removeAttr(${
        a.id
      })">−</button>
    `;
    list.appendChild(row);
  });
  window.__updAttr = (id, field, val) => {
    const a = S.attrs.find((x) => x.id === id);
    if (a) a[field] = val;
    updateMetaPreview();
  };
  window.__removeAttr = removeAttr;
}

// ─── METADATA PREVIEW ─────────────────────────────────────────────────────────
function buildMeta(imageHRL = "hcs://1/0.0.TOPIC?inscription_id=img-PENDING") {
  const clean = (v) => v?.trim() || undefined;
  return {
    name: document.getElementById("m_name")?.value.trim() || "Hashinal #001",
    creator: clean(document.getElementById("m_creator")?.value) || undefined,
    description: clean(document.getElementById("m_desc")?.value) || undefined,
    image: imageHRL,
    type: S.fileMime || "image/png",
    format: "HIP412@2.0.0",
    attributes: S.attrs
      .filter((a) => a.t && a.v)
      .map((a) => ({ trait_type: a.t, value: a.v })),
    properties: {
      category: document.getElementById("m_cat")?.value || "art",
      collection:
        clean(document.getElementById("m_collection")?.value) || undefined,
    },
  };
}

function updateMetaPreview() {
  const el = document.getElementById("metaPreview");
  if (!el) return;
  el.innerHTML = syntaxHighlight(JSON.stringify(buildMeta(), null, 2));
}

function syntaxHighlight(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span class="jk">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="js">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="jn">$1</span>');
}

// ─── TOKEN MODE ───────────────────────────────────────────────────────────────
function wireTokenMode() {
  document
    .getElementById("tmode-new")
    ?.addEventListener("click", () => setTMode("new"));
  document
    .getElementById("tmode-existing")
    ?.addEventListener("click", () => setTMode("existing"));
}

function setTMode(m) {
  S.tokenMode = m;
  document.getElementById("tmode-new")?.classList.toggle("active", m === "new");
  document
    .getElementById("tmode-existing")
    ?.classList.toggle("active", m === "existing");
  document.getElementById("tfields-new").style.display =
    m === "new" ? "" : "none";
  document.getElementById("tfields-existing").style.display =
    m === "existing" ? "" : "none";
  updateCost();
  updateApprovalEstimate();
}

// ─── KEY OPTIONS ──────────────────────────────────────────────────────────────
function wireKeyOptions() {
  // Master toggle: use wallet key for everything
  document
    .getElementById("useWalletKeyAll")
    ?.addEventListener("change", (e) => {
      S.keys.useWalletKeyForAll = e.target.checked;
      updateKeyUI();
    });

  // Per-role toggles
  const roles = ["admin", "freeze", "pause", "wipe"];
  roles.forEach((role) => {
    document
      .getElementById(`enable_${role}`)
      ?.addEventListener("change", (e) => {
        S.keys[`${role}KeyEnabled`] = e.target.checked;
        updateKeyUI();
      });
    document
      .getElementById(`custom_${role}`)
      ?.addEventListener("change", (e) => {
        S.keys[`${role}KeyCustom`] = e.target.checked;
        updateKeyUI();
      });
    document
      .getElementById(`gen_${role}`)
      ?.addEventListener("click", async () => {
        await handleGenerateKey(role);
      });
  });

  // Supply key custom
  document.getElementById("custom_supply")?.addEventListener("change", (e) => {
    S.keys.supplyKeyCustom = e.target.checked;
    updateKeyUI();
  });
  document.getElementById("gen_supply")?.addEventListener("click", async () => {
    await handleGenerateKey("supply");
  });
}

async function handleGenerateKey(role) {
  const btn = document.getElementById(`gen_${role}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Generating...";
  }

  try {
    const keyData = await generateKeyPair();
    S.keys[`${role}KeyData`] = keyData;

    // Show key info
    const display = document.getElementById(`key_display_${role}`);
    if (display) {
      display.style.display = "block";
      display.innerHTML = `
        <div style="font-family:var(--mono);font-size:10px;color:var(--accent3);word-break:break-all;margin-bottom:6px;">
          Public: ${keyData.publicKey.slice(0, 40)}...
        </div>
        <button class="btn btn-ghost btn-sm" onclick="window.__downloadKey('${role}')">
          ⬇ Download Key File
        </button>
      `;
    }

    // Auto-download for safety
    downloadKeyFile(keyData, `hashinal-${role}-key.txt`);
  } catch (err) {
    alert(`Failed to generate key: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Generate Key";
    }
  }
}

// Expose download function globally
window.__downloadKey = (role) => {
  const keyData = S.keys[`${role}KeyData`];
  if (keyData) downloadKeyFile(keyData, `hashinal-${role}-key.txt`);
};

function updateKeyUI() {
  const walletKeyAll = S.keys.useWalletKeyForAll;

  // Show/hide advanced key options
  const advanced = document.getElementById("advancedKeyOptions");
  if (advanced) advanced.style.display = walletKeyAll ? "none" : "block";

  // Update per-role UI
  const roles = ["admin", "freeze", "pause", "wipe"];
  roles.forEach((role) => {
    const enableRow = document.getElementById(`row_${role}`);
    const customRow = document.getElementById(`customrow_${role}`);
    const genRow = document.getElementById(`genrow_${role}`);

    const enabled = S.keys[`${role}KeyEnabled`];
    const custom = S.keys[`${role}KeyCustom`];

    if (customRow) customRow.style.display = enabled ? "flex" : "none";
    if (genRow) genRow.style.display = enabled && custom ? "flex" : "none";
  });

  // Supply key
  const supplyCustomRow = document.getElementById("customrow_supply");
  const supplyGenRow = document.getElementById("genrow_supply");
  if (supplyCustomRow)
    supplyCustomRow.style.display = S.keys.supplyKeyCustom ? "flex" : "none";
  if (supplyGenRow)
    supplyGenRow.style.display = S.keys.supplyKeyCustom ? "flex" : "none";
}

// ─── COST & APPROVAL ESTIMATE ─────────────────────────────────────────────────
function updateCost() {
  const cnt = parseInt(document.getElementById("m_mintCount")?.value || 1);
  document.getElementById("c-cnt").textContent = cnt;
  const imgCost = S.file
    ? Math.max(0.001, (S.file.size / 1024) * 0.00005)
    : 0.003;
  document.getElementById("c-img").textContent = `~$${imgCost.toFixed(4)}`;
  document.getElementById("c-mint").textContent = `~$${(0.05 * cnt).toFixed(
    2
  )}`;
  const tkCost = S.tokenMode === "new" ? 1.0 : 0;
  const topicCost = S.collectionTopicId ? 0 : 0.01;
  const total = topicCost + imgCost + 0.0001 + tkCost + 0.05 * cnt;
  document.getElementById("c-total").innerHTML = `<strong>~$${total.toFixed(
    3
  )}</strong>`;
}

function updateApprovalEstimate() {
  const el = document.getElementById("c-approvals");
  if (!el) return;
  const approvals = estimateApprovals({
    fileSizeBytes: S.file?.size || 15000,
    isNewTopic: !S.collectionTopicId,
    isNewToken: S.tokenMode === "new",
    mintCount: parseInt(document.getElementById("m_mintCount")?.value || 1),
  });
  el.textContent = `~${approvals} wallet approvals`;
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
function buildSummary() {
  const el = document.getElementById("summaryContent");
  if (!el) return;
  const topicInfo = S.collectionTopicId
    ? S.collectionTopicId
    : "Will create new topic";
  const tokenInfo =
    S.tokenMode === "new"
      ? `New: ${document.getElementById("m_tokenName")?.value} (${
          document.getElementById("m_tokenSymbol")?.value
        })`
      : `Existing: ${document.getElementById("m_existingToken")?.value}`;
  const keyInfo = S.keys.useWalletKeyForAll
    ? "Wallet key (all roles)"
    : "Custom keys configured";
  const approvals = estimateApprovals({
    fileSizeBytes: S.file?.size || 0,
    isNewTopic: !S.collectionTopicId,
    isNewToken: S.tokenMode === "new",
    mintCount: parseInt(document.getElementById("m_mintCount")?.value || 1),
  });

  el.innerHTML = grid([
    ["Network", S.network.toUpperCase()],
    ["Wallet", getAccountId() || "—"],
    ["Collection Topic", topicInfo],
    [
      "Artwork",
      `${S.fileName || "—"} (${S.file ? fmtBytes(S.file.size) : "—"})`,
    ],
    ["NFT Name", document.getElementById("m_name")?.value || "—"],
    ["Token", tokenInfo],
    ["Keys", keyInfo],
    ["Mint Count", document.getElementById("m_mintCount")?.value || "1"],
    ["Wallet Approvals", `~${approvals} (one per HCS message + mint)`],
  ]);
}

function grid(pairs) {
  return `<div style="display:grid;grid-template-columns:150px 1fr;gap:6px 12px;">${pairs
    .map(
      ([l, v]) =>
        `<span style="color:var(--text-muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;align-self:start;padding-top:2px;">${l}</span><span style="font-size:13px;color:var(--text);">${v}</span>`
    )
    .join("")}</div>`;
}

// ─── MINT FLOW ────────────────────────────────────────────────────────────────
async function startMint() {
  if (!isConnected()) {
    alert("Connect your wallet first");
    return;
  }
  if (!S.file) {
    alert("No image file — go back to Step 2");
    return;
  }

  const btn = document.getElementById("mintBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>&nbsp;Minting...';

  document.getElementById("progressCard").style.display = "block";
  document.getElementById("mintResult").classList.remove("show");
  document.getElementById("txLog").innerHTML = "";
  document
    .getElementById("mintActions")
    .querySelector("[data-goto]").style.display = "none";

  try {
    // ── PHASE 1: Collection Topic ──────────────────────────────────────────
    let topicId = S.collectionTopicId;
    if (!topicId) {
      setPhase("Phase 1 — Creating collection topic", 3);
      log("Creating shared collection topic...", "info");
      const collectionName =
        document.getElementById("m_collection")?.value.trim() ||
        "Hashinal Collection";
      topicId = await createCollectionTopic(collectionName);
      S.collectionTopicId = topicId;
      setPhase(`Collection topic: ${topicId}`, 8);
      log(`✓ Collection topic: ${topicId}`, "ok");
    } else {
      setPhase("Phase 1 — Using existing collection topic", 8);
      log(`Using existing topic: ${topicId}`, "info");
    }

    // ── PHASE 2: Inscribe Image ────────────────────────────────────────────
    setPhase("Phase 2 — Inscribing image to collection topic", 10);
    log(`Inscribing ${S.fileName} (${fmtBytes(S.file.size)})...`, "info");

    const arrayBuf = await fileToArrayBuffer(S.file);
    const { hrl: imageHRL, chunkCount } = await inscribeFileToTopic(
      topicId,
      arrayBuf,
      S.fileMime,
      S.fileName,
      (pct, msg) => {
        setPhase(msg, Math.round(10 + pct * 0.3));
        log(msg, "info");
      }
    );

    S.imageHRL = imageHRL;
    setPhase("Image inscribed ✓", 40);
    log(`✓ Image HRL: ${imageHRL}`, "ok");

    // ── PHASE 3: Inscribe Metadata ─────────────────────────────────────────
    setPhase("Phase 3 — Inscribing metadata JSON", 42);
    log("Building metadata JSON...", "info");

    const metadata = buildMeta(imageHRL);
    const { hrl: metadataHRL } = await inscribeMetadataToTopic(
      topicId,
      metadata,
      (pct, msg) => {
        setPhase(msg, Math.round(42 + pct * 0.2));
        log(msg, "info");
      }
    );

    S.metadataHRL = metadataHRL;
    setPhase("Metadata inscribed ✓", 62);
    log(`✓ Metadata HRL: ${metadataHRL}`, "ok");

    // ── PHASE 4: Token ─────────────────────────────────────────────────────
    let tokenId;
    if (S.tokenMode === "new") {
      setPhase("Phase 4 — Creating HTS token collection", 64);
      log("Creating NFT token — approve in wallet...", "info");

      const keys = buildKeyConfig();
      tokenId = await createNFTCollection({
        name: document.getElementById("m_tokenName").value.trim(),
        symbol: document.getElementById("m_tokenSymbol").value.trim(),
        maxSupply: parseInt(document.getElementById("m_maxSupply").value) || 0,
        supplyType: document.getElementById("m_supplyType").value,
        collectionTopicId: topicId,
        keys,
      });

      S.tokenId = tokenId;
      setPhase(`Token created: ${tokenId}`, 80);
      log(`✓ Token: ${tokenId}`, "ok");
    } else {
      tokenId = document.getElementById("m_existingToken").value.trim();
      S.tokenId = tokenId;
      setPhase("Phase 4 — Using existing token", 80);
      log(`Using token: ${tokenId}`, "info");
    }

    // ── PHASE 5: Mint ──────────────────────────────────────────────────────
    const mintCount =
      parseInt(document.getElementById("m_mintCount").value) || 1;
    setPhase(`Phase 5 — Minting ${mintCount} NFT serial(s)`, 82);
    log(`Minting with metadata HRL — approve in wallet...`, "info");

    const serials = await mintNFT(tokenId, metadataHRL, mintCount);

    setPhase("Minted! ✓", 100);
    log(`✓ Serials: ${serials.join(", ")}`, "ok");

    showSuccess({
      tokenId,
      serials,
      imageHRL,
      metadataHRL,
      topicId,
      network: S.network,
    });
  } catch (err) {
    const msg = err?.message || String(err);
    setPhase(`Error: ${msg}`, null);
    log(`✗ ${msg}`, "err");
    btn.disabled = false;
    btn.innerHTML = "⬡ &nbsp;Retry Mint";
    document
      .getElementById("mintActions")
      .querySelector("[data-goto]").style.display = "";
  }
}

function buildKeyConfig() {
  if (S.keys.useWalletKeyForAll) {
    return { useWalletKey: true };
  }
  return {
    supplyKey: S.keys.supplyKeyCustom ? S.keys.supplyKeyData?.privateKey : null,
    adminKey: S.keys.adminKeyCustom ? S.keys.adminKeyData?.privateKey : null,
    freezeKey: S.keys.freezeKeyCustom ? S.keys.freezeKeyData?.privateKey : null,
    pauseKey: S.keys.pauseKeyCustom ? S.keys.pauseKeyData?.privateKey : null,
    wipeKey: S.keys.wipeKeyCustom ? S.keys.wipeKeyData?.privateKey : null,
    enableAdmin: S.keys.adminKeyEnabled,
    enableFreeze: S.keys.freezeKeyEnabled,
    enablePause: S.keys.pauseKeyEnabled,
  };
}

function showSuccess({
  tokenId,
  serials,
  imageHRL,
  metadataHRL,
  topicId,
  network,
}) {
  const items = [
    ["Token ID", tokenId],
    ["Serial(s)", serials.join(", ")],
    ["Collection Topic", topicId],
    ["Image HRL", imageHRL],
    ["Metadata HRL", metadataHRL],
    ["Network", network.toUpperCase()],
  ];

  document.getElementById("resultGrid").innerHTML = items
    .map(
      ([l, v]) =>
        `<div class="result-item">
      <div class="ri-label">${l}</div>
      <div class="ri-value">
        <span>${v}</span>
        <button class="ri-copy" onclick="navigator.clipboard.writeText('${v.replace(
          /'/g,
          "\\'"
        )}')">⧉</button>
      </div>
    </div>`
    )
    .join("");

  document.getElementById("hashscanBtns").innerHTML = `
    <a class="hs-btn" href="https://hashscan.io/${network}/token/${tokenId}/${serials[0]}" target="_blank">⬡ View NFT</a>
    <a class="hs-btn" href="https://hashscan.io/${network}/token/${tokenId}" target="_blank">⬡ Collection</a>
    <a class="hs-btn" href="https://hashscan.io/${network}/topic/${topicId}" target="_blank">⬡ Collection Topic</a>
  `;

  document.getElementById("mintResult").classList.add("show");
  document.getElementById("mintActions").innerHTML = `
    <button class="btn btn-secondary" onclick="location.reload()">↺ Mint Another</button>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-family:var(--mono);">Collection Topic (save for future mints)</div>
      <div style="font-family:var(--mono);font-size:13px;color:var(--accent3);">${topicId}</div>
    </div>
  `;
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
function setPhase(label, pct) {
  if (pct !== null && pct !== undefined) {
    document.getElementById("progFill").style.width = `${pct}%`;
    document.getElementById("progPct").textContent = `${pct}%`;
  }
  document.getElementById("progLabel").textContent = label;
}

function log(msg, type = "info") {
  const el = document.getElementById("txLog");
  if (!el) return;
  const ts = new Date().toTimeString().slice(0, 8);
  const d = document.createElement("div");
  d.className = "log-line";
  d.innerHTML = `<span class="log-ts">${ts}</span><span class="log-${type}">${escHtml(
    msg
  )}</span>`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

// ─── VIEWER ───────────────────────────────────────────────────────────────────
function wireViewer() {
  document.getElementById("lookupBtn")?.addEventListener("click", lookupNFT);
  document.getElementById("demoBtn")?.addEventListener("click", loadDemo);
}

function loadDemo() {
  document.getElementById("v_tokenId").value = "0.0.1234567";
  document.getElementById("v_serial").value = "1";
  renderNFTDemo();
}

function renderNFTDemo() {
  const demoMeta = {
    name: "Demo Hashinal #1",
    creator: "Hashinal Forge",
    description:
      "Fully on-chain NFT using shared collection topic architecture. Image and metadata inscribed to a single HCS-1 topic, referenced by inscription_id.",
    image: "hcs://1/0.0.999111?inscription_id=img-demo-001",
    type: "image/png",
    format: "HIP412@2.0.0",
    attributes: [
      { trait_type: "Standard", value: "HCS-5" },
      { trait_type: "Architecture", value: "Shared Topic" },
      { trait_type: "Rarity", value: "Rare" },
    ],
    properties: { category: "art", collection: "Demo Hashinals" },
  };
  document.getElementById("viewerEmpty").style.display = "none";
  renderNFT(
    demoMeta,
    {
      tokenId: "0.0.1234567",
      serial: "1",
      metadataHRL: "hcs://1/0.0.999111?inscription_id=meta-demo-001",
      imgHRL: "hcs://1/0.0.999111?inscription_id=img-demo-001",
      tokenName: "Demo Hashinals",
      tokenSymbol: "DHASH",
    },
    true
  );
}

async function lookupNFT() {
  const tokenId = document.getElementById("v_tokenId").value.trim();
  const serial = document.getElementById("v_serial").value.trim();
  if (!tokenId.match(/^0\.0\.\d+$/) || !serial) {
    alert("Enter a valid Token ID and serial number");
    return;
  }

  document.getElementById("viewerEmpty").style.display = "none";
  document.getElementById("nftDisplay").classList.remove("show");
  document.getElementById("viewerLoading").style.display = "block";

  try {
    const data = await fetchNFTFromMirror(tokenId, serial);
    document.getElementById("viewerLoading").style.display = "none";
    if (!data.metaJson) throw new Error("Could not resolve metadata from HRL");
    renderNFT(data.metaJson, {
      tokenId,
      serial,
      metadataHRL: data.metadataHRL,
      imgHRL: data.metaJson?.image,
      tokenName: data.tokenName,
      tokenSymbol: data.tokenSymbol,
    });
  } catch (err) {
    document.getElementById("viewerLoading").style.display = "none";
    document.getElementById("viewerEmpty").style.display = "block";
    document.getElementById("viewerEmpty").innerHTML = `
      <span class="viewer-empty-icon">⚠</span>
      <div style="color:var(--error);">${escHtml(err.message)}</div>
    `;
  }
}

function renderNFT(meta, refs, isDemo = false) {
  document.getElementById("nftName").textContent = meta.name || "—";
  document.getElementById("nftCreator").textContent = meta.creator
    ? `by ${meta.creator}`
    : "";
  document.getElementById("nftDescText").textContent = meta.description || "";

  const imgWrap = document.getElementById("nftImgWrap");
  if (S.imageHRL && refs.imgHRL === S.imageHRL && S.fileBuf) {
    imgWrap.innerHTML = `<img src="${S.fileBuf}" alt="${meta.name}" />`;
  } else {
    imgWrap.innerHTML = generatePlaceholderSVG(meta.name || "H");
  }

  document.getElementById("nftTraits").innerHTML = (meta.attributes || [])
    .map(
      (a) =>
        `<div class="trait-pill"><div class="trait-type">${escHtml(
          a.trait_type
        )}</div><div class="trait-val">${escHtml(a.value)}</div></div>`
    )
    .join("");

  const metaItems = [];
  if (refs.tokenId) metaItems.push(["Token ID", refs.tokenId]);
  if (refs.serial) metaItems.push(["Serial", `#${refs.serial}`]);
  if (refs.tokenName)
    metaItems.push(["Collection", `${refs.tokenName} (${refs.tokenSymbol})`]);
  if (meta.type) metaItems.push(["Type", meta.type]);
  if (meta.format) metaItems.push(["Standard", meta.format]);

  document.getElementById("nftMetaRows").innerHTML = metaItems
    .map(
      ([l, v]) =>
        `<div class="meta-row"><span class="meta-label">${l}</span><span class="meta-val">${escHtml(
          v
        )}</span></div>`
    )
    .join("");

  const hrls = [];
  if (refs.metadataHRL) hrls.push(["Metadata HRL", refs.metadataHRL]);
  if (refs.imgHRL) hrls.push(["Image HRL", refs.imgHRL]);

  document.getElementById("nftHRLs").innerHTML = hrls
    .map(
      ([l, hrl]) =>
        `<div style="margin-bottom:12px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:6px;">${l}</div>
      <div class="hrl-box"><span style="font-size:16px;">⬡</span><span class="hrl-val">${escHtml(
        hrl
      )}</span>
        <button class="hrl-copy" onclick="navigator.clipboard.writeText('${hrl.replace(
          /'/g,
          "\\'"
        )}')">COPY</button>
      </div>
    </div>`
    )
    .join("");

  const linksEl = document.getElementById("nftLinks");
  linksEl.innerHTML = "";
  if (refs.tokenId && refs.serial) {
    linksEl.innerHTML += `<a class="hs-btn" href="https://hashscan.io/${S.network}/token/${refs.tokenId}/${refs.serial}" target="_blank">⬡ HashScan</a>`;
  }
  if (isDemo)
    linksEl.innerHTML += `<span class="status-badge pending">Demo</span>`;

  document.getElementById("nftDisplay").classList.add("show");
}

function generatePlaceholderSVG(name) {
  const colors = ["#3dd6f5", "#8b5cf6", "#10e6a0", "#f59e0b"];
  const c1 = colors[Math.abs(name.charCodeAt(0)) % colors.length];
  const c2 = colors[(Math.abs(name.charCodeAt(0)) + 2) % colors.length];
  const letter = (name[0] || "H").toUpperCase();
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
      font-family="monospace" opacity="0.5">hcs://1 shared topic</text>
  </svg>`;
}

// ─── DIRECTIONS ───────────────────────────────────────────────────────────────
function wireDirections() {
  const el = document.getElementById("dirTimeline");
  if (!el) return;
  el.innerHTML = [
    [
      "Create Collection Topic",
      "Create one shared HCS-1 topic for your entire collection. Save the Topic ID — paste it back in for every future mint. All images and metadata for the collection go into this one topic, identified by unique inscription IDs.",
    ],
    [
      "Upload & Inscribe Image",
      "Your 128×128 PNG is chunked into ~4KB HCS messages and written to the collection topic. Each chunk needs one wallet approval. At 128×128 this is typically 2-4 approvals.",
    ],
    [
      "Build Metadata JSON",
      "HIP-412 metadata JSON is built with the image HRL as the <code>image</code> field: <code>hcs://1/&lt;topicId&gt;?inscription_id=img-xxx</code>",
    ],
    [
      "Inscribe Metadata JSON",
      "The metadata JSON is also written to the shared topic with its own inscription_id. 3 approvals: header, content, end.",
    ],
    [
      "Configure Token & Keys",
      "Create a new HTS NonFungibleUnique token or use an existing one. Keys default to your wallet — check the box to generate separate keys and download them.",
    ],
    [
      "Mint the NFT",
      "One final approval: TokenMintTransaction with the metadata HRL as on-chain metadata bytes. HashScan and wallets resolve the full chain: NFT → metadata HRL → JSON → image HRL → image bytes.",
    ],
  ]
    .map(
      ([title, body], i) => `
    <div style="position:relative;margin-bottom:28px;padding-left:4px;">
      <div style="position:absolute;left:-26px;top:4px;width:20px;height:20px;border-radius:50%;background:var(--surface);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:var(--mono);color:var(--accent);">${
        i + 1
      }</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:7px;">${title}</div>
      <div style="font-size:13px;color:var(--text-dim);line-height:1.7;">${body}</div>
    </div>
  `
    )
    .join("");
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
