export function renderApp() {
  return `
<nav class="topnav">
  <div class="logo">
    <div class="logo-hex">⬡</div>
    <div>
      <div class="logo-name">Hashinal Forge</div>
      <div class="logo-sub">HCS-5 · Shared Topic Architecture</div>
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

<!-- ═══ MINT ═══ -->
<div class="page active" id="page-mint">
  <div class="page-header">
    <div class="page-title">Mint a <span>Hashinal NFT</span></div>
    <div class="page-subtitle">Shared collection topic architecture — one topic, many NFTs, minimal wallet approvals.</div>
  </div>

  <div id="walletGate" class="warn-box">
    <strong>🔌 Connect your wallet first.</strong> Click <strong>Connect Wallet</strong> top right. Your private key never touches this app.
  </div>

  <div class="flow-steps" id="flowSteps">
    <div class="flow-step active" data-step="1" id="fstep-1">
      <div class="flow-num">1</div>
      <div><div class="flow-label">Topic</div><div class="flow-sublabel">Collection topic</div></div>
    </div>
    <div class="flow-step" data-step="2" id="fstep-2">
      <div class="flow-num">2</div>
      <div><div class="flow-label">Image</div><div class="flow-sublabel">128×128 recommended</div></div>
    </div>
    <div class="flow-step" data-step="3" id="fstep-3">
      <div class="flow-num">3</div>
      <div><div class="flow-label">Metadata</div><div class="flow-sublabel">HIP-412 JSON</div></div>
    </div>
    <div class="flow-step" data-step="4" id="fstep-4">
      <div class="flow-num">4</div>
      <div><div class="flow-label">Token &amp; Keys</div><div class="flow-sublabel">Configure token</div></div>
    </div>
    <div class="flow-step" data-step="5" id="fstep-5">
      <div class="flow-num">5</div>
      <div><div class="flow-label">Mint</div><div class="flow-sublabel">Sign &amp; submit</div></div>
    </div>
  </div>

  <!-- STEP 1: COLLECTION TOPIC -->
  <div class="mint-panel active" id="mp-1">
    <div class="info-box">
      <strong>Step 1 — Collection Topic</strong><br>
      Create one shared HCS-1 topic for your entire collection, or paste an existing Topic ID to add to an existing collection. All images and metadata are inscribed into this single topic, referenced by unique <code>inscription_id</code>s — minimizing wallet approvals and fees.
    </div>

    <div class="card">
      <div class="card-header"><div class="card-dot"></div><div class="card-title">Collection Topic</div></div>

      <div class="form-group" style="margin-bottom:16px;">
        <label>Existing Topic ID <span style="color:var(--text-muted);font-weight:400;">(leave blank to create new)</span></label>
        <input type="text" id="m_topicId" placeholder="0.0.123456 — paste your collection topic ID here" />
      </div>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="flex:1;height:1px;background:var(--border);"></div>
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--mono);">OR CREATE NEW</span>
        <div style="flex:1;height:1px;background:var(--border);"></div>
      </div>

      <div class="form-grid" style="margin-bottom:12px;">
        <div class="form-group">
          <label>Collection Name (for topic memo)</label>
          <input type="text" id="m_collectionName2" placeholder="Genesis Hashinals" />
        </div>
        <div class="form-group" style="justify-content:flex-end;">
          <label style="visibility:hidden;">Create</label>
          <button class="btn btn-ghost" id="createTopicBtn" style="height:44px;">+ Create New Topic</button>
        </div>
      </div>

      <div class="success-box" id="topicSuccess" style="display:none;"></div>

      <div class="warn-box" style="margin-bottom:0;">
        <strong>💾 Save your Topic ID!</strong> Paste it back in Step 1 for every future mint in this collection. Without it you'll create a new topic each time.
      </div>
    </div>

    <div class="actions">
      <div></div>
      <button class="btn btn-primary" id="step1Next">Next: Upload Image →</button>
    </div>
  </div>

  <!-- STEP 2: IMAGE -->
  <div class="mint-panel" id="mp-2">
    <div class="info-box">
      <strong>Step 2 — Upload Artwork</strong><br>
      Recommended: <strong>128×128 PNG</strong> (~15KB) = ~2-4 wallet approvals for the image. Each 4KB chunk requires one approval. Larger files = more approvals.
    </div>

    <div class="card">
      <div class="card-header"><div class="card-dot"></div><div class="card-title">NFT Artwork</div></div>
      <div class="file-drop" id="imgDrop">
        <input type="file" id="imgInput" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" />
        <span class="drop-icon">🖼</span>
        <div class="drop-text">Drop artwork or click to browse</div>
        <div class="drop-hint">Recommended: 128×128 PNG · Keep under 50KB · Fewer KB = fewer wallet approvals</div>
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
      <button class="btn btn-secondary" data-goto="1">← Back</button>
      <button class="btn btn-primary" id="step2Next">Next: Build Metadata →</button>
    </div>
  </div>

  <!-- STEP 3: METADATA -->
  <div class="mint-panel" id="mp-3">
    <div class="info-box">
      <strong>Step 3 — NFT Metadata</strong><br>
      The <code>image</code> field will be automatically set to your image HRL after inscription. This JSON is also inscribed to the shared topic (3 approvals).
    </div>

    <div class="card">
      <div class="card-header"><div class="card-dot"></div><div class="card-title">NFT Details (HIP-412)</div></div>
      <div class="form-grid">
        <div class="form-group"><label>NFT Name *</label><input id="m_name" placeholder="Hashinal #001" /></div>
        <div class="form-group"><label>Creator</label><input id="m_creator" placeholder="Artist Name" /></div>
        <div class="form-group full"><label>Description</label><textarea id="m_desc" placeholder="A fully on-chain NFT inscribed on Hedera..."></textarea></div>
        <div class="form-group"><label>Collection</label><input id="m_collection" placeholder="Genesis Hashinals" /></div>
        <div class="form-group"><label>Category</label>
          <select id="m_cat">
            <option value="art">Art</option><option value="collectible">Collectible</option>
            <option value="gaming">Gaming</option><option value="music">Music</option>
            <option value="photography">Photography</option><option value="pfp">PFP</option>
            <option value="other">Other</option>
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
      <button class="btn btn-secondary" data-goto="2">← Back</button>
      <button class="btn btn-primary" id="step3Next">Next: Token &amp; Keys →</button>
    </div>
  </div>

  <!-- STEP 4: TOKEN & KEYS -->
  <div class="mint-panel" id="mp-4">
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
          <div style="font-size:11px;color:var(--text-muted);margin-top:5px;font-family:var(--mono);">Connected wallet must be the supply key holder.</div>
        </div>
      </div>
    </div>

    <!-- KEY OPTIONS -->
    <div class="card">
      <div class="card-header"><div class="card-dot purple"></div><div class="card-title">Token Keys</div></div>

      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface2);border-radius:9px;margin-bottom:16px;">
        <input type="checkbox" id="useWalletKeyAll" checked style="width:18px;height:18px;cursor:pointer;accent-color:var(--accent3);" />
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text);">Use wallet key for all roles</div>
          <div style="font-size:12px;color:var(--text-dim);">Supply, Admin, Freeze, Pause keys all default to your connected wallet account key — nothing extra to remember.</div>
        </div>
      </div>

      <div id="advancedKeyOptions" style="display:none;">
        <div class="info-box" style="margin-bottom:16px;">
          Custom keys are generated in your browser and downloaded as a <code>.txt</code> file. Store them safely — they control your token. The wallet key is still used for signing transactions.
        </div>

        <!-- SUPPLY KEY -->
        <div style="margin-bottom:14px;padding:14px;background:var(--surface2);border-radius:9px;border:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="font-size:13px;font-weight:700;color:var(--text);">Supply Key</div>
            <div style="font-size:11px;color:var(--text-muted);">Controls minting new serials</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;" id="customrow_supply">
            <input type="checkbox" id="custom_supply" style="accent-color:var(--accent2);" />
            <label for="custom_supply" style="font-size:12px;color:var(--text-dim);cursor:pointer;text-transform:none;letter-spacing:0;">Use a separate generated key instead of wallet key</label>
          </div>
          <div style="display:flex;align-items:center;gap:10px;" id="genrow_supply" style="display:none;">
            <button class="btn btn-ghost btn-sm" id="gen_supply">Generate Key</button>
            <div id="key_display_supply" style="display:none;flex:1;"></div>
          </div>
        </div>

        <!-- ADMIN KEY -->
        ${keyRoleCard(
          "admin",
          "Admin Key",
          "Allows updating or deleting the token"
        )}
        <!-- FREEZE KEY -->
        ${keyRoleCard(
          "freeze",
          "Freeze Key",
          "Allows freezing accounts from transacting"
        )}
        <!-- PAUSE KEY -->
        ${keyRoleCard(
          "pause",
          "Pause Key",
          "Allows pausing all token transactions"
        )}
        <!-- WIPE KEY -->
        ${keyRoleCard(
          "wipe",
          "Wipe Key",
          "Allows wiping tokens from accounts — use with caution"
        )}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-dot green"></div><div class="card-title">Mint Options</div></div>
      <div class="form-grid">
        <div class="form-group"><label>Copies to Mint</label><input type="number" id="m_mintCount" value="1" min="1" max="10" /></div>
        <div class="form-group"><label>Network</label>
          <select id="m_network"><option value="testnet">Testnet</option><option value="mainnet">Mainnet</option></select>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" data-goto="3">← Back</button>
      <button class="btn btn-primary" id="step4Next">Review &amp; Mint →</button>
    </div>
  </div>

  <!-- STEP 5: MINT -->
  <div class="mint-panel" id="mp-5">

    <div class="card" id="summaryCard">
      <div class="card-header"><div class="card-dot"></div><div class="card-title">Summary</div></div>
      <div id="summaryContent"></div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-dot green"></div><div class="card-title">Cost &amp; Approvals Estimate</div></div>
      <table class="cost-table">
        <thead><tr><th>Operation</th><th class="amt">Est. USD</th></tr></thead>
        <tbody>
          <tr><td>Image inscription (HCS messages)</td><td class="amt" id="c-img">~$0.003</td></tr>
          <tr><td>Metadata JSON inscription</td><td class="amt">~$0.0001</td></tr>
          <tr><td id="c-token-lbl">Token creation (HTS)</td><td class="amt" id="c-token">~$1.00</td></tr>
          <tr><td>NFT mint × <span id="c-cnt">1</span></td><td class="amt" id="c-mint">~$0.05</td></tr>
          <tr><td><strong>Estimated Total</strong></td><td class="amt" id="c-total"><strong>~$1.06</strong></td></tr>
          <tr><td><strong>Wallet Approvals</strong></td><td class="amt" id="c-approvals" style="color:var(--warn);">calculating...</td></tr>
        </tbody>
      </table>
    </div>

    <div class="success-box">
      <strong>✓ Ready.</strong> HashPack will prompt you for each approval. Keep the extension open and approve each transaction. The topic ID will be shown at the end — save it for future mints.
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
      <div class="result-sub">Fully on-chain. Image and metadata live in the shared collection topic permanently.</div>
      <div class="result-grid" id="resultGrid"></div>
      <div class="hashscan-btns" id="hashscanBtns"></div>
    </div>

    <div class="actions" id="mintActions">
      <button class="btn btn-secondary" data-goto="4">← Back</button>
      <button class="btn btn-primary btn-lg" id="mintBtn">⬡ &nbsp;Sign &amp; Mint Hashinal</button>
    </div>
  </div>
</div><!-- /page-mint -->


<!-- ═══ VIEWER ═══ -->
<div class="page" id="page-viewer">
  <div class="page-header">
    <div class="page-title">Hashinal <span>Viewer</span></div>
    <div class="page-subtitle">Resolve any Hashinal by Token ID + serial. Supports both shared topic and legacy per-NFT topic HRLs.</div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-dot"></div><div class="card-title">Look Up a Hashinal</div></div>
    <div class="form-grid">
      <div class="form-group"><label>Token ID</label><input id="v_tokenId" placeholder="0.0.123456" /></div>
      <div class="form-group"><label>Serial Number</label><input type="number" id="v_serial" placeholder="1" min="1" /></div>
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;">
      <button class="btn btn-primary" id="lookupBtn">🔍 Resolve Hashinal</button>
      <button class="btn btn-secondary" id="demoBtn">Load Demo</button>
    </div>
  </div>
  <div style="display:none;" id="viewerLoading" class="card">
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;color:var(--text-dim);font-size:14px;padding:20px;">
      <div class="spin" style="width:20px;height:20px;border-width:2.5px;"></div>
      Resolving on-chain data...
    </div>
  </div>
  <div class="viewer-empty" id="viewerEmpty">
    <span class="viewer-empty-icon">⬡</span>
    <div>Enter a Token ID and serial to view a Hashinal</div>
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
</div>


<!-- ═══ DIRECTIONS ═══ -->
<div class="page" id="page-directions">
  <div class="page-header">
    <div class="page-title">How <span>Hashinals Work</span></div>
    <div class="page-subtitle">Shared collection topic architecture — minimal approvals, fully on-chain.</div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-dot green"></div><div class="card-title">Data Chain</div></div>
    <div style="font-family:var(--mono);font-size:12px;line-height:2.4;color:var(--text-dim);padding:4px 0;">
      <div style="color:var(--text);">NFT on-chain metadata field</div>
      <div style="padding-left:20px;">└─ <span style="color:var(--accent);">hcs://1/0.0.TOPIC?inscription_id=meta-xxx</span></div>
      <div style="padding-left:40px;">└─ JSON: { name, image: "<span style="color:var(--warn);">hcs://1/0.0.TOPIC?inscription_id=img-xxx</span>", ... }</div>
      <div style="padding-left:60px;">└─ Image chunks in shared topic, filtered by inscription_id</div>
      <div style="padding-left:80px;">└─ <span style="color:var(--accent3);">✓ Permanent on Hedera — one topic, many NFTs</span></div>
    </div>
  </div>

  <div style="position:relative;padding-left:36px;" id="dirTimeline"></div>

  <div class="actions" style="border-top:none;">
    <div></div>
    <button class="btn btn-primary" data-page="mint">Start Minting →</button>
  </div>
</div>

</div><!-- /main -->

<!-- WALLET MODAL -->
<div class="modal-overlay" id="walletModal" style="display:none;">
  <div class="modal">
    <button class="modal-close" id="modalClose">✕</button>
    <div class="modal-title">Connect Wallet</div>
    <div class="modal-sub">Your private key never leaves your wallet. Transactions are signed locally via WalletConnect.</div>
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
      <div style="font-size:12px;color:var(--text-dim);">Approve the connection in your wallet</div>
    </div>
    <div style="margin-top:14px;">
      <div class="warn-box" style="margin-bottom:10px;font-size:12px;">
        Need a WalletConnect Project ID? Get one free at <a href="https://cloud.walletconnect.com" target="_blank">cloud.walletconnect.com</a>
      </div>
      <div class="form-group">
        <label>WalletConnect Project ID</label>
        <input id="wcProjectId" placeholder="Paste your Project ID" style="font-family:var(--mono);font-size:13px;" />
      </div>
    </div>
  </div>
</div>
`;
}

function keyRoleCard(role, label, description) {
  return `
    <div style="margin-bottom:14px;padding:14px;background:var(--surface2);border-radius:9px;border:1px solid var(--border);" id="row_${role}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <input type="checkbox" id="enable_${role}" style="accent-color:var(--accent2);" />
        <label for="enable_${role}" style="font-size:13px;font-weight:700;color:var(--text);cursor:pointer;text-transform:none;letter-spacing:0;">${label}</label>
        <div style="font-size:11px;color:var(--text-muted);">${description}</div>
      </div>
      <div style="display:none;align-items:center;gap:10px;margin-bottom:8px;" id="customrow_${role}">
        <input type="checkbox" id="custom_${role}" style="accent-color:var(--accent2);margin-left:28px;" />
        <label for="custom_${role}" style="font-size:12px;color:var(--text-dim);cursor:pointer;text-transform:none;letter-spacing:0;">Use separate generated key (recommended)</label>
      </div>
      <div style="display:none;align-items:center;gap:10px;" id="genrow_${role}">
        <div style="width:28px;"></div>
        <button class="btn btn-ghost btn-sm" id="gen_${role}">Generate Key</button>
        <div id="key_display_${role}" style="display:none;flex:1;"></div>
      </div>
    </div>
  `;
}
