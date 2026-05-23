import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { REAL_GALACTIC_PERIOD_YEARS } from './galacticOrbit.js';

/**
 * VisualEffects
 * Manages trails, labels and starfield for multiple planets and the Sun.
 */
export class VisualEffects {
  /**
   * @param {Object} options
   * @param {THREE.Scene} options.scene
   * @param {THREE.Camera} options.camera
   * @param {THREE.Mesh[]} options.planets
   * @param {PlanetOrbit[]} options.planetOrbits
   * @param {THREE.Mesh} options.sun
   * @param {THREE.Object3D} options.sagittariusA
   * @param {SimulationControls} options.simulationControls
   */
  constructor({ scene, camera, planets, planetOrbits, sun, sagittariusA, simulationControls, earthIndex } = {}) {
    if (!scene) throw new Error('VisualEffects: scene is required');
    if (!camera) throw new Error('VisualEffects: camera is required');
    if (!Array.isArray(planets) || planets.length === 0) throw new Error('VisualEffects: planets array is required');
    if (!Array.isArray(planetOrbits) || planetOrbits.length !== planets.length) throw new Error('VisualEffects: planetOrbits must match planets length');
    if (!sun) throw new Error('VisualEffects: sun is required');

    this._scene = scene;
    this._camera = camera;
    this._planets = planets;
    this._planetOrbits = planetOrbits;
    this._sun = sun;
    this._sagittariusA = sagittariusA || null;
    this._simulationControls = simulationControls || null;
    this._earthIndex = (typeof earthIndex === 'number' && earthIndex >= 0 && earthIndex < this._planets.length) ? earthIndex : -1;

    // Per-planet trail data (time-stamped points)
    this._planetTrails = this._planets.map(() => ({
      maxPoints: 2000,
      timeWindowYears: 30e6,
      points: [], // { pos: Vector3, simYears }
      positions: new Float32Array(2000 * 3), // preallocated buffer
      line: null
    }));

    // Sun trail (kept separate)
    this._sunTrail = { maxPoints: 2000, timeWindowYears: 50e6, points: [], positions: new Float32Array(2000 * 3), line: null };

    // Cached world positions
    this._sunWorldPos = new THREE.Vector3();
    this._sgrAWorldPos = new THREE.Vector3();
    this._planetWorldPositions = this._planets.map(() => new THREE.Vector3());

    // Simulation-time accumulator to ensure monotonically increasing sim years
    this._simYearsAccumulator = 0;
    this._lastGalacticProgress = null;

    // Create sun trail, planet trails, labels and starfield
    this._createSunTrail();
    this._createPlanetTrails();
    this._createLabels();
    this._createStarfield();
    this._createMilkyWayBand();
  }

  _createSunTrail() {
    const t = this._sunTrail;
    const geom = new THREE.BufferGeometry();
    // use preallocated buffer assigned in constructor
    geom.setAttribute('position', new THREE.BufferAttribute(t.positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffdf8d, transparent: true, opacity: 0.92, linewidth: 3 });
    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    t.line = line;
    this._scene.add(line);
  }

