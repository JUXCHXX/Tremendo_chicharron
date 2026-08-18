import { supabase } from "./supabase";

export interface ValoracionDb {
  id: string;
  pedido_id: string;
  pedido_item_id: string | null;
  producto_id: string;
  cliente_nombre: string;
  cliente_telefono: string;
  calificacion: number;
  comentario: string | null;
  creado_en: string;
}

export interface ResumenValoracion {
  producto_id: string;
  cantidad: number;
  promedio: number;
}

/** Carga las valoraciones públicas de un plato (visibles para cualquiera). */
export async function cargarValoraciones(productoId: string): Promise<ValoracionDb[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("valoraciones")
    .select("*")
    .eq("producto_id", productoId)
    .order("creado_en", { ascending: false });
  if (error) {
    console.error("Error cargando valoraciones:", error);
    return [];
  }
  return (data ?? []) as ValoracionDb[];
}

/** Carga el resumen (promedio + cantidad) de valoraciones de todos los platos. */
export async function cargarResumenValoraciones(): Promise<Record<string, ResumenValoracion>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from("resumen_valoraciones").select("*");
  if (error) {
    console.error("Error cargando resumen de valoraciones:", error);
    return {};
  }
  const mapa: Record<string, ResumenValoracion> = {};
  for (const r of (data ?? []) as ResumenValoracion[]) {
    mapa[r.producto_id] = r;
  }
  return mapa;
}

/**
 * Crea una valoración vinculada a un pedido entregado.
 * La RLS valida que el pedido esté 'entregado', que el teléfono coincida,
 * que el producto esté en el pedido y que no exista ya una valoración.
 */
export async function crearValoracion(input: {
  pedido_id: string;
  producto_id: string;
  cliente_nombre: string;
  cliente_telefono: string;
  calificacion: number;
  comentario?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { error } = await supabase.from("valoraciones").insert({
    pedido_id: input.pedido_id,
    producto_id: input.producto_id,
    cliente_nombre: input.cliente_nombre,
    cliente_telefono: input.cliente_telefono,
    calificacion: input.calificacion,
    comentario: input.comentario?.trim() || null,
  });
  if (error) {
    console.error("Error creando valoración:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Genera un avatar automático a partir del nombre (iniciales + color determinístico). */
export function avatarDesdeNombre(nombre: string): { iniciales: string; color: string } {
  const limpio = nombre.trim();
  const partes = limpio.split(/\s+/).filter(Boolean);
  const iniciales =
    partes.length >= 2
      ? (partes[0]![0] ?? "") + (partes[partes.length - 1]![0] ?? "")
      : (partes[0]?.[0] ?? "?").toUpperCase();
  const inicialesFinal = iniciales.toUpperCase();

  // Paleta de colores de marca (dorados, brasa, carbón)
  const colores = [
    "oklch(0.82 0.155 85)", // dorado brasa
    "oklch(0.7 0.19 45)", // naranja brasa
    "oklch(0.6 0.12 140)", // verde
    "oklch(0.65 0.14 250)", // azul
    "oklch(0.75 0.1 20)", // rojo
    "oklch(0.55 0.15 300)", // morado
  ];

  // Hash determinístico del nombre para elegir color
  let hash = 0;
  for (let i = 0; i < limpio.length; i++) {
    hash = (hash * 31 + limpio.charCodeAt(i)) >>> 0;
  }
  const color = colores[hash % colores.length]!;

  return { iniciales: inicialesFinal, color };
}
