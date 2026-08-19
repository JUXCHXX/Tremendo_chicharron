import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface PedidoItemDb {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  nombre_producto: string;
  cantidad: number;
  variante_personas: number | null;
  combo: boolean;
  notas: string;
  precio_unitario: number;
}

/** Item con la forma que esperan las funciones de documentos.ts (nombre, no nombre_producto). */
export interface PedidoItemNormalizado {
  key: string;
  producto_id: string | null;
  nombre: string;
  cantidad: number;
  variante_personas: number | null;
  combo: boolean;
  notas: string;
  precio_unitario: number;
}

export interface PedidoDb {
  id: string;
  numero_comanda: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion_entrega: string;
  barrio: string | null;
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
  items?: PedidoItemNormalizado[];
}

export function usePedidosRealtime(opts?: { telefono?: string | null; staff?: boolean }) {
  const [pedidos, setPedidos] = useState<PedidoDb[]>([]);
  const [cargando, setCargando] = useState(true);

  /**
   * Actualización LOCAL optimista: mueve la tarjeta de columna al instante
   * sin esperar la respuesta del servidor. El UPDATE a Supabase se dispara
   * después; si falla, el error se muestra y la próxima recarga corrige.
   */
  const actualizarLocal = useCallback((id: string, cambios: Partial<PedidoDb>) => {
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  }, []);

  const cargar = useCallback(async () => {
    if (!supabase) {
      setCargando(false);
      return;
    }
    // SEGURIDAD: modo cliente (no staff) exige teléfono.
    // Sin teléfono, NO consultar nada — evita que la política pedidos_select_staff
    // (si el usuario tiene sesión de staff en el mismo navegador) devuelva TODOS
    // los pedidos (fuga de datos).
    if (!opts?.staff && !opts?.telefono) {
      setPedidos([]);
      setCargando(false);
      return;
    }
    let query = supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .order("creado_en", { ascending: false });
    if (opts?.telefono) {
      query = query
        .eq("cliente_telefono", opts.telefono)
        // Header requerido por la política RLS pedidos_select_anon
        .setHeader("x-cliente-telefono", opts.telefono);
    }
    const { data, error } = await query;
    if (!error && data) {
      const conItems = (data as (PedidoDb & { pedido_items: PedidoItemDb[] })[]).map((p) => ({
        ...p,
        items: (p.pedido_items ?? []).map((i) => ({
          key: i.id,
          producto_id: i.producto_id,
          nombre: i.nombre_producto,
          cantidad: i.cantidad,
          variante_personas: i.variante_personas,
          combo: i.combo,
          notas: i.notas,
          precio_unitario: i.precio_unitario,
        })),
      }));
      setPedidos(conItems);
    } else if (error) {
      console.error("Error cargando pedidos:", error);
    }
    setCargando(false);
  }, [opts?.telefono, opts?.staff]);

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
  }, [cargar]);

  return { pedidos, cargando, recargar: cargar, actualizarLocal };
}
