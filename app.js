import * as THREE from 'three';
import { initScene } from './src/scene.js';

let sceneData = null;

function getSceneData() {
  return sceneData;
}

function formatScenePosition(object) {
  const position = new THREE.Vector3();
  object.getWorldPosition(position);
  return `${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`;
}

function formatDistance(units, scale) {
  if (scale === 'au') return `${(units / 15).toFixed(2)} AU`;
  if (scale === 'ly') return `${(units * 65).toFixed(0)} ly`;
  return `${units.toFixed(1)} units`;
}

function clampInfoCard(card, x, y) {
  const margin = 16;
  const rect = card.getBoundingClientRect();
  const left = Math.min(Math.max(x + 18, margin), window.innerWidth - rect.width - margin);
  const top = Math.min(Math.max(y + 18, margin), window.innerHeight - rect.height - margin);
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function initInfoCards() {
  const infocard = document.getElementById('infocard');
  const infocardTitle = document.getElementById('infocard-title');
  const infocardDescription = document.getElementById('infocard-description');
  const infocardDetails = document.getElementById('infocard-details');
  const infocardClose = document.getElementById('infocard-close');

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredObject = null;
  let pinnedObject = null;

  function appendDetail(label, value) {
    if (!value) return;
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = `${label}:`;
    li.append(strong, ` ${value}`);
    infocardDetails.appendChild(li);
  }

  function showInfoCard(object, x, y) {
    const data = object?.userData?.info;
    if (!data) {
      hideInfoCard();
      return;
    }

    infocardTitle.textContent = `${data.emoji} ${data.name}`;
    infocardDescription.textContent = data.description;
    infocardDetails.textContent = '';

    appendDetail('Mass', data.mass);
    appendDetail('Diameter', data.diameter);
    appendDetail('Surface Temp.', data.surfaceTemperature);
    appendDetail('Orbital Period', data.orbitalPeriodYears ? `${data.orbitalPeriodYears} years` : undefined);
    appendDetail('Scene Position', formatScenePosition(object));

    if (sceneData?.sun && object !== sceneData.sun) {
      const source = new THREE.Vector3();
      const sun = new THREE.Vector3();
      object.getWorldPosition(source);
      sceneData.sun.getWorldPosition(sun);
      appendDetail('Distance from Sun', formatDistance(source.distanceTo(sun), 'au'));
    }

    if (sceneData?.galacticOrbit?.sagittariusA && object !== sceneData.galacticOrbit.sagittariusA) {
      const source = new THREE.Vector3();
      const sgr = new THREE.Vector3();
      object.getWorldPosition(source);
      sceneData.galacticOrbit.sagittariusA.getWorldPosition(sgr);
      appendDetail('Distance from Sgr A*', formatDistance(source.distanceTo(sgr), 'ly'));
    }

    infocard.classList.remove('hidden');
    clampInfoCard(infocard, x, y);
  }

  function hideInfoCard() {
    infocard.classList.add('hidden');
  }

  function getIntersectedObject(event) {
    if (event.target.closest('.hud, #info, #toggle-panel-btn, #minimal-telemetry, #infocard')) {
      return null;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, sceneData.camera);

    const interactiveObjects = [
      sceneData.sun,
      ...sceneData.planets,
      sceneData.galacticOrbit.sagittariusA
    ];

    const intersects = raycaster.intersectObjects(interactiveObjects, true);
    if (!intersects.length) return null;

    let object = intersects[0].object;
    while (object && !object.userData.info) object = object.parent;
    return object || null;
  }

  window.addEventListener('mousemove', (event) => {
    if (pinnedObject) return;
    const intersected = getIntersectedObject(event);

    if (intersected && intersected !== hoveredObject) {
      hoveredObject = intersected;
      showInfoCard(hoveredObject, event.clientX, event.clientY);
    } else if (intersected && hoveredObject) {
      clampInfoCard(infocard, event.clientX, event.clientY);
    } else if (!intersected && hoveredObject) {
      hoveredObject = null;
      hideInfoCard();
    }
  });

  window.addEventListener('click', (event) => {
    const intersected = getIntersectedObject(event);

    if (intersected) {
      if (pinnedObject === intersected) {
        pinnedObject = null;
        hideInfoCard();
        return;
      }
      pinnedObject = intersected;
      showInfoCard(pinnedObject, event.clientX, event.clientY);
      return;
    }

    pinnedObject = null;
    hideInfoCard();
  });

  infocardClose.addEventListener('click', (event) => {
    event.stopPropagation();
    pinnedObject = null;
    hideInfoCard();
  });
}

function initHud() {
  const controls = sceneData.simulationControls;
  const body = document.body;
  const hud = document.getElementById('hud');
  const togglePanelBtn = document.getElementById('toggle-panel-btn');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const cinematicBtn = document.getElementById('cinematic-btn');
  const speedSlider = document.getElementById('speed-slider');
  const speedReadout = document.getElementById('speed-readout');
  const cameraModeSelect = document.getElementById('camera-mode-select');
  const targetSelect = document.getElementById('target-select');
  const miniMode = document.getElementById('mini-mode');
  const hudDelayInput = document.getElementById('hud-delay-input');
  const cinematicDelayInput = document.getElementById('cinematic-delay-input');

  const toggles = {
    labelsVisible: document.getElementById('labels-toggle'),
    planetTrailsVisible: document.getElementById('planet-trails-toggle'),
    sunTrailVisible: document.getElementById('sun-trail-toggle'),
    gridVisible: document.getElementById('grid-toggle'),
    axesVisible: document.getElementById('axes-toggle')
  };

  for (const mode of controls.getCameraModes()) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode;
    cameraModeSelect.appendChild(option);
  }

  for (const target of controls.getFollowTargets()) {
    const option = document.createElement('option');
    option.value = target;
    option.textContent = target;
    targetSelect.appendChild(option);
  }

  togglePanelBtn.addEventListener('click', () => {
    if (controls.getState().cinematicMode) {
      controls.setCinematicMode(false);
      hud.classList.remove('hidden');
      return;
    }
    hud.classList.toggle('hidden');
  });

  playPauseBtn.addEventListener('click', () => controls.togglePause());
  resetBtn.addEventListener('click', () => controls.reset());
  cinematicBtn.addEventListener('click', () => controls.toggleCinematicMode());
  speedSlider.addEventListener('input', () => controls.setSpeed(speedSlider.value));
  cameraModeSelect.addEventListener('change', () => controls.setCameraMode(cameraModeSelect.value));
  targetSelect.addEventListener('change', () => controls.setFollowTarget(targetSelect.value));

  for (const [key, element] of Object.entries(toggles)) {
    element.addEventListener('change', () => controls.setVisibilitySetting(key, element.checked));
  }

  controls.onStateChange((state) => {
    playPauseBtn.textContent = state.paused ? 'Play' : 'Pause';
    speedSlider.value = String(state.speed);
    speedReadout.textContent = `${state.speed.toFixed(2)}x`;
    cameraModeSelect.value = state.activeCameraMode;
    targetSelect.value = state.activeTarget;
    miniMode.textContent = state.activeCameraMode;
    body.classList.toggle('cinematic-mode', state.cinematicMode);

    for (const [key, element] of Object.entries(toggles)) {
      element.checked = Boolean(state[key]);
    }
  });

  window.addEventListener('keydown', (event) => {
    const launchMarquee = document.getElementById('launch-marquee');
    if (launchMarquee && !launchMarquee.classList.contains('dismissed')) return;

    const tagName = event.target?.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') return;

    if (event.code === 'Space') {
      event.preventDefault();
      controls.togglePause();
    } else if (event.key.toLowerCase() === 'r') {
      controls.reset();
    } else if (event.key.toLowerCase() === 'h') {
      hud.classList.toggle('hidden');
    } else if (event.key.toLowerCase() === 'c' || event.key === 'Escape') {
      controls.toggleCinematicMode();
    } else if (event.key.toLowerCase() === 't') {
      controls.toggleVisibilitySetting('planetTrailsVisible');
    } else if (event.key.toLowerCase() === 'l') {
      controls.toggleVisibilitySetting('labelsVisible');
    } else if (/^[1-5]$/.test(event.key)) {
      const mode = controls.getCameraModes()[Number(event.key) - 1];
      if (mode) controls.setCameraMode(mode);
    }
  });

  initInactivityAutomation({
    controls,
    hud,
    hudDelayInput,
    cinematicDelayInput
  });
}

