/**
 * EarthOrbit module
 * Manages Earth's orbital motion around the Sun, creating a helical path
 * as the Sun itself moves through its galactic orbit.
 *
 * The Earth orbits the Sun while the Sun orbits Sagittarius A*, resulting
 * in a helix-like trajectory through 3D space.
 *
 * Scaling notes (for documentation only):
 * - Semi-major axis = 15 units (representing 1 AU / ~150 million km)
 * - Eccentricity = 0 (circular by default; can be customized for elliptical orbits)
 * - Orbital period is derived from real period (365.25 days) using the same
 *   time-scaling factor as GalacticOrbit (1.875M:1 ratio)
 * - Real orbital period = 365.25 days
 * - Scaled orbital period ≈ 0.000195 seconds (too fast to visualize meaningfully)
 *
 * For visualization purposes, the default constructor uses a faster period
 * (see EARTH_PERIOD_SECONDS_VISUALIZATION below) to make the helix visible.
 * The derived time-scaled period is available as EARTH_PERIOD_SECONDS_SCALED
 * for reference and accurate astronomical simulations.
 */

import * as THREE from 'three';
import { applyEclipticTilt, ECLIPTIC_TILT_DEGREES } from './coordinateTransforms.js';

// Real-world orbital parameters
export const REAL_EARTH_PERIOD_DAYS = 365.25;
export const REAL_EARTH_ORBIT_AU = 1;

// Galactic time-scaling reference (from GalacticOrbit)
// Galactic period: 225 million years in 120 seconds = 1.875M:1 ratio
export const GALACTIC_TIME_SCALE_RATIO = 1.875e6;

// Earth's orbital parameters
export const EARTH_SEMI_MAJOR_AXIS = 15; // units (1 AU)
export const EARTH_ECCENTRICITY = 0; // circular by default

// Derived scaled Earth period using galactic time-scaling ratio
// 365.25 days / 1.875M = 0.0001947 seconds (too fast for visualization)
export const EARTH_PERIOD_SECONDS_SCALED = REAL_EARTH_PERIOD_DAYS * 86400 / GALACTIC_TIME_SCALE_RATIO; // ~0.000195s

// Visualization period (faster than realistic to make helix visible)
export const EARTH_PERIOD_SECONDS_VISUALIZATION = 2.5;

export class EarthOrbit {
  /**
   * @param {THREE.Mesh} earth - The Earth mesh to move
   * @param {THREE.Mesh} sun - The Sun mesh to orbit around
   * @param {Object} options - Configuration overrides
   *   @param {number} [semiMajorAxis=EARTH_SEMI_MAJOR_AXIS] - Semi-major axis (a)
   *   @param {number} [eccentricity=EARTH_ECCENTRICITY] - Eccentricity (e), 0=circular, 0<e<1=elliptical
   *   @param {number} [orbitalPeriod=EARTH_PERIOD_SECONDS_VISUALIZATION] - Period in seconds
   *   @param {number} [startAngle=0] - Initial true anomaly (radians)
   */
  constructor(earth, sun, options = {}) {
    if (!earth) throw new Error('EarthOrbit: earth mesh is required');
    if (!sun) throw new Error('EarthOrbit: sun mesh is required');

    this.earth = earth;
    this.sun = sun;

    const {
      semiMajorAxis = EARTH_SEMI_MAJOR_AXIS,
      eccentricity = EARTH_ECCENTRICITY,
      orbitalPeriod = EARTH_PERIOD_SECONDS_VISUALIZATION,
      startAngle = 0
    } = options;

    if (!isFinite(orbitalPeriod) || orbitalPeriod <= 0) {
      throw new Error(`EarthOrbit: orbitalPeriod must be positive and finite, got ${orbitalPeriod}`);
    }

    if (eccentricity < 0 || eccentricity >= 1) {
      throw new Error(`EarthOrbit: eccentricity must be in [0, 1), got ${eccentricity}`);
    }

    // Elliptical orbit parameters
    this.semiMajorAxis = semiMajorAxis;
    this.eccentricity = eccentricity;
    this.orbitalPeriod = orbitalPeriod;
    this.startAngle = startAngle;

    // Derived parameters
    this.semiMinorAxis = this.semiMajorAxis * Math.sqrt(1 - this.eccentricity * this.eccentricity);
    this.currentAngle = startAngle;
    this.angularVelocity = (2 * Math.PI) / this.orbitalPeriod; // radians per second

    // Reusable vector for world-space calculations
    this._sunWorldPos = new THREE.Vector3();

    // Set initial position
    this._updateEarthPosition();
  }

  /**
   * Calculate Earth's position using elliptical orbit and the Sun's world position.
   * The helix emerges from Earth's elliptical orbit around the moving Sun.
   * @private
   */
  _updateEarthPosition() {
    // Calculate orbital offset in XZ plane using ellipse equation
    // r(θ) = a(1 - e²) / (1 + e*cos(θ))  [true anomaly form]
    const cosTheta = Math.cos(this.currentAngle);
    const sinTheta = Math.sin(this.currentAngle);

    // Calculate orbital offset in XZ plane using ellipse parameterization
    let offsetX = this.semiMajorAxis * cosTheta;
    let offsetZ = this.semiMinorAxis * sinTheta;
    let offsetY = 0;

    // Create offset vector and apply 60-degree ecliptic tilt around the X-axis
    const offset = new THREE.Vector3(offsetX, offsetY, offsetZ);
    const tiltedOffset = applyEclipticTilt(offset, ECLIPTIC_TILT_DEGREES);

    // Get Sun's world position using getWorldPosition() for scene graph robustness
    this.sun.getWorldPosition(this._sunWorldPos);

    // Update Earth's world position: sunPos + orbital offset
    this.earth.position.set(
      this._sunWorldPos.x + tiltedOffset.x,
      this._sunWorldPos.y + tiltedOffset.y,
      this._sunWorldPos.z + tiltedOffset.z
    );
  }

  /**
   * Update Earth's orbital position. Call each frame with deltaTime (seconds).
   * @param {number} deltaTime - Seconds elapsed since last update
   */
  update(deltaTime) {
    if (!isFinite(deltaTime) || deltaTime <= 0) return;

    this.currentAngle = (this.currentAngle + this.angularVelocity * deltaTime) % (2 * Math.PI);
    this._updateEarthPosition();
  }

  /**
   * Return Earth's orbital progress as percentage [0,100)
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
    this._updateEarthPosition();
  }
}
