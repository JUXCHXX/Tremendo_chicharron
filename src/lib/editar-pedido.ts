import { supabase } from "./supabase";
import type { PedidoItemNormalizado } from "./use-pedidos";
import type { EstadoPedido } from "./store";

/**
 * Estados en los que el pedido AÚN puede editarse (antes de pasar a cocina).
 */
const ESTADOS_EDITABLES: EstadoPedido[] = [
  "pendiente_confirmacion_cajera",
  "pendiente_pago",
  "pago_confirmado",
];

/**
 * ¿El pedido se puede editar? (según el estado actual).
 * La ventana de 10 minutos del cliente se valida aparte con `editable_hasta`.
 */
export function estadoEditable(estado: string | EstadoPedido): boolean {
  return ESTADOS_EDITABLES.includes(estado as EstadoPedido);
}

export interface EditarPedidoResult {
  ok: boolean;
  error?: string;
  subtotal?: number;
  valor_domicilio?: number;
  total?: number;
  version?: number;
}

/**
 * Guarda la edición de un pedido de forma atómica en la base de datos.
 * Usa la RPC `editar_pedido_con_items` (SECURITY DEFINER) que:
 *   - Valida permisos (staff autenticado, o cliente dueño del pedido dentro
 *     de la ventana editable_hasta).
 *   - Valida que el estado sea anterior a en_cocina.
 *   - Recalcula subtotal/total.
 *   - Archiva la versión anterior (trigger) y reemplaza los items.
 */
export async function guardarEdicionPedido(
  pedidoId: string,
  items: PedidoItemNormalizado[],
  valorDomicilio?: number,
  telefonoCliente?: string | null,
): Promise<EditarPedidoResult> {
  if (!supabase) {
    return { ok: false, error: "La edición en línea no está disponible en este momento." };
  }

  const itemsJson = items.map((i) => ({
    producto_id: i.producto_id,
    nombre: i.nombre,
    cantidad: i.cantidad,
    variante_personas: i.variante_personas,
    combo: i.combo,
    notas: i.notas,
    precio_unitario: i.precio_unitario,
  }));

  try {
    let query = supabase.rpc("editar_pedido_con_items", {
      p_pedido_id: pedidoId,
      p_items: JSON.stringify(itemsJson),
      p_valor_domicilio: valorDomicilio ?? null,
    });

    // El cliente anónimo necesita el header x-cliente-telefono para que la
    // RPC valide que es el dueño del pedido.
    if (telefonoCliente) {
      query = query.setHeader("x-cliente-telefono", telefonoCliente);
    }

    const { data, error } = await query;
    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    return {
      ok: true,
      subtotal: Number((data as Record<string, unknown>)?.["subtotal"] ?? 0),
      valor_domicilio: Number((data as Record<string, unknown>)?.["valor_domicilio"] ?? 0),
      total: Number((data as Record<string, unknown>)?.["total"] ?? 0),
      version: Number((data as Record<string, unknown>)?.["version"] ?? 0),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la edición del pedido.",
    };
  }
}

/**
 * Calcula el subtotal de una lista de items.
 */
export function calcularSubtotal(items: PedidoItemNormalizado[]): number {
  return items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);
}
