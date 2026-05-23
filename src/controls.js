import * as THREE from 'three';

const CAMERA_MODES = [
  'Galactic Overview',
  'Solar Chase',
  'Earth Helix',
  'Black Hole Approach',
  'Free Orbit'
];

/**
 * SimulationControls
 * Manages playback, app state, camera choreography, and visibility toggles.
 */
export default class SimulationControls {
  constructor({
    camera,
    controls,
    sun,
    planets,
    sagittariusA,
    galacticOrbit,
    planetOrbits,
    visualEffects,
    galacticPlaneGrid,
    axesHelper
  } = {}) {
    if (!camera) throw new Error('SimulationControls: camera is required');
    if (!controls) throw new Error('SimulationControls: controls (OrbitControls) is required');

    this._camera = camera;
    this._controls = controls;
    this._sun = sun || null;
    this._sagittariusA = sagittariusA || null;
    this._galacticOrbit = galacticOrbit || null;
    this._planetOrbits = Array.isArray(planetOrbits) ? planetOrbits : [];
    this._visualEffects = visualEffects || null;
    this._galacticPlaneGrid = galacticPlaneGrid || null;
    this._axesHelper = axesHelper || null;

    this._followableObjects = new Map();
    if (sun) this._followableObjects.set('Sun', sun);
    if (Array.isArray(planets)) {
      for (const planet of planets) {
        const name = planet?.userData?.info?.name;
        if (name) this._followableObjects.set(name, planet);
      }
    }
    if (sagittariusA) this._followableObjects.set('Sgr A*', sagittariusA);

    this._earth = this._followableObjects.get('Earth') || null;
    this._stateListeners = new Set();
    this._transition = null;
    this._transitionDuration = 1.4;
    this._tmpTarget = new THREE.Vector3();
    this._tmpOffset = new THREE.Vector3();

    this._state = {
      speed: 1,
      paused: true,
      activeCameraMode: 'Solar Chase',
      activeTarget: 'Sun',
      labelsVisible: false,
      planetTrailsVisible: false,
      sunTrailVisible: true,
      gridVisible: true,
      axesVisible: false,
      cinematicMode: false
    };

    this.updateVisibilities();
    this.setCameraMode('Solar Chase', { instant: true });
  }

  onStateChange(listener) {
    if (typeof listener !== 'function') return () => {};
    this._stateListeners.add(listener);
    listener(this.getState());
    return () => this._stateListeners.delete(listener);
  }

  _emitStateChange() {
    const snapshot = this.getState();
    for (const listener of this._stateListeners) listener(snapshot);
  }

  getState() {
    return { ...this._state };
  }

  getCameraModes() {
    return [...CAMERA_MODES];
  }

  getFollowTargets() {
    return ['None', ...this._followableObjects.keys()];
  }

  getEffectiveSpeed() {
    return this._state.paused ? 0 : this._state.speed;
  }

  setSpeed(value) {
    const speed = Number(value);
    if (!Number.isFinite(speed) || speed < 0) return;

    this._state.speed = Math.min(speed, 20);
    this._state.paused = this._state.speed === 0;
    this._emitStateChange();
  }

  setPaused(paused) {
    this._state.paused = Boolean(paused);
    this._emitStateChange();
  }

  togglePause() {
    this.setPaused(!this._state.paused);
  }

  isPaused() {
    return this._state.paused;
  }

  toggleCinematicMode() {
    this._state.cinematicMode = !this._state.cinematicMode;
    this._emitStateChange();
  }

  setCinematicMode(enabled) {
    this._state.cinematicMode = Boolean(enabled);
    this._emitStateChange();
  }

  setVisibilitySetting(name, value) {
    if (!(name in this._state)) return;
    this._state[name] = Boolean(value);
    this.updateVisibilities();
    this._emitStateChange();
  }

  toggleVisibilitySetting(name) {
    if (!(name in this._state)) return;
    this.setVisibilitySetting(name, !this._state[name]);
  }

  updateVisibilities() {
    if (this._visualEffects) {
      this._visualEffects.setLabelsVisible?.(this._state.labelsVisible);
      this._visualEffects.setPlanetTrailsVisible?.(this._state.planetTrailsVisible);
      this._visualEffects.setSunTrailVisible?.(this._state.sunTrailVisible);
    }
    if (this._galacticPlaneGrid) this._galacticPlaneGrid.visible = this._state.gridVisible;
    if (this._axesHelper) this._axesHelper.visible = this._state.axesVisible;
  }

  setCameraPreset(presetName) {
    const modeMap = new Map([
      ['Galactic View', 'Galactic Overview'],
      ['Sun', 'Solar Chase'],
      ['Earth', 'Earth Helix'],
      ['Sgr A*', 'Black Hole Approach']
    ]);

    if (modeMap.has(presetName)) {
      this.setCameraMode(modeMap.get(presetName));
      return;
    }

    this.setFollowTarget(presetName);
  }

