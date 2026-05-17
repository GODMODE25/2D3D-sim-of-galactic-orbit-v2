/**
 * GalacticOrbit module
 * Manages the Sun's circular motion around Sagittarius A* (the galactic center).
 *
 * This module uses a simplified circular orbit model and time scaling so the
 * Sun completes one orbit in `orbitalPeriod` seconds (real-time seconds).
 *
 * Scaling notes (for documentation only):
 * - Default orbit radius = 400 units (scaled representation of ~26,000 ly)
 * - Default orbital period = 120 seconds (scaled representation of ~225 million years)
 */

import * as THREE from 'three';
import { SGR_A_DATA } from './planetOrbits.js';

export const GALACTIC_ORBIT_RADIUS = 400;
export const GALACTIC_PERIOD_SECONDS = 120;
export const REAL_GALACTIC_PERIOD_YEARS = 225_000_000;
export const REAL_GALACTIC_RADIUS_LY = 26_000;

export class GalacticOrbit {
  /**
   * @param {THREE.Mesh} sun - The Sun mesh to move along the orbit
   * @param {THREE.Scene} scene - The scene to add Sagittarius A* marker to
   * @param {Object} options - Configuration overrides
   */
  constructor(sun, scene, options = {}) {
    this.sun = sun;
    this.scene = scene;

    const {
      orbitRadius = GALACTIC_ORBIT_RADIUS,
      orbitalPeriod = GALACTIC_PERIOD_SECONDS,
      startAngle = 0
    } = options;

    this.orbitRadius = orbitRadius;
    this.orbitalPeriod = orbitalPeriod;

    // Validate orbitalPeriod
    if (!Number.isFinite(this.orbitalPeriod) || this.orbitalPeriod <= 0) {
      throw new Error('orbitalPeriod must be a positive finite number.');
    }

    this.startAngle = startAngle;

    this.currentAngle = startAngle;
    this.angularVelocity = (2 * Math.PI) / this.orbitalPeriod; // radians per second

    this.sagittariusA = null;

    this._createSagittariusA();

    // Initialize Sun position on the orbit
    this._updateSunPosition();
  }

  _createSagittariusA() {
    const group = new THREE.Group();

    // Black hole sphere (slightly larger)
    const blackHoleGeom = new THREE.SphereGeometry(5, 32, 32); // Increased size
    const blackHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackHoleMesh = new THREE.Mesh(blackHoleGeom, blackHoleMat);
    group.add(blackHoleMesh);

    // Accretion disk (larger and brighter)
    const diskGeom = new THREE.TorusGeometry(14, 5, 2, 100); // Doubled sizes

    // Procedural texture for the disk
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(128, 128, 20, 128, 128, 128);
    // Adjusted colors for brighter appearance
    gradient.addColorStop(0, 'rgba(255,200,100,1)'); // Brighter yellow
    gradient.addColorStop(0.3, 'rgba(255,150,50,1)'); // Brighter orange
    gradient.addColorStop(0.6, 'rgba(200,50,0,1)');  // Brighter red
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    // Use an emissive material for self-illumination
    const diskMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaMap: texture,
        side: THREE.DoubleSide, // Ensure both sides are visible
        blending: THREE.AdditiveBlending // Makes it glow
    });

    const diskMesh = new THREE.Mesh(diskGeom, diskMat);
    diskMesh.rotation.x = Math.PI / 2;
    group.add(diskMesh);
    
    group.position.set(0, 0, 0);
    this.scene.add(group);
    this.sagittariusA = group;
    SGR_A_DATA.uuid = group.uuid;
    this.sagittariusA.userData.info = SGR_A_DATA;

    // Point light for glow (increased intensity)
    const light = new THREE.PointLight(0xff88ff, 2.5, 3000); // Increased intensity and range
    light.position.set(0, 0, 0);
    this.scene.add(light);
  }

  _updateSunPosition() {
    const x = this.orbitRadius * Math.cos(this.currentAngle);
    const z = this.orbitRadius * Math.sin(this.currentAngle);
    const y = 0;
    if (this.sun) this.sun.position.set(x, y, z);
  }

  /**
   * Update orbital position. Call each frame with deltaTime (seconds).
   * @param {number} deltaTime - Seconds elapsed since last update
   */
  update(deltaTime) {
    if (!isFinite(deltaTime) || deltaTime <= 0) return;
    this.currentAngle = (this.currentAngle + this.angularVelocity * deltaTime) % (2 * Math.PI);
    this._updateSunPosition();
    
    // Rotate the black hole accretion disk
    if (this.sagittariusA) {
        this.sagittariusA.rotation.y += 0.005;
        this.sagittariusA.rotation.z += 0.001; // slight wobble
    }
  }

  /**
   * Return orbital progress as percentage [0,100)
   */
  getOrbitalProgress() {
    const progress = (this.currentAngle / (2 * Math.PI)) * 100;
    return (progress + 100) % 100; // normalize
  }

  /**
   * Reset the orbit to the starting angle
   */
  reset() {
    this.currentAngle = this.startAngle;
    this._updateSunPosition();
  }
}
