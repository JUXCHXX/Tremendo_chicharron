import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface TarifaDomicilio {
  ubicacion: string;
  tarifa: number;
}

/** Normaliza texto para búsqueda: minúsculas y sin tildes. */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Carga el catálogo de barrios y tarifas desde Supabase (una sola vez). */
export function useTarifasDomicilio() {
  const [tarifas, setTarifas] = useState<TarifaDomicilio[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      if (!supabase) {
        setCargando(false);
        return;
      }
      const { data, error } = await supabase
        .from("tarifas_domicilio")
        .select("ubicacion, tarifa")
        .order("ubicacion");
      if (!error && data && activo) {
        setTarifas(data as TarifaDomicilio[]);
      }
      if (activo) setCargando(false);
    }
    void cargar();
    return () => {
      activo = false;
    };
  }, []);

  return { tarifas, cargando };
}

/** Filtra barrios por texto (case-insensitive, sin tildes). */
export function buscarBarrios(
  tarifas: TarifaDomicilio[],
  texto: string,
  limite = 8,
): TarifaDomicilio[] {
  const q = normalizarTexto(texto);
  if (!q) return tarifas.slice(0, limite);
  return tarifas.filter((t) => normalizarTexto(t.ubicacion).includes(q)).slice(0, limite);
}
