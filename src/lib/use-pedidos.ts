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
    let filas: (PedidoDb & { pedido_items: PedidoItemDb[] })[];
    if (opts?.telefono) {
      const { data, error } = await supabase.rpc("consultar_pedidos_por_telefono", {
        p_telefono: opts.telefono,
      });
      if (error) {
        console.error("Error cargando pedidos del cliente:", error);
        setCargando(false);
        return;
      }
      const entradas = (Array.isArray(data) ? data : []) as {
        pedido: PedidoDb;
        items: PedidoItemDb[];
      }[];
      filas = entradas.map((entrada) => ({
        ...entrada.pedido,
        pedido_items: entrada.items ?? [],
      }));
    } else {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*, pedido_items(*)")
        .order("creado_en", { ascending: false });
      if (error || !data) {
        console.error("Error cargando pedidos:", error);
        setCargando(false);
        return;
      }
      filas = data as (PedidoDb & { pedido_items: PedidoItemDb[] })[];
    }

    if (filas) {
      // La relación anidada normalmente trae los items, pero una consulta
      // explícita evita que el detalle quede vacío si PostgREST no expande la
      // relación en algún snapshot del Kanban.
      if (opts?.staff && filas.length > 0) {
        const ids = filas.map((p) => p.id);
        const { data: itemsStaff, error: itemsError } = await supabase
          .from("pedido_items")
          .select("*")
          .in("pedido_id", ids);
        if (!itemsError && itemsStaff) {
          const porPedido = new Map<string, PedidoItemDb[]>();
          for (const item of itemsStaff as PedidoItemDb[]) {
            const lista = porPedido.get(item.pedido_id) ?? [];
            lista.push(item);
            porPedido.set(item.pedido_id, lista);
          }
          filas = filas.map((p) => ({
            ...p,
            pedido_items: porPedido.get(p.id) ?? [],
          }));
        } else if (itemsError) {
          console.error("Error cargando items de pedidos para staff:", itemsError);
        }

        // Último respaldo de lectura: la RPC de cliente es SECURITY DEFINER
        // y devuelve pedido + items sin depender de la expansión relacional
        // ni de la política SELECT directa de pedido_items.
        const pedidosSinItems = filas.filter((p) => (p.pedido_items ?? []).length === 0);
        const telefonos = [...new Set(pedidosSinItems.map((p) => p.cliente_telefono))];
        if (telefonos.length > 0) {
          const respuestas = await Promise.all(
            telefonos.map((telefono) =>
              supabase.rpc("consultar_pedidos_por_telefono", { p_telefono: telefono }),
            ),
          );
          const itemsPorPedido = new Map<string, PedidoItemDb[]>();
          for (const respuesta of respuestas) {
            if (respuesta.error || !Array.isArray(respuesta.data)) continue;
            for (const entrada of respuesta.data as {
              pedido: PedidoDb;
              items: PedidoItemDb[];
            }[]) {
              if (entrada.items?.length) itemsPorPedido.set(entrada.pedido.id, entrada.items);
            }
          }
          filas = filas.map((p) => ({
            ...p,
            pedido_items: p.pedido_items?.length
              ? p.pedido_items
              : (itemsPorPedido.get(p.id) ?? []),
          }));
        }
      }

      const conItems = filas.map((p) => {
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
