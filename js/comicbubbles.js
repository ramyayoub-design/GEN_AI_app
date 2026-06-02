// comicbubbles.js — Speech bubble overlay for FlatDream comic panel mode
// Adapted from teacher's bubbles.js — dark theme, overlays #comicBubbleCanvas

const ComicBubbles = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'flatdream_comic_bubbles';
  let bubbles = [];

  function load() {
    try { bubbles = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch { bubbles = []; }
    bubbles.forEach(b => {
      if (!b.fillColor)              b.fillColor   = '#111111';
      if (!b.strokeColor)            b.strokeColor = '#E24B4A';
      if (!b.textColor)              b.textColor   = '#f5f0e8';
      if (b.tailAngle === undefined) b.tailAngle   = 90;
      if (b.tailDist  === undefined) b.tailDist    = 60;
      if (!b.type)                   b.type        = 'speech';
    });
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(bubbles)); } catch {}
  }

  // The bubble canvas is recreated on each ComicPanels.render(), so always find it fresh
  function getCanvas() { return document.getElementById('comicBubbleCanvas'); }

  function init() { load(); renderAll(); }

  // ---- Add bubble ----
  function addBubble(data) {
    const isCaption = (data.type || 'speech') === 'caption';
    const defaults = {
      type:'speech', text:'…', character:'',
      x:10, y:10,
      w: isCaption ? 70 : 30,
      h: isCaption ? 8  : 14,
      fillColor:'#111111', strokeColor:'#E24B4A', textColor:'#f5f0e8',
      tailAngle:90, tailDist:60
    };
    bubbles.push({ ...defaults, ...data });
    save(); renderAll(); renderBubbleList();
  }

  // Position new bubble near selected panel's bounding box
  function addBubbleForPanel(panelId) {
    if (window.ComicPanels && panelId) {
      const bb = ComicPanels.getBBoxPercent(panelId);
      if (bb) {
        addBubble({ x: Math.max(2, Math.min(60, bb.x + 5)), y: Math.max(2, Math.min(70, bb.y + 5)) });
        return;
      }
    }
    addBubble({});
  }

  function removeBubble(idx) { bubbles.splice(idx,1); save(); renderAll(); renderBubbleList(); }
  function updateBubble(idx, f) { if (!bubbles[idx]) return; Object.assign(bubbles[idx], f); save(); }
  function clearAll() { bubbles = []; save(); renderAll(); renderBubbleList(); }
  function getAll()   { return bubbles; }

  // ---- Render all bubbles into #comicBubbleCanvas ----
  function renderAll() {
    const canvas = getCanvas();
    if (!canvas) return;
    canvas.innerHTML = '';
    canvas.style.pointerEvents = 'auto';
    bubbles.forEach((b, idx) => canvas.appendChild(createBubbleEl(idx, b)));
  }

  function createBubbleEl(idx, b) {
    const wrap = document.createElement('div');
    wrap.className = `comic-bubble type-${b.type}`;
    wrap.dataset.idx = idx;
    wrap.style.cssText = `position:absolute;left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;` +
      `box-sizing:border-box;overflow:visible;cursor:move;user-select:none;pointer-events:all;`;

    // SVG shape
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;';
    drawSVG(svg, b);
    wrap.appendChild(svg);

    // Editable text
    const ta = document.createElement('div');
    ta.className = 'comic-bubble-text';
    ta.contentEditable = 'true';
    ta.textContent = b.text || '';
    ta.style.color = b.textColor || '#f5f0e8';
    // Fix 3: apply stored font size
    ta.style.fontSize = (b.fontSize || 11) + 'px';
    ta.addEventListener('input', e => {
      updateBubble(idx, { text: e.target.textContent });
      syncListText(idx, e.target.textContent);
    });
    ta.addEventListener('mousedown', e => e.stopPropagation());
    wrap.appendChild(ta);

    // Delete handle
    const del = document.createElement('div');
    del.className = 'comic-bubble-handle';
    del.textContent = '✕';
    del.addEventListener('click', e => { e.stopPropagation(); removeBubble(idx); });
    wrap.appendChild(del);

    // Width resize
    const resX = document.createElement('div'); resX.className = 'comic-bubble-resize-x';
    wrap.appendChild(resX);
    // Height resize
    const resY = document.createElement('div'); resY.className = 'comic-bubble-resize-y';
    wrap.appendChild(resY);
    // Tail handle
    const tailH = document.createElement('div'); tailH.className = 'comic-bubble-tail-handle';
    if (b.type === 'speech' || b.type === 'thought') { positionTailHandle(tailH, b); }
    else { tailH.style.display = 'none'; }
    wrap.appendChild(tailH);

    makeDraggable(wrap, idx);
    makeResizableX(wrap, resX, idx);
    makeResizableY(wrap, resY, idx);
    makeTailDraggable(wrap, tailH, svg, idx);

    return wrap;
  }

  // ---- SVG drawing (adapted from teacher, dark colours) ----
  function drawSVG(svg, b) {
    svg.innerHTML = '';
    const fill   = b.fillColor   || '#111111';
    const stroke = b.strokeColor || '#E24B4A';
    const cx=50, cy=50, rx=46, ry=38;

    if (b.type === 'speech') {
      const a = b.tailAngle * Math.PI/180;
      const dist = b.tailDist * 0.8;
      const tx = cx+(rx+dist)*Math.cos(a), ty = cy+(ry+dist)*Math.sin(a);
      const sp = 0.14;
      const p1x=cx+rx*Math.cos(a-sp), p1y=cy+ry*Math.sin(a-sp);
      const p2x=cx+rx*Math.cos(a+sp), p2y=cy+ry*Math.sin(a+sp);
      const path = document.createElementNS(NS,'path');
      path.setAttribute('d', `M${r(p1x)},${r(p1y)} A${rx},${ry} 0 1 0 ${r(p2x)},${r(p2y)} L${r(tx)},${r(ty)} Z`);
      path.setAttribute('fill', fill); path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width','1.5'); path.setAttribute('stroke-linejoin','round');
      svg.appendChild(path);

    } else if (b.type === 'thought') {
      const a = b.tailAngle * Math.PI/180;
      const dist = b.tailDist * 0.8;
      const ex=cx+rx*Math.cos(a), ey=cy+ry*Math.sin(a);
      const tx=cx+(rx+dist)*Math.cos(a), ty=cy+(ry+dist)*Math.sin(a);
      for (let i=0; i<3; i++) {
        const t=(i+1)/4, c=document.createElementNS(NS,'circle');
        c.setAttribute('cx',r(ex+(tx-ex)*t)); c.setAttribute('cy',r(ey+(ty-ey)*t));
        c.setAttribute('r',r(4.5-i*1.2));
        c.setAttribute('fill',fill); c.setAttribute('stroke',stroke); c.setAttribute('stroke-width','1.2');
        svg.appendChild(c);
      }
      const el=document.createElementNS(NS,'ellipse');
      el.setAttribute('cx',cx); el.setAttribute('cy',cy);
      el.setAttribute('rx',rx); el.setAttribute('ry',ry);
      el.setAttribute('fill',fill); el.setAttribute('stroke',stroke);
      el.setAttribute('stroke-width','1.5'); el.setAttribute('stroke-dasharray','4 3');
      svg.appendChild(el);

    } else if (b.type === 'shout') {
      const pts=[];
      for (let i=0;i<20;i++){
        const a=i*18*Math.PI/180-Math.PI/2, ro=i%2===0?47:37;
        pts.push(`${r(cx+ro*Math.cos(a))},${r(cy+ro*Math.sin(a))}`);
      }
      const star=document.createElementNS(NS,'polygon');
      star.setAttribute('points',pts.join(' '));
      star.setAttribute('fill', hexToRgba(fill,0.3));
      star.setAttribute('stroke', stroke); star.setAttribute('stroke-width','1.5');
      svg.appendChild(star);

    } else { // caption
      const rect=document.createElementNS(NS,'rect');
      rect.setAttribute('x','2'); rect.setAttribute('y','2');
      rect.setAttribute('width','96'); rect.setAttribute('height','96'); rect.setAttribute('rx','2');
      rect.setAttribute('fill', fill); rect.setAttribute('stroke', stroke); rect.setAttribute('stroke-width','1.5');
      svg.appendChild(rect);
    }
  }

  function r(n) { return parseFloat(n.toFixed(2)); }
  function hexToRgba(hex, a) {
    const rv=parseInt(hex.slice(1,3),16), gv=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${rv},${gv},${b},${a})`;
  }

  function positionTailHandle(h, b) {
    const a = b.tailAngle*Math.PI/180, dist = b.tailDist*0.8;
    const tx=50+(46+dist)*Math.cos(a), ty=50+(44+dist)*Math.sin(a);
    h.style.left = tx+'%'; h.style.top = ty+'%';
  }

  // ---- Drag / Resize / Tail ----
  function makeDraggable(wrap, idx) {
    wrap.addEventListener('mousedown', e => {
      if (['TEXTAREA','INPUT'].includes(e.target.tagName) ||
          e.target.className.includes('comic-bubble-handle') ||
          e.target.className.includes('comic-bubble-resize') ||
          e.target.className.includes('comic-bubble-tail')) return;
      e.preventDefault();
      const pr=wrap.parentElement.getBoundingClientRect();
      const sx=e.clientX, sy=e.clientY, sl=bubbles[idx].x, st=bubbles[idx].y;
      const onMove = e => {
        const nl=Math.max(0,sl+((e.clientX-sx)/pr.width)*100);
        const nt=Math.max(0,st+((e.clientY-sy)/pr.height)*100);
        wrap.style.left=nl+'%'; wrap.style.top=nt+'%';
        updateBubble(idx,{x:nl,y:nt});
      };
      const onUp = () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
      window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
    });
  }

  function makeResizableX(wrap, handle, idx) {
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const pr=wrap.parentElement.getBoundingClientRect();
      const sx=e.clientX, sw=wrap.getBoundingClientRect().width;
      const onMove = e => {
        const nw=Math.max(60,sw+(e.clientX-sx));
        const np=(nw/pr.width)*100;
        wrap.style.width=np+'%'; updateBubble(idx,{w:np});
        const svg=wrap.querySelector('svg'); if(svg)drawSVG(svg,bubbles[idx]);
      };
      const onUp = () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
      window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
    });
  }

  function makeResizableY(wrap, handle, idx) {
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const pr=wrap.parentElement.getBoundingClientRect();
      const sy=e.clientY, sh=(bubbles[idx].h/100)*pr.height;
      const onMove = e => {
        const nh=Math.max(30,sh+(e.clientY-sy));
        const np=(nh/pr.height)*100;
        wrap.style.height=np+'%'; updateBubble(idx,{h:np});
        const svg=wrap.querySelector('svg'); if(svg)drawSVG(svg,bubbles[idx]);
      };
      const onUp = () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
      window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
    });
  }

  function makeTailDraggable(wrap, handle, svg, idx) {
    if (!handle || handle.style.display === 'none') return;
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const wr=wrap.getBoundingClientRect();
      const onMove = e => {
        const dx=e.clientX-(wr.left+wr.width/2), dy=e.clientY-(wr.top+wr.height/2);
        const angle=Math.atan2(dy,dx)*180/Math.PI;
        const distPx=Math.sqrt(dx*dx+dy*dy);
        const maxR=Math.max(wr.width,wr.height)/2;
        const dist=Math.max(10,(distPx/maxR)*60);
        bubbles[idx].tailAngle=parseFloat(angle.toFixed(1));
        bubbles[idx].tailDist=parseFloat(dist.toFixed(1));
        updateBubble(idx,{tailAngle:bubbles[idx].tailAngle, tailDist:bubbles[idx].tailDist});
        drawSVG(svg, bubbles[idx]);
        positionTailHandle(handle, bubbles[idx]);
      };
      const onUp = () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
      window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
    });
  }

  // ---- Sidebar bubble list (renders into #comicBubbleList) ----
  function renderBubbleList(panelId) {
    const list = document.getElementById('comicBubbleList');
    if (!list) return;
    list.innerHTML = '';

    if (bubbles.length === 0) {
      list.innerHTML = '<p class="mag-no-sel" style="font-size:14px;">No bubbles yet</p>';
      return;
    }

    bubbles.forEach((b, idx) => {
      const item = document.createElement('div');
      item.className = 'comic-bubble-item';
      item.id = `comic-bubble-list-${idx}`;
      item.innerHTML = `
        <div class="comic-bubble-item-header">
          <select class="comic-bubble-type-sel">
            ${['speech','thought','shout','caption'].map(t =>
              `<option value="${t}"${b.type===t?' selected':''}>${t}</option>`
            ).join('')}
          </select>
          <input class="comic-bubble-char" placeholder="Character…" value="${b.character||''}"/>
          <button class="comic-bubble-del-btn">✕</button>
        </div>
        <textarea class="comic-bubble-text-input" rows="2" placeholder="Bubble text…">${b.text||''}</textarea>
        <div class="comic-bubble-color-row">
          <label class="comic-bubble-color-lbl">Fill
            <input type="color" class="comic-color-pick" data-field="fillColor" value="${b.fillColor||'#111111'}"/>
          </label>
          <label class="comic-bubble-color-lbl">Stroke
            <input type="color" class="comic-color-pick" data-field="strokeColor" value="${b.strokeColor||'#E24B4A'}"/>
          </label>
          <label class="comic-bubble-color-lbl">Text
            <input type="color" class="comic-color-pick" data-field="textColor" value="${b.textColor||'#f5f0e8'}"/>
          </label>
        </div>
        <div class="comic-bubble-font-row">
          <span class="comic-bubble-font-label">Size</span>
          <input type="range" class="comic-bubble-font-slider" min="8" max="32" value="${b.fontSize||11}" step="1"/>
          <span class="comic-bubble-font-val">${b.fontSize||11}px</span>
        </div>`;

      item.querySelector('.comic-bubble-type-sel').addEventListener('change', e => {
        updateBubble(idx,{type:e.target.value}); renderAll(); renderBubbleList();
      });
      item.querySelector('.comic-bubble-char').addEventListener('input', e =>
        updateBubble(idx,{character:e.target.value})
      );
      item.querySelector('.comic-bubble-text-input').addEventListener('input', e => {
        updateBubble(idx,{text:e.target.value});
        syncListText(idx, e.target.value);
      });
      item.querySelectorAll('.comic-color-pick').forEach(p => p.addEventListener('input', e => {
        updateBubble(idx,{[e.target.dataset.field]:e.target.value});
        const wrap = getCanvas()?.querySelector(`[data-idx="${idx}"]`);
        if (wrap) {
          const svg = wrap.querySelector('svg'); if(svg) drawSVG(svg, bubbles[idx]);
          if (e.target.dataset.field === 'textColor') {
            const ta = wrap.querySelector('.comic-bubble-text');
            if (ta) ta.style.color = e.target.value;
          }
        }
      }));
      item.querySelector('.comic-bubble-del-btn').addEventListener('click', () => removeBubble(idx));

      // Fix 3: font size slider — updates canvas bubble text live
      item.querySelector('.comic-bubble-font-slider').addEventListener('input', e => {
        const fs = parseInt(e.target.value);
        item.querySelector('.comic-bubble-font-val').textContent = fs + 'px';
        updateBubble(idx, { fontSize: fs });
        const wrap = getCanvas()?.querySelector(`[data-idx="${idx}"]`);
        if (wrap) {
          const txt = wrap.querySelector('.comic-bubble-text');
          if (txt) txt.style.fontSize = fs + 'px';
        }
      });

      list.appendChild(item);
    });
  }

  function syncListText(idx, text) {
    const el = document.querySelector(`#comic-bubble-list-${idx} .comic-bubble-text-input`);
    if (el && el.value !== text) el.value = text;
  }

  return { init, load, addBubble, addBubbleForPanel, removeBubble, updateBubble, clearAll, getAll, renderAll, renderBubbleList };
})();
