import * as THREE from 'three';

/**
 * Ecliptic tilt constants
 */
export const ECLIPTIC_TILT_DEGREES = 60;
export const ECLIPTIC_TILT_RADIANS = (ECLIPTIC_TILT_DEGREES * Math.PI) / 180;

/**
 * Rotate a vector around an arbitrary axis by angle (radians) and return a new Vector3.
 * This function does not mutate the input vector.
 * @param {THREE.Vector3} vector
 * @param {THREE.Vector3} axis - axis must be normalized
 * @param {number} angleRadians
 * @returns {THREE.Vector3}
 */
export function rotateVectorAroundAxis(vector, axis, angleRadians) {
  const m = new THREE.Matrix4();
  m.makeRotationAxis(axis.clone().normalize(), angleRadians);
  const v = vector.clone();
  v.applyMatrix4(m);
  return v;
}

/**
 * Convenience: rotate an offset vector around the X-axis by the specified tilt (degrees).
 * Returns a new Vector3 and does not mutate the input.
 * @param {THREE.Vector3} offsetVector
 * @param {number} tiltDegrees
 * @returns {THREE.Vector3}
 */
export function applyEclipticTilt(offsetVector, tiltDegrees = ECLIPTIC_TILT_DEGREES) {
  // Reuse precomputed radians when using the default tilt to avoid repeated work
  const angle = (tiltDegrees === ECLIPTIC_TILT_DEGREES) ? ECLIPTIC_TILT_RADIANS : (tiltDegrees * Math.PI) / 180;
  const xAxis = new THREE.Vector3(1, 0, 0);
  return rotateVectorAroundAxis(offsetVector, xAxis, angle);
}
