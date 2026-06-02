// comicbubbles.js — Clean draggable speech bubble overlay for FlatDream comic mode

const ComicBubbles = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'flatdream_comic_bubbles_v2';

  let bubbles = [];

  function load() {
    try {
      bubbles = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    } catch {
      bubbles = [];
    }

    bubbles.forEach(normalizeBubble);
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(bubbles));
    } catch {}
  }

  function normalizeBubble(b) {
    if (!b.type) b.type = 'speech';
    if (!b.text) b.text = '…';
    if (!b.character) b.character = '';
    if (typeof b.x !== 'number') b.x = 10;
    if (typeof b.y !== 'number') b.y = 10;
    if (typeof b.w !== 'number') b.w = b.type === 'caption' ? 70 : 30;
    if (typeof b.h !== 'number') b.h = b.type === 'caption' ? 8 : 14;
    if (!b.fillColor) b.fillColor = '#111111';
    if (!b.strokeColor) b.strokeColor = '#E24B4A';
    if (!b.textColor) b.textColor = '#f5f0e8';
    if (typeof b.fontSize !== 'number') b.fontSize = 11;
    if (typeof b.tailAngle !== 'number') b.tailAngle = 90;
    if (typeof b.tailDist !== 'number') b.tailDist = 60;
  }

  function getCanvas() {
    return document.getElementById('comicBubbleCanvas');
  }

  function init() {
    load();
    renderAll();
    renderBubbleList();
  }

  function addBubble(data = {}) {
    const selectedPanel = window.ComicPanels ? ComicPanels.getSelected() : null;
    const isCaption = (data.type || 'speech') === 'caption';

    const bubble = {
      type: 'speech',
      text: '…',
      character: '',
      x: 10,
      y: 10,
      w: isCaption ? 70 : 30,
      h: isCaption ? 8 : 14,
      fillColor: '#111111',
      strokeColor: '#E24B4A',
      textColor: '#f5f0e8',
      fontSize: 11,
      tailAngle: 90,
      tailDist: 60,
      ...data,
    };

    if (selectedPanel && window.ComicPanels) {
      const bb = ComicPanels.getBBoxPercent(selectedPanel.id);
      if (bb) {
        bubble.x = Math.max(2, Math.min(75, bb.x + 5));
        bubble.y = Math.max(2, Math.min(80, bb.y + 5));
      }
    }

    normalizeBubble(bubble);
    bubbles.push(bubble);
    save();
    renderAll();
    renderBubbleList();
  }

  function addBubbleForPanel(panelId) {
    if (window.ComicPanels && panelId) {
      const bb = ComicPanels.getBBoxPercent(panelId);
      if (bb) {
        addBubble({
          x: Math.max(2, Math.min(75, bb.x + 5)),
          y: Math.max(2, Math.min(80, bb.y + 5)),
        });
        return;
      }
    }

    addBubble({});
  }

  function removeBubble(idx) {
    bubbles.splice(idx, 1);
    save();
    renderAll();
    renderBubbleList();
  }

  function updateBubble(idx, fields) {
    if (!bubbles[idx]) return;

    Object.assign(bubbles[idx], fields);
    normalizeBubble(bubbles[idx]);
    save();
  }

  function clearAll() {
    bubbles = [];
    save();
    renderAll();
    renderBubbleList();
  }

  function getAll() {
    return bubbles;
  }

  function renderAll() {
    const canvas = getCanvas();
    if (!canvas) return;

    canvas.innerHTML = '';
    canvas.style.pointerEvents = 'none';

    bubbles.forEach((bubble, idx) => {
      canvas.appendChild(createBubbleEl(idx, bubble));
    });
  }

  function createBubbleEl(idx, bubble) {
    const wrap = document.createElement('div');

    wrap.className = `comic-bubble type-${bubble.type}`;
    wrap.dataset.idx = idx;
    wrap.style.cssText = [
      'position:absolute',
      `left:${bubble.x}%`,
      `top:${bubble.y}%`,
      `width:${bubble.w}%`,
      `height:${bubble.h}%`,
      'box-sizing:border-box',
      'overflow:visible',
      'cursor:move',
      'user-select:none',
      'pointer-events:auto',
      'z-index:1000',
    ].join(';');

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;';
    drawSVG(svg, bubble);
    wrap.appendChild(svg);

    const text = document.createElement('div');
    text.className = 'comic-bubble-text';
    text.contentEditable = 'true';
    text.textContent = bubble.text || '';
    text.style.color = bubble.textColor;
    text.style.fontSize = `${bubble.fontSize}px`;
    text.style.pointerEvents = 'auto';

    text.addEventListener('input', e => {
      updateBubble(idx, { text: e.target.textContent });
      syncListText(idx, e.target.textContent);
    });

    wrap.appendChild(text);

    const del = document.createElement('div');
    del.className = 'comic-bubble-handle';
    del.textContent = '✕';
    del.addEventListener('pointerdown', e => e.stopPropagation());
    del.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      removeBubble(idx);
    });
    wrap.appendChild(del);

    const resizeX = document.createElement('div');
    resizeX.className = 'comic-bubble-resize-x';
    wrap.appendChild(resizeX);

    const resizeY = document.createElement('div');
    resizeY.className = 'comic-bubble-resize-y';
    wrap.appendChild(resizeY);

    const tail = document.createElement('div');
    tail.className = 'comic-bubble-tail-handle';

    if (bubble.type === 'speech' || bubble.type === 'thought') {
      positionTailHandle(tail, bubble);
    } else {
      tail.style.display = 'none';
    }

    wrap.appendChild(tail);

    makeDraggable(wrap, idx);
    makeResizableX(wrap, resizeX, idx);
    makeResizableY(wrap, resizeY, idx);
    makeTailDraggable(wrap, tail, svg, idx);

    return wrap;
  }

  function drawSVG(svg, b) {
    svg.innerHTML = '';

    const fill = b.fillColor || '#111111';
    const stroke = b.strokeColor || '#E24B4A';

    const cx = 50;
    const cy = 50;
    const rx = 46;
    const ry = 38;

    if (b.type === 'speech') {
      const a = (b.tailAngle * Math.PI) / 180;
      const dist = b.tailDist * 0.8;

      const tx = cx + (rx + dist) * Math.cos(a);
      const ty = cy + (ry + dist) * Math.sin(a);

      const spread = 0.14;
      const p1x = cx + rx * Math.cos(a - spread);
      const p1y = cy + ry * Math.sin(a - spread);
      const p2x = cx + rx * Math.cos(a + spread);
      const p2y = cy + ry * Math.sin(a + spread);

      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M${r(p1x)},${r(p1y)} A${rx},${ry} 0 1 0 ${r(p2x)},${r(p2y)} L${r(tx)},${r(ty)} Z`);
      path.setAttribute('fill', fill);
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
      return;
    }

    if (b.type === 'thought') {
      const a = (b.tailAngle * Math.PI) / 180;
      const dist = b.tailDist * 0.8;
      const ex = cx + rx * Math.cos(a);
      const ey = cy + ry * Math.sin(a);
      const tx = cx + (rx + dist) * Math.cos(a);
      const ty = cy + (ry + dist) * Math.sin(a);

      for (let i = 0; i < 3; i++) {
        const t = (i + 1) / 4;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', r(ex + (tx - ex) * t));
        c.setAttribute('cy', r(ey + (ty - ey) * t));
        c.setAttribute('r', r(4.5 - i * 1.2));
        c.setAttribute('fill', fill);
        c.setAttribute('stroke', stroke);
        c.setAttribute('stroke-width', '1.2');
        svg.appendChild(c);
      }

      const el = document.createElementNS(NS, 'ellipse');
      el.setAttribute('cx', cx);
      el.setAttribute('cy', cy);
      el.setAttribute('rx', rx);
      el.setAttribute('ry', ry);
      el.setAttribute('fill', fill);
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', '1.5');
      el.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(el);
      return;
    }

    if (b.type === 'shout') {
      const pts = [];

      for (let i = 0; i < 20; i++) {
        const a = ((i * 18) * Math.PI) / 180 - Math.PI / 2;
        const ro = i % 2 === 0 ? 47 : 37;
        pts.push(`${r(cx + ro * Math.cos(a))},${r(cy + ro * Math.sin(a))}`);
      }

      const star = document.createElementNS(NS, 'polygon');
      star.setAttribute('points', pts.join(' '));
      star.setAttribute('fill', hexToRgba(fill, 0.3));
      star.setAttribute('stroke', stroke);
      star.setAttribute('stroke-width', '1.5');
      svg.appendChild(star);
      return;
    }

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', '2');
    rect.setAttribute('y', '2');
    rect.setAttribute('width', '96');
    rect.setAttribute('height', '96');
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', '1.5');
    svg.appendChild(rect);
  }

  function makeDraggable(wrap, idx) {
    wrap.addEventListener('pointerdown', e => {
      const cls = String(e.target.className || '');

      if (
        ['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName) ||
        cls.includes('comic-bubble-handle') ||
        cls.includes('comic-bubble-resize') ||
        cls.includes('comic-bubble-tail')
      ) {
        return;
      }

      console.log('[ComicBubbles] drag start', idx);

      e.preventDefault();
      e.stopPropagation();

      wrap.setPointerCapture?.(e.pointerId);

      const parentRect = wrap.parentElement.getBoundingClientRect();
      const sx = e.clientX;
      const sy = e.clientY;
      const startX = bubbles[idx].x;
      const startY = bubbles[idx].y;

      const onMove = e => {
        const nx = Math.max(0, Math.min(95, startX + ((e.clientX - sx) / parentRect.width) * 100));
        const ny = Math.max(0, Math.min(95, startY + ((e.clientY - sy) / parentRect.height) * 100));

        wrap.style.left = `${nx}%`;
        wrap.style.top = `${ny}%`;

        updateBubble(idx, { x: nx, y: ny });
      };

      const onUp = e => {
        wrap.releasePointerCapture?.(e.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }, true);
  }

  function makeResizableX(wrap, handle, idx) {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();

      const parentRect = wrap.parentElement.getBoundingClientRect();
      const sx = e.clientX;
      const startW = wrap.getBoundingClientRect().width;

      const onMove = e => {
        const newW = Math.max(60, startW + (e.clientX - sx));
        const percent = (newW / parentRect.width) * 100;

        wrap.style.width = `${percent}%`;
        updateBubble(idx, { w: percent });

        const svg = wrap.querySelector('svg');
        if (svg) drawSVG(svg, bubbles[idx]);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  function makeResizableY(wrap, handle, idx) {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();

      const parentRect = wrap.parentElement.getBoundingClientRect();
      const sy = e.clientY;
      const startH = wrap.getBoundingClientRect().height;

      const onMove = e => {
        const newH = Math.max(30, startH + (e.clientY - sy));
        const percent = (newH / parentRect.height) * 100;

        wrap.style.height = `${percent}%`;
        updateBubble(idx, { h: percent });

        const svg = wrap.querySelector('svg');
        if (svg) drawSVG(svg, bubbles[idx]);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  function makeTailDraggable(wrap, handle, svg, idx) {
    if (!handle || handle.style.display === 'none') return;

    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();

      const onMove = e => {
        const rect = wrap.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const maxR = Math.max(rect.width, rect.height) / 2;
        const dist = Math.max(10, (distPx / maxR) * 60);

        bubbles[idx].tailAngle = parseFloat(angle.toFixed(1));
        bubbles[idx].tailDist = parseFloat(dist.toFixed(1));

        updateBubble(idx, {
          tailAngle: bubbles[idx].tailAngle,
          tailDist: bubbles[idx].tailDist,
        });

        drawSVG(svg, bubbles[idx]);
        positionTailHandle(handle, bubbles[idx]);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  function positionTailHandle(handle, bubble) {
    const a = (bubble.tailAngle * Math.PI) / 180;
    const dist = bubble.tailDist * 0.8;
    const tx = 50 + (46 + dist) * Math.cos(a);
    const ty = 50 + (44 + dist) * Math.sin(a);

    handle.style.left = `${tx}%`;
    handle.style.top = `${ty}%`;
  }

  function renderBubbleList() {
    const list = document.getElementById('comicBubbleList');
    if (!list) return;

    list.innerHTML = '';

    if (bubbles.length === 0) {
      list.innerHTML = '<p class="mag-no-sel" style="font-size:12px;">No bubbles yet</p>';
      return;
    }

    bubbles.forEach((bubble, idx) => {
      const item = document.createElement('div');
      item.className = 'comic-bubble-item';
      item.id = `comic-bubble-list-${idx}`;

      item.innerHTML = `
        <div class="comic-bubble-item-header">
          <select class="comic-bubble-type-sel">
            ${['speech', 'thought', 'shout', 'caption'].map(type =>
              `<option value="${type}"${bubble.type === type ? ' selected' : ''}>${type}</option>`
            ).join('')}
          </select>
          <input class="comic-bubble-char" placeholder="Character…" value="${escapeHTML(bubble.character || '')}" />
          <button class="comic-bubble-del-btn">✕</button>
        </div>

        <textarea class="comic-bubble-text-input" rows="2" placeholder="Bubble text…">${escapeHTML(bubble.text || '')}</textarea>

        <div class="comic-bubble-color-row">
          <label class="comic-bubble-color-lbl">Fill
            <input type="color" class="comic-color-pick" data-field="fillColor" value="${bubble.fillColor}" />
          </label>
          <label class="comic-bubble-color-lbl">Stroke
            <input type="color" class="comic-color-pick" data-field="strokeColor" value="${bubble.strokeColor}" />
          </label>
          <label class="comic-bubble-color-lbl">Text
            <input type="color" class="comic-color-pick" data-field="textColor" value="${bubble.textColor}" />
          </label>
        </div>

        <div class="comic-bubble-font-row">
          <span class="comic-bubble-font-label">Size</span>
          <input type="range" class="comic-bubble-font-slider" min="8" max="32" value="${bubble.fontSize}" step="1" />
          <span class="comic-bubble-font-val">${bubble.fontSize}px</span>
        </div>
      `;

      item.querySelector('.comic-bubble-type-sel').addEventListener('change', e => {
        updateBubble(idx, { type: e.target.value });
        renderAll();
        renderBubbleList();
      });

      item.querySelector('.comic-bubble-char').addEventListener('input', e => {
        updateBubble(idx, { character: e.target.value });
      });

      item.querySelector('.comic-bubble-text-input').addEventListener('input', e => {
        updateBubble(idx, { text: e.target.value });
        const wrap = getCanvas()?.querySelector(`[data-idx="${idx}"]`);
        const text = wrap?.querySelector('.comic-bubble-text');
        if (text) text.textContent = e.target.value;
      });

      item.querySelectorAll('.comic-color-pick').forEach(input => {
        input.addEventListener('input', e => {
          updateBubble(idx, { [e.target.dataset.field]: e.target.value });
          renderAll();
        });
      });

      item.querySelector('.comic-bubble-font-slider').addEventListener('input', e => {
        const size = parseInt(e.target.value, 10);
        item.querySelector('.comic-bubble-font-val').textContent = `${size}px`;

        updateBubble(idx, { fontSize: size });

        const wrap = getCanvas()?.querySelector(`[data-idx="${idx}"]`);
        const text = wrap?.querySelector('.comic-bubble-text');
        if (text) text.style.fontSize = `${size}px`;
      });

      item.querySelector('.comic-bubble-del-btn').addEventListener('click', () => {
        removeBubble(idx);
      });

      list.appendChild(item);
    });
  }

  function syncListText(idx, text) {
    const el = document.querySelector(`#comic-bubble-list-${idx} .comic-bubble-text-input`);
    if (el && el.value !== text) {
      el.value = text;
    }
  }

  function r(n) {
    return parseFloat(n.toFixed(2));
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const rv = parseInt(clean.slice(0, 2), 16);
    const gv = parseInt(clean.slice(2, 4), 16);
    const bv = parseInt(clean.slice(4, 6), 16);

    return `rgba(${rv},${gv},${bv},${alpha})`;
  }

  function escapeHTML(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  const api = {
    init,
    load,
    addBubble,
    addBubbleForPanel,
    removeBubble,
    updateBubble,
    clearAll,
    getAll,
    renderAll,
    renderBubbleList,
  };

  return api;
})();

window.ComicBubbles = ComicBubbles;