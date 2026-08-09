import { Box } from "lucide-react";

/**
 * Placeholder de animación 3D. Cuando reemplaces los .fbx por .glb reales,
 * cambia este componente por <model-viewer src={src} ... /> de @google/model-viewer.
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
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-primary/25 bg-card/60 shadow-card ${
        size === "sm" ? "h-40" : "h-60"
      }`}
    >
      <div className="absolute inset-0 bg-brasa opacity-[0.06]" />
      <Box className="animate-float size-14 text-primary" strokeWidth={1.2} />
      <p className="font-display mt-3 text-xl text-primary">{label}</p>
      <p className="mt-1 px-4 text-center text-[11px] tracking-wide text-muted-foreground">
        Vista 3D · {src.replace("/", "")}
      </p>
    </div>
  );
}