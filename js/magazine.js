// magazine.js — Layout-based magazine builder with in-panel generation and zoom

const Magazine = (() => {

  // ---- State ----
  let slots         = [];
  let currentLayout = 'landscape-grid';
  let pendingSlotId = null;
  let zoom          = 1.0;

  // ---- Layout definitions (900×700 canvas) ----
  const LAYOUTS = {
    'landscape-grid': (count) => {
      const w = Math.floor(860 / 2);
      const h = 320;
      return Array.from({ length: count }, (_, i) => ({
        x: 20 + (i % 2) * (w + 12),
        y: 20 + Math.floor(i / 2) * (h + 12),
        w, h, oblique: null
      }));
    },
    'landscape-oblique': (count) => {
      const w = Math.floor(860 / 2);
      const h = 320;
      return Array.from({ length: count }, (_, i) => ({
        x: 20 + (i % 2) * (w + 12),
        y: 20 + Math.floor(i / 2) * (h + 12),
        w, h,
        oblique: (i % 2 === 0) ? 'oblique-left' : 'oblique-right'
      }));
    },
    'portrait-grid': (count) => {
      const h = Math.floor(660 / 2);
      return Array.from({ length: count }, (_, i) => ({
        x: 20, y: 20 + i * (h + 12), w: 860, h, oblique: null
      }));
    },
    'portrait-oblique': (count) => {
      const h = Math.floor(660 / 2);
      return Array.from({ length: count }, (_, i) => ({
        x: 20, y: 20 + i * (h + 12), w: 860, h,
        oblique: (i % 2 === 0) ? 'oblique-top' : 'oblique-bottom'
      }));
    }
  };

  // ---- Init ----
  function init() {
    initSlots(2);
    render();
    initLayoutPicker();
  }

  function initLayoutPicker() {
    document.querySelectorAll('.mag-layout-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        document.querySelectorAll('.mag-layout-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        currentLayout = thumb.dataset.layout;
        const images = slots.map(s => s.imageUrl).filter(Boolean);
        initSlots(Math.max(2, images.length));
        images.forEach((url, i) => { if (slots[i]) slots[i].imageUrl = url; });
        render();
      });
    });
  }

  function initSlots(count) {
    const fn = LAYOUTS[currentLayout] || LAYOUTS['landscape-grid'];
    slots = fn(count).map((pos, i) => ({
      id: `slot-${Date.now()}-${i}`,
      imageUrl: null,
      ...pos
    }));
  }

  // ---- Add image from library ----
  function addImage(imageUrl) {
    if (pendingSlotId) {
      const slot = slots.find(s => s.id === pendingSlotId);
      if (slot) { slot.imageUrl = imageUrl; pendingSlotId = null; render(); return; }
      pendingSlotId = null;
    }
    const empty = slots.find(s => !s.imageUrl);
    if (empty) { empty.imageUrl = imageUrl; render(); return; }
    addPanels(2);
    const newEmpty = slots.find(s => !s.imageUrl);
    if (newEmpty) newEmpty.imageUrl = imageUrl;
    render();
  }

  // ---- Add panels (Fix 10, 11) ----
  function addPanels(n = 2) {
    const newCount  = slots.length + n;
    const fn        = LAYOUTS[currentLayout] || LAYOUTS['landscape-grid'];
    const oldImages = slots.map(s => s.imageUrl);
    slots = fn(newCount).map((pos, i) => ({
      id: `slot-${Date.now()}-${i}`,
      imageUrl: oldImages[i] || null,
      ...pos
    }));
    render();
  }

  // Exposed for the external "Add Panels" button (Fix 11)
  function addPanelsExternal() { addPanels(2); }

  function clearAll() { initSlots(2); render(); }

  // ---- Render ----
  function render() {
    const canvas = document.getElementById('magazineCanvas');
    if (!canvas) return;
    canvas.innerHTML = '';

    if (slots.length === 0) {
      canvas.innerHTML = `<div class="mag-empty"><div class="mag-empty-icon">[ ]</div><p>Click a panel to add an image</p></div>`;
      return;
    }

    slots.forEach(slot => {
      const el = document.createElement('div');
      el.className = 'mag-slot' +
        (slot.oblique  ? ` ${slot.oblique}` : '') +
        (slot.imageUrl ? ' has-image' : '');
      el.id        = slot.id;
      el.style.cssText = `left:${slot.x}px; top:${slot.y}px; width:${slot.w}px; height:${slot.h}px;`;

      if (slot.imageUrl) {
        renderSlotFilled(slot, el);
      } else {
        renderSlotEmpty(slot, el);
      }
      canvas.appendChild(el);
    });

    // Floating + button inside canvas (stays for quick access)
    const addBtn = document.createElement('button');
    addBtn.className = 'mag-add-panel-btn';
    addBtn.title     = 'Add 2 panels';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => addPanels(2));
    canvas.appendChild(addBtn);
  }

  function renderSlotFilled(slot, el) {
    el.innerHTML = `
      <img src="${slot.imageUrl}" class="mag-slot-img" draggable="false" />
      <button class="mag-slot-remove" title="Clear image">✕</button>`;
    el.querySelector('.mag-slot-remove').addEventListener('click', e => {
      e.stopPropagation();
      slot.imageUrl = null;
      el.classList.remove('has-image');
      render();
    });
    el.addEventListener('click', () => renderEditor(slot));
  }

  // Fix 10: Two action buttons for empty slot
  function renderSlotEmpty(slot, el) {
    el.innerHTML = `
      <div class="mag-slot-actions">
        <button class="mag-slot-add-btn">+ Library</button>
        <button class="mag-slot-gen-btn">⚡ Generate</button>
      </div>`;

    el.querySelector('.mag-slot-add-btn').addEventListener('click', e => {
      e.stopPropagation();
      // Clear any previous pending highlight
      document.querySelectorAll('.mag-slot').forEach(s => s.style.outline = '');
      pendingSlotId = slot.id;
      el.style.outline = '2px solid var(--red)';
      renderEditor(null, true);
    });

    el.querySelector('.mag-slot-gen-btn').addEventListener('click', e => {
      e.stopPropagation();
      showSlotGenerateForm(slot, el);
    });
  }

  // Fix 10: Inline generate form inside slot
  function showSlotGenerateForm(slot, el) {
    el.innerHTML = `
      <div class="mag-gen-form">
        <textarea class="mag-gen-prompt" rows="4"
          placeholder="Describe architectural scene…"></textarea>
        <div class="mag-gen-form-btns">
          <button class="mag-gen-submit">▶ Gen</button>
          <button class="mag-gen-cancel">✕</button>
        </div>
      </div>`;

    el.querySelector('.mag-gen-cancel').addEventListener('click', e => {
      e.stopPropagation();
      render();
    });

    el.querySelector('.mag-gen-submit').addEventListener('click', async e => {
      e.stopPropagation();
      const promptText = el.querySelector('.mag-gen-prompt').value.trim();
      if (!promptText) return;

      el.innerHTML = `<div class="mag-slot-loading">⚡ Generating…</div>`;

      try {
        const cfg        = Config.get();
        const styleEl    = document.getElementById('styleSelect');
        const style      = styleEl ? styleEl.value : '';
        const fullPrompt = `${cfg.loraTrigger || 'torzev'} ${promptText}${style ? ', ' + style : ''}`;
        const imageUrl   = await ComfyUI.textToImage(fullPrompt, null);
        slot.imageUrl    = imageUrl;
        render();
      } catch (err) {
        alert('Panel generation failed: ' + err.message);
        render();
      }
    });
  }

  // ---- Render editor sidebar ----
  function renderEditor(slot, waitingForImage = false) {
    const editor = document.getElementById('magEditor');
    if (!editor) return;

    if (waitingForImage) {
      editor.innerHTML = `<p class="mag-no-sel" style="color:#EF9F27;">Click an image in the Library to add it to the highlighted panel</p>`;
      return;
    }

    if (!slot) {
      editor.innerHTML = `<p class="mag-no-sel">Click a panel to edit</p>`;
      return;
    }

    editor.innerHTML = `
      <div class="mag-editor-section">
        <label class="mag-editor-label">Status</label>
        <p class="mag-no-sel" style="font-size:14px;">${slot.imageUrl ? '✓ Image loaded' : 'Empty'}</p>
      </div>
      <div class="mag-editor-section">
        <label class="mag-editor-label">Size</label>
        <p class="mag-no-sel" style="font-size:14px;">${slot.w} × ${slot.h} px</p>
      </div>
      ${slot.imageUrl ? `<button class="mag-remove-btn" id="magSlotClear">Clear Image</button>` : ''}`;

    if (slot.imageUrl) {
      document.getElementById('magSlotClear').addEventListener('click', () => {
        slot.imageUrl = null;
        render();
        renderEditor(null);
      });
    }
  }

  // ---- Export ----
  async function exportPNG() {
    const canvas = document.getElementById('magazineCanvas');
    if (!canvas) return;
    try {
      const dataUrl = await domtoimage.toPng(canvas);
      const link    = document.createElement('a');
      link.download = `flatdream_magazine_${Date.now()}.png`;
      link.href     = dataUrl;
      link.click();
    } catch (e) { alert('Export failed: ' + e.message); }
  }

  // ---- Zoom (Fix 11) ----
  function zoomIn()  { setZoom(Math.min(zoom + 0.15, 2.0)); }
  function zoomOut() { setZoom(Math.max(zoom - 0.15, 0.4)); }

  function setZoom(value) {
    zoom = parseFloat(value.toFixed(2));
    const canvas  = document.getElementById('magazineCanvas');
    const label   = document.getElementById('magZoomLabel');
    if (canvas) canvas.style.transform = `scale(${zoom})`;
    if (label)  label.textContent = `${Math.round(zoom * 100)}%`;
  }

  function getAll() { return slots; }

  return { init, addImage, clearAll, exportPNG, getAll, zoomIn, zoomOut, addPanelsExternal };
})();
