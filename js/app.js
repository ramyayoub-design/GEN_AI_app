// app.js — FlatDream main orchestration

// ---- State ----
let currentMode = 'txt2img';
let img2imgFile = null;
let multi1File  = null;
let multi2File  = null;
let threedFile  = null;
let generatedImages = [];
window._currentFilter = '';  // Fix 5: shared filter string

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initModes();
  initUploads();
  initGenerate();
  initMagazine();
  init3D();
  initConfig();
  initLoraStrength();
  initFilters();        // Fix 5
  initPromptResize();   // Fix 3
  Magazine.init();
  pingAll();
  loadConfigUI();
});

// ---- Ping all services ----
async function pingAll() {
  const cfg = Config.get();
  const comfy   = await ComfyUI.ping(cfg.comfyUrl);
  const lm      = await LMStudio.ping();
  const comfy3d = await ComfyUI.ping(cfg.comfy3dUrl);
  document.getElementById('comfyDot').className   = 'status-dot ' + (comfy   ? 'dot-green' : 'dot-red');
  document.getElementById('lmDot').className      = 'status-dot ' + (lm      ? 'dot-green' : 'dot-red');
  document.getElementById('comfy3dDot').className = 'status-dot ' + (comfy3d ? 'dot-green' : 'dot-red');
}

// ---- Tab navigation ----
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ---- Mode switching (Fix 8, 9: split-mode for img2img/multi) ----
function initModes() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;

      const inputsCol   = document.getElementById('genInputsCol');
      const contentArea = document.getElementById('genContentArea');
      document.querySelectorAll('.input-section').forEach(s => s.classList.remove('active'));

      if (currentMode === 'txt2img') {
        inputsCol.classList.add('hidden');
        contentArea.classList.remove('split-mode');
      } else {
        inputsCol.classList.remove('hidden');
        contentArea.classList.add('split-mode');
        const sec = document.getElementById(`inputSection-${currentMode}`);
        if (sec) sec.classList.add('active');
      }

      const placeholders = {
        txt2img:  'Describe your architectural scene… trigger word torzev is added automatically',
        img2img:  'Describe the transformation…',
        multiimg: 'Describe how to combine both references…'
      };
      document.getElementById('mainPrompt').placeholder = placeholders[currentMode] || '';

      const labels = { txt2img: 'TEXT → IMAGE', img2img: 'IMAGE → IMAGE', multiimg: 'MULTI REFERENCE' };
      document.getElementById('modeBillboard').textContent = labels[currentMode];
    });
  });
}

// ---- Fix 3: Auto-resize prompt textarea ----
function initPromptResize() {
  const ta = document.getElementById('mainPrompt');
  if (!ta) return;
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    const maxH = 120;
    ta.style.height = Math.min(ta.scrollHeight, maxH) + 'px';
  });
}

// ---- Fix 5: CSS filter controls ----
function initFilters() {
  const defs = [
    { id: 'filterBrightness', valId: 'filterBrightnessVal', unit: '%' },
    { id: 'filterContrast',   valId: 'filterContrastVal',   unit: '%' },
    { id: 'filterSaturation', valId: 'filterSaturationVal', unit: '%' },
    { id: 'filterHue',        valId: 'filterHueVal',        unit: '°' },
  ];
  defs.forEach(({ id, valId, unit }) => {
    const slider = document.getElementById(id);
    const label  = document.getElementById(valId);
    if (!slider) return;
    slider.addEventListener('input', () => {
      label.textContent = slider.value + unit;
      applyFilters();
    });
  });
  const resetBtn = document.getElementById('filterResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.getElementById('filterBrightness').value = 100;
      document.getElementById('filterContrast').value   = 100;
      document.getElementById('filterSaturation').value = 100;
      document.getElementById('filterHue').value        = 0;
      document.getElementById('filterBrightnessVal').textContent = '100%';
      document.getElementById('filterContrastVal').textContent   = '100%';
      document.getElementById('filterSaturationVal').textContent = '100%';
      document.getElementById('filterHueVal').textContent        = '0°';
      applyFilters();
    });
  }
}

