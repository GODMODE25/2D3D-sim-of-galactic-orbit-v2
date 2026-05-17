import * as THREE from 'three';
import { applyEclipticTilt, ECLIPTIC_TILT_DEGREES } from './coordinateTransforms.js';

export const SUN_DATA = {
  name: 'Sun',
  emoji: '☀',
  uuid: '', // to be populated
  description: 'The star at the center of the Solar System, a nearly perfect sphere of hot plasma, with internal convective motion that generates a magnetic field via a dynamo process.',
  mass: '1.989 × 10^30 kg',
  diameter: '1.3927 million km',
  surfaceTemperature: '5,778 K',
  orbitalPeriodYears: '230 million'
};

export const SGR_A_DATA = {
  name: 'Sagittarius A*',
  emoji: '★',
  uuid: '', // to be populated
  description: 'The supermassive black hole at the Galactic Center of the Milky Way. It is the object around which our entire galaxy, including our Sun, orbits.',
  mass: '4.31 million solar masses',
  diameter: '23.5 million km (event horizon)',
  surfaceTemperature: 'N/A'
};

// PLANET_DATA: semiMajorAxis in AU, eccentricity, orbital period in years
export const PLANET_DATA = [
  {
    name: 'Mercury',
    emoji: '☿',
    uuid: '', // to be populated
    semiMajorAxisAU: 0.387,
    eccentricity: 0.206,
    orbitalPeriodYears: 0.241,
    radiusUnits: 0.38,
    color: 0x8c7853,
    description: 'The smallest planet in the Solar System and nearest to the Sun, it circles the Sun faster than any other planet.',
    mass: '3.3011 × 10^23 kg',
    diameter: '4,879 km',
    surfaceTemperature: '440 K (day), 100 K (night)'
  },
  {
    name: 'Venus',
    emoji: '♀',
    uuid: '', // to be populated
    semiMajorAxisAU: 0.723,
    eccentricity: 0.007,
    orbitalPeriodYears: 0.615,
    radiusUnits: 0.95,
    color: 0xffc649,
    description: 'The second planet from the Sun, known for its thick, toxic atmosphere that traps heat in a runaway greenhouse effect.',
    mass: '4.8675 × 10^24 kg',
    diameter: '12,104 km',
    surfaceTemperature: '737 K'
  },
  {
    name: 'Earth',
    emoji: '♁',
    uuid: '', // to be populated
    semiMajorAxisAU: 1.000,
    eccentricity: 0.0167,
    orbitalPeriodYears: 1.000,
    radiusUnits: 1.00,
    color: 0x1e90ff,
    description: 'Our home planet, the only place we know of so far that’s inhabited by living things.',
    mass: '5.972 × 10^24 kg',
    diameter: '12,742 km',
    surfaceTemperature: '288 K (average)'
  },
  {
    name: 'Mars',
    emoji: '♂',
    uuid: '', // to be populated
    semiMajorAxisAU: 1.524,
    eccentricity: 0.093,
    orbitalPeriodYears: 1.881,
    radiusUnits: 0.53,
    color: 0xcd5c5c,
    description: 'The "Red Planet" is a cold, desert-like world with a very thin atmosphere. It has seasons, polar ice caps, volcanoes, canyons, and weather.',
    mass: '6.4171 × 10^23 kg',
    diameter: '6,779 km',
    surfaceTemperature: '210 K (average)'
  },
  {
    name: 'Jupiter',
    emoji: '♃',
    uuid: '', // to be populated
    semiMajorAxisAU: 5.203,
    eccentricity: 0.049,
    orbitalPeriodYears: 11.862,
    radiusUnits: 11.2,
    color: 0xdaa520,
    description: 'The largest planet in our solar system, a gas giant more than twice as massive as all the other planets combined.',
    mass: '1.898 × 10^27 kg',
    diameter: '139,820 km',
    surfaceTemperature: '165 K (cloud tops)'
  },
  {
    name: 'Saturn',
    emoji: '♄',
    uuid: '', // to be populated
    semiMajorAxisAU: 9.537,
    eccentricity: 0.057,
    orbitalPeriodYears: 29.457,
    radiusUnits: 9.45,
    color: 0xf4a460,
    description: 'The sixth planet from the Sun and the second-largest, best known for its spectacular ring system.',
    mass: '5.683 × 10^26 kg',
    diameter: '116,460 km',
    surfaceTemperature: '134 K (cloud tops)'
  },
  {
    name: 'Uranus',
    emoji: '♅',
    uuid: '', // to be populated
    semiMajorAxisAU: 19.191,
    eccentricity: 0.046,
    orbitalPeriodYears: 84.011,
    radiusUnits: 4.0,
    color: 0x4fd0e0,
    description: 'An ice giant with a unique feature: it rotates on its side. Its axis of rotation is tilted almost parallel to its orbital plane.',
    mass: '8.681 × 10^25 kg',
    diameter: '50,724 km',
    surfaceTemperature: '76 K (cloud tops)'
  },
  {
    name: 'Neptune',
    emoji: '♆',
    uuid: '', // to be populated
    semiMajorAxisAU: 30.069,
    eccentricity: 0.009,
    orbitalPeriodYears: 164.79,
    radiusUnits: 3.88,
    color: 0x4169e1,
    description: 'The most distant planet from the Sun, a dark, cold, and windy ice giant. It is the first planet located through mathematical prediction.',
    mass: '1.024 × 10^26 kg',
    diameter: '49,244 km',
    surfaceTemperature: '72 K (cloud tops)'
  }
];

