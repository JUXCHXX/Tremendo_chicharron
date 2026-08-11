import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  onUbicacion: (lat: number, lng: number, direccion: string) => void;
  onClose: () => void;
}

export function MapaUbicacion({ onUbicacion, onClose }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [direccion, setDireccion] = useState("");
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    // Limpiar instancia previa si existe
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const map = L.map("mapa-ubicacion").setView([5.0689, -75.5174], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;

    const icon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    const onMapClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      setBuscando(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`,
        );
        const data = await res.json();
        const dir = data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setDireccion(dir);
        onUbicacion(lat, lng, dir);
      } catch {
        const dir = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setDireccion(dir);
        onUbicacion(lat, lng, dir);
      } finally {
        setBuscando(false);
      }
    };

    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
      map.remove();
      mapRef.current = null;
    };
  }, [onUbicacion]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-primary/30 bg-popover p-4 shadow-glow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl text-primary">Selecciona tu ubicación</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div id="mapa-ubicacion" className="h-72 w-full rounded-2xl" />
        <div className="mt-3 rounded-xl border border-border bg-card p-3 text-sm">
          {buscando ? (
            <p className="text-muted-foreground">Buscando dirección…</p>
          ) : direccion ? (
            <p className="text-primary">{direccion}</p>
          ) : (
            <p className="text-muted-foreground">Toca el mapa para marcar tu ubicación.</p>
          )}
        </div>
        <button
          onClick={onClose}
          disabled={!direccion}
          className="mt-3 w-full rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow disabled:opacity-40"
        >
          Usar esta ubicación
        </button>
      </div>
    </div>
  );
}
