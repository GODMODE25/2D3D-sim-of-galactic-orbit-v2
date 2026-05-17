import * as THREE from 'three';
import { GUI } from 'dat.gui';

/**
 * SimulationControls
 * Manages time scaling, playback, camera presets, and reset behavior.
 */
export default class SimulationControls {
  /**
   * @param {Object} options
   * @param {THREE.Camera} options.camera
   * @param {OrbitControls} options.controls
   * @param {THREE.Mesh} options.sun
   * @param {THREE.Mesh[]} options.planets
   * @param {THREE.Object3D} options.sagittariusA
   * @param {GalacticOrbit} options.galacticOrbit
   * @param {PlanetOrbit[]} options.planetOrbits
   */
  constructor({ camera, controls, sun, planets, sagittariusA, galacticOrbit, planetOrbits, visualEffects, galacticPlaneGrid, axesHelper } = {}) {
    if (!camera) throw new Error('SimulationControls: camera is required');
    if (!controls) throw new Error('SimulationControls: controls (OrbitControls) is required');

    this._camera = camera;
    this._controls = controls;
    this._sun = sun;
    this._sagittariusA = sagittariusA || null;
    this._galacticOrbit = galacticOrbit || null;
    this._planetOrbits = Array.isArray(planetOrbits) ? planetOrbits : [];
    this._visualEffects = visualEffects || null;
    this._galacticPlaneGrid = galacticPlaneGrid || null;
    this._axesHelper = axesHelper || null;
    
    this._followableObjects = new Map();
    if (sun) this._followableObjects.set('Sun', sun);
    if (planets && Array.isArray(planets)) {
        for (const planet of planets) {
            if (planet.userData.info && planet.userData.info.name) {
                this._followableObjects.set(planet.userData.info.name, planet);
            }
        }
    }
    if (sagittariusA) this._followableObjects.set('Sgr A*', sagittariusA);

    this._timeSpeed = 1.0; // multiplier
    this._isPaused = false;
    this._cameraPreset = 'Sun'; // Default preset
    
    // -- NEW: Proxy object for dat.gui --
    this._proxy = {
        timeSpeed: this._timeSpeed,
        follow: this._cameraPreset,
        togglePlayback: () => this.togglePause(),
        setSpeed_Pause: () => this.setSpeed(0),
        setSpeed_Normal: () => this.setSpeed(1),
        setSpeed_Fast: () => this.setSpeed(5),
        resetSimulation: () => this.reset()
    };

    // Initialize dat.GUI
    try {
      this.gui = new GUI();
      
      // -- Camera Folder --
      const cameraFolder = this.gui.addFolder('Camera');
      const followOptions = ['Galactic View', ...this._followableObjects.keys()];
      cameraFolder.add(this._proxy, 'follow', followOptions).name('Target').onChange((value) => {
          this.setCameraPreset(value);
      });
      cameraFolder.open();

      // -- Time Folder --
      const timeFolder = this.gui.addFolder('Time');
      this._timeSpeedController = timeFolder.add(this._proxy, 'timeSpeed', 0, 20, 0.25).name('Speed');
      this._timeSpeedController.onChange(val => this.setSpeed(val));
      timeFolder.add(this._proxy, 'setSpeed_Pause').name('Pause (0x)');
      timeFolder.add(this._proxy, 'setSpeed_Normal').name('Normal (1x)');
      timeFolder.add(this._proxy, 'setSpeed_Fast').name('Fast (5x)');
      timeFolder.open();

      // -- Playback Folder --
      const playbackFolder = this.gui.addFolder('Playback');
      this._playPauseButton = playbackFolder.add(this._proxy, 'togglePlayback').name(this._isPaused ? '▶ Play' : '⏸ Pause');
      playbackFolder.add(this._proxy, 'resetSimulation').name('↻ Reset');
      playbackFolder.open();
      
      // -- Visibility Folder --
      const visFolder = this.gui.addFolder('Visibility');
      const settings = {
        showLabels: true,
        showTrails: false,
        showSunTrail: true,
        showGrid: true,
        showAxes: false
      };
      this._visibilitySettings = Object.assign({}, settings);
      // ... (rest of visibility controls are the same)
      visFolder.add(settings, 'showLabels').name('Show Labels').onChange((value) => {
        this._visibilitySettings.showLabels = Boolean(value);
        if (this._visualEffects && typeof this._visualEffects.setLabelsVisible === 'function') {
          this._visualEffects.setLabelsVisible(Boolean(value));
        }
      });
      visFolder.add(settings, 'showTrails').name('Show Planet Trails').onChange((value) => {
        this._visibilitySettings.showTrails = Boolean(value);
        if (this._visualEffects && typeof this._visualEffects.setPlanetTrailsVisible === 'function') {
          this._visualEffects.setPlanetTrailsVisible(Boolean(value));
        }
      });
      visFolder.add(settings, 'showSunTrail').name('Show Sun Trail').onChange((value) => {
        this._visibilitySettings.showSunTrail = Boolean(value);
        if (this._visualEffects && typeof this._visualEffects.setSunTrailVisible === 'function') {
          this._visualEffects.setSunTrailVisible(Boolean(value));
        }
      });
      visFolder.add(settings, 'showGrid').name('Show Grid').onChange((value) => {
        this._visibilitySettings.showGrid = Boolean(value);
        if (this._galacticPlaneGrid) this._galacticPlaneGrid.visible = Boolean(value);
      });
      visFolder.add(settings, 'showAxes').name('Show Axes').onChange((value) => {
        this._visibilitySettings.showAxes = Boolean(value);
        if (this._axesHelper) this._axesHelper.visible = Boolean(value);
      });
      visFolder.open();
      // visFolder is closed by default now

      // -- Panel Folder --
      const panelFolder = this.gui.addFolder('Panel');
      const panelSettings = {
        autohide: true,
        autohideDelay: 5
      };
      this._panelSettings = Object.assign({}, panelSettings);

      panelFolder.add(panelSettings, 'autohide').name('Autohide').onChange((value) => {
        this._panelSettings.autohide = Boolean(value);
      });
      panelFolder.add(panelSettings, 'autohideDelay', 1, 30, 1).name('Delay (s)').onChange((value) => {
        this._panelSettings.autohideDelay = Number(value);
      });
      panelFolder.open();

    } catch (e) {
      console.error("Failed to initialize dat.GUI", e);
      this._visibilitySettings = { showLabels: true, showTrails: false, showSunTrail: true, showGrid: true, showAxes: false };
      this._panelSettings = { autohide: true, autohideDelay: 5 };
    }
  }