/**
 * Visual period compression used for visualization so outer planets remain visible.
 * Formula: 1 + 3 * P^0.6 (seconds)
 */
export function calculateVisualPeriod(orbitalPeriodYears) {
  return 1 + 3 * Math.pow(orbitalPeriodYears, 0.6);
}

/**
 * PlanetOrbit
 * Generalized planet orbit class based on EarthOrbit implementation.
 * Accepts planet mesh, sun mesh, and a planet data object from PLANET_DATA.
 */
export class PlanetOrbit {
  /**
   * @param {THREE.Mesh} planetMesh
   * @param {THREE.Mesh} sunMesh
   * @param {Object} planetData - entry from PLANET_DATA
   * @param {Object} options
   */
  constructor(planetMesh, sunMesh, planetData = {}, options = {}) {
    if (!planetMesh) throw new Error('PlanetOrbit: planet mesh is required');
    if (!sunMesh) throw new Error('PlanetOrbit: sun mesh is required');
    if (!planetData || typeof planetData !== 'object') throw new Error('PlanetOrbit: planetData is required');

    this.planet = planetMesh;
    this.sun = sunMesh;

    const {
      semiMajorAxisAU = 1,
      eccentricity = 0,
      orbitalPeriodYears = 1,
      name = 'Planet',
      emoji = '',
      radiusUnits = 1,
      color = 0xffffff
    } = planetData;

    // Scale 1 AU -> 15 scene units
    this.semiMajorAxis = semiMajorAxisAU * 15;
    this.eccentricity = eccentricity;
    this.orbitalPeriod = calculateVisualPeriod(orbitalPeriodYears); // seconds for visualization
    this.name = name;
    this.emoji = emoji;
    this.radiusUnits = radiusUnits;
    this.color = color;

    if (!isFinite(this.orbitalPeriod) || this.orbitalPeriod <= 0) {
      throw new Error('PlanetOrbit: orbitalPeriod must be a positive finite number.');
    }
    if (this.eccentricity < 0 || this.eccentricity >= 1) {
      throw new Error('PlanetOrbit: eccentricity must be in [0,1).');
    }

    // Derived parameters
    this.semiMinorAxis = this.semiMajorAxis * Math.sqrt(1 - this.eccentricity * this.eccentricity);
    this._startAngle = (typeof options.startAngle === 'number') ? options.startAngle : 0;
    this.currentAngle = this._startAngle;
    this.angularVelocity = (2 * Math.PI) / this.orbitalPeriod;

    // Reusable vector
    this._sunWorldPos = new THREE.Vector3();
    // Cached offset and tilted vectors to avoid per-frame allocations
    this._offset = new THREE.Vector3();
    this._tilted = new THREE.Vector3();

    // Initialize position
    this._updatePlanetPosition();
  }

  _updatePlanetPosition() {
    const cosTheta = Math.cos(this.currentAngle);
    const sinTheta = Math.sin(this.currentAngle);

    let offsetX = this.semiMajorAxis * cosTheta;
    let offsetZ = this.semiMinorAxis * sinTheta;
    let offsetY = 0;

    // Reuse cached vectors
    this._offset.set(offsetX, offsetY, offsetZ);
    const tiltedResult = applyEclipticTilt(this._offset, ECLIPTIC_TILT_DEGREES);
    // copy into cached tilted vector (applyEclipticTilt returns a new Vector3)
    this._tilted.copy(tiltedResult);

    this.sun.getWorldPosition(this._sunWorldPos);

    this.planet.position.set(
      this._sunWorldPos.x + this._tilted.x,
      this._sunWorldPos.y + this._tilted.y,
      this._sunWorldPos.z + this._tilted.z
    );
  }

  update(deltaTime) {
    if (!isFinite(deltaTime) || deltaTime <= 0) return;
    this.currentAngle = (this.currentAngle + this.angularVelocity * deltaTime) % (2 * Math.PI);
    this._updatePlanetPosition();
  }

  getOrbitalProgress() {
    const progress = (this.currentAngle / (2 * Math.PI)) * 100;
    return (progress + 100) % 100;
  }

  reset() {
    this.currentAngle = this._startAngle;
    this._updatePlanetPosition();
  }
}

export default PlanetOrbit;