function applyFilters() {
  const b  = document.getElementById('filterBrightness')?.value  || 100;
  const c  = document.getElementById('filterContrast')?.value    || 100;
  const s  = document.getElementById('filterSaturation')?.value  || 100;
  const h  = document.getElementById('filterHue')?.value         || 0;
  const f  = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg)`;
  window._currentFilter = f;
  document.querySelectorAll('.output-img').forEach(img => { img.style.filter = f; });
}

// ---- Upload zones ----
function initUploads() {
  setupUpload('img2imgUploadZone', 'img2imgFile', 'img2imgPreview', file => { img2imgFile = file; });
  setupUpload('multi1UploadZone',  'multi1File',  'multi1Preview',  file => { multi1File  = file; });
  setupUpload('multi2UploadZone',  'multi2File',  'multi2Preview',  file => { multi2File  = file; });
  setupUpload('threedUploadZone',  'threedFile',  'threedPreview',  file => { threedFile  = file; });
}

function setupUpload(zoneId, inputId, previewId, onFile) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!zone || !input || !preview) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleUploadedFile(file, preview, onFile);
  });
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleUploadedFile(file, preview, onFile);
  });
}

function handleUploadedFile(file, preview, onFile) {
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" />`;
  onFile(file);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---- Generate ----
function initGenerate() {
  document.getElementById('mainGenBtn').addEventListener('click', runGenerate);
  document.getElementById('expandPromptBtn').addEventListener('click', runExpandPrompt);
}

async function runGenerate() {
  const prompt = document.getElementById('mainPrompt').value.trim();
  if (!prompt) { alert('Please enter a prompt.'); return; }

  const style      = document.getElementById('styleSelect').value;
  const fullPrompt = `${prompt}, ${style}`;

  if (currentMode === 'txt2img') {
    showLoading('Generating image…');
    try {
      const url = await ComfyUI.textToImage(fullPrompt, p => updateLoadingProgress(p));
      addToGallery(url);
      setStatus('READY');
    } catch (e) { alert('Generation failed: ' + e.message); setStatus('ERROR'); }
    hideLoading();

  } else if (currentMode === 'img2img') {
    if (!img2imgFile) { alert('Please upload an input image.'); return; }
    const dataUrl = await fileToDataURL(img2imgFile);
    showLoading('Transforming image…');
    try {
      const url = await ComfyUI.imageToImage(fullPrompt, dataUrl, p => updateLoadingProgress(p));
      addToGallery(url);
      setStatus('READY');
    } catch (e) { alert('Generation failed: ' + e.message); setStatus('ERROR'); }
    hideLoading();

  } else if (currentMode === 'multiimg') {
    if (!multi1File || !multi2File) { alert('Please upload both reference images.'); return; }
    const url1 = await fileToDataURL(multi1File);
    const url2 = await fileToDataURL(multi2File);
    showLoading('Combining references…');
    try {
      const url = await ComfyUI.multiImage(fullPrompt, url1, url2, p => updateLoadingProgress(p));
      addToGallery(url);
      setStatus('READY');
    } catch (e) { alert('Generation failed: ' + e.message); setStatus('ERROR'); }
    hideLoading();
  }
}

async function runExpandPrompt() {
  const promptEl = document.getElementById('mainPrompt');
  const short    = promptEl.value.trim();
  if (!short) { alert('Enter a short description first.'); return; }
  showLoading('Expanding prompt with LLM…');
  try {
    promptEl.value = await LMStudio.expandPrompt(short, currentMode);
    // Trigger resize after filling
    promptEl.dispatchEvent(new Event('input'));
  } catch (e) { alert('LLM failed: ' + e.message); }
  hideLoading();
}

// ---- Gallery (Fix 2, 7) ----
function addToGallery(imageUrl) {
  generatedImages.unshift(imageUrl);
  const largePreview = document.getElementById('largePreview');
  if (largePreview) {
    largePreview.style.minHeight = '500px';
    largePreview.style.height = '500px';
    largePreview.innerHTML = `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain;" />`;
  }

  const promptText = document.getElementById('mainPrompt')?.value || '';

  const chatHistory = document.getElementById('chatHistory');
  if (chatHistory && promptText) {
    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    entry.innerHTML = `
      <div class="chat-prompt-bubble">${promptText}</div>
      <div class="chat-image-result">
        <img src="${imageUrl}" class="chat-result-img" />
      </div>
    `;
    chatHistory.appendChild(entry);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
  const grid  = document.getElementById('outputGrid');
  const count = document.getElementById('outputCount');
  const empty = grid.querySelector('.output-empty');
  if (empty) empty.remove();

  const cell = document.createElement('div');
  cell.className = 'output-cell';
  const img = document.createElement('img');
  img.src = imageUrl;
  img.className = 'output-img';
  // Fix 5: apply current filter to new image
  if (window._currentFilter) img.style.filter = window._currentFilter;

  cell.innerHTML = `
    <div class="output-cell-actions">
      <button class="cell-btn" title="Add to Magazine">+Mag</button>
      <button class="cell-btn" title="Send to 3D">→3D</button>
      <a class="cell-btn" href="${imageUrl}" download="flatdream.png" title="Download">↓</a>
    </div>`;
  cell.insertBefore(img, cell.firstChild);

  cell.querySelector('[title="Add to Magazine"]').addEventListener('click', e => {
    e.stopPropagation();
    Magazine.addImage(imageUrl);
    updateMagLibrary();
    document.querySelector('[data-tab="magazine"]').click();
  });
  cell.querySelector('[title="Send to 3D"]').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('threedPreview').innerHTML =
      `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;" />`;
    fetch(imageUrl).then(r => r.blob()).then(blob => {
      threedFile = new File([blob], 'selected.png', { type: 'image/png' });
    });
    document.querySelector('[data-tab="threed"]').click();
  });

  grid.insertBefore(cell, grid.firstChild);
  count.textContent = `${generatedImages.length} image${generatedImages.length !== 1 ? 's' : ''}`;
  updateMagLibrary();
}

