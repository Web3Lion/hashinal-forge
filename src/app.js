export function renderApp() {
  return `
<!-- TOP NAV -->
<nav class="topnav">
  <div class="logo">
    <div class="logo-hex">⬡</div>
    <div>
      <div class="logo-name">Hashinal Forge</div>
      <div class="logo-sub">HCS-5 · Real Transactions</div>
    </div>
  </div>
  <div class="nav-tabs">
    <button class="nav-tab active" data-page="mint">⬡ <span>Mint</span></button>
    <button class="nav-tab" data-page="viewer">🔍 <span>Viewer</span></button>
    <button class="nav-tab" data-page="directions">📖 <span>How It Works</span></button>
  </div>
  <div class="nav-right">
    <div class="net-pill" id="netPill">
      <span class="dot" id="netDot"></span>
      <span id="netLabel">TESTNET</span>
    </div>
    <button class="wallet-btn" id="walletBtn">
      <span class="w-dot" id="walletDot"></span>
      <span id="walletBtnLabel">Connect Wallet</span>
    </button>
  </div>
</nav>

<div class="main">

<!-- ═══ PAGE: MINT ═══ -->
<div class="page active" id="page-mint">
  <div class="page-header">
    <div class="page-title">Mint a <span>Hashinal NFT</span></div>
    <div class="page-subtitle">Real on-chain transactions via your connected HashPack wallet. No private key required in the browser.</div>
  </div>

  <!-- WALLET REQUIRED GATE -->
  <div id="walletGate" class="warn-box">
    <strong>🔌 Connect your wallet first.</strong> Click <strong>Connect Wallet</strong> in the top right to link HashPack, Blade, or Kabila. Your private key never touches this app — the wallet signs every transaction.
  </div>

  <!-- FLOW STEPS -->
  <div class="flow-steps" id="flowSteps">
    <div class="flow-step active" data-step="1" id="fstep-1">
      <div class="flow-num">1</div>
      <div><div class="flow-label">Image</div><div class="flow-sublabel">Upload &amp; inscribe</div></div>
    </div>
    <div class="flow-step" data-step="2" id="fstep-2">
      <div class="flow-num">2</div>
      <div><div class="flow-label">Metadata</div><div class="flow-sublabel">Build JSON</div></div>
    </div>
    <div class="flow-step" data-step="3" id="fstep-3">
      <div class="flow-num">3</div>
      <div><div class="flow-label">Token</div><div class="flow-sublabel">Create or select</div></div>
    </div>
    <div class="flow-step" data-step="4" id="fstep-4">
      <div class="flow-num">4</div>
      <div><div class="flow-label">Mint</div><div class="flow-sublabel">Sign &amp; submit</div></div>
    </div>
  </div>

  <!-- STEP 1: IMAGE -->
  <div class="mint-panel active" id="mp-1">
    <div class="info-box">
      <strong>Step 1 — Upload &amp; Inscribe Image to HCS-1</strong><br>
      Your image is the first thing that goes on-chain. It's chunked into HCS-1 consensus messages. Each chunk requires a wallet signature. You'll receive an <strong>Image HRL</strong>: <code>hcs://1/&lt;topicId&gt;</code> — referenced later in the metadata JSON.
    </div>
    <div class="card">
      <div class="card-header"><div class="card-dot"></div><div class="card-title">NFT Artwork</div></div>
      <div class="file-drop" id="imgDrop">
        <input type="file" id="imgInput" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" />
        <span class="drop-icon">🖼</span>
        <div class="drop-text">Drop artwork or click to browse</div>
        <div class="drop-hint">PNG · JPEG · GIF · SVG · WEBP — keep under 80KB to minimise chunks &amp; fees</div>
      </div>
      <div class="file-preview" id="imgPreview">
        <img id="imgThumb" src="" alt="preview" />
        <div class="fp-info">
          <div class="fp-name" id="imgName"></div>
          <div class="fp-meta" id="imgMeta"></div>
        </div>
        <button class="fp-remove" id="imgClear">✕</button>
      </div>
    </div>
    <div class="actions">
      <div></div>
      <button class="btn btn-primary" id="step1Next">Next: Build Metadata →</button>
    </div>
  </div>

  <!-- STEP 2: METADATA -->
  <div class="mint-panel" id="mp-2">
    <div class="info-box">
      <strong>Step 2 — Build Metadata JSON</strong><br>
      The <code>image</code> field will be set to your image HRL after it's inscribed. This JSON is also inscribed to HCS-1, producing a <strong>Metadata HRL</strong> that gets stored in the NFT.
    </div>
    <div class="card">
      <div class="card-header"><div class="card-dot"></div><div class="card-title">NFT Details (HIP-412)</div></div>
      <div class="form-grid">
        <div class="form-group"><label>NFT Name *</label><input id="m_name" placeholder="Hashinal #001" /></div>
        <div class="form-group"><label>Creator</label><input id="m_creator" placeholder="Artist Name" /></div>
        <div class="form-group full"><label>Description</label><textarea id="m_desc" placeholder="A fully on-chain NFT on Hedera..."></textarea></div>
        <div class="form-group"><label>Collection</label><input id="m_collection" placeholder="Genesis Hashinals" /></div>
        <div class="form-group"><label>Category</label>
          <select id="m_cat">
            <option value="art">Art</option><option value="collectible">Collectible</option>
            <option value="gaming">Gaming</option><option value="music">Music</option>
            <option value="photography">Photography</option><option value="pfp">PFP</option><option value="other">Other</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-dot purple"></div><div class="card-title">Traits / Attributes</div></div>
      <div class="attr-list" id="attrList"></div>
      <button class="btn btn-ghost btn-sm" id="addAttrBtn">+ Add Trait</button>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-dot green"></div><div class="card-title">Live JSON Preview</div></div>
      <div class="json-preview" id="metaPreview"></div>
    </div>
    <div class="actions">
      <button class="btn btn-secondary" data-goto="1">← Back</button>
      <button class="btn btn-primary" id="step2Next">Next: Token Setup →</button>
    </div>
  </div>

  <!-- STEP 3: TOKEN -->
  <div class="mint-panel" id="mp-3">
    <div class="info-box">
      <strong>Step 3 — Token Configuration</strong><br>
      Create a new NFT collection token, or mint into an existing one. <strong>Important:</strong> the token's supply key must match the account connected in your wallet so it can sign the mint transaction.
    </div>
    <div class="card">
      <div class="card-header"><div class="card-dot"></div><div class="card-title">Token Mode</div></div>
      <div class="toggle-row" style="margin-bottom:16px;">
        <button class="toggle-opt active" id="tmode-new">Create New Token</button>
        <button class="toggle-opt" id="tmode-existing">Use Existing Token</button>
      </div>
      <div id="tfields-new">
        <div class="form-grid">
          <div class="form-group"><label>Token Name *</label><input id="m_tokenName" placeholder="Hashinals Collection" /></div>
          <div class="form-group"><label>Symbol *</label><input id="m_tokenSymbol" placeholder="HASH" /></div>
          <div class="form-group"><label>Max Supply (0 = infinite)</label><input type="number" id="m_maxSupply" value="10000" min="0" /></div>
          <div class="form-group"><label>Supply Type</label>
            <select id="m_supplyType"><option value="FINITE">Finite</option><option value="INFINITE">Infinite</option></select>
          </div>
        </div>
      </div>
      <div id="tfields-existing" style="display:none;">
        <div class="form-group">
          <label>Token ID *</label>
          <input id="m_existingToken" placeholder="0.0.123456" />
          <div style="font-size:11px;color:var(--text-muted);margin-top:5px;font-family:var(--mono);">The connected wallet account must be the supply key holder for this token.</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-dot purple"></div><div class="card-title">Mint Options</div></div>
      <div class="form-grid">
        <div class="form-group"><label>Copies to Mint</label><input type="number" id="m_mintCount" value="1" min="1" max="100" /></div>
        <div class="form-group"><label>Network</label>
          <select id="m_network"><option value="testnet">Testnet</option><option value="mainnet">Mainnet</option></select>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-dot green"></div><div class="card-title">Cost Estimate</div></div>
      <table class="cost-table">
        <thead><tr><th>Operation</th><th class="amt">Est. USD</th></tr></thead>
        <tbody>
          <tr><td>Image inscription (HCS messages)</td><td class="amt" id="c-img">~$0.005</td></tr>
          <tr><td>Metadata JSON inscription</td><td class="amt">~$0.0001</td></tr>
          <tr><td id="c-token-lbl">Token creation (HTS)</td><td class="amt" id="c-token">~$1.00</td></tr>
          <tr><td>NFT mint × <span id="c-cnt">1</span></td><td class="amt" id="c-mint">~$0.05</td></tr>
          <tr><td><strong>Estimated Total</strong></td><td class="amt" id="c-total"><strong>~$1.06</strong></td></tr>
        </tbody>
      </table>
    </div>
    <div class="actions">
      <button class="btn btn-secondary" data-goto="2">← Back</button>
      <button class="btn btn-primary" id="step3Next">Review &amp; Mint →</button>
    </div>
  </div>

  <!-- STEP 4: MINT -->
  <div class="mint-panel" id="mp-4">
    <div class="success-box" id="readyBox">
      <strong>✓ Ready to mint.</strong> Your wallet will prompt you to approve each transaction. Keep HashPack open.
    </div>

    <div class="card" id="summaryCard">
      <div class="card-header"><div class="card-dot"></div><div class="card-title">Summary</div></div>
      <div id="summaryContent" style="font-size:13px;color:var(--text-dim);line-height:2.2;"></div>
    </div>

    <div class="card" id="progressCard" style="display:none;">
      <div class="card-header"><div class="card-dot green"></div><div class="card-title">Transaction Progress</div></div>
      <div class="prog-bar"><div class="prog-fill" id="progFill"></div></div>
      <div class="prog-labels"><span id="progLabel">Initializing...</span><span id="progPct">0%</span></div>
      <div class="tx-log" id="txLog"></div>
    </div>

    <div class="result-banner" id="mintResult">
      <span class="result-icon">✅</span>
      <div class="result-title">HASHINAL MINTED!</div>
      <div class="result-sub">Your NFT is fully inscribed on Hedera. Image and metadata live on-chain forever.</div>
      <div class="result-grid" id="resultGrid"></div>
      <div class="hashscan-btns" id="hashscanBtns"></div>
    </div>

    <div class="actions" id="mintActions">
      <button class="btn btn-secondary" data-goto="3">← Back</button>
      <button class="btn btn-primary btn-lg" id="mintBtn">⬡ &nbsp;Sign &amp; Mint Hashinal</button>
    </div>
  </div>
</div><!-- /page-mint -->


<!-- ═══ PAGE: VIEWER ═══ -->
<div class="page" id="page-viewer">
  <div class="page-header">
    <div class="page-title">Hashinal <span>Viewer</span></div>
    <div class="page-subtitle">Look up any Hashinal NFT by Token ID + serial. Resolves the on-chain HRL and displays inscribed data.</div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-dot"></div><div class="card-title">Look Up a Hashinal</div></div>
    <div class="form-grid">
      <div class="form-group"><label>Token ID</label><input id="v_tokenId" placeholder="0.0.123456" /></div>
      <div class="form-group"><label>Serial Number</label><input type="number" id="v_serial" placeholder="1" min="1" /></div>
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-primary" id="lookupBtn">🔍 Resolve Hashinal</button>
      <button class="btn btn-secondary" id="demoBtn">Load Demo</button>
    </div>
  </div>
  <div style="display:none;" id="viewerLoading" class="card" style="text-align:center;padding:32px;">
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;color:var(--text-dim);font-size:14px;">
      <div class="spin" style="width:20px;height:20px;border-width:2.5px;"></div>
      Resolving on-chain data via Mirror Node...
    </div>
  </div>
  <div class="viewer-empty" id="viewerEmpty">
    <span class="viewer-empty-icon">⬡</span>
    <div>Enter a Token ID and serial number to view a Hashinal</div>
  </div>
  <div class="card nft-display" id="nftDisplay">
    <div class="nft-grid-2">
      <div class="nft-img-wrap" id="nftImgWrap"><span style="font-size:64px;opacity:0.3">🖼</span></div>
      <div class="nft-info">
        <div class="nft-name-big" id="nftName">—</div>
        <div class="nft-creator" id="nftCreator">—</div>
        <div class="nft-desc-text" id="nftDescText">—</div>
        <div class="trait-pills" id="nftTraits"></div>
        <div id="nftMetaRows"></div>
      </div>
    </div>
    <div style="padding:18px 22px;border-top:1px solid var(--border);">
      <div class="card-header" style="margin-bottom:10px;"><div class="card-dot green"></div><div class="card-title">On-Chain References</div></div>
      <div id="nftHRLs"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;" id="nftLinks"></div>
    </div>
  </div>
</div><!-- /page-viewer -->


<!-- ═══ PAGE: DIRECTIONS ═══ -->
<div class="page" id="page-directions">
  <div class="page-header">
    <div class="page-title">How <span>Hashinals Work</span></div>
    <div class="page-subtitle">The exact HCS-5 process — what goes on-chain, in what order, and why.</div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-dot"></div><div class="card-title">What is a Hashinal?</div></div>
    <p style="font-size:14px;color:var(--text-dim);line-height:1.7;margin-bottom:10px;">A <strong style="color:var(--text);">Hashinal</strong> is an NFT where all data lives on Hedera — no IPFS, no Arweave. Artwork and metadata are inscribed into <strong style="color:var(--text);">HCS-1 consensus topic messages</strong>. The HTS NFT's metadata field stores a <strong style="color:var(--text);">Hashinal Reference Locator (HRL)</strong> in the form <code>hcs://1/&lt;topicId&gt;</code>.</p>
    <p style="font-size:14px;color:var(--text-dim);line-height:1.7;">Because HCS-1 topics are permanent and immutable, your NFT data can never be taken down, changed, or lost.</p>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-dot green"></div><div class="card-title">Data Chain</div></div>
    <div style="font-family:var(--mono);font-size:12px;line-height:2.4;color:var(--text-dim);padding:4px 0;">
      <div style="color:var(--text);">NFT on-chain metadata field</div>
      <div style="padding-left:20px;">└─ <span style="color:var(--accent);">hcs://1/0.0.AAABBB</span> ← Metadata HRL</div>
      <div style="padding-left:40px;">└─ JSON: { name, description, <span style="color:var(--warn);">image</span>: "hcs://1/0.0.XXXYYY", attributes... }</div>
      <div style="padding-left:60px;">└─ <span style="color:var(--accent);">hcs://1/0.0.XXXYYY</span> ← Image HRL</div>
      <div style="padding-left:80px;">└─ HCS-1 topic messages (chunked base64 image bytes)</div>
      <div style="padding-left:100px;">└─ <span style="color:var(--accent3);">✓ Permanent on Hedera — no external servers</span></div>
    </div>
  </div>

  <div style="position:relative;padding-left:36px;" id="dirTimeline"></div>

  <div class="card" style="margin-top:8px;">
    <div class="card-header"><div class="card-dot green"></div><div class="card-title">Why WalletConnect Instead of a Pasted Key?</div></div>
    <div style="font-size:14px;color:var(--text-dim);line-height:1.7;">
      When you connect HashPack (or Blade/Kabila), your private key <strong style="color:var(--text);">never leaves your wallet</strong>. The app builds unsigned transactions, sends them to your wallet via WalletConnect v2, and your wallet signs them locally before broadcasting. This is the same model used by every major DeFi dApp — your key stays on your device, always.
    </div>
    <div style="margin-top:14px;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:14px;font-family:var(--mono);font-size:12px;line-height:1.9;color:var(--text-dim);">
      Browser App &nbsp;<span style="color:var(--accent);">──builds──►</span>&nbsp; Unsigned Tx<br>
      Unsigned Tx &nbsp;<span style="color:var(--accent);">──sends──►</span>&nbsp; HashPack (via WalletConnect)<br>
      HashPack &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--accent3);">──signs──►</span>&nbsp; Signed Tx &nbsp;<span style="color:var(--accent3);">──broadcasts──►</span>&nbsp; Hedera Network<br>
      <span style="color:var(--text-muted);">// Your private key never touches the browser app ✓</span>
    </div>
  </div>

  <div class="actions" style="border-top:none;">
    <div></div>
    <button class="btn btn-primary" data-page="mint">Start Minting →</button>
  </div>
</div><!-- /page-directions -->

</div><!-- /main -->

<!-- WALLET MODAL -->
<div class="modal-overlay" id="walletModal" style="display:none;">
  <div class="modal">
    <button class="modal-close" id="modalClose">✕</button>
    <div class="modal-title">Connect Wallet</div>
    <div class="modal-sub">Choose a WalletConnect-compatible Hedera wallet. Your private key never leaves your wallet.</div>
    <div id="walletOptions">
      <div class="wallet-option" data-wallet="hashpack">
        <div class="wallet-icon">🟣</div>
        <div><div class="wallet-name">HashPack</div><div class="wallet-desc">Most popular Hedera wallet</div></div>
      </div>
      <div class="wallet-option" data-wallet="blade">
        <div class="wallet-icon">⚡</div>
        <div><div class="wallet-name">Blade Wallet</div><div class="wallet-desc">Gaming &amp; DeFi focused</div></div>
      </div>
      <div class="wallet-option" data-wallet="kabila">
        <div class="wallet-icon">📱</div>
        <div><div class="wallet-name">Kabila</div><div class="wallet-desc">Mobile-first wallet</div></div>
      </div>
    </div>
    <div id="walletConnecting" style="display:none;text-align:center;padding:20px 0;">
      <div class="spin" style="width:28px;height:28px;border-width:3px;margin:0 auto 14px;"></div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;" id="connectingMsg">Opening WalletConnect...</div>
      <div style="font-size:12px;color:var(--text-dim);">Approve the connection request in your wallet</div>
    </div>
    <div style="margin-top:14px;">
      <div class="warn-box" style="margin-bottom:0;font-size:12px;">
        <strong>Need a WalletConnect Project ID?</strong> Get one free at <a href="https://cloud.walletconnect.com" target="_blank">cloud.walletconnect.com</a>. Enter it in the field below:
      </div>
      <div class="form-group" style="margin-top:10px;">
        <label>WalletConnect Project ID</label>
        <input id="wcProjectId" placeholder="Paste your Project ID here" style="font-family:var(--mono);font-size:13px;" />
      </div>
    </div>
  </div>
</div>
`
}