  // --- GUI VISIBILITY & AUTOHIDE ---
  toggleGuiVisibility() {
      if (this.gui) this.gui.closed = !this.gui.closed;
  }
  
  hideGui() {
      if (this.gui) this.gui.closed = true;
  }

  isGuiHidden() {
      return this.gui ? this.gui.closed : true;
  }

  isPanelAutohide() {
    return this._panelSettings.autohide;
  }

  getPanelAutohideDelay() {
    return this._panelSettings.autohideDelay * 1000; // convert to ms
  }

  // ... (rest of methods)
  updateVisibilities() {
    const s = this._visibilitySettings;
    if (!s) return;
    if (this._visualEffects) {
      if (typeof this._visualEffects.setLabelsVisible === 'function') this._visualEffects.setLabelsVisible(Boolean(s.showLabels));
      if (typeof this._visualEffects.setPlanetTrailsVisible === 'function') this._visualEffects.setPlanetTrailsVisible(Boolean(s.showTrails));
      if (typeof this._visualEffects.setSunTrailVisible === 'function') this._visualEffects.setSunTrailVisible(Boolean(s.showSunTrail));
    }
    if (this._galacticPlaneGrid) this._galacticPlaneGrid.visible = Boolean(s.showGrid);
    if (this._axesHelper) this._axesHelper.visible = Boolean(s.showAxes);
  }

  getEffectiveSpeed() {
    return this._isPaused ? 0 : this._timeSpeed;
  }

  setSpeed(value) {
    const num = Number(value);
    if (!isFinite(num) || num < 0) return;
    
    this._timeSpeed = num;
    this._proxy.timeSpeed = num;
    if (this._timeSpeedController) this._timeSpeedController.updateDisplay();

    if (num > 0 && this.isPaused()) {
        this.setPaused(false);
    } else if (num === 0 && !this.isPaused()) {
        this.setPaused(true);
    }
  }

  setPaused(paused) {
    this._isPaused = Boolean(paused);
    if (this._playPauseButton) {
        this._playPauseButton.name(this._isPaused ? '▶ Play' : '⏸ Pause');
    }
  }

  togglePause() {
    this.setPaused(!this._isPaused);
  }

  isPaused() {
    return this._isPaused;
  }

  setCameraPreset(presetName) {
    this._cameraPreset = presetName;
    this._proxy.follow = presetName;
    // Need to find the controller and update it if it exists
    // This is complex, will skip for now, the internal state is correct.

    if (!this._camera || !this._controls) return;
    
    const targetObject = this._followableObjects.get(presetName);

    if (targetObject) {
        const target = new THREE.Vector3();
        targetObject.getWorldPosition(target);
        const size = new THREE.Box3().setFromObject(targetObject).getSize(new THREE.Vector3()).length();
        const offset = Math.max(size * 5, 30);
        const desiredPos = target.clone().add(new THREE.Vector3(0, offset / 2, offset));
        this._camera.position.copy(desiredPos);
        this._controls.target.copy(target);
        this._controls.update();
    } else { // Galactic View
        const target = new THREE.Vector3(0, 0, 0);
        const desiredPos = new THREE.Vector3(0, 400, 800);
        this._camera.position.copy(desiredPos);
        this._controls.target.copy(target);
        this._controls.update();
    }
  }

  updateCameraFollow() {
    if (!this._camera || !this._controls) return;
    const targetObject = this._followableObjects.get(this._cameraPreset);
    if (targetObject) {
      const newTargetPos = new THREE.Vector3();
      targetObject.getWorldPosition(newTargetPos);
      const oldTargetPos = this._controls.target.clone();
      const delta = newTargetPos.clone().sub(oldTargetPos);
      this._camera.position.add(delta);
      this._controls.target.copy(newTargetPos);
    }
  }

  reset() {
    if (this._galacticOrbit) this._galacticOrbit.reset();
    if (this._planetOrbits) {
      for (const po of this._planetOrbits) {
        if (po) po.reset();
      }
    }
    this.setSpeed(1.0);
    this.setPaused(false);
    this.setCameraPreset('Galactic View');
  }
}