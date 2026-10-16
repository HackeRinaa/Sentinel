import {
  findSituations,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  TYPE_LABELS,
  type Incident,
} from '@sentinel/shared';
import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { escapeHtml, formatMetric, formatPlace, formatRelativeTime } from '@/lib/format';
import { useFilterStore } from '@/stores/filter-store';
import { useThemeStore } from '@/stores/theme-store';
import { MapLegend } from './MapLegend';
import { markerIcon } from './marker-icon';

interface IncidentMapProps {
  incidents: Incident[];
  selected: Incident | null;
  onSelect: (id: string) => void;
  now: Date;
}

const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
const darkTiles = {
  base: `${esri}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
  labels: `${esri}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
};
const lightTiles = {
  base: `${esri}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
  labels: `${esri}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
};
const tileAttribution = '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ';

export function IncidentMap({ incidents, selected, onSelect, now }: IncidentMapProps) {
  const theme = useThemeStore((state) => state.theme);
  const tiles = theme === 'dark' ? darkTiles : lightTiles;

  return (
    <div className="relative z-0 h-full min-h-[420px] xl:min-h-0">
      <MapContainer
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        worldCopyJump
        className="h-full w-full"
        aria-label="Incident map"
      >
        <TileLayer
          key={`${theme}-base`}
          attribution={tileAttribution}
          url={tiles.base}
          maxZoom={16}
        />
        <TileLayer key={`${theme}-labels`} url={tiles.labels} maxZoom={16} />
        <ViewportSync />
        <SituationLinks incidents={incidents} />
        <IncidentLayers
          incidents={incidents}
          selectedId={selected?.id ?? null}
          onSelect={onSelect}
          now={now}
        />
        <FlyTo incident={selected} />
        <FitOnce incidents={incidents} />
      </MapContainer>
      <MapLegend />
    </div>
  );
}

function ViewportSync() {
  const map = useMap();
  const limitToMapView = useFilterStore((state) => state.limitToMapView);
  const setBbox = useFilterStore((state) => state.setBbox);

  useEffect(() => {
    if (!limitToMapView) {
      setBbox(null);
      return;
    }
    let timer: number | undefined;
    const emit = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const bounds = map.getBounds();
        setBbox({
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
        });
      }, 400);
    };
    emit();
    map.on('moveend', emit);
    return () => {
      map.off('moveend', emit);
      window.clearTimeout(timer);
    };
  }, [limitToMapView, map, setBbox]);

  return null;
}

function SituationLinks({ incidents }: { incidents: Incident[] }) {
  const map = useMap();
  const situations = useMemo(() => findSituations(incidents), [incidents]);

  useEffect(() => {
    const layer = L.layerGroup();
    const byId = new Map(incidents.map((incident) => [incident.id, incident]));
    for (const situation of situations) {
      const primary = byId.get(situation.primaryId);
      const secondary = byId.get(situation.secondaryId);
      if (!primary || !secondary) {
        continue;
      }
      const line = L.polyline(
        [
          [primary.latitude, primary.longitude],
          [secondary.latitude, secondary.longitude],
        ],
        {
          color: SEVERITY_COLORS[situation.severity],
          weight: 3,
          dashArray: '7 7',
          opacity: 0.95,
        },
      );
      line.bindPopup(
        `<div class="sentinel-popup"><strong>Compound situation</strong><div>${escapeHtml(situation.summary)}</div></div>`,
      );
      layer.addLayer(line);
    }
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [incidents, map, situations]);

  return null;
}

function IncidentLayers({
  incidents,
  selectedId,
  onSelect,
  now,
}: {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: Date;
}) {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 48,
      chunkedLoading: true,
      showCoverageOnHover: false,
    });
    for (const incident of incidents) {
      const marker = L.marker([incident.latitude, incident.longitude], {
        icon: markerIcon(incident.type, incident.severity, incident.id === selectedId),
        title: incident.title,
        keyboard: true,
      });
      marker.bindPopup(
        `<div class="sentinel-popup"><strong>${escapeHtml(incident.title)}</strong><div>${escapeHtml(TYPE_LABELS[incident.type])} · ${escapeHtml(SEVERITY_LABELS[incident.severity])}</div><div>${escapeHtml(formatMetric(incident))}</div><div>${escapeHtml(formatPlace(incident))}</div><div>${escapeHtml(formatRelativeTime(incident.occurredAt, now))}</div></div>`,
      );
      marker.on('click', () => onSelect(incident.id));
      cluster.addLayer(marker);
    }
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [incidents, map, now, onSelect, selectedId]);

  return null;
}

function FlyTo({ incident }: { incident: Incident | null }) {
  const map = useMap();
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!incident || incident.id === lastId.current) {
      return;
    }
    lastId.current = incident.id;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const zoom = Math.max(map.getZoom(), 5);
    if (reduced) {
      map.setView([incident.latitude, incident.longitude], zoom);
      return;
    }
    map.flyTo([incident.latitude, incident.longitude], zoom, { duration: 0.8 });
  }, [incident, map]);

  return null;
}

function FitOnce({ incidents }: { incidents: Incident[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || incidents.length === 0) {
      return;
    }
    const bounds = L.latLngBounds(
      incidents.map((incident) => [incident.latitude, incident.longitude]),
    );
    map.fitBounds(bounds.pad(0.2), { maxZoom: 3 });
    fitted.current = true;
  }, [incidents, map]);

  return null;
}