// ---- Magazine ----
function initMagazine() {
  document.getElementById('magExportBtn').addEventListener('click', () => Magazine.exportPNG());
  document.getElementById('magClearBtn').addEventListener('click', () => {
    if (confirm('Clear all magazine panels?')) Magazine.clearAll();
  });
  // Fix 11: zoom and add-panels buttons
  document.getElementById('magZoomIn').addEventListener('click',      () => Magazine.zoomIn());
  document.getElementById('magZoomOut').addEventListener('click',     () => Magazine.zoomOut());
  document.getElementById('magAddPanelsBtn').addEventListener('click', () => Magazine.addPanelsExternal());
}

// Fix 7: library thumbnails with hover actions
function updateMagLibrary() {
  const lib = document.getElementById('magLibrary');
  if (!lib) return;
  lib.innerHTML = '';
  if (generatedImages.length === 0) {
    lib.innerHTML = '<p class="mag-no-sel">No images yet</p>';
    return;
  }
  generatedImages.forEach(url => {
    const thumb = document.createElement('div');
    thumb.className = 'mag-thumb';
    thumb.innerHTML = `
      <img src="${url}" class="mag-thumb-img" />
      <div class="mag-thumb-actions">
        <button class="mag-thumb-btn" data-action="addmag">+Mag</button>
        <a class="mag-thumb-btn" href="${url}" download="flatdream.png">↓ Save</a>
        <button class="mag-thumb-btn" data-action="send3d">→3D</button>
      </div>`;

    thumb.querySelector('[data-action="addmag"]').addEventListener('click', e => {
      e.stopPropagation();
      Magazine.addImage(url);
    });
    thumb.querySelector('[data-action="send3d"]').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('threedPreview').innerHTML =
        `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" />`;
      fetch(url).then(r => r.blob()).then(blob => {
        threedFile = new File([blob], 'selected.png', { type: 'image/png' });
      });
      document.querySelector('[data-tab="threed"]').click();
    });
    // Clicking the thumb (not buttons) adds to magazine
    thumb.addEventListener('click', () => Magazine.addImage(url));
    lib.appendChild(thumb);
  });
}

// ---- 3D (Fix 4: no showLoading — overlay is local to generate tab) ----
function init3D() {
  document.getElementById('threedGenBtn').addEventListener('click', run3D);
}