  setCameraMode(modeName, options = {}) {
    if (!CAMERA_MODES.includes(modeName)) return;

    this._state.activeCameraMode = modeName;

    if (modeName === 'Free Orbit') {
      this._state.activeTarget = 'None';
      this._transition = null;
      this._controls.enabled = true;
      this._emitStateChange();
      return;
    }

    this._controls.enabled = true;
    const { position, target, targetName } = this._getCameraPose(modeName);
    this._state.activeTarget = targetName;
    this._startCameraTransition(position, target, Boolean(options.instant));
    this._emitStateChange();
  }

  setFollowTarget(targetName, options = {}) {
    if (targetName === 'None') {
      this._state.activeTarget = 'None';
      this._state.activeCameraMode = 'Free Orbit';
      this._transition = null;
      this._emitStateChange();
      return;
    }

    const object = this._followableObjects.get(targetName);
    if (!object) return;

    const target = this._getWorldPosition(object);
    const offset = this._getObjectOffset(targetName, object);
    const position = target.clone().add(offset);

    this._state.activeTarget = targetName;
    this._state.activeCameraMode = 'Free Orbit';
    this._startCameraTransition(position, target, Boolean(options.instant));
    this._emitStateChange();
  }

  _getCameraPose(modeName) {
    if (modeName === 'Solar Chase') {
      const target = this._getWorldPosition(this._sun);
      return {
        targetName: 'Sun',
        target,
        position: target.clone().add(new THREE.Vector3(-90, 56, 140))
      };
    }

    if (modeName === 'Earth Helix') {
      const earth = this._earth || this._sun;
      const target = this._getWorldPosition(earth);
      return {
        targetName: this._earth ? 'Earth' : 'Sun',
        target,
        position: target.clone().add(new THREE.Vector3(56, 36, 92))
      };
    }

    if (modeName === 'Black Hole Approach') {
      const target = this._getWorldPosition(this._sagittariusA);
      return {
        targetName: 'Sgr A*',
        target,
        position: target.clone().add(new THREE.Vector3(0, 88, 220))
      };
    }

    return {
      targetName: 'None',
      target: new THREE.Vector3(0, 0, 0),
      position: new THREE.Vector3(-460, 520, 900)
    };
  }

  _getObjectOffset(targetName, object) {
    if (targetName === 'Sgr A*') return new THREE.Vector3(0, 86, 220);
    if (targetName === 'Sun') return new THREE.Vector3(-90, 56, 140);
    if (targetName === 'Earth') return new THREE.Vector3(56, 36, 92);

    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).length();
    const distance = Math.max(size * 5, 42);
    return new THREE.Vector3(distance * 0.7, distance * 0.42, distance);
  }

  _getWorldPosition(object) {
    if (!object) return new THREE.Vector3(0, 0, 0);
    const position = new THREE.Vector3();
    object.getWorldPosition(position);
    return position;
  }

  _startCameraTransition(position, target, instant = false) {
    if (instant) {
      this._camera.position.copy(position);
      this._controls.target.copy(target);
      this._controls.update();
      this._transition = null;
      return;
    }

    this._transition = {
      elapsed: 0,
      fromPosition: this._camera.position.clone(),
      fromTarget: this._controls.target.clone(),
      toPosition: position.clone(),
      toTarget: target.clone()
    };
  }

  updateCameraFollow(deltaTime = 0) {
    if (!this._camera || !this._controls) return;

    if (this._state.activeTarget !== 'None') {
      const targetObject = this._followableObjects.get(this._state.activeTarget);
      if (targetObject) {
        const target = this._getWorldPosition(targetObject);
        const offset = this._getCameraOffsetForState(targetObject);
        this._tmpTarget.copy(target);
        this._tmpOffset.copy(offset);

        if (this._transition) {
          this._transition.toTarget.copy(target);
          this._transition.toPosition.copy(target).add(offset);
        } else {
          const delta = target.clone().sub(this._controls.target);
          this._camera.position.add(delta);
          this._controls.target.copy(target);
        }
      }
    }

    if (this._transition) {
      this._transition.elapsed += Math.max(deltaTime, 0.016);
      const t = Math.min(this._transition.elapsed / this._transitionDuration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      this._camera.position.lerpVectors(this._transition.fromPosition, this._transition.toPosition, eased);
      this._controls.target.lerpVectors(this._transition.fromTarget, this._transition.toTarget, eased);

      if (t >= 1) this._transition = null;
    }

    this._controls.update();
  }

  _getCameraOffsetForState(targetObject) {
    if (this._state.activeCameraMode === 'Solar Chase') return new THREE.Vector3(-90, 56, 140);
    if (this._state.activeCameraMode === 'Earth Helix') return new THREE.Vector3(56, 36, 92);
    if (this._state.activeCameraMode === 'Black Hole Approach') return new THREE.Vector3(0, 88, 220);
    return this._getObjectOffset(this._state.activeTarget, targetObject);
  }

  reset() {
    this._galacticOrbit?.reset();
    for (const orbit of this._planetOrbits) orbit?.reset();

    this._state.speed = 1;
    this._state.paused = false;
    this._state.labelsVisible = false;
    this._state.planetTrailsVisible = false;
    this._state.sunTrailVisible = true;
    this._state.gridVisible = true;
    this._state.axesVisible = false;
    this._state.cinematicMode = false;

    this.updateVisibilities();
    this.setCameraMode('Solar Chase', { instant: false });
    this._emitStateChange();
  }
}
