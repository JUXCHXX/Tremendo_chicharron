import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Estado global del restaurante, sincronizado con Supabase y Realtime. */
export function useNegocioAbierto() {
  // Si aún no se pudo consultar la configuración, fallar cerrado: la base de
  // datos sigue siendo la autoridad final y nunca debe aceptar ese pedido.
  const [negocioAbierto, setNegocioAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    if (!supabase) {
      setCargando(false);
      return;
    }
    const { data, error } = await supabase
      .from("configuracion")
      .select("negocio_abierto")
      .eq("id", true)
      .maybeSingle();
    if (!error && data) setNegocioAbierto(data.negocio_abierto);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
    if (!supabase) return;
    const canal = supabase
      .channel("configuracion-negocio")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "configuracion" }, () => {
        void recargar();
      })
      .subscribe();
    // Respaldo si Realtime no estuviera publicado aún en una instalación antigua.
    const intervalo = window.setInterval(() => void recargar(), 15_000);
    return () => {
      window.clearInterval(intervalo);
      void supabase.removeChannel(canal);
    };
  }, [recargar]);

  const actualizar = useCallback(async (abierto: boolean) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { data, error } = await supabase.rpc("actualizar_negocio_abierto", {
      p_abierto: abierto,
    });
    if (error) throw error;
    setNegocioAbierto(data === true);
  }, []);

  return { negocioAbierto, cargando, recargar, actualizar };
}
