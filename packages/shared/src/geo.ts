export function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLat = toRadians(from.latitude);
  const endLat = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundingBoxForRadius(
  latitude: number,
  longitude: number,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latitudeDelta = radiusKm / 111;
  const cosine = Math.cos((latitude * Math.PI) / 180);
  const longitudeDelta = radiusKm / (111 * Math.max(Math.abs(cosine), 0.01));
  return {
    minLat: Math.max(-90, latitude - latitudeDelta),
    maxLat: Math.min(90, latitude + latitudeDelta),
    minLng: Math.max(-180, longitude - longitudeDelta),
    maxLng: Math.min(180, longitude + longitudeDelta),
  };
}
