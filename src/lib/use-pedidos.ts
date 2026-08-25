import { useCallback, useEffect, useRef, useState } from "react";
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
  domiciliario_id: string | null;
  propina: number;
  asignado_en: string | null;
  en_camino_en: string | null;
  entregado_en: string | null;
  items?: PedidoItemNormalizado[];
}

export function usePedidosRealtime(opts?: { telefono?: string | null; staff?: boolean }) {
  const [pedidos, setPedidos] = useState<PedidoDb[]>([]);
  const [cargando, setCargando] = useState(true);
  const pedidosRef = useRef<PedidoDb[]>([]);

  // Overrides locales: pedidos cuyo estado la cajera cambió en esta sesión.
  // Se aplican SIEMPRE por encima de lo que devuelva el servidor, para que la
  // tarjeta NO "rebote" a la columna anterior si el UPDATE aún no se refleja
  // o si Realtime llega con un snapshot viejo. Se limpian tras una recarga
  // que confirme el nuevo estado en el servidor.
  const overridesRef = useRef(new Map<string, Partial<PedidoDb>>());

  /**
   * Actualización LOCAL optimista y DURADERA: mueve la tarjeta de columna al
   * instante y la mantiene ahí aunque el server/Realtime devuelva el estado
   * anterior. El UPDATE a Supabase se dispara después; una vez que el server
   * confirme el nuevo estado (recarga posterior), el override se libera.
   */
  const actualizarLocal = useCallback((id: string, cambios: Partial<PedidoDb>) => {
    const prev = overridesRef.current.get(id) ?? {};
    overridesRef.current.set(id, { ...prev, ...cambios });
    setPedidos((prevPedidos) => prevPedidos.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
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
      const conItems = (data as (PedidoDb & { pedido_items: PedidoItemDb[] })[]).map((p) => {
        const pedidoNormalizado = {
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
        };
        const override = overridesRef.current.get(p.id);
        if (override) {
          if (p.estado === override.estado) {
            overridesRef.current.delete(p.id);
          } else {
            return { ...pedidoNormalizado, ...override };
          }
        }
        return pedidoNormalizado;
      });
      pedidosRef.current = conItems;
      setPedidos(conItems);
    } else if (error) {
      console.error("Error cargando pedidos:", error);
    }
    setCargando(false);
  }, [opts?.telefono, opts?.staff]);

  useEffect(() => {
    void cargar();

    if (!supabase) return;
    // Estrategia única de seguimiento: polling por REST con el header
    // x-cliente-telefono. Realtime anónimo no puede satisfacer esa política.
    // Staff continúa consultando por polling para conservar el mismo modelo.
    const intervalo = setInterval(() => {
      const hayPedidosActivos = pedidosRef.current.some(
        (p) => p.estado !== "entregado" && p.estado !== "cancelado",
      );
      if (opts?.staff || !opts?.telefono || hayPedidosActivos || pedidosRef.current.length === 0) {
        void cargar();
      } else {
        clearInterval(intervalo);
      }
    }, 4_000);

    return () => {
      clearInterval(intervalo);
    };
  }, [cargar, opts?.staff, opts?.telefono]);

  return { pedidos, cargando, recargar: cargar, actualizarLocal };
}
