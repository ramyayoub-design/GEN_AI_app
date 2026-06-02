// magazine.js — Clean comic-only magazine builder for FlatDream

const Magazine = (() => {
  let currentLayout = 'cut4';
  let zoom = 1;
  let uploadedImages = [];

  const COMIC_LAYOUTS = new Set(['cut3', 'cut4', 'cut5', 'cut6']);

  function isComic(layout) {
    return COMIC_LAYOUTS.has(layout);
  }

  function init() {
    if (window.ComicPanels) {
      ComicPanels.init(currentLayout);
    }

    if (window.ComicBubbles) {
      ComicBubbles.init();
    }

    initLayoutPicker();
    ensureHiddenUploadInput();
    initLibraryUpload();
    initPromptControls();

    render();
  }

  function ensureHiddenUploadInput() {
    let uploadInput = document.getElementById('magUploadImageInput');

    if (!uploadInput) {
      uploadInput = document.createElement('input');
      uploadInput.id = 'magUploadImageInput';
      uploadInput.type = 'file';
      uploadInput.accept = 'image/*';
      uploadInput.style.display = 'none';
      document.body.appendChild(uploadInput);
    }

    // Remove/hide sidebar upload button if it exists
    const uploadBtn = document.getElementById('magUploadImageBtn');
    if (uploadBtn) {
      uploadBtn.style.display = 'none';
    }
  }

  function openUploadForPanel(panelId) {
    if (!panelId) {
      alert('Select a panel first.');
      return;
    }

    window._pendingComicPanelId = panelId;

    const uploadInput = document.getElementById('magUploadImageInput');
    if (!uploadInput) {
      alert('Upload input is missing.');
      return;
    }

    console.log('[Magazine Upload] opening file picker for panel:', panelId);

    uploadInput.value = '';
    uploadInput.click();
  }

  function initLibraryUpload() {
    const uploadInput = document.getElementById('magUploadImageInput');

    console.log('[Magazine Upload] init hidden input', {
      uploadInput: !!uploadInput,
    });

    if (!uploadInput) {
      console.error('[Magazine Upload] Missing hidden upload input');
      return;
    }

    uploadInput.onchange = e => {
      const file = e.target.files && e.target.files[0];

      console.log('[Magazine Upload] file selected:', file);

      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        uploadInput.value = '';
        return;
      }

      const reader = new FileReader();

      reader.onload = event => {
        const imageUrl = event.target.result;

        if (!imageUrl) {
          alert('Image upload failed: empty file result.');
          return;
        }

        console.log('[Magazine Upload] image loaded as data URL');

        uploadedImages.unshift(imageUrl);
        renderUploadedLibrary();

        if (window._pendingComicPanelId && window.ComicPanels && ComicPanels.addImageToSelected) {
          console.log('[Magazine Upload] inserting into pending panel:', window._pendingComicPanelId);
          ComicPanels.addImageToSelected(imageUrl);
        } else {
          console.warn('[Magazine Upload] No pending comic panel.');
        }
      };

      reader.onerror = () => {
        console.error('[Magazine Upload] FileReader failed:', reader.error);
        alert('Image upload failed.');
      };

      reader.readAsDataURL(file);
    };

    renderUploadedLibrary();
  }

  function renderUploadedLibrary() {
    const uploadLibrary = document.getElementById('magUploadLibrary');

    if (!uploadLibrary) return;

    uploadLibrary.innerHTML = '';

    if (uploadedImages.length === 0) {
      return;
    }

    uploadedImages.forEach((imageUrl, index) => {
      const item = document.createElement('div');
      item.className = 'mag-thumb';

      item.innerHTML = `
        <img src="${imageUrl}" class="mag-thumb-img" alt="Uploaded image ${index + 1}" />
        <div class="mag-thumb-actions">
          <button class="mag-thumb-btn" type="button">+ Panel</button>
        </div>
      `;

      item.addEventListener('click', () => {
        console.log('[Magazine Upload] thumbnail clicked:', index);
        addImage(imageUrl);
      });

      const panelBtn = item.querySelector('.mag-thumb-btn');
      if (panelBtn) {
        panelBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();

          console.log('[Magazine Upload] + Panel clicked:', index);
          addImage(imageUrl);
        });
      }

      uploadLibrary.appendChild(item);
    });
  }

  function initLayoutPicker() {
    document.querySelectorAll('.mag-layout-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const layout = thumb.dataset.layout;
        if (!isComic(layout)) return;

        document.querySelectorAll('.mag-layout-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');

        currentLayout = layout;
        window._pendingComicPanelId = null;

        if (window.ComicPanels) {
          ComicPanels.setLayout(currentLayout);
          ComicPanels.syncPromptUI?.();
        }

        const bubbleSection = document.getElementById('comicBubbleSection');
        if (bubbleSection) {
          bubbleSection.style.display = 'block';
        }

        if (window.ComicBubbles) {
          ComicBubbles.renderBubbleList();
        }
      });
    });
  }

  function initPromptControls() {
    const promptEl = document.getElementById('magPanelPrompt');
    const enhanceBtn = document.getElementById('magEnhancePromptBtn');

    if (promptEl) {
      promptEl.addEventListener('input', () => {
        const panel = window.ComicPanels ? ComicPanels.getSelected?.() : null;
        if (panel) {
          panel.prompt = promptEl.value;
        }
      });
    }

    if (enhanceBtn) {
      enhanceBtn.addEventListener('click', async () => {
        const panel = window.ComicPanels ? ComicPanels.getSelected?.() : null;

        if (!panel) {
          alert('Select a comic panel first.');
          return;
        }

        const el = document.getElementById('magPanelPrompt');
        const original = el ? el.value.trim() : '';

        if (!original) {
          alert('Write a prompt first.');
          return;
        }

        if (!window.LMStudio || !LMStudio.expandPrompt) {
          alert('LM Studio expandPrompt function is not available.');
          return;
        }

        const oldValue = el.value;
        el.value = 'Enhancing prompt...';

        try {
          const expanded = await LMStudio.expandPrompt(original, 'comic panel');

          if (expanded) {
            el.value = expanded;
            panel.prompt = expanded;
          } else {
            el.value = oldValue;
          }
        } catch (err) {
          el.value = oldValue;
          alert('Prompt enhancement failed: ' + err.message);
        }
      });
    }
  }

  function render() {
    ensureHiddenUploadInput();

    if (window.ComicPanels) {
      ComicPanels.render();
      ComicPanels.syncPromptUI?.();
    }

    const bubbleSection = document.getElementById('comicBubbleSection');
    if (bubbleSection) {
      bubbleSection.style.display = 'block';
    }

    if (window.ComicBubbles) {
      ComicBubbles.renderBubbleList();
    }

    renderUploadedLibrary();
  }

  function addImage(imageUrl) {
    if (!imageUrl) return;

    if (!window.ComicPanels || !ComicPanels.addImageToSelected) {
      alert('Comic panel system is not ready.');
      return;
    }

    ComicPanels.addImageToSelected(imageUrl);
  }

  function clearAll() {
    if (!confirm('Clear all comic panels and bubbles?')) return;

    if (window.ComicPanels) {
      ComicPanels.init(currentLayout);
      ComicPanels.render();
      ComicPanels.syncPromptUI?.();
    }

    if (window.ComicBubbles) {
      ComicBubbles.clearAll();
    }

    window._pendingComicPanelId = null;
  }

  async function exportPNG() {
    const canvas = document.getElementById('magazineCanvas');
    if (!canvas) return;

    try {
      const dataUrl = await domtoimage.toPng(canvas, {
        bgcolor: '#f5f0e8',
      });

      const link = document.createElement('a');
      link.download = `flatdream_comic_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  }

  function zoomIn() {
    setZoom(Math.min(zoom + 0.1, 1.6));
  }

  function zoomOut() {
    setZoom(Math.max(zoom - 0.1, 0.5));
  }

  function setZoom(value) {
    zoom = parseFloat(value.toFixed(2));

    const canvas = document.getElementById('magazineCanvas');
    const label = document.getElementById('magZoomLabel');

    if (canvas) {
      canvas.style.transform = `scale(${zoom})`;
    }

    if (label) {
      label.textContent = `${Math.round(zoom * 100)}%`;
    }
  }

  function addPanelsExternal() {
    alert('Panel count is controlled by the selected comic layout.');
  }

  function getAll() {
    return window.ComicPanels ? ComicPanels.getAll() : [];
  }

  const api = {
    init,
    render,
    addImage,
    clearAll,
    exportPNG,
    zoomIn,
    zoomOut,
    addPanelsExternal,
    getAll,
    openUploadForPanel,
  };

  return api;
})();

window.Magazine = Magazine;