function initInactivityAutomation({ controls, hud, hudDelayInput, cinematicDelayInput }) {
  let hudTimer = null;
  let cinematicTimer = null;
  let autoCinematicActive = false;

  const getDelayMs = (input, fallbackSeconds) => {
    const seconds = Number(input?.value);
    if (!Number.isFinite(seconds) || seconds <= 0) return fallbackSeconds * 1000;
    return seconds * 1000;
  };

  const clearTimers = () => {
    if (hudTimer) clearTimeout(hudTimer);
    if (cinematicTimer) clearTimeout(cinematicTimer);
  };

  const scheduleTimers = () => {
    clearTimers();

    hudTimer = setTimeout(() => {
      hud.classList.add('hidden');
    }, getDelayMs(hudDelayInput, 7));

    cinematicTimer = setTimeout(() => {
      autoCinematicActive = true;
      controls.setCinematicMode(true);
    }, getDelayMs(cinematicDelayInput, 10));
  };

  const handleActivity = (event) => {
    hud.classList.remove('hidden');
    if (autoCinematicActive) {
      autoCinematicActive = false;
      controls.setCinematicMode(false);
    }
    scheduleTimers();
  };

  for (const eventName of ['mousemove', 'mousedown', 'wheel', 'touchstart', 'keydown']) {
    window.addEventListener(eventName, handleActivity, { passive: eventName !== 'keydown' });
  }

  hudDelayInput?.addEventListener('change', scheduleTimers);
  cinematicDelayInput?.addEventListener('change', scheduleTimers);
  scheduleTimers();
}

function initLaunchMarquee() {
  const controls = sceneData.simulationControls;
  const launchMarquee = document.getElementById('launch-marquee');
  const launchBtn = document.getElementById('launch-btn');
  const launchCinematicBtn = document.getElementById('launch-cinematic-btn');
  const hud = document.getElementById('hud');

  const start = ({ cinematic = false } = {}) => {
    launchMarquee.classList.add('dismissed');
    hud.classList.toggle('hidden', cinematic);
    controls.setPaused(false);
    controls.setCameraMode('Solar Chase');
    controls.setCinematicMode(cinematic);
  };

  launchBtn.addEventListener('click', () => start());
  launchCinematicBtn.addEventListener('click', () => start({ cinematic: true }));

  window.addEventListener('keydown', (event) => {
    if (launchMarquee.classList.contains('dismissed')) return;
    if (event.key === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      start();
    }
  });
}

function init() {
  console.log('Three.js loaded successfully');
  console.log('Three.js version:', THREE.REVISION);

  sceneData = initScene();
  initInfoCards();
  initHud();
  initLaunchMarquee();

  const versionSpan = document.getElementById('threejs-version');
  if (versionSpan) versionSpan.textContent = THREE.REVISION;

  console.log('Scene initialized');
}

document.addEventListener('DOMContentLoaded', init);

export { init, getSceneData };
