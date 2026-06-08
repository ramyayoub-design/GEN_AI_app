// modelshot.js — Load GLB, navigate model, capture current view as PNG,
// then send capture to img2img, multi-reference, or sketch.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let currentModel = null;
let currentCaptureDataUrl = null;
let initialized = false;

function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const el = $('modelshotStatusBillboard');
  if (el) el.textContent = text;
}

function init() {
  if (initialized) return;
  initialized = true;

  initViewer();
  initUI();
}

function initViewer() {
  const canvas = $('modelshotCanvas');
  const wrap = $('modelshotViewerWrap');

  if (!canvas || !wrap) return;

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true
  });

  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0b);

  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
  camera.position.set(4, 3, 6);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.target.set(0, 0, 0);

  addLights();
  addGrid();

  resizeRenderer();

  const ro = new ResizeObserver(resizeRenderer);
  ro.observe(wrap);

  animate();
}

function addLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 1.25);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(5, 8, 5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.9);
  fill.position.set(-5, 4, -5);
  scene.add(fill);

  const top = new THREE.DirectionalLight(0xffffff, 0.8);
  top.position.set(0, 10, 0);
  scene.add(top);
}

function addGrid() {
  const grid = new THREE.GridHelper(20, 20, 0x333333, 0x222222);
  grid.name = 'modelshot_grid';
  scene.add(grid);

  const axes = new THREE.AxesHelper(2);
  axes.name = 'modelshot_axes';
  scene.add(axes);
}

function resizeRenderer() {
  const wrap = $('modelshotViewerWrap');
  if (!wrap || !renderer || !camera) return;

  const w = wrap.clientWidth || 800;
  const h = wrap.clientHeight || 500;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);

  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function initUI() {
  const uploadBtn = $('modelshotUploadBtn');
  const fileInput = $('modelshotFileInput');
  const resetBtn = $('modelshotResetCameraBtn');
  const captureBtn = $('modelshotCaptureBtn');

  const sendImg2ImgBtn = $('modelshotSendImg2ImgBtn');
  const sendMulti1Btn = $('modelshotSendMulti1Btn');
  const sendMulti2Btn = $('modelshotSendMulti2Btn');
  const sendSketchBtn = $('modelshotSendSketchBtn');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.glb')) {
        alert('Please upload a .glb file.');
        fileInput.value = '';
        return;
      }

      loadGLBFile(file);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetCamera);
  }

  if (captureBtn) {
    captureBtn.addEventListener('click', captureView);
  }

  if (sendImg2ImgBtn) {
    sendImg2ImgBtn.addEventListener('click', () => {
      if (!requireCapture()) return;
      window.FlatDreamModelShot?.sendToImg2Img(currentCaptureDataUrl);
    });
  }

  if (sendMulti1Btn) {
    sendMulti1Btn.addEventListener('click', () => {
      if (!requireCapture()) return;
      window.FlatDreamModelShot?.sendToMultiRef(1, currentCaptureDataUrl);
    });
  }

  if (sendMulti2Btn) {
    sendMulti2Btn.addEventListener('click', () => {
      if (!requireCapture()) return;
      window.FlatDreamModelShot?.sendToMultiRef(2, currentCaptureDataUrl);
    });
  }

  if (sendSketchBtn) {
    sendSketchBtn.addEventListener('click', () => {
      if (!requireCapture()) return;
      window.FlatDreamModelShot?.sendToSketch(currentCaptureDataUrl);
    });
  }
}

