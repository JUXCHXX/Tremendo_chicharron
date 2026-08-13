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
  orden: number;
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
  activa: boolean;
}

export function useMenuData() {
  const [categorias, setCategorias] = useState<CategoriaDb[]>([]);
  const [productos, setProductos] = useState<ProductoDb[]>([]);
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
      const [cats, prods, promos] = await Promise.all([
        supabase.from("categorias").select("*").order("orden"),
        supabase.from("productos").select("*").order("orden"),
        supabase.from("promociones").select("*").order("creado_en", { ascending: false }),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      if (promos.error) throw promos.error;

      setCategorias(cats.data as CategoriaDb[]);
      setProductos(prods.data as ProductoDb[]);
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

  return { categorias, productos, promociones, cargando, error, recargar: cargar };
}

/**
 * Determina si una promoción está vigente AHORA, en hora de Colombia.
 * - fija: siempre que esté activa.
 * - rotativa: si el dia_semana coincide con el día actual (0 = domingo).
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
    return p.dia_semana === diaHoy;
  }

  if (p.tipo_vigencia === "por_fecha") {
    if (!p.fecha_inicio || !p.fecha_fin) return false;
    const hoy = `${get("year")}-${get("month")}-${get("day")}`;
    return hoy >= p.fecha_inicio && hoy <= p.fecha_fin;
  }

  return true; // fija
}
