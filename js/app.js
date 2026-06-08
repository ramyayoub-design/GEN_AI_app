// app.js — FlatDream main orchestration

// ---- State ----
let currentMode = 'txt2img';
let img2imgFile = null;
let multi1File  = null;
let multi2File  = null;
let threedFile  = null;
let generatedImages = [];
let lastPromptUsed = '';      // Fix 7: track last prompt for display
window._currentFilter = '';

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initModes();
  initUploads();
  initGenerate();
  initMagazine();
  init3D();
  initSketch();
  initConfig();
  initLoraStrength();
  initFilters();        // Fix 5
  initPromptResize();   // Fix 3
  initLightbox();
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

// ---- Apply mode-specific generation defaults ----
function applyModeDefaults(mode) {
  const defaults = {
    txt2img: { width: 1024, height: 1024, steps: 20, seed: 1, cfg: 5, loraStrength: 1, negativePrompt: '' },
    img2img: { width: 1024, height: 1024, steps: 20, seed: 1, cfg: 2.5, loraStrength: 0.5, negativePrompt: '' },
    multiimg: { width: 1024, height: 1024, steps: 20, seed: 1, cfg: 2.5, loraStrength: 1, negativePrompt: '' }
  };
  const d = defaults[mode] || defaults.txt2img;

  // Update Generation Settings inputs
  const genWidth = document.getElementById('genWidth');
  const genHeight = document.getElementById('genHeight');
  const genSteps = document.getElementById('genSteps');
  const genSeed = document.getElementById('genSeed');
  const genCfgSlider = document.getElementById('genCfgSlider');
  const genCfgVal = document.getElementById('genCfgVal');
  const genNegativePrompt = document.getElementById('genNegativePrompt');

  if (genWidth) genWidth.value = d.width;
  if (genHeight) genHeight.value = d.height;
  if (genSteps) genSteps.value = d.steps;
  if (genSeed) genSeed.value = d.seed;

  if (genCfgSlider) {
    genCfgSlider.value = d.cfg;
    if (genCfgVal) genCfgVal.textContent = d.cfg;
  }

  if (genNegativePrompt) genNegativePrompt.value = d.negativePrompt;

  // Update LoRA Strength slider and label
  const loraSlider = document.getElementById('loraStrengthSlider');
  const loraLabel = document.getElementById('loraStrengthLabel');
  if (loraSlider) {
    loraSlider.value = d.loraStrength;
    if (loraLabel) loraLabel.textContent = `strength ${parseFloat(d.loraStrength).toFixed(2)}`;
  }
}

// ---- Mode switching — show/hide the three distinct mode panels ----
function initModes() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;

      // Show the correct mode panel
      document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`panel-${currentMode}`);
      if (panel) panel.classList.add('active');

      const placeholders = {
        txt2img:  'Describe your architectural scene… trigger word torzev is added automatically',
        img2img:  'Describe the transformation…',
        multiimg: 'Describe how to combine both references…'
      };
      document.getElementById('mainPrompt').placeholder = placeholders[currentMode] || '';

      const labels = { txt2img: 'TEXT → IMAGE', img2img: 'IMAGE → IMAGE', multiimg: 'MULTI REFERENCE' };
      document.getElementById('modeBillboard').textContent = labels[currentMode];

      // Apply mode defaults to generation settings
      applyModeDefaults(currentMode);
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
  // For the new full-height column zones, the preview is position:absolute inset:0
  // Setting innerHTML fills the zone with the image
  preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;" />`;
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

// ---- Model Shot bridge: receive captured PNG from modelshot.js ----
function dataUrlToFile(dataUrl, filename = 'modelshot.png') {
  return fetch(dataUrl)
    .then(r => r.blob())
    .then(blob => new File([blob], filename, { type: 'image/png' }));
}

window.FlatDreamModelShot = {
  async sendToImg2Img(dataUrl) {
    const file = await dataUrlToFile(dataUrl, 'modelshot_img2img.png');

    img2imgFile = file;

    const preview = document.getElementById('img2imgPreview');
    if (preview) {
      preview.innerHTML = `
        <img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />
      `;
    }

    document.querySelector('[data-tab="generate"]')?.click();
    document.querySelector('[data-mode="img2img"]')?.click();
  },

  async sendToMultiRef(index, dataUrl) {
    const file = await dataUrlToFile(dataUrl, `modelshot_multi_${index}.png`);

    if (index === 1) {
      multi1File = file;
      const preview = document.getElementById('multi1Preview');
      if (preview) {
        preview.innerHTML = `
          <img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        `;
      }
    } else {
      multi2File = file;
      const preview = document.getElementById('multi2Preview');
      if (preview) {
        preview.innerHTML = `
          <img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        `;
      }
    }

    document.querySelector('[data-tab="generate"]')?.click();
    document.querySelector('[data-mode="multiimg"]')?.click();
  },

  sendToSketch(dataUrl) {
    if (!window.Sketch || !Sketch.loadImage) {
      alert('Sketch module is not ready.');
      return;
    }

    Sketch.loadImage(dataUrl);
    document.querySelector('[data-tab="sketch"]')?.click();
  }
};