function loadGLBFile(file) {
  if (!scene) return;

  setStatus('LOADING');

  const url = URL.createObjectURL(file);
  const loader = new GLTFLoader();

  loader.load(
    url,
    gltf => {
      URL.revokeObjectURL(url);

      if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse(child => {
          if (child.geometry) child.geometry.dispose?.();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose?.());
            } else {
              child.material.dispose?.();
            }
          }
        });
      }

      currentModel = gltf.scene;

      currentModel.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          const hasTexture =
            child.material &&
            (
              child.material.map ||
              child.material.normalMap ||
              child.material.roughnessMap ||
              child.material.metalnessMap ||
              child.material.emissiveMap
            );

          // If the imported object has no texture, show it like Rhino Arctic:
          // white clay material, slightly rough, readable in dark viewport.
          if (!hasTexture) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xf2f2f2,
              roughness: 0.75,
              metalness: 0.0
            });
          }
        }
      });

      scene.add(currentModel);
      fitModelToView(currentModel);

      const empty = $('modelshotEmpty');
      if (empty) empty.style.display = 'none';

      setStatus('READY');
    },
    undefined,
    err => {
      URL.revokeObjectURL(url);
      console.error('[ModelShot] GLB load error:', err);
      setStatus('ERROR');
      alert('Could not load GLB model.');
    }
  );
}

function fitModelToView(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);

  if (!Number.isFinite(maxDim) || maxDim === 0) {
    model.position.set(0, 0, 0);
    resetCamera();
    return;
  }

  // Center model
  model.position.x += -center.x;
  model.position.y += -center.y;
  model.position.z += -center.z;

  // Recalculate after centering
  const newBox = new THREE.Box3().setFromObject(model);
  const newSize = newBox.getSize(new THREE.Vector3());
  const newMaxDim = Math.max(newSize.x, newSize.y, newSize.z);

  const distance = newMaxDim * 1.6;

  camera.position.set(distance, distance * 0.65, distance);
  camera.near = Math.max(0.01, newMaxDim / 1000);
  camera.far = Math.max(1000, newMaxDim * 100);
  camera.updateProjectionMatrix();

  moveGridToModelBottom(model);

  controls.target.set(0, 0, 0);
  controls.update();
}

function moveGridToModelBottom(model) {
  if (!model || !scene) return;

  const box = new THREE.Box3().setFromObject(model);
  const minY = box.min.y;

  const grid = scene.getObjectByName('modelshot_grid');
  const axes = scene.getObjectByName('modelshot_axes');

  if (grid) {
    grid.position.y = minY;
  }

  if (axes) {
    axes.position.y = minY;
  }
}

function resetCamera() {
  if (!camera || !controls) return;

  if (currentModel) {
    fitModelToView(currentModel);
  } else {
    camera.position.set(4, 3, 6);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

function captureView() {
  if (!renderer || !scene || !camera) return;

  if (!currentModel) {
    alert('Upload a GLB model first.');
    return;
  }

  const grid = scene.getObjectByName('modelshot_grid');
  const axes = scene.getObjectByName('modelshot_axes');

  // Temporarily hide helper elements before capture
  const gridWasVisible = grid ? grid.visible : null;
  const axesWasVisible = axes ? axes.visible : null;

  if (grid) grid.visible = false;
  if (axes) axes.visible = false;

  renderer.render(scene, camera);

  currentCaptureDataUrl = renderer.domElement.toDataURL('image/png');

  // Restore helpers after capture
  if (grid && gridWasVisible !== null) grid.visible = gridWasVisible;
  if (axes && axesWasVisible !== null) axes.visible = axesWasVisible;

  renderer.render(scene, camera);

  const preview = $('modelshotCapturePreview');
  if (preview) {
    preview.innerHTML = `<img src="${currentCaptureDataUrl}" alt="Model Shot capture" />`;
  }

  const downloadBtn = $('modelshotDownloadBtn');
  if (downloadBtn) {
    downloadBtn.href = currentCaptureDataUrl;
    downloadBtn.style.display = 'block';
  }

  setStatus('CAPTURED');
}

function requireCapture() {
  if (!currentCaptureDataUrl) {
    alert('Capture a view first.');
    return false;
  }

  return true;
}

// Initialize when DOM is ready.
// It is safe even if the tab is not visible yet; resize observer will handle size.
document.addEventListener('DOMContentLoaded', () => {
  init();

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'modelshot') {
        setTimeout(resizeRenderer, 50);
      }
    });
  });
});