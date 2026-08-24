"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { VisualPoint } from "@/lib/suta/visuals";

/**
 * Fond de carte : Azure Maps quand la ressource est configurée (relais
 * serveur /api/map/tile — la clé ne paraît jamais ici), sinon OpenStreetMap
 * comme avant. La réponse de /api/map/config est demandée UNE fois par
 * chargement de page, pas à chaque affichage de carte.
 */
let fondAzurePromise: Promise<boolean> | null = null;
function fondAzureDisponible(): Promise<boolean> {
  fondAzurePromise ??= fetch("/api/map/config")
    .then((r) => r.json())
    .then((config: { fondAzure?: boolean }) => config.fondAzure === true)
    .catch(() => false);
  return fondAzurePromise;
}

/**
 * Carte des lieux dont SUTA parle.
 *
 * Les marqueurs sont dessinés en CSS plutôt qu'avec l'icône par défaut de
 * Leaflet : celle-ci est une image dont le chemin est résolu au moment du
 * bundling et se retrouve cassée en production. Un marqueur dessiné évite ce
 * piège et suit la charte ANSUT.
 */
function brandMarker(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:block;width:14px;height:14px;border-radius:9999px;
      background:var(--ansut-orange,#E8791E);
      border:2px solid #fff;
      box-shadow:0 0 0 3px rgba(232,121,30,.35);
    "></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Cadre la vue sur l'ensemble des points, à chaque changement de réponse. */
function FitToPoints({ points }: { points: VisualPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11, { animate: true });
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])),
      { padding: [32, 32], animate: true },
    );
  }, [map, points]);

  return null;
}

export default function SutaMap({ points }: { points: VisualPoint[] }) {
  const [fondAzure, setFondAzure] = useState(false);
  useEffect(() => {
    let actif = true;
    void fondAzureDisponible().then((disponible) => { if (actif) setFondAzure(disponible); });
    return () => { actif = false; };
  }, []);

  const first = points[0];
  if (!first) return null;

  return (
    <MapContainer
      center={[first.lat, first.lng]}
      zoom={11}
      scrollWheelZoom={false}
      className="h-full w-full"
      // Sur un écran de salon, la carte se lit, elle ne se manipule pas.
      attributionControl
    >
      {fondAzure ? (
        <TileLayer key="azure" attribution="&copy; Microsoft, TomTom" url="/api/map/tile/{z}/{x}/{y}" />
      ) : (
        <TileLayer
          key="osm"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}
      {points.map((point) => (
        <Marker
          key={`${point.lat},${point.lng}`}
          position={[point.lat, point.lng]}
          icon={brandMarker()}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={points.length === 1}>
            {point.label}
          </Tooltip>
        </Marker>
      ))}
      <FitToPoints points={points} />
    </MapContainer>
  );
}
