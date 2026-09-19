import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface CategoriaDb {
  id: string;
  nombre: string;
  orden: number;
  plato_destacado_id: string | null;
  modelo_3d_url: string | null;
}

export interface ProductoDb {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string;
  precio: number | null;
  imagen_url: string | null;
  disponible: boolean;
  destacado_3d: boolean;
  modelo_3d_url: string | null;
  por_persona: boolean;
  combo_gratis: boolean;
  opciones_proteina: string[];
  max_opciones_proteina: number;
  eliminado: boolean;
  orden: number;
}

export interface VariantePrecioDb {
  id: string;
  producto_id: string;
  cantidad_personas: number;
  precio: number;
}

export interface PromocionDb {
  id: string;
  titulo: string;
  descripcion: string;
  imagen_url: string | null;
  tipo_vigencia: "fija" | "rotativa" | "por_fecha";
  fecha_inicio: string | null;
  fecha_fin: string | null;
  dia_semana: number | null;
  dias_semana: number[];
  activa: boolean;
}

const INGREDIENTES_CONFIGURABLES = [
  "chicharrón",
  "chorizo",
  "carne desmechada",
  "carne",
  "pollo",
  "huevo",
  "huevos",
  "aguacate",
  "guacamole",
  "plátano maduro",
  "arepa",
  "papa salada",
] as const;

export function opcionesDesdeDescripcion(descripcion: string): string[] {
  const texto = descripcion.toLocaleLowerCase("es");
  return INGREDIENTES_CONFIGURABLES.filter((ingrediente) => texto.includes(ingrediente)).map(
    (ingrediente) => ingrediente[0].toLocaleUpperCase("es") + ingrediente.slice(1),
  );
}

export function useMenuData() {
  const [categorias, setCategorias] = useState<CategoriaDb[]>([]);
  const [productos, setProductos] = useState<ProductoDb[]>([]);
  const [variantesPrecio, setVariantesPrecio] = useState<VariantePrecioDb[]>([]);
  const [promociones, setPromociones] = useState<PromocionDb[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    if (!supabase) {
      setError("Supabase no está configurado.");
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const [cats, prods, variantes, promos] = await Promise.all([
        supabase.from("categorias").select("*").order("orden"),
        supabase.from("productos").select("*").order("orden"),
        supabase.from("variantes_precio").select("*").order("cantidad_personas"),
        supabase.from("promociones").select("*").order("creado_en", { ascending: false }),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      if (variantes.error) throw variantes.error;
      if (promos.error) throw promos.error;

      setCategorias(cats.data as CategoriaDb[]);
      setProductos(
        (prods.data as ProductoDb[])
          .filter((producto) => !producto.eliminado)
          .map((producto) => ({
            ...producto,
            opciones_proteina:
              Array.isArray(producto.opciones_proteina) && producto.opciones_proteina.length > 0
                ? producto.opciones_proteina.filter(
                    (opcion): opcion is string => typeof opcion === "string",
                  )
                : opcionesDesdeDescripcion(producto.descripcion),
            max_opciones_proteina: Math.min(
              10,
              Math.max(1, Number(producto.max_opciones_proteina) || 1),
            ),
          })),
      );
      setVariantesPrecio(variantes.data as VariantePrecioDb[]);
      setPromociones(promos.data as PromocionDb[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el menú.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  return { categorias, productos, variantesPrecio, promociones, cargando, error, recargar: cargar };
}

/**
 * Determina si una promoción está vigente AHORA, en hora de Colombia.
 * - fija: siempre que esté activa.
 * - rotativa: si el día actual está en dias_semana (0 = domingo).
 * - por_fecha: si la fecha de hoy está entre fecha_inicio y fecha_fin.
 */
export function promocionVigente(p: PromocionDb, ahora = new Date()): boolean {
  if (!p.activa) return false;

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const get = (t: string) => partes.find((x) => x.type === t)?.value ?? "";

  if (p.tipo_vigencia === "rotativa") {
    const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const diaHoy = dias.indexOf(get("weekday")); // 0 = domingo
    const diasConfigurados =
      Array.isArray(p.dias_semana) && p.dias_semana.length
        ? p.dias_semana
        : p.dia_semana === null
          ? []
          : [p.dia_semana];
    return diasConfigurados.includes(diaHoy);
  }

  if (p.tipo_vigencia === "por_fecha") {
    if (!p.fecha_inicio || !p.fecha_fin) return false;
    const hoy = `${get("year")}-${get("month")}-${get("day")}`;
    return hoy >= p.fecha_inicio && hoy <= p.fecha_fin;
  }

  return true; // fija
}
