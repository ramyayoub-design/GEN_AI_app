// comicpanels.js — Clean comic panel system for FlatDream Magazine tab

const ComicPanels = (() => {
  const W = 500;
  const H = 707;
  const G = 6;
  const MAX = 6;

  let panels = [];
  let selectedId = null;
  let currentLayout = 'cut4';

  const SLOT_ORDER = {
    cut3: [3, 1, 2],
    cut4: [3, 4, 1, 2],
    cut5: [3, 4, 5, 1, 2],
    cut6: [4, 5, 6, 1, 2, 3],
  };

  function side(p, l) {
    return (l.x2 - l.x1) * (p[1] - l.y1) - (l.y2 - l.y1) * (p[0] - l.x1);
  }

  function isect(p1, p2, l) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const lx = l.x2 - l.x1;
    const ly = l.y2 - l.y1;
    const d = dx * ly - dy * lx;

    if (Math.abs(d) < 1e-9) return null;

    const t = ((l.x1 - p1[0]) * ly - (l.y1 - p1[1]) * lx) / d;
    return [p1[0] + t * dx, p1[1] + t * dy];
  }

  function clip(poly, l, s) {
    if (!poly || poly.length < 3) return [];

    const out = [];

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const sa = side(a, l) * s;
      const sb = side(b, l) * s;

      if (sa >= 0) out.push(a);

      if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
        const p = isect(a, b, l);
        if (p) out.push(p);
      }
    }

    return out;
  }

  function off(l, d, s) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * d * s;
    const ny = (dx / len) * d * s;

    return {
      x1: l.x1 + nx,
      y1: l.y1 + ny,
      x2: l.x2 + nx,
      y2: l.y2 + ny,
    };
  }

  function split(poly, l) {
    if (!poly || poly.length < 3) return [poly, []];

    return [
      clip(poly, off(l, G / 2, 1), 1),
      clip(poly, off(l, G / 2, -1), -1),
    ];
  }

  function buildLayouts() {
    const M = 3;
    const pg = [
      [M, M],
      [W - M, M],
      [W - M, H - M],
      [M, H - M],
    ];

    const [p3top, p3bot] = split(pg, { x1: 0, y1: H * 0.36, x2: W, y2: H * 0.32 });
    const [p3bL, p3bR] = split(p3bot, { x1: W * 0.47, y1: H * 0.33, x2: W * 0.53, y2: H });
    const cut3 = [p3top, p3bL, p3bR];

    const [p4L, p4R] = split(pg, { x1: W * 0.47, y1: 0, x2: W * 0.53, y2: H });
    const [p4tL, p4bL] = split(p4L, { x1: 0, y1: H * 0.50, x2: W * 0.50, y2: H * 0.46 });
    const [p4tR, p4bR] = split(p4R, { x1: W * 0.50, y1: H * 0.54, x2: W, y2: H * 0.50 });
    const cut4 = [p4tL, p4tR, p4bL, p4bR];

    const [p5top, p5bot] = split(pg, { x1: 0, y1: H * 0.56, x2: W, y2: H * 0.53 });
    const [p5t1, p5ttmp] = split(p5top, { x1: W * 0.34, y1: 0, x2: W * 0.30, y2: H * 0.55 });
    const [p5t2, p5t3] = split(p5ttmp, { x1: W * 0.66, y1: 0, x2: W * 0.70, y2: H * 0.55 });
    const [p5bL, p5bR] = split(p5bot, { x1: W * 0.47, y1: H * 0.54, x2: W * 0.53, y2: H });
    const cut5 = [p5t1, p5t2, p5t3, p5bL, p5bR];

    const [p6c1, p6tmp] = split(pg, { x1: W * 0.34, y1: 0, x2: W * 0.30, y2: H });
    const [p6c2, p6c3] = split(p6tmp, { x1: W * 0.66, y1: 0, x2: W * 0.70, y2: H });
    const p6h = { x1: 0, y1: H * 0.50, x2: W, y2: H * 0.47 };
    const [p6t1, p6b1] = split(p6c1, p6h);
    const [p6t2, p6b2] = split(p6c2, p6h);
    const [p6t3, p6b3] = split(p6c3, p6h);
    const cut6 = [p6t1, p6t2, p6t3, p6b1, p6b2, p6b3];

    return { cut3, cut4, cut5, cut6 };
  }

  const LAYOUTS = buildLayouts();

  function createPanel(n) {
    return {
      id: `cpanel-${n}`,
      number: n,
      prompt: '',
      imageUrl: null,
      status: 'empty',
      _svgScale: 1,
      _svgOx: 0,
      _svgOy: 0,
      _svgTransform: null,
    };
  }

  function init(layout = 'cut4') {
    currentLayout = layout;
    panels = Array.from({ length: MAX }, (_, i) => createPanel(i + 1));
    selectedId = null;
    window._pendingComicPanelId = null;
  }

  function getPanel(id) {
    return panels.find(p => p.id === id) || null;
  }

  function getSelected() {
    return selectedId ? getPanel(selectedId) : null;
  }

  function getAll() {
    return panels;
  }

  function getLayout() {
    return currentLayout;
  }

  function setLayout(layout) {
    currentLayout = layout;
    render();
  }

  function syncPromptUI() {
    const el = document.getElementById('magPanelPrompt');
    if (!el) return;

    const panel = getSelected();
    if (!panel) {
      el.value = '';
      el.placeholder = 'Select a comic panel first...';
    } else {
      el.value = panel.prompt || '';
      el.placeholder = `Write prompt for Panel ${panel.number}...`;
    }
  }

  function selectPanel(id) {
    selectedId = id;
    render();

    if (window.ComicBubbles) {
      ComicBubbles.renderBubbleList(selectedId);
    }

    syncPromptUI();
  }

  function bbox(pts) {
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);

    const x = Math.min(...xs);
    const y = Math.min(...ys);

    return {
      x,
      y,
      w: Math.max(...xs) - x,
      h: Math.max(...ys) - y,
    };
  }

  function getBBoxPercent(panelId) {
    const p = getPanel(panelId);
    if (!p) return null;

    const shapes = LAYOUTS[currentLayout];
    if (!shapes) return null;

    const order = SLOT_ORDER[currentLayout] || shapes.map((_, i) => i + 1);
    const idx = order.indexOf(p.number);
    const pts = shapes[idx];

    if (!pts || pts.length < 3) return null;

    const bb = bbox(pts);

    return {
      x: (bb.x / W) * 100,
      y: (bb.y / H) * 100,
      w: (bb.w / W) * 100,
      h: (bb.h / H) * 100,
    };
  }

  function render() {
    const canvas = document.getElementById('magazineCanvas');
    if (!canvas) return;

    canvas.innerHTML = '';
    canvas.style.position = 'relative';
    canvas.style.width = 'min(58vh, 500px)';
    canvas.style.height = 'calc(min(58vh, 500px) * 1.414)';
    canvas.style.minWidth = '0';
    canvas.style.minHeight = '0';
    canvas.style.maxHeight = 'calc(100vh - 175px)';
    canvas.style.margin = '0 auto';
    canvas.style.backgroundImage = 'none';

    const ns = 'http://www.w3.org/2000/svg';

    const svgEl = document.createElementNS(ns, 'svg');
    svgEl.id = 'comicSVG';
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.cssText = 'position:absolute;inset:0;z-index:1;display:block;';

    canvas.appendChild(svgEl);

    const bubbleCanvas = document.createElement('div');
    bubbleCanvas.id = 'comicBubbleCanvas';
    bubbleCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;overflow:visible;';

    canvas.appendChild(bubbleCanvas);

    renderSVG(svgEl);

    if (window.ComicBubbles) {
      ComicBubbles.renderAll();
      ComicBubbles.renderBubbleList(selectedId);
    }
  }

  function renderSVG(svgEl) {
    svgEl.innerHTML = '';

    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    svgEl.appendChild(defs);

    const shapes = LAYOUTS[currentLayout];
    if (!shapes) return;

    const order = SLOT_ORDER[currentLayout] || shapes.map((_, i) => i + 1);

    shapes.forEach((pts, i) => {
      if (!pts || pts.length < 3) return;

      const panelNum = order[i];
      const panel = panels[panelNum - 1];
      if (!panel) return;

      const pstr = pts.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
      const bb = bbox(pts);
      const clipId = `comic-clip-${currentLayout}-${i}`;

      const cp = document.createElementNS(ns, 'clipPath');
      cp.setAttribute('id', clipId);

      const cpPoly = document.createElementNS(ns, 'polygon');
      cpPoly.setAttribute('points', pstr);
      cp.appendChild(cpPoly);
      defs.appendChild(cp);

      const bg = document.createElementNS(ns, 'polygon');
      bg.setAttribute('points', pstr);
      bg.setAttribute('fill', '#111111');
      bg.style.cursor = 'pointer';
      bg.addEventListener('click', () => selectPanel(panel.id));
      svgEl.appendChild(bg);

      const g = document.createElementNS(ns, 'g');
      g.setAttribute('clip-path', `url(#${clipId})`);
      g.style.cursor = 'pointer';
      g.addEventListener('click', e => {
        if (!g.dataset.dragging) selectPanel(panel.id);
      });

      if (panel.status === 'loading') {
        const r = document.createElementNS(ns, 'rect');
        r.setAttribute('x', bb.x);
        r.setAttribute('y', bb.y);
        r.setAttribute('width', bb.w);
        r.setAttribute('height', bb.h);
        r.setAttribute('fill', '#111111');
        g.appendChild(r);

        addTxt(g, ns, bb.x + bb.w / 2, bb.y + bb.h / 2, 'GENERATING…', 10, '#EF9F27', 2);
      } else if (panel.imageUrl) {
        const img = document.createElementNS(ns, 'image');
        img.setAttribute('href', panel.imageUrl);
        img.setAttribute('x', bb.x);
        img.setAttribute('y', bb.y);
        img.setAttribute('width', bb.w);
        img.setAttribute('height', bb.h);
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');

        if (panel._svgTransform) {
          img.setAttribute('transform', panel._svgTransform);
        }

        g.appendChild(img);
        svgPanZoom(panel, img, bb, g);
      } else {
        drawEmptyPanelControls(g, ns, panel, bb);
      }

      svgEl.appendChild(g);

      const border = document.createElementNS(ns, 'polygon');
      border.setAttribute('points', pstr);
      border.setAttribute('fill', 'none');
      border.setAttribute('stroke', panel.id === selectedId ? '#E24B4A' : '#2a2a2a');
      border.setAttribute('stroke-width', panel.id === selectedId ? '4' : '1.5');
      border.style.pointerEvents = 'none';
      svgEl.appendChild(border);
    });
  }

  function drawEmptyPanelControls(g, ns, panel, bb) {
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;

    addTxt(g, ns, cx, cy - 38, String(panel.number), 32, 'rgba(245,240,232,0.12)', 0);

    const btnW = Math.min(92, bb.w * 0.65);
    const btnH = 18;
    const btnX = cx - btnW / 2;
    const libY = cy - 12;
    const genY = cy + 14;

    drawButtonVisual(g, ns, btnX, libY, btnW, btnH, '#555555', '+ LIBRARY', '#888888');
    drawButtonVisual(g, ns, btnX, genY, btnW, btnH, '#EF9F27', '⚡ GENERATE', '#EF9F27');

    const panelHit = document.createElementNS(ns, 'rect');
    panelHit.setAttribute('x', bb.x);
    panelHit.setAttribute('y', bb.y);
    panelHit.setAttribute('width', bb.w);
    panelHit.setAttribute('height', bb.h);
    panelHit.setAttribute('fill', 'rgba(0,0,0,0)');
    panelHit.style.pointerEvents = 'all';
    panelHit.style.cursor = 'pointer';
    panelHit.addEventListener('click', () => selectPanel(panel.id));
    g.appendChild(panelHit);

    const libHit = document.createElementNS(ns, 'rect');
    libHit.setAttribute('x', btnX);
    libHit.setAttribute('y', libY);
    libHit.setAttribute('width', btnW);
    libHit.setAttribute('height', btnH);
    libHit.setAttribute('fill', 'rgba(255,0,0,0)');
    libHit.style.pointerEvents = 'all';
    libHit.style.cursor = 'pointer';
    libHit.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();

      window._pendingComicPanelId = panel.id;
      selectPanel(panel.id);

      console.log('[ComicPanels] Opening upload for panel:', panel.id);

      if (window.Magazine && Magazine.openUploadForPanel) {
        Magazine.openUploadForPanel(panel.id);
      } else {
        alert('Magazine upload system is not ready.');
      }
    });
    g.appendChild(libHit);

    const genHit = document.createElementNS(ns, 'rect');
    genHit.setAttribute('x', btnX);
    genHit.setAttribute('y', genY);
    genHit.setAttribute('width', btnW);
    genHit.setAttribute('height', btnH);
    genHit.setAttribute('fill', 'rgba(255,0,0,0)');
    genHit.style.pointerEvents = 'all';
    genHit.style.cursor = 'pointer';
    genHit.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      selectPanel(panel.id);
      generatePanel(panel.id);
    });
    g.appendChild(genHit);
  }

  function drawButtonVisual(g, ns, x, y, w, h, stroke, label, color) {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', x);
    r.setAttribute('y', y);
    r.setAttribute('width', w);
    r.setAttribute('height', h);
    r.setAttribute('fill', 'rgba(0,0,0,0.1)');
    r.setAttribute('stroke', stroke);
    r.setAttribute('stroke-width', '1');
    g.appendChild(r);

    addTxt(g, ns, x + w / 2, y + h / 2 + 1, label, 7, color, 1.5);
  }

  function addTxt(parent, ns, x, y, text, size, fill, letterSpacing) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', fill);
    t.setAttribute('font-size', size);
    t.setAttribute('font-family', 'Inter, Arial, sans-serif');

    if (letterSpacing) {
      t.setAttribute('letter-spacing', letterSpacing);
    }

    t.style.pointerEvents = 'none';
    t.textContent = text;
    parent.appendChild(t);
  }

  function svgPanZoom(panel, imgEl, bb, g) {
    if (!panel._svgScale) panel._svgScale = 1;
    if (!panel._svgOx) panel._svgOx = 0;
    if (!panel._svgOy) panel._svgOy = 0;

    const applyT = () => {
      const s = panel._svgScale;
      const ox = panel._svgOx;
      const oy = panel._svgOy;
      const cx = bb.x + bb.w / 2;
      const cy = bb.y + bb.h / 2;
      const t = `translate(${cx + ox},${cy + oy}) scale(${s}) translate(${-cx},${-cy})`;

      imgEl.setAttribute('transform', t);
      panel._svgTransform = t;
    };

    g.addEventListener('wheel', e => {
      e.preventDefault();
      e.stopPropagation();

      panel._svgScale = Math.max(0.5, Math.min(4, panel._svgScale - e.deltaY * 0.002));
      applyT();
    }, { passive: false });

    let dragging = false;
    let lx = 0;
    let ly = 0;

    g.addEventListener('mousedown', e => {
      if (panel._svgScale <= 1 && !e.shiftKey) return;

      e.preventDefault();
      e.stopPropagation();

      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      g.dataset.dragging = '1';
    });

    const move = e => {
      if (!dragging) return;

      panel._svgOx += e.clientX - lx;
      panel._svgOy += e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      applyT();
    };

    const up = () => {
      if (!dragging) return;

      dragging = false;
      delete g.dataset.dragging;
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  async function generatePanel(panelId) {
    const panel = getPanel(panelId);
    if (!panel) return;

    const promptEl = document.getElementById('magPanelPrompt');
    const promptText = promptEl ? promptEl.value.trim() : '';
    if (promptText) {
      panel.prompt = promptText;
    }

    if (!panel.prompt || !panel.prompt.trim()) {
      alert(`Write a prompt in the left sidebar for Panel ${panel.number} first.`);
      return;
    }

    const cfg = Config.get();
    const styleEl = document.getElementById('magStyleSelect') || document.getElementById('styleSelect');
    const style = styleEl ? styleEl.value : '';
    const trigger = cfg.loraTrigger || 'torzev';
    const fullPrompt = `${trigger} ${panel.prompt.trim()}${style ? ', ' + style : ''}`;

    panel.status = 'loading';
    render();

    try {
      const imageUrl = await ComfyUI.textToImage(fullPrompt, null);

      panel.imageUrl = imageUrl;
      panel.status = 'generated';
      panel._svgScale = 1;
      panel._svgOx = 0;
      panel._svgOy = 0;
      panel._svgTransform = null;

      render();

      if (typeof addToGallery === 'function') {
        addToGallery(imageUrl);
      }
    } catch (err) {
      panel.status = 'error';
      render();
      alert('Panel generation failed: ' + err.message);
    }
  }

  function addImageToPanel(panelId, imageUrl) {
    const panel = getPanel(panelId);
    if (!panel) return false;

    panel.imageUrl = imageUrl;
    panel.status = 'generated';
    panel._svgScale = 1;
    panel._svgOx = 0;
    panel._svgOy = 0;
    panel._svgTransform = null;

    selectedId = panelId;
    window._pendingComicPanelId = null;

    render();

    return true;
  }

  function addImageToSelected(imageUrl) {
    const targetId = window._pendingComicPanelId || selectedId;

    if (!targetId) {
      alert('Click + LIBRARY inside a panel first, then choose an image from the Library.');
      return false;
    }

    return addImageToPanel(targetId, imageUrl);
  }

  const api = {
    init,
    setLayout,
    render,
    renderSVG,
    selectPanel,
    syncPromptUI,
    generatePanel,
    addImageToSelected,
    addImageToPanel,
    getPanel,
    getSelected,
    getAll,
    getLayout,
    getBBoxPercent,
    LAYOUTS,
    SLOT_ORDER,
  };

  return api;
})();

window.ComicPanels = ComicPanels;