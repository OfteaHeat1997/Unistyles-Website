// Approximate polygons for Curaçao delivery zones.
// Coordinates are [lat, lng] pairs (Leaflet convention).
// These are visual approximations — fee determination is still done by
// the area dropdown in checkout, not by polygon hit-testing on the order side.
// The polygons are good enough for the "detect my zone" geolocation button.

export const CURACAO_ZONES = [
  {
    id: 1,
    slug: 'zone-1-centro',
    name: 'Zone 1 — Centro',
    color: '#27ae60',
    fee: 5,
    freeThreshold: 75,
    estimatedDays: '1-2 business days',
    // Willemstad metro: Otrobanda, Punda, Pietermaai, Scharloo, Saliña-west fringe
    polygon: [
      [12.135, -68.965],
      [12.135, -68.910],
      [12.115, -68.895],
      [12.085, -68.890],
      [12.080, -68.940],
      [12.100, -68.965]
    ]
  },
  {
    id: 2,
    slug: 'zone-2-east',
    name: 'Zone 2 — East',
    color: '#e67e22',
    fee: 10,
    freeThreshold: 100,
    estimatedDays: '1-2 business days',
    // East of Willemstad: Saliña, Mahaai, Cas Grandi, Jan Thiel, Blue Bay, Spanish Water
    polygon: [
      [12.135, -68.910],
      [12.140, -68.825],
      [12.080, -68.785],
      [12.045, -68.830],
      [12.080, -68.890],
      [12.115, -68.895]
    ]
  },
  {
    id: 3,
    slug: 'zone-3-west-north',
    name: 'Zone 3 — West & North',
    color: '#c0392b',
    fee: 25,
    freeThreshold: 150,
    estimatedDays: '2-3 business days',
    // Two halves: west island (Banda Abou) + far east tip (Banda Ariba/Oostpunt)
    // Leaflet supports MultiPolygon as an array of polygons
    multiPolygon: [
      // West & North-West: Westpunt, Lagun, Santa Cruz, Barber, Tera Kòrá, Groot Kwartier, Emmastad
      [
        [12.385, -69.165],
        [12.395, -68.985],
        [12.140, -68.965],
        [12.135, -68.965],
        [12.100, -68.965],
        [12.080, -68.985],
        [12.085, -69.080],
        [12.155, -69.170]
      ],
      // Far East: Banda Ariba, Fuik, Sint Joris, Oostpunt
      [
        [12.080, -68.785],
        [12.095, -68.745],
        [12.045, -68.745],
        [12.045, -68.830]
      ]
    ]
  }
];

// Map center & default bounds
export const CURACAO_CENTER = [12.17, -68.99];
export const CURACAO_BOUNDS = [
  [12.04, -69.18],  // SW
  [12.40, -68.73]   // NE
];

// Ray-casting point-in-polygon test. `polygon` is [[lat, lng], ...].
export function pointInPolygon(point, polygon) {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const intersect =
      (lngI > lng) !== (lngJ > lng) &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Returns the matching zone for a [lat, lng] point, or null.
export function findZoneByPoint(point) {
  for (const zone of CURACAO_ZONES) {
    if (zone.polygon && pointInPolygon(point, zone.polygon)) return zone;
    if (zone.multiPolygon) {
      for (const ring of zone.multiPolygon) {
        if (pointInPolygon(point, ring)) return zone;
      }
    }
  }
  return null;
}
