// sketch.js — Three-column Sketch editor: left settings + center viewport + right tools
// Supports: image upload/send-to-sketch, free draw, straight line preview, eraser,
// editable/movable/scalable text objects, flattening, and img2img regeneration.

const Sketch = (() => {
  let initialized = false;
  let currentTool = 'draw';

  let baseImage = null;
  let currentImageUrl = null;

  let isDrawing = false;
  let startPoint = null;
  let lastPoint = null;
  let lineSnapshot = null;

  let activeTextItem = null;
  let isMovingText = false;
  let isResizingText = false;
  let isRotatingText = false;
  let textDragStart = null;

  function $(id) {
    return document.getElementById(id);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    initToolButtons();
    initCanvasEvents();
    initControls();
    initSliders();
    initUpload();
    initTextLayerEvents();
    initKeyboardShortcuts();

    setActiveTool('draw');
  }

  /* -----------------------------
     TOOL BUTTONS
  ----------------------------- */

  function initToolButtons() {
    const buttons = {
      sketchDrawBtn: 'draw',
      sketchLineBtn: 'line',
      sketchTextBtn: 'text',
      sketchMoveBtn: 'move',
      sketchEraseBtn: 'eraser',
    };

    Object.entries(buttons).forEach(([id, tool]) => {
      const btn = $(id);
      if (!btn) return;

      btn.addEventListener('click', () => {
        setActiveTool(tool);
      });
    });
  }

  function setActiveTool(tool) {
    currentTool = tool;

    const ids = [
      'sketchDrawBtn',
      'sketchLineBtn',
      'sketchTextBtn',
      'sketchMoveBtn',
      'sketchEraseBtn',
    ];

    ids.forEach(id => {
      const btn = $(id);
      if (btn) btn.classList.remove('active');
    });

    const activeIdByTool = {
      draw: 'sketchDrawBtn',
      line: 'sketchLineBtn',
      text: 'sketchTextBtn',
      move: 'sketchMoveBtn',
      eraser: 'sketchEraseBtn',
    };

    const activeBtn = $(activeIdByTool[tool]);
    if (activeBtn) activeBtn.classList.add('active');

    const drawCanvas = $('sketchDrawCanvas');
    if (drawCanvas) {
      if (tool === 'text') drawCanvas.style.cursor = 'text';
      else if (tool === 'move') drawCanvas.style.cursor = 'default';
      else if (tool === 'eraser') drawCanvas.style.cursor = 'cell';
      else drawCanvas.style.cursor = 'crosshair';
    }
  }

  /* -----------------------------
     CONTROLS
  ----------------------------- */

  function initControls() {
    const clearOverlayBtn = $('sketchClearBtn');
    const generateBtn = $('sketchGenerateBtn');
    const clearImageBtn = $('sketchClearImageBtn');

    if (clearOverlayBtn) {
      clearOverlayBtn.addEventListener('click', clearDrawingOverlay);
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', regenerateFromSketch);
    }

    if (clearImageBtn) {
      clearImageBtn.addEventListener('click', clearSketchImage);
    }
  }

  function initSliders() {
    bindSliderLabel('sketchBrushSize', 'sketchBrushSizeVal');
    bindSliderLabel('sketchTextSize', 'sketchTextSizeVal');
    bindSliderLabel('sketchDenoise', 'sketchDenoiseVal');
    bindSliderLabel('sketchCfgSlider', 'sketchCfgVal');
  }

  function bindSliderLabel(sliderId, labelId) {
    const slider = $(sliderId);
    const label = $(labelId);
    if (!slider || !label) return;

    label.textContent = slider.value;
    slider.addEventListener('input', () => {
      label.textContent = slider.value;
    });
  }

  function initUpload() {
    const uploadBtn = $('sketchUploadBtn');
    const uploadInput = $('sketchUploadInput');

    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());

      uploadInput.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          alert('Please upload an image file.');
          uploadInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = event => {
          loadImage(event.target.result);
        };
        reader.onerror = () => {
          alert('Could not upload image.');
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* -----------------------------
     IMAGE LOADING
  ----------------------------- */

  async function imageUrlToSafeSrc(imageUrl) {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('data:')) return imageUrl;

    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();

      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('[Sketch] Could not convert image URL to data URL. Trying direct source.', err);
      return imageUrl;
    }
  }

  function loadImage(imageUrl) {
    init();

    if (!imageUrl) return;

    currentImageUrl = imageUrl;
    setStatus('LOADING');

    imageUrlToSafeSrc(imageUrl).then(safeSrc => {
      const img = new Image();

      img.onload = () => {
        baseImage = img;

        setupCanvases(img.naturalWidth || img.width, img.naturalHeight || img.height);
        drawBaseCanvas();
        clearDrawingOverlay();
        clearTextObjects();
        showCanvasWrap();

        setStatus('READY');
      };

      img.onerror = () => {
        setStatus('ERROR');
        alert('Could not load image into Sketch.');
      };

      img.src = safeSrc;
    });
  }

  function setupCanvases(width, height) {
    const baseCanvas = $('sketchBaseCanvas');
    const drawCanvas = $('sketchDrawCanvas');

    if (!baseCanvas || !drawCanvas) return;

    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(width, height));

    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    baseCanvas.width = w;
    baseCanvas.height = h;
    drawCanvas.width = w;
    drawCanvas.height = h;
  }

  function drawBaseCanvas() {
    const baseCanvas = $('sketchBaseCanvas');
    if (!baseCanvas || !baseImage) return;

    const ctx = baseCanvas.getContext('2d');
    ctx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    ctx.drawImage(baseImage, 0, 0, baseCanvas.width, baseCanvas.height);
  }

  function showCanvasWrap() {
    const wrap = $('sketchCanvasWrap');
    const empty = $('sketchEmptyState');

    if (wrap) wrap.style.display = 'block';
    if (empty) empty.style.display = 'none';
  }

  function hideCanvasWrap() {
    const wrap = $('sketchCanvasWrap');
    const empty = $('sketchEmptyState');

    if (wrap) wrap.style.display = 'none';
    if (empty) empty.style.display = 'block';
  }

  function clearSketchImage() {
    baseImage = null;
    currentImageUrl = null;
    activeTextItem = null;

    const baseCanvas = $('sketchBaseCanvas');
    const drawCanvas = $('sketchDrawCanvas');

    if (baseCanvas) baseCanvas.getContext('2d').clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    if (drawCanvas) drawCanvas.getContext('2d').clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    clearTextObjects();
    hideCanvasWrap();

    const outputFrame = $('sketchOutputFrame');
    if (outputFrame) {
      outputFrame.innerHTML = '<div class="sketch-empty">Regenerated image will appear here</div>';
    }

    setStatus('READY');
  }

  /* -----------------------------
     CANVAS DRAWING
  ----------------------------- */

  function initCanvasEvents() {
    const drawCanvas = $('sketchDrawCanvas');
    if (!drawCanvas) return;

    drawCanvas.addEventListener('pointerdown', onCanvasPointerDown);
    drawCanvas.addEventListener('pointermove', onCanvasPointerMove);
    window.addEventListener('pointerup', onCanvasPointerUp);
  }

  function getPoint(e) {
    const drawCanvas = $('sketchDrawCanvas');
    if (!drawCanvas) return { x: 0, y: 0 };

    const rect = drawCanvas.getBoundingClientRect();

    return {
      x: (e.clientX - rect.left) * (drawCanvas.width / rect.width),
      y: (e.clientY - rect.top) * (drawCanvas.height / rect.height),
    };
  }

  function getBrushSize() {
    return parseInt($('sketchBrushSize')?.value || 6, 10);
  }

  function getTextSize() {
    return parseInt($('sketchTextSize')?.value || 32, 10);
  }

  function getColor() {
    return $('sketchColor')?.value || '#E24B4A';
  }

  function drawSegment(ctx, a, b, erase = false) {
    ctx.save();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = getBrushSize();
    ctx.strokeStyle = getColor();

    if (erase) {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.restore();
  }

  function drawStraightLine(ctx, a, b) {
    ctx.save();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = getBrushSize();
    ctx.strokeStyle = getColor();

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.restore();
  }

  function onCanvasPointerDown(e) {
    if (!baseImage) return;

    const p = getPoint(e);

    if (currentTool === 'text') {
      e.preventDefault();
      createTextItem(p);
      return;
    }

    if (currentTool === 'move') {
      return;
    }

    e.preventDefault();

    isDrawing = true;
    startPoint = p;
    lastPoint = p;

    const drawCanvas = $('sketchDrawCanvas');

    if (currentTool === 'line' && drawCanvas) {
      const ctx = drawCanvas.getContext('2d');
      lineSnapshot = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
    }

    if (drawCanvas && drawCanvas.setPointerCapture) {
      try {
        drawCanvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  }

  function onCanvasPointerMove(e) {
    if (!isDrawing || !baseImage) return;

    const p = getPoint(e);
    const drawCanvas = $('sketchDrawCanvas');
    if (!drawCanvas) return;

    const ctx = drawCanvas.getContext('2d');

    if (currentTool === 'draw') {
      drawSegment(ctx, lastPoint, p, false);
      lastPoint = p;
    } else if (currentTool === 'eraser') {
      drawSegment(ctx, lastPoint, p, true);
      lastPoint = p;
    } else if (currentTool === 'line') {
      if (lineSnapshot) {
        ctx.putImageData(lineSnapshot, 0, 0);
      }
      drawStraightLine(ctx, startPoint, p);
    }
  }

  function onCanvasPointerUp(e) {
    if (!isDrawing || !baseImage) return;

    const p = getPoint(e);
    const drawCanvas = $('sketchDrawCanvas');

    if (currentTool === 'line' && drawCanvas) {
      const ctx = drawCanvas.getContext('2d');

      if (lineSnapshot) {
        ctx.putImageData(lineSnapshot, 0, 0);
      }

      drawStraightLine(ctx, startPoint, p);
    }

    isDrawing = false;
    startPoint = null;
    lastPoint = null;
    lineSnapshot = null;
  }

  function clearDrawingOverlay() {
    const drawCanvas = $('sketchDrawCanvas');
    if (!drawCanvas) return;

    const ctx = drawCanvas.getContext('2d');
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    clearTextObjects();
  }

  /* -----------------------------
     TEXT OBJECTS
  ----------------------------- */

  function initTextLayerEvents() {
    const textLayer = $('sketchTextLayer');
    if (!textLayer) return;

    textLayer.addEventListener('pointerdown', e => {
      const item = e.target.closest('.sketch-text-item');
      if (!item) return;

      setActiveTextItem(item);

      if (e.target.classList.contains('sketch-text-resize')) {
        startTextResize(e, item);
      } else if (e.target.classList.contains('sketch-text-rotate')) {
        startTextRotate(e, item);
      } else {
        startTextMove(e, item);
      }
    });
  }

  function createTextItem(canvasPoint) {
    const textLayer = $('sketchTextLayer');
    const drawCanvas = $('sketchDrawCanvas');
    if (!textLayer || !drawCanvas) return;

    const leftPct = (canvasPoint.x / drawCanvas.width) * 100;
    const topPct = (canvasPoint.y / drawCanvas.height) * 100;

    const item = document.createElement('div');
    item.className = 'sketch-text-item active';
    item.contentEditable = 'true';
    item.textContent = 'Text';
    item.dataset.fontSize = String(getTextSize());
    item.dataset.rotation = '0';

    item.style.left = `${leftPct}%`;
    item.style.top = `${topPct}%`;
    item.style.color = getColor();
    item.style.fontSize = `${getTextSize()}px`;
    item.style.transform = 'rotate(0deg)';

    const rotate = document.createElement('span');
    rotate.className = 'sketch-text-rotate';
    rotate.contentEditable = 'false';
    item.appendChild(rotate);

    const resize = document.createElement('span');
    resize.className = 'sketch-text-resize';
    resize.contentEditable = 'false';
    item.appendChild(resize);

    textLayer.appendChild(item);
    setActiveTextItem(item);

    requestAnimationFrame(() => {
      item.focus();

      const range = document.createRange();
      range.selectNodeContents(item);
      range.setStart(item.firstChild || item, 0);
      range.setEnd(item.firstChild || item, item.textContent.length);

      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }

  function setActiveTextItem(item) {
    document.querySelectorAll('.sketch-text-item').forEach(el => el.classList.remove('active'));

    activeTextItem = item || null;

    if (activeTextItem) {
      activeTextItem.classList.add('active');
    }
  }

  function startTextMove(e, item) {
    if (!item) return;

    // Do not move text while actively editing with Text tool.
    if (currentTool === 'text') return;

    e.preventDefault();
    e.stopPropagation();

    isMovingText = true;

    const layerRect = $('sketchTextLayer').getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    textDragStart = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      leftPx: itemRect.left - layerRect.left,
      topPx: itemRect.top - layerRect.top,
      layerW: layerRect.width,
      layerH: layerRect.height,
      item,
    };

    window.addEventListener('pointermove', onTextMove);
    window.addEventListener('pointerup', stopTextTransform, { once: true });
  }

  function onTextMove(e) {
    if (!isMovingText || !textDragStart) return;

    const dx = e.clientX - textDragStart.pointerX;
    const dy = e.clientY - textDragStart.pointerY;

    const newLeft = textDragStart.leftPx + dx;
    const newTop = textDragStart.topPx + dy;

    textDragStart.item.style.left = `${(newLeft / textDragStart.layerW) * 100}%`;
    textDragStart.item.style.top = `${(newTop / textDragStart.layerH) * 100}%`;
  }

  function startTextResize(e, item) {
    e.preventDefault();
    e.stopPropagation();

    isResizingText = true;

    const fontSize = parseFloat(item.dataset.fontSize || getComputedStyle(item).fontSize || 32);

    textDragStart = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      fontSize,
      item,
    };

    window.addEventListener('pointermove', onTextResize);
    window.addEventListener('pointerup', stopTextTransform, { once: true });
  }

  function onTextResize(e) {
    if (!isResizingText || !textDragStart) return;

    const dx = e.clientX - textDragStart.pointerX;
    const dy = e.clientY - textDragStart.pointerY;
    const delta = Math.max(dx, dy);

    const newSize = Math.max(8, Math.min(180, textDragStart.fontSize + delta * 0.35));

    textDragStart.item.dataset.fontSize = String(newSize);
    textDragStart.item.style.fontSize = `${newSize}px`;
  }

  function startTextRotate(e, item) {
    e.preventDefault();
    e.stopPropagation();

    isRotatingText = true;

    const rect = item.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const currentRotation = parseFloat(item.dataset.rotation || '0');
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;

    textDragStart = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      centerX,
      centerY,
      startAngle,
      currentRotation,
      item,
    };

    window.addEventListener('pointermove', onTextRotate);
    window.addEventListener('pointerup', stopTextTransform, { once: true });
  }

  function onTextRotate(e) {
    if (!isRotatingText || !textDragStart) return;

    const angle = Math.atan2(
      e.clientY - textDragStart.centerY,
      e.clientX - textDragStart.centerX
    ) * 180 / Math.PI;

    const delta = angle - textDragStart.startAngle;
    const newRotation = textDragStart.currentRotation + delta;

    textDragStart.item.dataset.rotation = String(newRotation);
    textDragStart.item.style.transform = `rotate(${newRotation}deg)`;
  }

  function stopTextTransform() {
    isMovingText = false;
    isResizingText = false;
    isRotatingText = false;
    textDragStart = null;

    window.removeEventListener('pointermove', onTextMove);
    window.removeEventListener('pointermove', onTextResize);
    window.removeEventListener('pointermove', onTextRotate);
  }

  function clearTextObjects() {
    const layer = $('sketchTextLayer');
    if (layer) layer.innerHTML = '';
    activeTextItem = null;
  }

  function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeTextItem) {
        const activeEl = document.activeElement;

        // Do not delete the item while typing inside it.
        if (activeEl === activeTextItem || activeTextItem.contains(activeEl)) return;

        activeTextItem.remove();
        activeTextItem = null;
      }
    });
  }

  /* -----------------------------
     FLATTEN + REGENERATE
  ----------------------------- */

  async function exportFlattenedSketch() {
    const baseCanvas = $('sketchBaseCanvas');
    const drawCanvas = $('sketchDrawCanvas');

    if (!baseCanvas || !drawCanvas) {
      throw new Error('Sketch canvases are missing.');
    }

    if (!baseImage) {
      throw new Error('No sketch image is loaded.');
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = baseCanvas.width;
    exportCanvas.height = baseCanvas.height;

    const ctx = exportCanvas.getContext('2d');

    // 1. Original image
    ctx.drawImage(baseCanvas, 0, 0);

    // 2. Freehand drawing, straight lines, and eraser result
    ctx.drawImage(drawCanvas, 0, 0);

    // 3. Editable HTML text objects
    drawTextObjectsToCanvas(ctx, exportCanvas);

    return exportCanvas.toDataURL('image/png');
  }

  function drawTextObjectsToCanvas(ctx, exportCanvas) {
    const textLayer = $('sketchTextLayer');
    const drawCanvas = $('sketchDrawCanvas');

    if (!textLayer || !drawCanvas) return;

    const layerRect = textLayer.getBoundingClientRect();

    document.querySelectorAll('.sketch-text-item').forEach(item => {
      const clone = item.cloneNode(true);
      clone.querySelectorAll('.sketch-text-resize, .sketch-text-rotate').forEach(handle => handle.remove());

      const text = clone.textContent.trim();
      if (!text) return;

      const itemRect = item.getBoundingClientRect();

      const x = (itemRect.left - layerRect.left) * (exportCanvas.width / layerRect.width);
      const y = (itemRect.top - layerRect.top) * (exportCanvas.height / layerRect.height);

      const computed = getComputedStyle(item);
      const fontSizeScreen = parseFloat(computed.fontSize || item.dataset.fontSize || 32);
      const fontSizeCanvas = fontSizeScreen * (exportCanvas.width / layerRect.width);
      const fontFamily = computed.fontFamily || 'Arial, sans-serif';
      const fontWeight = computed.fontWeight || '700';
      const color = computed.color || getColor();

      const rotation = parseFloat(item.dataset.rotation || '0');

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.fillStyle = color;
      ctx.font = `${fontWeight} ${fontSizeCanvas}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      const lines = text.split('\n');
      const lineHeight = fontSizeCanvas * 1.15;

      lines.forEach((line, index) => {
        ctx.fillText(line, 0, index * lineHeight);
      });

      ctx.restore();
    });
  }

  function showSketchResult(imageUrl) {
    const outputFrame = $('sketchOutputFrame');
    if (!outputFrame) return;

    outputFrame.innerHTML = `
      <img src="${imageUrl}" class="sketch-result-img" alt="Sketch generated result" />
    `;
  }

  async function regenerateFromSketch() {
    const prompt = $('sketchPrompt')?.value.trim();
    const samPrompt = $('sketchSamPrompt')?.value.trim() || 'blue sketch lines';

    if (!prompt) {
      alert('Write a prompt first.');
      return;
    }

    if (!baseImage) {
      alert('Send or upload an image to Sketch first.');
      return;
    }

    if (typeof ComfyUI === 'undefined' || !ComfyUI.sketchInpaintSam) {
      alert('ComfyUI sketch inpainting function is not available.');
      return;
    }

    setStatus('GENERATING');

    try {
      // This sends the base image + your sketch/text marks as ONE image.
      // Then SAM3 inside the workflow detects the mask based on sketchSamPrompt.
      const flattenedImage = await exportFlattenedSketch();
      const genSettings = getSketchGenerationSettings();

      const style = document.getElementById('styleSelect')?.value || '';
      const fullPrompt = style ? `${prompt}, ${style}` : prompt;

      const url = await ComfyUI.sketchInpaintSam(
        fullPrompt,
        samPrompt,
        flattenedImage,
        genSettings,
        p => {
          if (typeof updateLoadingProgress === 'function') {
            updateLoadingProgress(p);
          }
        }
      );

      showSketchResult(url);

      if (window.addToGallery) {
        window.addToGallery(url);
      }

      setStatus('READY');
    } catch (err) {
      setStatus('ERROR');
      console.error('[Sketch] Inpainting failed:', err);
      alert('Sketch inpainting failed: ' + err.message);
    }
  }

  function getSketchGenerationSettings() {
    const width = parseInt($('sketchWidth')?.value || 1024, 10);
    const height = parseInt($('sketchHeight')?.value || 1024, 10);
    const steps = parseInt($('sketchSteps')?.value || 20, 10);
    const seed = $('sketchSeed')?.value.trim() === ''
      ? 1
      : parseInt($('sketchSeed')?.value || 1, 10);

    const cfg = parseFloat($('sketchCfgSlider')?.value || 2.5);
    const denoise = parseFloat($('sketchDenoise')?.value || 0.55);
    const negativePrompt = $('sketchNegativePrompt')?.value.trim() || '';

    const mainLoraSlider = document.getElementById('loraStrengthSlider');
    const loraStrength = parseFloat(
      mainLoraSlider?.value ||
      (typeof Config !== 'undefined' ? Config.get?.().loraStrength : 1.0) ||
      1.0
    );

    return {
      width,
      height,
      steps,
      seed,
      cfg,
      denoise,
      negativePrompt,
      loraStrength,
    };
  }

  function setStatus(text) {
    const el = $('sketchStatusBillboard');
    if (el) el.textContent = text;
  }

  return {
    init,
    loadImage,
    exportFlattenedSketch,
    regenerateFromSketch,
    clearDrawingOverlay,
    clearSketchImage,
    getCurrentImage: () => currentImageUrl,
  };
})();

window.Sketch = Sketch;

// Safe init: app.js may also call Sketch.init(), so init() is protected.
document.addEventListener('DOMContentLoaded', () => {
  if (window.Sketch) {
    window.Sketch.init();
  }
});