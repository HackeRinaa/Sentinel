import { SEVERITY_COLORS, type IncidentType, type Severity } from '@sentinel/shared';
import L from 'leaflet';

const cache = new Map<string, L.DivIcon>();

const glyphs: Record<IncidentType, string> = {
  EARTHQUAKE: '◉',
  WILDFIRE: '▲',
  STORM: '✺',
  FLOOD: '≋',
  OTHER: '◆',
};

export function markerIcon(type: IncidentType, severity: Severity, selected: boolean): L.DivIcon {
  const key = `${type}:${severity}:${selected ? '1' : '0'}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const icon = L.divIcon({
    className: 'sentinel-marker',
    html: `<span class="sentinel-marker__dot${selected ? ' is-selected' : ''}" data-type="${type}" style="--marker:${SEVERITY_COLORS[severity]}"><span>${glyphs[type]}</span></span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
  cache.set(key, icon);
  return icon;
}
