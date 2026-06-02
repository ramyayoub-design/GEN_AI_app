import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let renderer, scene, camera, controls, animId;

function initViewer() {
  const canvas = document.getElementById('threedCanvas');
  const container = document.getElementById('threedPreviewArea');

  if (!canvas || !container) {
    console.error('[Viewer3D] Missing canvas or container', { canvas, container });
    return false;
  }

  canvas.style.display = 'block';

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });

  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0d0d);

  camera = new THREE.PerspectiveCamera(
    45,
    width / height,
    0.01,
    1000
  );

  camera.position.set(2, 2, 2);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 0.1;
  controls.maxDistance = 100;

  // Rhino-style ground grid
  const grid = new THREE.GridHelper(10, 20, 0x333333, 0x222222);
  grid.userData.isGrid = true;
  scene.add(grid);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  function animate() {
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', resizeViewer);

  return true;
}

function resizeViewer() {
  const container = document.getElementById('threedPreviewArea');

  if (!container || !renderer || !camera) return;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function clearPreviousModel() {
  if (!scene) return;

  const oldModels = scene.children.filter(
    child => child.userData && child.userData.isModel
  );

  oldModels.forEach(child => {
    scene.remove(child);

    child.traverse(obj => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }

      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => {
            if (mat.dispose) mat.dispose();
          });
        } else {
          if (obj.material.dispose) obj.material.dispose();
        }
      }
    });
  });
}

export function loadGLB(url) {
  console.log('[Viewer3D] loadGLB:', url);

  const canvas = document.getElementById('threedCanvas');
  const empty = document.getElementById('threedEmpty');

  if (!url) {
    console.error('[Viewer3D] No GLB URL provided');
    return;
  }

  if (!canvas) {
    console.error('[Viewer3D] threedCanvas not found. Something removed it from the DOM.');
    return;
  }

  canvas.style.display = 'block';

  if (empty) {
    empty.style.display = 'none';
  }

  if (!renderer) {
    const initialized = initViewer();
    if (!initialized) return;
  }

  resizeViewer();
  clearPreviousModel();

  const loader = new GLTFLoader();

  loader.load(
    url,

    gltf => {
      console.log('[Viewer3D] GLB loaded successfully');

      const model = gltf.scene;
      model.userData.isModel = true;

      // Measure original model before scaling
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2 / maxDim;

      // Scale model
      model.scale.setScalar(scale);

      // Center model horizontally on the grid
      model.position.x = -center.x * scale;
      model.position.z = -center.z * scale;

      // Put the bottom of the model exactly on the grid
      model.position.y = -box.min.y * scale;

      scene.add(model);

      // Focus camera and orbit target around the object
      const modelHeight = size.y * scale;

      camera.position.set(2.5, 2.2, 2.5);
      controls.target.set(0, modelHeight / 2, 0);
      controls.update();

      resizeViewer();
      renderer.render(scene, camera);
    },

    progress => {
      if (progress.lengthComputable) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        console.log(`[Viewer3D] Loading ${percent}%`);
      }
    },

    error => {
      console.error('[Viewer3D] GLB load error:', error);
    }
  );
}

window.Viewer3D = { loadGLB };