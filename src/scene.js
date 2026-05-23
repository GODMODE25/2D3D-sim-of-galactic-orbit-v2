import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GalacticOrbit } from './galacticOrbit.js';
import { PLANET_DATA, SUN_DATA, PlanetOrbit } from './planetOrbits.js';
import SimulationControls from './controls.js';
import { VisualEffects } from './visualEffects.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function initScene() {
  // Canvas and renderer
  const canvas = document.getElementById('canvas');
  if (!canvas) {
    throw new Error('Canvas element with id "canvas" not found. Ensure your HTML contains <canvas id="canvas"></canvas>');
  }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // CSS2D renderer for labels
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  document.body.appendChild(labelRenderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  // Move the camera back so the large galactic orbit is visible initially
  camera.position.set(0, 200, 600);
  camera.lookAt(0, 0, 0);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(100, 100, 100);
  directional.castShadow = true;
  scene.add(directional);

  // Sun
  const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
  const sunMaterial = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xffaa00,
    emissiveIntensity: 1.45,
    metalness: 0.2
  });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.set(0, 0, 0);
  sun.castShadow = false;
  sun.receiveShadow = false;
  SUN_DATA.uuid = sun.uuid;
  sun.userData.info = SUN_DATA;
  scene.add(sun);

  const sunGlowTexture = createGlowTexture(['rgba(255,245,160,1)', 'rgba(255,150,28,0.5)', 'rgba(255,90,0,0)']);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunGlowTexture,
    color: 0xffcc66,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  sunGlow.scale.set(34, 34, 1);
  sun.add(sunGlow);

  // Create planets array and their orbits
  const planets = [];
  const planetOrbits = [];
  for (const pdata of PLANET_DATA) {
    const geom = new THREE.SphereGeometry(Math.min(pdata.radiusUnits, 1.0), 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: pdata.color, roughness: 0.7, metalness: 0.3 });
    const mesh = new THREE.Mesh(geom, mat);
    pdata.uuid = mesh.uuid;
    mesh.userData.info = pdata;
    // place initially at semi-major axis along +X (will be updated by orbit)
    mesh.position.set(pdata.semiMajorAxisAU * 15, 0, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    planets.push(mesh);

    // instantiate PlanetOrbit
    const orbit = new PlanetOrbit(mesh, sun, pdata);
    planetOrbits.push(orbit);
  }
  // Determine Earth index reliably from PLANET_DATA
  let earthIndex = PLANET_DATA.findIndex(p => p.name === 'Earth');
  if (earthIndex === -1) {
    // fallback to case-insensitive match
    earthIndex = PLANET_DATA.findIndex(p => typeof p.name === 'string' && p.name.toLowerCase() === 'earth');
  }
  if (earthIndex === -1) {
    // final fallback: prefer index 2 if available
    earthIndex = (planets.length > 2) ? 2 : 0;
  }
  const earth = (earthIndex >= 0 && earthIndex < planets.length) ? planets[earthIndex] : null;
  // Galactic plane reference grid (XZ plane, Y=0) to visualize the 60-degree ecliptic tilt
  const galacticPlaneGrid = new THREE.GridHelper(2000, 50, 0x444444, 0x222222);
  galacticPlaneGrid.position.set(0, 0, 0);
  scene.add(galacticPlaneGrid);

  // Axes helper for orientation (X=red, Y=green, Z=blue)
  const axesHelper = new THREE.AxesHelper(100);
  scene.add(axesHelper);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 1500;

  // Initialize galactic orbit system (Sun will orbit Sagittarius A*)
  const galacticOrbit = new GalacticOrbit(sun, scene, { orbitRadius: 800, orbitalPeriod: 120 });

  // planetOrbits created above for all planets

  // Visual effects (trail, labels, starfield, info updates)
  // Create visualEffects before controls so SimulationControls can reference it
  const visualEffects = new VisualEffects({
    scene,
    camera,
    planets,
    planetOrbits,
    sun,
    sagittariusA: galacticOrbit.sagittariusA,
    earthIndex
  });

  // Simulation controls (time speed, play/pause, camera presets, reset)
  const simulationControls = new SimulationControls({
    camera,
    controls,
    sun,
    planets,
    sagittariusA: galacticOrbit.sagittariusA,
    galacticOrbit,
    planetOrbits,
    visualEffects,
    galacticPlaneGrid,
    axesHelper
  });

  simulationControls.updateVisibilities();
  simulationControls.setCameraMode('Galactic Overview', { instant: true });

  // Resize handler
  function onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }

  window.addEventListener('resize', onWindowResize, { passive: true });

  // Animation loop
  // Delta time tracking
  let lastTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000; // seconds
    lastTime = currentTime;

    // subtle rotations
    sun.rotation.y += 0.0015;
    for (const p of planets) {
      p.rotation.y += 0.01;
    }

    // Apply time speed multiplier from controls
    const effectiveDeltaTime = (typeof simulationControls !== 'undefined') ? deltaTime * simulationControls.getEffectiveSpeed() : deltaTime;

    // Update galactic orbit (moves the Sun around Sagittarius A*)
    galacticOrbit.update(effectiveDeltaTime);

    // Update all planet orbits around the Sun (must be called after galacticOrbit.update)
    for (const pOrbit of planetOrbits) {
      pOrbit.update(effectiveDeltaTime);
    }

    // Update camera following behavior if enabled
    if (typeof simulationControls !== 'undefined' && simulationControls) {
      simulationControls.updateCameraFollow(deltaTime);
    }

    // Update visual effects (trail, labels, info panel)
    if (typeof visualEffects !== 'undefined' && visualEffects) {
      visualEffects.update(galacticOrbit);
    }

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  // Start loop
  animate();

  // Earth now orbits the Sun, creating a tilted helical path as the Sun moves through the galaxy.
  return { scene, camera, renderer, sun, planets, controls, animate, galacticOrbit, planetOrbits, galacticPlaneGrid, axesHelper, simulationControls, visualEffects, labelRenderer };
}

function createGlowTexture(colorStops) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  colorStops.forEach((color, index) => {
    gradient.addColorStop(index / (colorStops.length - 1), color);
  });
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}