async function run3D() {
  if (!threedFile) { alert('Please select or upload an image first.'); return; }
  const dataUrl        = await fileToDataURL(threedFile);
  const statusBillboard = document.getElementById('threedStatusBillboard');
  const progress        = document.getElementById('threedProgress');
  const bar             = document.getElementById('threedProgressBar');
  const label           = document.getElementById('threedProgressLabel');

  statusBillboard.textContent = 'PROCESSING';
  progress.style.display = 'block';

  try {
    const glbUrl = await ComfyUI.imageTo3D(dataUrl, p => {
      bar.style.width     = p + '%';
      label.textContent   = `Processing… ${Math.round(p)}%`;
    });

    const dlBtn = document.getElementById('threedDownloadBtn');
    dlBtn.href           = glbUrl;
    dlBtn.style.display  = 'block';

    if (window.ThreeDViewer) {
      window.ThreeDViewer.loadGLB(glbUrl);
    } else {
      document.getElementById('threedPreviewArea').innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:20px;letter-spacing:2px;text-transform:uppercase;color:#1D9E75;margin-bottom:8px;font-weight:700;">✓ 3D MESH READY</div>
          <a href="${glbUrl}" download class="btn-generate" style="display:inline-block;text-decoration:none;">↓ Download GLB</a>
        </div>`;
    }
    statusBillboard.textContent = 'READY';
  } catch (e) {
    alert('3D generation failed: ' + e.message);
    statusBillboard.textContent = 'ERROR';
  }
  progress.style.display = 'none';
}

// ---- LoRA strength slider ----
function initLoraStrength() {
  const slider = document.getElementById('loraStrengthSlider');
  const label  = document.getElementById('loraStrengthLabel');
  if (!slider) return;
  slider.value    = Config.get().loraStrength;
  label.textContent = `strength ${slider.value}`;
  slider.addEventListener('input', () => {
    label.textContent = `strength ${parseFloat(slider.value).toFixed(2)}`;
    Config.set('loraStrength', parseFloat(slider.value));
  });
}

// ---- Config modal ----
function initConfig() {
  document.getElementById('configBtn').addEventListener('click', () => {
    loadConfigUI();
    document.getElementById('configModal').style.display = 'flex';
  });
  document.getElementById('closeConfigBtn').addEventListener('click', () => {
    document.getElementById('configModal').style.display = 'none';
  });
  document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
  document.getElementById('testConnectionsBtn').addEventListener('click', testConnections);
}

function loadConfigUI() {
  const cfg = Config.get();
  document.getElementById('cfgComfyUrl').value    = cfg.comfyUrl;
  document.getElementById('cfgComfy3dUrl').value  = cfg.comfy3dUrl;
  document.getElementById('cfgSteps').value       = cfg.fluxSteps;
  document.getElementById('cfgCfg').value         = cfg.fluxCfg;
  document.getElementById('cfgLmUrl').value       = cfg.lmUrl;
  document.getElementById('cfgLmTemp').value      = cfg.lmTemp;
  document.getElementById('cfgLoraName').value    = cfg.loraName;
  document.getElementById('cfgLoraTrigger').value = cfg.loraTrigger;
}

function saveConfig() {
  Config.setAll({
    comfyUrl:    document.getElementById('cfgComfyUrl').value.trim(),
    comfy3dUrl:  document.getElementById('cfgComfy3dUrl').value.trim(),
    fluxSteps:   parseInt(document.getElementById('cfgSteps').value),
    fluxCfg:     parseFloat(document.getElementById('cfgCfg').value),
    lmUrl:       document.getElementById('cfgLmUrl').value.trim(),
    lmTemp:      parseFloat(document.getElementById('cfgLmTemp').value),
    loraName:    document.getElementById('cfgLoraName').value.trim(),
    loraTrigger: document.getElementById('cfgLoraTrigger').value.trim(),
  });
  document.getElementById('configModal').style.display = 'none';
  pingAll();
}

async function testConnections() {
  const result = document.getElementById('connectionResult');
  result.style.display = 'block';
  result.textContent   = 'Testing…';
  const cfg     = Config.get();
  const comfy   = await ComfyUI.ping(cfg.comfyUrl);
  const lm      = await LMStudio.ping();
  const comfy3d = await ComfyUI.ping(cfg.comfy3dUrl);
  result.innerHTML = `
    ComfyUI: <span style="color:${comfy   ? '#1D9E75' : '#E24B4A'}">${comfy   ? '✓ Connected' : '✗ Offline'}</span><br/>
    LM Studio: <span style="color:${lm    ? '#1D9E75' : '#E24B4A'}">${lm    ? '✓ Connected' : '✗ Offline'}</span><br/>
    ComfyUI 3D: <span style="color:${comfy3d ? '#1D9E75' : '#E24B4A'}">${comfy3d ? '✓ Connected' : '✗ Offline'}</span>`;
  pingAll();
}

// ---- Status billboard ----
function setStatus(text) {
  document.getElementById('statusBillboard').textContent = text;
}

// ---- Loading overlay (Fix 4: local to gen-main, position:absolute in CSS) ----
function showLoading(msg) {
  document.getElementById('loadingMsg').textContent           = msg || 'Working…';
  document.getElementById('loadingProgressBar').style.width  = '0%';
  document.getElementById('loadingOverlay').style.display    = 'flex';
  updateLoadingProgress(0);
  setStatus('GENERATING');
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function updateLoadingProgress(pct) {
  document.getElementById('loadingProgressBar').style.width = pct + '%';
  // Crane hook descends: y=38 at 0%, y=120 at 100%
  const hookY   = 38 + (pct / 100) * 82;
  const cable   = document.getElementById('craneCable');
  const hookBody = document.getElementById('craneHookBody');
  const hookCurve = document.getElementById('craneHookCurve');
  if (cable)     cable.setAttribute('y2', hookY);
  if (hookBody)  hookBody.setAttribute('y', hookY);
  if (hookCurve) {
    const b = hookY + 8;
    hookCurve.setAttribute('d', `M 11 ${b} Q 14 ${b + 6} 17 ${b}`);
  }
}
