// threedviewer.js — Three.js orbit viewer (ES module)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let renderer, scene, camera, controls, currentModel;

function init() {
  const container = document.getElementById('threedPreviewArea');
  if (!container) return;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'threed-canvas-el';
  container.innerHTML = '';
  container.appendChild(canvas);

  const w = container.clientWidth || 800;
  const h = Math.max(container.clientHeight, 500);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Scene — Rhino-style dark background
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);
  scene.fog = new THREE.Fog(0x1a1a1a, 20, 80);

  // Camera
  camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
  camera.position.set(4, 3, 5);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 8, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x7090ff, 0.4);
  fillLight.position.set(-5, 2, -5);
  scene.add(fillLight);

  // Grid — Rhino viewport style
  const gridHelper = new THREE.GridHelper(20, 20, 0x3a3a3a, 0x2a2a2a);
  scene.add(gridHelper);

  // Axis lines (X=red, Z=blue) like Rhino
  const axesMat = (color) => new THREE.LineBasicMaterial({ color });
  const axisGeo = (pts) => new THREE.BufferGeometry().setFromPoints(pts);
  scene.add(new THREE.Line(axisGeo([new THREE.Vector3(0,0,0), new THREE.Vector3(2,0,0)]), axesMat(0xe24b4a)));
  scene.add(new THREE.Line(axisGeo([new THREE.Vector3(0,0,0), new THREE.Vector3(0,2,0)]), axesMat(0x1d9e75)));
  scene.add(new THREE.Line(axisGeo([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,2)]), axesMat(0x378add)));

  // OrbitControls — Rhino-like feel
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 50;
  controls.target.set(0, 0, 0);

  // Animate loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Resize
  const ro = new ResizeObserver(() => {
    const nw = container.clientWidth;
    const nh = container.clientHeight || 500;
    renderer.setSize(nw, nh);
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);
}

function loadGLB(url) {
  if (!renderer) init();

  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      if (currentModel) scene.remove(currentModel);
      currentModel = gltf.scene;

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(currentModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3 / maxDim;
      currentModel.scale.setScalar(scale);
      currentModel.position.sub(center.multiplyScalar(scale));

      // Enable shadows on all meshes
      currentModel.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(currentModel);
      controls.target.copy(new THREE.Vector3(0, 0, 0));
      controls.update();
    },
    undefined,
    (err) => console.error('GLB load error:', err)
  );
}

// Expose to non-module scripts
window.ThreeDViewer = { init, loadGLB };

// Auto-init when 3D tab becomes active
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'threed' && !renderer) {
        // Small delay to let the tab become visible before measuring
        setTimeout(init, 50);
      }
    });
  });
});
