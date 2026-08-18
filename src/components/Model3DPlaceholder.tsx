import { createElement, useEffect, useState } from "react";
import { Box } from "lucide-react";

/**
 * Ruta del decoder meshopt (script clásico que define `self.MeshoptDecoder`).
 * Los .glb de las categorías destacadas usan EXT_meshopt_compression en
 * extensionsRequired, así que sin este decoder no pueden descomprimir los
 * buffers y el modelo nunca se renderiza.
 *
 * El archivo se sirve desde /public/meshopt_decoder.js (copia del
 * meshopt_decoder.cjs de meshoptimizer, que en navegador cae en la rama
 * `(self).MeshoptDecoder = ...`).
 */
const MESHOPT_DECODER_URL = "/meshopt_decoder.js";

// Flag a nivel de módulo: el registro del decoder debe ocurrir UNA SOLA VEZ
// (no en cada render del componente) y SIEMPRE antes de que el navegador
// intente cargar cualquier .glb comprimido.
let meshoptRegistrado = false;

/**
 * Registra la ubicación del MeshoptDecoder en la clase del custom element
 * `model-viewer`. En @google/model-viewer 4.x la propiedad estática se llama
 * `meshoptDecoderLocation` (ver features/loading.d.ts) y model-viewer hace
 * fetchScript(url) + espera que el script exponga `self.MeshoptDecoder`.
 */
function registrarMeshoptDecoderSiNecesario() {
  if (meshoptRegistrado) return;
  if (typeof window === "undefined") return;

  const ModelViewerElement = window.customElements?.get("model-viewer") as
    (typeof HTMLElement & { meshoptDecoderLocation?: string }) | undefined;

  if (ModelViewerElement) {
    // Asignar ANTES de que el primer <model-viewer> tenga `src` asignado.
    ModelViewerElement.meshoptDecoderLocation = MESHOPT_DECODER_URL;
    meshoptRegistrado = true;
  }
}

/**
 * Renderiza un modelo 3D .glb con <model-viewer> de @google/model-viewer.
 * Si el src no es .glb (ej. .fbx legacy), muestra un placeholder visual.
 */
export function Model3DPlaceholder({
  src,
  label,
  size = "md",
}: {
  src: string;
  label: string;
  size?: "sm" | "md";
}) {
  const [modelViewerListo, setModelViewerListo] = useState(false);

  // Importar @google/model-viewer solo en el cliente (usa customElements, no existe en SSR)
  useEffect(() => {
    let activo = true;
    import("@google/model-viewer")
      .then(() => {
        // Una vez que la librería está cargada, el custom element "model-viewer"
        // ya está definido. Registrar el decoder AQUÍ garantiza que ocurra
        // antes de que cualquier <model-viewer> con src se monte (el estado
        // modelViewerListo se actualiza después de este punto).
        registrarMeshoptDecoderSiNecesario();
        if (activo) setModelViewerListo(true);
      })
      .catch((e) => {
        console.error("Error cargando @google/model-viewer:", e);
      });
    return () => {
      activo = false;
    };
  }, []);

  const esGlb = src.toLowerCase().endsWith(".glb");

  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-primary/25 bg-card/60 shadow-card ${
        size === "sm" ? "h-40" : "h-60"
      }`}
    >
      <div className="absolute inset-0 bg-brasa opacity-[0.06]" />
      {esGlb && modelViewerListo ? (
        createElement("model-viewer", {
          src,
          alt: label,
          "camera-controls": true,
          "auto-rotate": true,
          "rotation-per-second": "12deg",
          "shadow-intensity": "1",
          exposure: "1",
          "environment-image": "neutral",
          "interaction-prompt": "none",
          "disable-tap": true,
          ar: true,
          "ar-modes": "webxr scene-viewer quick-look",
          loading: "eager",
          reveal: "auto",
          style: { width: "100%", height: "100%", position: "absolute", inset: 0 },
        } as Record<string, unknown>)
      ) : (
        <Box className="animate-float size-14 text-primary" strokeWidth={1.2} />
      )}
      <p className="font-display relative z-10 mt-auto mb-3 text-xl text-primary drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
        {label}
      </p>
    </div>
  );
}
