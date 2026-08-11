import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface PedidoDb {
  id: string;
  numero_comanda: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion_entrega: string;
  latitud: number | null;
  longitud: number | null;
  medio_pago: string;
  monto_efectivo_recibido: number | null;
  vuelto: number | null;
  valor_domicilio: number;
  subtotal: number;
  total: number;
  estado: string;
  version: number;
  creado_en: string;
  editable_hasta: string;
}

export function usePedidosRealtime(opts?: { telefono?: string | null }) {
  const [pedidos, setPedidos] = useState<PedidoDb[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    if (!supabase) {
      setCargando(false);
      return;
    }
    let query = supabase.from("pedidos").select("*").order("creado_en", { ascending: false });
    if (opts?.telefono) {
      query = query.eq("cliente_telefono", opts.telefono);
    }
    const { data, error } = await query;
    if (!error && data) setPedidos(data as PedidoDb[]);
    setCargando(false);
  };

  useEffect(() => {
    void cargar();

    if (!supabase) return;
    const sb = supabase;

    // Suscripción Realtime a la tabla pedidos
    const channel = sb
      .channel("pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        void cargar();
      })
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [opts?.telefono]);

  return { pedidos, cargando, recargar: cargar };
}
