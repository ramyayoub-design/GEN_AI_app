// comicpanels.js — Portrait comic panel system for FlatDream magazine tab
// Adapted from teacher's panels.js + angledLayouts.js
// Only portrait cut layouts: cut3, cut4, cut5, cut6

const ComicPanels = (() => {

  // ---- SVG canvas dimensions (portrait) ----
  const W = 500, H = 707, G = 6;

  // ---- State ----
  let panels = [];
  let selectedId = null;
  let currentLayout = 'cut4';
  const MAX = 6;

  // ---- Slot order: shape-index → panel-number (from teacher) ----
  const SLOT_ORDER = {
    cut3: [3, 1, 2],
    cut4: [3, 4, 1, 2],
    cut5: [3, 4, 5, 1, 2],
    cut6: [4, 5, 6, 1, 2, 3],
  };

  // ---- Polygon clipping geometry (verbatim from teacher's angledLayouts.js) ----
  function side(p, l) { return (l.x2-l.x1)*(p[1]-l.y1)-(l.y2-l.y1)*(p[0]-l.x1); }
  function isect(p1, p2, l) {
    const dx=p2[0]-p1[0],dy=p2[1]-p1[1],lx=l.x2-l.x1,ly=l.y2-l.y1;
    const d=dx*ly-dy*lx; if(Math.abs(d)<1e-9)return null;
    const t=((l.x1-p1[0])*ly-(l.y1-p1[1])*lx)/d;
    return [p1[0]+t*dx, p1[1]+t*dy];
  }
  function clip(poly, l, s) {
    if(!poly||poly.length<3) return [];
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i], b=poly[(i+1)%poly.length];
      const sa=side(a,l)*s, sb=side(b,l)*s;
      if(sa>=0) out.push(a);
      if((sa>0&&sb<0)||(sa<0&&sb>0)){const p=isect(a,b,l);if(p)out.push(p);}
    }
    return out;
  }
  function off(l, d, s) {
    const dx=l.x2-l.x1, dy=l.y2-l.y1, len=Math.sqrt(dx*dx+dy*dy)||1;
    const nx=-dy/len*d*s, ny=dx/len*d*s;
    return {x1:l.x1+nx,y1:l.y1+ny,x2:l.x2+nx,y2:l.y2+ny};
  }
  function split(poly, l) {
    if(!poly||poly.length<3) return [poly,[]];
    return [clip(poly,off(l,G/2,1),1), clip(poly,off(l,G/2,-1),-1)];
  }

  // ---- Build layouts (portrait, from teacher) ----
  function buildLayouts() {
    const M=8, pg=[[M,M],[W-M,M],[W-M,H-M],[M,H-M]];

    const [p3top,p3bot] = split(pg,{x1:0,y1:H*0.36,x2:W,y2:H*0.32});
    const [p3bL,p3bR]   = split(p3bot,{x1:W*0.47,y1:H*0.33,x2:W*0.53,y2:H});
    const cut3 = [p3top,p3bL,p3bR];

    const [p4L,p4R]   = split(pg,{x1:W*0.47,y1:0,x2:W*0.53,y2:H});
    const [p4tL,p4bL] = split(p4L,{x1:0,y1:H*0.50,x2:W*0.5,y2:H*0.46});
    const [p4tR,p4bR] = split(p4R,{x1:W*0.5,y1:H*0.54,x2:W,y2:H*0.50});
    const cut4 = [p4tL,p4tR,p4bL,p4bR];

    const [p5top,p5bot]   = split(pg,{x1:0,y1:H*0.56,x2:W,y2:H*0.53});
    const [p5t1,p5ttmp]   = split(p5top,{x1:W*0.34,y1:0,x2:W*0.30,y2:H*0.55});
    const [p5t2,p5t3]     = split(p5ttmp,{x1:W*0.66,y1:0,x2:W*0.70,y2:H*0.55});
    const [p5bL,p5bR]     = split(p5bot,{x1:W*0.47,y1:H*0.54,x2:W*0.53,y2:H});
    const cut5 = [p5t1,p5t2,p5t3,p5bL,p5bR];

    const [p6c1,p6tmp] = split(pg,{x1:W*0.34,y1:0,x2:W*0.30,y2:H});
    const [p6c2,p6c3]  = split(p6tmp,{x1:W*0.66,y1:0,x2:W*0.70,y2:H});
    const p6h = {x1:0,y1:H*0.50,x2:W,y2:H*0.47};
    const [p6t1,p6b1] = split(p6c1,p6h);
    const [p6t2,p6b2] = split(p6c2,p6h);
    const [p6t3,p6b3] = split(p6c3,p6h);
    const cut6 = [p6t1,p6t2,p6t3,p6b1,p6b2,p6b3];

    return { cut3, cut4, cut5, cut6 };
  }

  const LAYOUTS = buildLayouts();

  // ---- Panel helpers ----
  function createPanel(n) {
    return { id:`cpanel-${n}`, number:n, prompt:'', imageUrl:null, status:'empty' };
  }
  function getPanel(id)  { return panels.find(p => p.id === id) || null; }
  function getSelected() { return selectedId ? getPanel(selectedId) : null; }
  function getAll()      { return panels; }
  function getLayout()   { return currentLayout; }

  // ---- Init ----
  function init(layout) {
    currentLayout = layout || 'cut4';
    panels = Array.from({ length: MAX }, (_, i) => createPanel(i+1));
    selectedId = null;
  }

  // ---- Set layout ----
  function setLayout(layout) {
    currentLayout = layout;
    render();
    renderSidebarEditor();
  }

  // ---- Select panel ----
  function selectPanel(id) {
    selectedId = id;
    render();
    renderSidebarEditor();
  }

  // ---- Bounding box of a polygon ----
  function bbox(pts) {
    const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w:Math.max(...xs)-x, h:Math.max(...ys)-y };
  }

  // ---- Return panel bbox as % of SVG canvas (used by bubbles) ----
  function getBBoxPercent(panelId) {
    const p = getPanel(panelId);
    if (!p) return null;
    const shapes = LAYOUTS[currentLayout];
    if (!shapes) return null;
    const order = SLOT_ORDER[currentLayout];
    const idx = order ? order.indexOf(p.number) : p.number - 1;
    const pts = shapes[idx];
    if (!pts || pts.length < 3) return null;
    const bb = bbox(pts);
    return { x:(bb.x/W)*100, y:(bb.y/H)*100, w:(bb.w/W)*100, h:(bb.h/H)*100 };
  }

  // ---- Render SVG into #magazineCanvas ----
  // Fix 4: preserve #comicBubbleCanvas across renders so bubbles don't flicker/disappear
  function render() {
    const canvas = document.getElementById('magazineCanvas');
    if (!canvas) return;

    // Size canvas to portrait aspect ratio
    const cw = canvas.parentElement?.clientWidth || 600;
    const portraitH = Math.round(cw * (H / W));
    canvas.style.minWidth  = '';
    canvas.style.minHeight = portraitH + 'px';
    canvas.style.height    = portraitH + 'px';
    canvas.style.width     = '100%';
    canvas.style.backgroundImage = 'none';
    canvas.style.position = 'relative';

    // Remove only the SVG — leave bubble canvas intact
    const oldSvg = canvas.querySelector('#comicSVG');
    if (oldSvg) oldSvg.remove();

    const ns = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(ns, 'svg');
    svgEl.id = 'comicSVG';
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.cssText = 'position:absolute;top:0;left:0;display:block;';

    // Insert SVG before the bubble canvas so bubbles render on top
    const existingBubbleCanvas = canvas.querySelector('#comicBubbleCanvas');
    canvas.insertBefore(svgEl, existingBubbleCanvas || null);

    // Create bubble canvas only once
    if (!existingBubbleCanvas) {
      const bubbleWrap = document.createElement('div');
      bubbleWrap.id = 'comicBubbleCanvas';
      bubbleWrap.style.cssText = 'position:absolute;inset:0;pointer-events:auto;z-index:50;overflow:visible;';
      canvas.appendChild(bubbleWrap);
    }

    renderSVG(svgEl);

    if (window.ComicBubbles) ComicBubbles.renderAll();
  }

  function renderSVG(svgEl) {
    svgEl.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    svgEl.appendChild(defs);

    const shapes = LAYOUTS[currentLayout];
    if (!shapes) return;
    const order = SLOT_ORDER[currentLayout] || shapes.map((_,i)=>i+1);

    shapes.forEach((pts, i) => {
      if (!pts || pts.length < 3) return;
      const panelNum = order[i];
      const panel = panels[panelNum - 1];
      if (!panel) return;

      const pstr = pts.map(([x,y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
      const bb   = bbox(pts);
      const clipId = `cp-${currentLayout}-${i}`;

      // Clip path
      const cp = document.createElementNS(ns, 'clipPath');
      cp.setAttribute('id', clipId);
      const cpPoly = document.createElementNS(ns, 'polygon');
      cpPoly.setAttribute('points', pstr);
      cp.appendChild(cpPoly);
      defs.appendChild(cp);

      // Dark background
      const bg = document.createElementNS(ns, 'polygon');
      bg.setAttribute('points', pstr);
      bg.setAttribute('fill', '#111111');
      svgEl.appendChild(bg);

      // Content group
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('clip-path', `url(#${clipId})`);

      if (panel.status === 'loading') {
        const r = document.createElementNS(ns, 'rect');
        r.setAttribute('x', bb.x); r.setAttribute('y', bb.y);
        r.setAttribute('width', bb.w); r.setAttribute('height', bb.h);
        r.setAttribute('fill', '#111111');
        g.appendChild(r);
        addTxt(g, ns, bb.x+bb.w/2, bb.y+bb.h/2, 'GENERATING…', 10, '#EF9F27', 2);
      } else if (panel.imageUrl) {
        const img = document.createElementNS(ns, 'image');
        img.setAttribute('href', panel.imageUrl);
        img.setAttribute('x', bb.x); img.setAttribute('y', bb.y);
        img.setAttribute('width', bb.w); img.setAttribute('height', bb.h);
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        if (panel._svgTransform) img.setAttribute('transform', panel._svgTransform);
        g.appendChild(img);
        // Pan/zoom on image
        svgPanZoom(panel, img, bb, g);
      } else {
        // Empty state
        // Empty state
       addTxt(g, ns, bb.x + bb.w / 2, bb.y + bb.h / 2 - 34, String(panel.number), 32, 'rgba(245,240,232,0.10)', 0);

       // + Library button visual
      const libBtn = document.createElementNS(ns, 'rect');
      libBtn.setAttribute('x', bb.x + bb.w / 2 - 42);
      libBtn.setAttribute('y', bb.y + bb.h / 2 - 8);
      libBtn.setAttribute('width', 84);
      libBtn.setAttribute('height', 18);
      libBtn.setAttribute('fill', 'transparent');
      libBtn.setAttribute('stroke', '#555555');
      libBtn.setAttribute('stroke-width', '1');
      g.appendChild(libBtn);

      addTxt(g, ns, bb.x + bb.w / 2, bb.y + bb.h / 2 + 1, '+ LIBRARY', 7, '#777777', 1.5);

    // Generate button visual
     const genBtn = document.createElementNS(ns, 'rect');
     genBtn.setAttribute('x', bb.x + bb.w / 2 - 42);
     genBtn.setAttribute('y', bb.y + bb.h / 2 + 16);
     genBtn.setAttribute('width', 84);
     genBtn.setAttribute('height', 18);
     genBtn.setAttribute('fill', 'transparent');
     genBtn.setAttribute('stroke', '#EF9F27');
     genBtn.setAttribute('stroke-width', '1');
     g.appendChild(genBtn);

     addTxt(g, ns, bb.x + bb.w / 2, bb.y + bb.h / 2 + 25, '⚡ GENERATE', 7, '#EF9F27', 1.5);

    }

      svgEl.appendChild(g);

      // Transparent hit polygon
      const hit = document.createElementNS(ns, 'polygon');
      hit.setAttribute('points', pstr);
      hit.setAttribute('fill', 'transparent');
      hit.style.cursor = 'pointer';
      hit.addEventListener('click', e => {
        if (!g.dataset.dragging) selectPanel(panel.id);
      });
      svgEl.appendChild(hit);

      // Border — red when selected, subtle when not
      const border = document.createElementNS(ns, 'polygon');
      border.setAttribute('points', pstr);
      border.setAttribute('fill', 'none');
      if (panel.id === selectedId) {
        border.setAttribute('stroke', '#E24B4A');
        border.setAttribute('stroke-width', '4');
      } else {
        border.setAttribute('stroke', '#2a2a2a');
        border.setAttribute('stroke-width', '1.5');
      }
      border.style.pointerEvents = 'none';
      svgEl.appendChild(border);
    });
  }

  function addTxt(g, ns, x, y, text, size, fill, ls) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', fill);
    t.setAttribute('font-size', size);
    t.setAttribute('font-family', 'Inter, Arial, sans-serif');
    if (ls) t.setAttribute('letter-spacing', ls);
    t.textContent = text;
    g.appendChild(t);
  }

  // Pan/zoom for filled panel images (from teacher)
  function svgPanZoom(panel, imgEl, bb, g) {
    if (!panel._svgScale) panel._svgScale = 1;
    if (!panel._svgOx)    panel._svgOx    = 0;
    if (!panel._svgOy)    panel._svgOy    = 0;
    const applyT = () => {
      const s=panel._svgScale, ox=panel._svgOx, oy=panel._svgOy;
      const cx=bb.x+bb.w/2, cy=bb.y+bb.h/2;
      const t=`translate(${cx+ox},${cy+oy}) scale(${s}) translate(${-cx},${-cy})`;
      imgEl.setAttribute('transform', t);
      panel._svgTransform = t;
    };
    g.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      panel._svgScale = Math.max(0.5, Math.min(4, panel._svgScale - e.deltaY*0.002));
      applyT();
    }, { passive:false });
    let drag=false, lx, ly;
    g.addEventListener('mousedown', e => {
      if (panel._svgScale <= 1 && !e.shiftKey) return;
      e.preventDefault(); drag=true; lx=e.clientX; ly=e.clientY; g.dataset.dragging='1';
    });
    const mv = e => { if(!drag)return; panel._svgOx+=e.clientX-lx; panel._svgOy+=e.clientY-ly; lx=e.clientX; ly=e.clientY; applyT(); };
    const up = () => { if(drag){drag=false; delete g.dataset.dragging;} };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  }

  // ---- Render panel editor in the mag sidebar ----
  function renderSidebarEditor() {
    const editor = document.getElementById('magEditor');
    if (!editor) return;

    // Show/hide bubble section
    const bubbleSec = document.getElementById('comicBubbleSection');

    if (!selectedId) {
      editor.innerHTML = `<p class="mag-no-sel">Click a panel to edit</p>`;
      if (bubbleSec) bubbleSec.style.display = 'none';
      return;
    }

    const p = getPanel(selectedId);
    if (!p) return;

    editor.innerHTML = `
      <div class="mag-editor-section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <label class="mag-editor-label" style="margin:0;">Panel ${p.number}</label>
          <span class="comic-status-badge comic-status-${p.status}">${p.status.toUpperCase()}</span>
        </div>
      </div>
      <div class="mag-editor-section">
        <label class="mag-editor-label">Prompt</label>
        <textarea id="comicPanelPrompt" class="mag-editor-textarea" rows="3"
          placeholder="Describe this panel scene…">${p.prompt || ''}</textarea>
      </div>
      <button class="comic-enhance-btn" id="comicEnhancePromptBtn">↗ Enhance Prompt</button>
      <button class="comic-gen-btn" id="comicGenPanelBtn">⚡ Generate Panel</button>
      ${p.imageUrl ? `<button class="comic-clear-btn" id="comicClearPanelBtn">✕ Clear Image</button>` : ''}
    `;

    document.getElementById('comicPanelPrompt').addEventListener('input', e => {
      p.prompt = e.target.value;
    });
    document.getElementById('comicEnhancePromptBtn').addEventListener('click', async () => {
      const ta = document.getElementById('comicPanelPrompt');
      const raw = ta.value.trim();

      if (!raw) {
        alert('Write a prompt first.');
        return;
     }

    const oldText = ta.value;
    ta.value = 'Enhancing prompt…';

  try {
    if (!window.LMStudio || !LMStudio.expandPrompt) {
      throw new Error('LM Studio expandPrompt function is not available.');
    }

    const enhanced = await LMStudio.expandPrompt(raw, 'comic panel');
    p.prompt = enhanced;
    ta.value = enhanced;
  } catch (err) {
    ta.value = oldText;
    alert('Prompt enhancement failed: ' + err.message);
  }
});
    document.getElementById('comicGenPanelBtn').addEventListener('click', () => generatePanel(p.id));
    if (p.imageUrl) {
      document.getElementById('comicClearPanelBtn').addEventListener('click', () => {
        p.imageUrl = null; p.status = 'empty'; p._svgTransform = null;
        render(); renderSidebarEditor();
      });
    }

    // Show bubbles section for selected panel
    if (bubbleSec) {
      bubbleSec.style.display = 'block';
      if (window.ComicBubbles) ComicBubbles.renderBubbleList(selectedId);
    }
  }

  // ---- Generate image for a panel via ComfyUI ----
  async function generatePanel(panelId) {
    const p = getPanel(panelId);
    if (!p) return;
    if (!p.prompt?.trim()) { alert('Enter a prompt for this panel first.'); return; }

    const cfg        = Config.get();
    const styleEl    = document.getElementById('styleSelect');
    const style      = styleEl ? styleEl.value : '';
    const fullPrompt = `${cfg.loraTrigger || 'torzev'} ${p.prompt.trim()}${style ? ', ' + style : ''}`;

    p.status = 'loading';
    render();

    try {
      const imageUrl = await ComfyUI.textToImage(fullPrompt, null);
      p.imageUrl = imageUrl;
      p.status   = 'generated';
      render();
      renderSidebarEditor();
      // Also add to FlatDream gallery
      if (typeof addToGallery === 'function') addToGallery(imageUrl);
    } catch (err) {
      p.status = 'error';
      render();
      renderSidebarEditor();
      alert('Panel generation failed: ' + err.message);
    }
  }

  return {
    init, setLayout, render, renderSVG, renderSidebarEditor,
    selectPanel, generatePanel,
    getPanel, getSelected, getAll, getLayout, getBBoxPercent,
    LAYOUTS, SLOT_ORDER,
  };
})();