// ---- Generation Settings ----
function getGenerationSettings() {
  const width = parseInt(document.getElementById('genWidth')?.value || 1024);
  const height = parseInt(document.getElementById('genHeight')?.value || 1024);
  const steps = parseInt(document.getElementById('genSteps')?.value || 20);
  const seed = document.getElementById('genSeed')?.value.trim() === '' ? 1 : parseInt(document.getElementById('genSeed')?.value || 1);
  const cfg = parseFloat(document.getElementById('genCfgSlider')?.value || 7);
  const negativePrompt = document.getElementById('genNegativePrompt')?.value.trim() || '';
  const loraStrength = parseFloat(document.getElementById('loraStrengthSlider')?.value || 1.0);

  return {
    width,
    height,
    steps,
    seed,
    cfg,
    negativePrompt,
    loraStrength
  };
}

// ---- Generate ----
function initGenerate() {
  document.getElementById('mainGenBtn').addEventListener('click', runGenerate);
  document.getElementById('expandPromptBtn').addEventListener('click', runExpandPrompt);
}

async function runGenerate() {
  const prompt = document.getElementById('mainPrompt').value.trim();
  if (!prompt) { alert('Please enter a prompt.'); return; }

  const genSettings = getGenerationSettings();

  const style      = document.getElementById('styleSelect').value;
  const fullPrompt = `${prompt}, ${style}`;

  lastPromptUsed = fullPrompt; // Fix 7: store before generating

  if (currentMode === 'txt2img') {
    showLoading('Generating image…');
    try {
      const url = await ComfyUI.textToImage(fullPrompt, genSettings, p => updateLoadingProgress(p));
      addToGallery(url);
      setStatus('READY');
    } catch (e) { alert('Generation failed: ' + e.message); setStatus('ERROR'); }
    hideLoading();
    document.getElementById('mainPrompt').value = '';

  } else if (currentMode === 'img2img') {
    if (!img2imgFile) { alert('Please upload an input image.'); return; }
    const dataUrl = await fileToDataURL(img2imgFile);
    showLoading('Transforming image…');
    try {
      const url = await ComfyUI.imageToImage(fullPrompt, dataUrl, genSettings, p => updateLoadingProgress(p));
      addToGallery(url);
      setStatus('READY');
    } catch (e) { alert('Generation failed: ' + e.message); setStatus('ERROR'); }
    hideLoading();
    document.getElementById('mainPrompt').value = '';

  } else if (currentMode === 'multiimg') {
    if (!multi1File || !multi2File) { alert('Please upload both reference images.'); return; }
    const url1 = await fileToDataURL(multi1File);
    const url2 = await fileToDataURL(multi2File);
    showLoading('Combining references…');
    try {
      const url = await ComfyUI.multiImage(fullPrompt, url1, url2, genSettings, p => updateLoadingProgress(p));
      addToGallery(url);
      setStatus('READY');
    } catch (e) { alert('Generation failed: ' + e.message); setStatus('ERROR'); }
    hideLoading();
    document.getElementById('mainPrompt').value = '';
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



function sendImageTo3D(imageUrl) {
  if (!imageUrl) return;

  const preview = document.getElementById('threedPreview');
  if (preview) {
    preview.innerHTML = `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;" />`;
  }

  fetch(imageUrl).then(r => r.blob()).then(blob => {
    threedFile = new File([blob], 'selected.png', { type: 'image/png' });
  }).catch(err => {
    console.error('[3D] Could not prepare image:', err);
  });

  const threedTab = document.querySelector('[data-tab="threed"]');
  if (threedTab) threedTab.click();
}

function sendImageToSketch(imageUrl) {
  if (!imageUrl) return;

  if (!window.Sketch || !Sketch.loadImage) {
    alert('Sketch system is not ready.');
    return;
  }

  Sketch.loadImage(imageUrl);
  const sketchTab = document.querySelector('[data-tab="sketch"]');
  if (sketchTab) sketchTab.click();
}

function initSketch() {
  if (window.Sketch && Sketch.init) {
    Sketch.init();
  }
}

// ---- Gallery — mode-aware output routing ----
function addToGallery(imageUrl) {
  generatedImages.unshift(imageUrl);
  updateMagLibrary();

  if (currentMode === 'txt2img' || !currentMode) {
    // Screen 1: update square large preview
    const largePreview = document.getElementById('largePreview');
    if (largePreview) {
      largePreview.innerHTML = `
        <div style="position:relative; width:100%; height:100%;">
          <img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain; display:block;" />
          <div class="output-cell-actions">
            <button class="cell-btn" id="largeAddMag">+Mag</button>
            <button class="cell-btn" id="largeSendSketch">Sketch</button>
            <button class="cell-btn" id="largeSend3D">→3D</button>
            <a class="cell-btn" href="${imageUrl}" download="flatdream.png">↓</a>
          </div>
        </div>`;
      document.getElementById('largeAddMag')?.addEventListener('click', () => {
        Magazine.addImage(imageUrl);
        updateMagLibrary();
        document.querySelector('[data-tab="magazine"]').click();
      });
      document.getElementById('largeSendSketch')?.addEventListener('click', () => {
        sendImageToSketch(imageUrl);
      });
      document.getElementById('largeSend3D')?.addEventListener('click', () => {
        document.getElementById('threedPreview').innerHTML =
          `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;" />`;
        fetch(imageUrl).then(r => r.blob()).then(blob => {
          threedFile = new File([blob], 'selected.png', { type: 'image/png' });
        });
        document.querySelector('[data-tab="threed"]').click();
      });
    }
    // Show prompt used beneath
    const lastPromptEl = document.getElementById('lastPromptDisplay');
    if (lastPromptEl) lastPromptEl.textContent = lastPromptUsed;
    // Add 40px thumbnail to history strip
    addThumbnail(imageUrl);
    const count = document.getElementById('outputCount');
    if (count) count.textContent = generatedImages.length;

  } else if (currentMode === 'img2img') {
    // Screen 2: fill right column output with hover actions
    const out = document.getElementById('img2imgOutput');
    if (out) {
      out.innerHTML = `
        <div style="position:relative; width:100%; height:100%;">
          <img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain; display:block;" />
          <div class="output-cell-actions">
            <button class="cell-btn" id="img2imgAddMag">+Mag</button>
            <button class="cell-btn" id="img2imgSendSketch">Sketch</button>
            <button class="cell-btn" id="img2imgSend3D">→3D</button>
            <a class="cell-btn" href="${imageUrl}" download="flatdream.png">↓</a>
          </div>
        </div>`;
      document.getElementById('img2imgAddMag')?.addEventListener('click', () => {
        Magazine.addImage(imageUrl);
        updateMagLibrary();
        document.querySelector('[data-tab="magazine"]').click();
      });
      document.getElementById('img2imgSendSketch')?.addEventListener('click', () => {
        sendImageToSketch(imageUrl);
      });
      document.getElementById('img2imgSend3D')?.addEventListener('click', () => {
        document.getElementById('threedPreview').innerHTML =
          `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;" />`;
        fetch(imageUrl).then(r => r.blob()).then(blob => {
          threedFile = new File([blob], 'selected.png', { type: 'image/png' });
        });
        document.querySelector('[data-tab="threed"]').click();
      });
    }

  } else if (currentMode === 'multiimg') {
    // Screen 3: fill right column output with hover actions
    const out = document.getElementById('multiimgOutput');
    if (out) {
      out.innerHTML = `
        <div style="position:relative; width:100%; height:100%;">
          <img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain; display:block;" />
          <div class="output-cell-actions">
            <button class="cell-btn" id="multiAddMag">+Mag</button>
            <button class="cell-btn" id="multiSendSketch">Sketch</button>
            <button class="cell-btn" id="multiSend3D">→3D</button>
            <a class="cell-btn" href="${imageUrl}" download="flatdream.png">↓</a>
          </div>
        </div>`;
      document.getElementById('multiAddMag')?.addEventListener('click', () => {
        Magazine.addImage(imageUrl);
        updateMagLibrary();
        document.querySelector('[data-tab="magazine"]').click();
      });
      document.getElementById('multiSendSketch')?.addEventListener('click', () => {
        sendImageToSketch(imageUrl);
      });
      document.getElementById('multiSend3D')?.addEventListener('click', () => {
        document.getElementById('threedPreview').innerHTML =
          `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;" />`;
        fetch(imageUrl).then(r => r.blob()).then(blob => {
          threedFile = new File([blob], 'selected.png', { type: 'image/png' });
        });
        document.querySelector('[data-tab="threed"]').click();
      });
    }
  }
}

// ---- Lightbox image preview ----
function showLightbox(imageUrl) {
  const backdrop = document.getElementById('lightboxBackdrop');
  const lightboxImg = document.getElementById('lightboxImage');
  if (backdrop && lightboxImg) {
    lightboxImg.src = imageUrl;
    backdrop.style.display = 'flex';
  }
}

function closeLightbox() {
  const backdrop = document.getElementById('lightboxBackdrop');
  if (backdrop) {
    backdrop.style.display = 'none';
  }
}

function initLightbox() {
  const backdrop = document.getElementById('lightboxBackdrop');
  const closeBtn = document.getElementById('lightboxClose');
  const lightboxImage = document.getElementById('lightboxImage');

  if (!backdrop) return;

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      closeLightbox();
    });
  }

  // Click on backdrop (but not on image) closes lightbox
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      closeLightbox();
    }
  });

  // Escape key closes lightbox (added only once during init)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (backdrop.style.display !== 'none') {
        closeLightbox();
      }
    }
  });
}

