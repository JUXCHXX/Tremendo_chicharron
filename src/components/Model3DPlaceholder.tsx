import { createElement, useEffect, useState } from "react";
import { Box } from "lucide-react";

/**
 * Renderiza un modelo 3D .glb con <model-viewer> de @google/model-viewer.
 * El loader nativo de .glb no necesita librerías adicionales.
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