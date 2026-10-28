interface PropertyLocation {
  latitude?: unknown;
  longitude?: unknown;
  coordinates_available?: boolean;
}

/** Return recorded property coordinates, never a map viewport fallback. */
export function getPropertyCoordinates(property: PropertyLocation | null | undefined): { lat: number; lng: number } | null {
  if (!property || property.coordinates_available === false) return null;

  const { latitude, longitude } = property;
  if ((typeof latitude !== 'number' && typeof latitude !== 'string') ||
      (typeof longitude !== 'number' && typeof longitude !== 'string') ||
      String(latitude).trim() === '' || String(longitude).trim() === '') return null;

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;

  return { lat, lng };
}