// ---- Add 40px thumbnail to the history strip (txt2img only) ----
function addThumbnail(imageUrl) {
  const grid = document.getElementById('outputGrid');
  if (!grid) return;
  const empty = grid.querySelector('.output-empty');
  if (empty) empty.remove();

  const cell = document.createElement('div');
  cell.className = 'output-cell';
  const img = document.createElement('img');
  img.src = imageUrl;
  img.className = 'output-img';
  if (window._currentFilter) img.style.filter = window._currentFilter;

  // Click image to open lightbox
  img.addEventListener('click', e => {
    e.stopPropagation();
    showLightbox(imageUrl);
  });

  cell.innerHTML = `<div class="output-cell-actions">
    <button class="cell-btn" title="Add to Magazine">+M</button>
    <button class="cell-btn" title="Send to Sketch">S</button>
    <button class="cell-btn" title="Send to 3D">3D</button>
    <a class="cell-btn" href="${imageUrl}" download="flatdream.png" title="Download">↓</a>
  </div>`;
  cell.insertBefore(img, cell.firstChild);

  cell.querySelector('[title="Add to Magazine"]').addEventListener('click', e => {
    e.stopPropagation();
    Magazine.addImage(imageUrl);
    updateMagLibrary();
    document.querySelector('[data-tab="magazine"]').click();
  });
  cell.querySelector('[title="Send to Sketch"]').addEventListener('click', e => {
    e.stopPropagation();
    sendImageToSketch(imageUrl);
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
  document.getElementById('magAddPanelsBtn')?.addEventListener('click', () => Magazine.addPanelsExternal());

  // Comic bubble buttons
  document.getElementById('comicAddBubbleBtn').addEventListener('click', () => {
    const p = ComicPanels.getSelected();
    ComicBubbles.addBubbleForPanel(p ? p.id : null);
  });
  document.getElementById('comicClearBubblesBtn').addEventListener('click', () => {
    if (confirm('Clear all speech bubbles?')) ComicBubbles.clearAll();
  });
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
        <button class="mag-thumb-btn" data-action="sendsketch">Sketch</button>
        <a class="mag-thumb-btn" href="${url}" download="flatdream.png">↓ Save</a>
        <button class="mag-thumb-btn" data-action="send3d">→3D</button>
      </div>`;

    thumb.querySelector('[data-action="addmag"]').addEventListener('click', e => {
      e.stopPropagation();
      Magazine.addImage(url);
    });
    thumb.querySelector('[data-action="sendsketch"]').addEventListener('click', e => {
      e.stopPropagation();
      sendImageToSketch(url);
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

// ---- 3D ----

function findGLBUrlFromOutputs(outputs, comfy3dUrl) {
  if (!outputs) return null;

  for (const nodeId in outputs) {
    const node = outputs[nodeId];

    const candidates = [];

    if (Array.isArray(node.result)) candidates.push(...node.result);
    if (Array.isArray(node.mesh)) candidates.push(...node.mesh);
    if (Array.isArray(node.meshes)) candidates.push(...node.meshes);
    if (Array.isArray(node.gltf)) candidates.push(...node.gltf);
    if (Array.isArray(node.glb)) candidates.push(...node.glb);

    for (const item of candidates) {
      let filename = null;
      let subfolder = '';

      if (typeof item === 'string') {
        filename = item.split('\\').pop().split('/').pop();
      } else if (item && typeof item === 'object') {
        filename = item.filename || item.name || null;
        subfolder = item.subfolder || '';
      }

      if (filename && filename.toLowerCase().endsWith('.glb')) {
        return `${comfy3dUrl}/view?filename=${encodeURIComponent(filename)}&type=output&subfolder=${encodeURIComponent(subfolder)}`;
      }
    }
  }

  return null;
}

async function run3D() {
  if (!threedFile) {
    alert('Please select or upload an image first.');
    return;
  }

  const cfg = Config.get();
  const dataUrl = await fileToDataURL(threedFile);
  const statusBillboard = document.getElementById('threedStatusBillboard');
  const bar = document.getElementById('threedProgressBar');
  const label = document.getElementById('threedProgressLabel');
  const progress = document.getElementById('threedProgress');

  statusBillboard.textContent = 'PROCESSING';
  progress.style.display = 'block';
  bar.style.width = '10%';
  label.textContent = 'Uploading image…';

  try {
    const blob = await fetch(dataUrl).then(r => r.blob());
    const filename = `flatdream_${Date.now()}.png`;
    const formData = new FormData();
    formData.append('image', blob, filename);
    formData.append('type', 'input');
    formData.append('overwrite', 'true');

    const uploadResp = await fetch(`${cfg.comfy3dUrl}/upload/image`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResp.ok) {
      throw new Error(`Image upload failed: ${uploadResp.status}`);
    }

    const uploadData = await uploadResp.json();
    bar.style.width = '20%';

    const workflow = await fetch('./workflows/3D.json').then(r => r.json());

    workflow["85"].inputs.image = uploadData.name;
    workflow["73"].inputs.seed = Math.floor(Math.random() * 99999);
    workflow["75"].inputs.seed = Math.floor(Math.random() * 99999);

    const queueResp = await fetch(`${cfg.comfy3dUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });

    if (!queueResp.ok) {
      throw new Error(`3D queue failed: ${queueResp.status}`);
    }

    const queueData = await queueResp.json();
    const promptId = queueData.prompt_id;

    bar.style.width = '30%';
    label.textContent = 'Processing 3D mesh…';

    let glbUrl = null;

    for (let i = 0; i < 300; i++) {
      await new Promise(r => setTimeout(r, 2000));
      bar.style.width = Math.min(90, 30 + i * 2) + '%';

      const histResp = await fetch(`${cfg.comfy3dUrl}/history/${promptId}`);
      if (!histResp.ok) continue;

      const hist = await histResp.json();
      const job = hist[promptId];

      if (job && job.status && job.status.completed) {
        glbUrl = findGLBUrlFromOutputs(job.outputs, cfg.comfy3dUrl);

        console.log('[3D] Completed job outputs:', job.outputs);
        console.log('[3D] Final GLB URL:', glbUrl);

        break;
      }
    }

    if (!glbUrl) {
      throw new Error('Timed out waiting for 3D mesh or no GLB found in outputs');
    }

    bar.style.width = '100%';
    label.textContent = 'Done!';

    const dlBtn = document.getElementById('threedDownloadBtn');
    if (dlBtn) {
      dlBtn.href = glbUrl;
      dlBtn.style.display = 'block';
      dlBtn.setAttribute('download', 'model.glb');
    }

    // IMPORTANT:
    // Do not rewrite threedPreviewArea.innerHTML here.
    // Rewriting it destroys the canvas needed by the Three.js viewer.
    statusBillboard.textContent = 'READY';

    const tabBtn = document.querySelector('[data-tab="threed"]');
    if (tabBtn) tabBtn.click();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (window.Viewer3D) {
          window.Viewer3D.loadGLB(glbUrl);
        } else {
          console.error('[3D] window.Viewer3D is missing');
        }
      });
    });

  } catch (e) {
    alert('3D failed: ' + e.message);
    statusBillboard.textContent = 'ERROR';
    console.error('[3D] Failed:', e);
  } finally {
    progress.style.display = 'none';
  }
}

function init3D() {
  document.getElementById('threedGenBtn').addEventListener('click', run3D);
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


// Expose selected app helpers to other modules such as sketch.js
window.addToGallery = addToGallery;
window.sendImageToSketch = sendImageToSketch;
window.sendImageTo3D = sendImageTo3D;