  _createPlanetTrails() {
    for (let i = 0; i < this._planetTrails.length; i++) {
      const trail = this._planetTrails[i];
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(trail.positions, 3));
      const color = this._planetOrbits[i].color || 0x00ccff;
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.68, linewidth: 2 });
      const line = new THREE.Line(geom, mat);
      line.frustumCulled = false;
      line.visible = false;
      trail.line = line;
      this._scene.add(line);
    }
  }

  _createLabels() {
    const createLabel = (text, color = '#ffffff') => {
      const div = document.createElement('div');
      div.className = 'label';
      div.textContent = text;
      div.style.color = color;
      return new CSS2DObject(div);
    };

    // Sun label
    this._sunLabel = createLabel('☀ Sun', '#ffaa00');
    this._sunLabel.position.set(0, 8, 0);
    this._sun.add(this._sunLabel);

    // Planet labels
    this._planetLabels = [];
    for (let i = 0; i < this._planets.length; i++) {
      const planet = this._planets[i];
      const pdata = this._planetOrbits[i];
      const colorHex = `#${(pdata.color || 0xffffff).toString(16).padStart(6, '0')}`;
      const label = createLabel(`${pdata.emoji} ${pdata.name}`, colorHex);
      label.position.set(0, (pdata.radiusUnits || 1) + 2, 0);
      planet.add(label);
      this._planetLabels.push(label);
    }

    // Sagittarius A* label
    if (this._sagittariusA) {
      this._sgrALabel = createLabel('★ Sgr A*', '#aa00ff');
      this._sgrALabel.position.set(0, 4, 0);
      this._sagittariusA.add(this._sgrALabel);
    }
  }

  _createStarfield() {
    const starCount = 11000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const color = new THREE.Color();
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 3800 + Math.random() * 2200;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const palette = Math.random();
      if (palette < 0.55) color.setRGB(0.82, 0.9, 1);
      else if (palette < 0.82) color.setRGB(1, 0.92, 0.76);
      else color.setRGB(0.72, 0.82, 1);

      const brightness = 0.45 + Math.random() * 0.55;
      colors[i * 3] = color.r * brightness;
      colors[i * 3 + 1] = color.g * brightness;
      colors[i * 3 + 2] = color.b * brightness;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.86,
      vertexColors: true
    });
    this._starfield = new THREE.Points(geometry, material);
    this._scene.add(this._starfield);
  }

  _createMilkyWayBand() {
    const starCount = 5500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const color = new THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2500 + Math.random() * 2600;
      const height = (Math.random() - 0.5) * 280;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height + Math.sin(angle * 2.2) * 90;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      color.setRGB(0.42 + Math.random() * 0.28, 0.52 + Math.random() * 0.2, 0.78 + Math.random() * 0.18);
      const brightness = 0.2 + Math.random() * 0.45;
      colors[i * 3] = color.r * brightness;
      colors[i * 3 + 1] = color.g * brightness;
      colors[i * 3 + 2] = color.b * brightness;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 3.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.36,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this._milkyWayBand = new THREE.Points(geometry, material);
    this._milkyWayBand.rotation.z = THREE.MathUtils.degToRad(-16);
    this._scene.add(this._milkyWayBand);
  }

  // Public API to toggle labels visibility
  setLabelsVisible(visible) {
    const v = Boolean(visible);
    if (this._sunLabel) this._sunLabel.visible = v;
    if (this._planetLabels && Array.isArray(this._planetLabels)) {
      for (const lbl of this._planetLabels) {
        if (lbl) lbl.visible = v;
      }
    }
    if (this._sgrALabel) this._sgrALabel.visible = v;
  }

  // Public API to toggle planet trails visibility
  setPlanetTrailsVisible(visible) {
    const v = Boolean(visible);
    if (this._planetTrails && Array.isArray(this._planetTrails)) {
      for (const t of this._planetTrails) {
        if (t && t.line) t.line.visible = v;
      }
    }
  }

  // Public API to toggle sun trail visibility
  setSunTrailVisible(visible) {
    const v = Boolean(visible);
    if (this._sunTrail && this._sunTrail.line) this._sunTrail.line.visible = v;
  }

  _pruneAndBuildTrail(trail, currentSimYears) {
    // Prune by time window
    const pts = trail.points;
    const window = trail.timeWindowYears;
    // Find first index to keep
    let keepFrom = 0;
    while (keepFrom < pts.length && (currentSimYears - pts[keepFrom].simYears) > window) keepFrom++;
    if (keepFrom > 0) pts.splice(0, keepFrom);

    // Cap by maxPoints
    if (pts.length > trail.maxPoints) {
      pts.splice(0, pts.length - trail.maxPoints);
    }

    const count = pts.length;
    const positions = trail.positions; // reuse preallocated buffer
    // Fill only the used portion
    for (let i = 0; i < count; i++) {
      const p = pts[i].pos;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }

    const geom = trail.line.geometry;
    // Do not replace the attribute; reuse the preallocated array
    if (geom.attributes.position.array !== positions) {
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
    geom.setDrawRange(0, count);
    geom.attributes.position.needsUpdate = true;
  }

  _calculateDistances() {
    // Update sun and Sgr A world positions
    this._sun.getWorldPosition(this._sunWorldPos);
    if (this._sagittariusA) this._sagittariusA.getWorldPosition(this._sgrAWorldPos); else this._sgrAWorldPos.set(0,0,0);

    // Update all planet world positions
    for (let i = 0; i < this._planets.length; i++) {
      this._planets[i].getWorldPosition(this._planetWorldPositions[i]);
    }

    // Compute distances for Earth based on provided earthIndex
    let earthToSun = null;
    let earthToSgrA = null;
    if (this._earthIndex >= 0 && this._earthIndex < this._planetWorldPositions.length) {
      const earthWorld = this._planetWorldPositions[this._earthIndex];
      earthToSun = earthWorld.distanceTo(this._sunWorldPos);
      earthToSgrA = earthWorld.distanceTo(this._sgrAWorldPos);
    }

    const sunToSgrA = this._sunWorldPos.distanceTo(this._sgrAWorldPos);

    return { sunToSgrA, earthToSun, earthToSgrA };
  }

  _formatDistance(units, scale) {
    if (scale === 'ly') {
      // 1 unit ≈ 65 light-years (project scaling)
      const ly = units * 65;
      return `${ly.toFixed(0)} ly`;
    } else if (scale === 'au') {
      return `${(units / 15).toFixed(2)} AU`;
    }
    return `${units.toFixed(2)}`;
  }

  updateInfoPanel(galacticOrbit) {
    const galacticProgress = galacticOrbit?.getOrbitalProgress?.() || 0;
    const elapsedMillionYears = (galacticProgress / 100) * (REAL_GALACTIC_PERIOD_YEARS / 1e6);

    const distances = this._calculateDistances();

    const simTimeEl = document.getElementById('sim-time');
    if (simTimeEl) simTimeEl.textContent = `${elapsedMillionYears.toFixed(2)} million years`;

    const miniTimeEl = document.getElementById('mini-time');
    if (miniTimeEl) miniTimeEl.textContent = `${elapsedMillionYears.toFixed(2)} Myr`;

    const distSunSgr = document.getElementById('dist-sun-sgr');
    if (distSunSgr) distSunSgr.textContent = this._formatDistance(distances.sunToSgrA, 'ly');

    const distEarthSun = document.getElementById('dist-earth-sun');
    if (distEarthSun) {
      distEarthSun.textContent = (distances.earthToSun != null) ? this._formatDistance(distances.earthToSun, 'au') : 'N/A';
    }

    const distEarthSgr = document.getElementById('dist-earth-sgr');
    if (distEarthSgr) {
      distEarthSgr.textContent = (distances.earthToSgrA != null) ? this._formatDistance(distances.earthToSgrA, 'ly') : 'N/A';
    }
  }

  update(galacticOrbit) {
    // Determine current simulation year from galactic progress and advance accumulator monotonically
    const galacticProgress = galacticOrbit?.getOrbitalProgress?.() || 0;
    if (this._lastGalacticProgress === null) {
      this._lastGalacticProgress = galacticProgress;
    }
    // forward delta percent (handles wrap-around and ensures positive forward progression)
    let forwardDeltaPercent = (galacticProgress - this._lastGalacticProgress + 100) % 100;
    // If there's no forward progress (same percent), delta is zero
    if (forwardDeltaPercent < 0) forwardDeltaPercent = 0;
    this._simYearsAccumulator += (forwardDeltaPercent / 100) * REAL_GALACTIC_PERIOD_YEARS;
    this._lastGalacticProgress = galacticProgress;
    const currentSimYears = this._simYearsAccumulator;

    // Update planet trails (timestamped)
    for (let i = 0; i < this._planets.length; i++) {
      const pos = this._planetWorldPositions[i];
      this._planets[i].getWorldPosition(pos);
      const trail = this._planetTrails[i];
      trail.points.push({ pos: pos.clone(), simYears: currentSimYears });
      this._pruneAndBuildTrail(trail, currentSimYears);
    }

    // Update sun trail
    this._sun.getWorldPosition(this._sunWorldPos);
    this._sunTrail.points.push({ pos: this._sunWorldPos.clone(), simYears: currentSimYears });
    this._pruneAndBuildTrail(this._sunTrail, currentSimYears);

    // Update info panel
    this.updateInfoPanel(galacticOrbit);
  }
}
