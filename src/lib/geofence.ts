import type { Warehouse } from './db';

/**
 * Great-circle distance between two lat/lon points, in meters.
 * (Haversine formula)
 */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface GeofenceResult {
  isInside: boolean;
  nearestWarehouse: Warehouse | null;
  distanceMeters: number | null;
}

/**
 * Checks a coordinate against a list of warehouses and returns whether the
 * point falls inside ANY of their geofence radii, plus the nearest one for
 * display purposes (e.g. "you are 340m from Dallas Distribution Yard").
 */
export function checkGeofence(lat: number, lon: number, warehouses: Warehouse[]): GeofenceResult {
  let nearestWarehouse: Warehouse | null = null;
  let minDistance = Infinity;
  let isInside = false;

  for (const wh of warehouses) {
    const distance = getDistanceMeters(lat, lon, wh.latitude, wh.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearestWarehouse = wh;
    }
    if (distance <= wh.radius) {
      isInside = true;
    }
  }

  return {
    isInside,
    nearestWarehouse,
    distanceMeters: nearestWarehouse ? minDistance : null,
  };
}
