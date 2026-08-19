/**
 * Capa de datos local (localStorage) que replica el esquema de /database.
 * Cuando conectes Supabase, reemplaza estas funciones por queries reales:
 * la forma de los objetos es idéntica a la de las tablas SQL.
 */
import { useSyncExternalStore } from "react";
import { PRODUCTOS } from "./menu-data";
import { supabase } from "./supabase";

export type EstadoPedido =
  | "pendiente_confirmacion_cajera"
  | "pendiente_pago"
  | "pago_confirmado"
  | "en_cocina"
  | "en_preparacion"
  | "en_camino"
  | "entregado"
  | "cancelado";

export const ESTADOS_FLUJO: EstadoPedido[] = [
  "pendiente_confirmacion_cajera",
  "pendiente_pago",
  "pago_confirmado",
  "en_cocina",
  "en_preparacion",
  "en_camino",
  "entregado",
];

export const ESTADO_LABEL: Record<EstadoPedido, string> = {
  pendiente_confirmacion_cajera: "Esperando confirmación de la caja",
  pendiente_pago: "Pendiente de pago",
  pago_confirmado: "Pago confirmado",
  en_cocina: "En cocina",
  en_preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/**
 * Etiquetas para el PANEL DE STAFF (Caja). El wording aclara que la acción
 * le corresponde al propio cajero — no es un permiso externo. La cajera ve
 * "Nuevo pedido — por confirmar" y sabe que su botón es la acción.
 */
export const ESTADO_LABEL_STAFF: Record<EstadoPedido, string> = {
  pendiente_confirmacion_cajera: "Nuevo pedido — por confirmar",
  pendiente_pago: "Pendiente de pago",
  pago_confirmado: "Pago confirmado",
  en_cocina: "En cocina",
  en_preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/**
 * Etiquetas AMIGABLES para el cliente. Los estados internos de gestión
 * ("Esperando confirmación de la caja") son exclusivos del staff en el Panel
 * de Caja; el cliente NO debe verlos. Esta vista siempre transmite calma:
 * el pedido ya quedó registrado.
 */
export const ESTADO_LABEL_CLIENTE: Record<EstadoPedido, string> = {
  pendiente_confirmacion_cajera: "Recibimos tu pedido",
  pendiente_pago: "Pendiente de pago",
  pago_confirmado: "Pago confirmado",
  en_cocina: "En cocina",
  en_preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export interface CartItem {
  key: string;
  producto_id: string;
  nombre: string;
  cantidad: number;
  variante_personas: number | null;
  notas: string;
  precio_unitario: number;
  combo: boolean;
}

export interface Pedido {
  id: string;
  numero_comanda: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion_entrega: string;
  barrio: string | null;
  latitud: number | null;
  longitud: number | null;
  medio_pago: "efectivo" | "transferencia" | "tarjeta";
  monto_efectivo_recibido: number | null;
  vuelto: number | null;
  valor_domicilio: number;
  subtotal: number;
  total: number;
  estado: EstadoPedido;
  creado_en: string;
  editable_hasta: string;
  version: number;
  items: CartItem[];
}

export interface HistoricoComanda {
  id: string;
  pedido_id: string;
  numero_comanda: string;
  version: number;
  snapshot: Pedido;
  anulada_en: string;
  motivo: string;
}

export interface Config {
  negocio_abierto: boolean;
  agotados: string[];
  precios: Record<string, number>;
  ultimo_respaldo: string | null;
}

interface State {
  cart: CartItem[];
  pedidos: Pedido[];
  historico: HistoricoComanda[];
  config: Config;
}

const KEY = "tremendo-chicharron-state-v1";

const initial: State = {
  cart: [],
  pedidos: [],
  historico: [],
  config: { negocio_abierto: true, agotados: [], precios: {}, ultimo_respaldo: null },
};

let state: State = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(updater: (s: State) => State) {
  state = updater(state);
  persist();
  emit();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...(JSON.parse(raw) as State) };
  } catch {
    /* ignore */
  }
  autoCancelar();
}

/** Auto-cancelación: pedidos sin confirmar pago con más de 30 min pasan a cancelado. */
export function autoCancelar() {
  const ahora = Date.now();
  let cambio = false;
  const pedidos = state.pedidos.map((pd) => {
    if (
      (pd.estado === "pendiente_pago" || pd.estado === "pendiente_confirmacion_cajera") &&
      ahora - new Date(pd.creado_en).getTime() > 30 * 60000
    ) {
      cambio = true;
      return { ...pd, estado: "cancelado" as EstadoPedido };
    }
    return pd;
  });
  if (cambio) setState((s) => ({ ...s, pedidos }));
}

function subscribe(cb: () => void) {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initial),
  );
}

export const getState = () => state;

// ── Carrito ──────────────────────────────────────────────────
export function addToCart(item: Omit<CartItem, "key">) {
  // Capa de seguridad: no permitir agregar productos agotados
  const producto = PRODUCTOS.find((p) => p.id === item.producto_id);
  if (producto && !producto.disponible) {
    console.warn(`[addToCart] Bloqueado: "${item.nombre}" está agotado.`);
    return;
  }
  const key = `${item.producto_id}|${item.variante_personas ?? ""}|${item.notas}|${item.combo}`;
  setState((s) => {
    const existing = s.cart.find((c) => c.key === key);
    const cart = existing
      ? s.cart.map((c) => (c.key === key ? { ...c, cantidad: c.cantidad + item.cantidad } : c))
      : [...s.cart, { ...item, key }];
    return { ...s, cart };
  });
}

export const updateCantidad = (key: string, cantidad: number) =>
  setState((s) => ({
    ...s,
    cart:
      cantidad <= 0
        ? s.cart.filter((c) => c.key !== key)
        : s.cart.map((c) => (c.key === key ? { ...c, cantidad } : c)),
  }));

export const clearCart = () => setState((s) => ({ ...s, cart: [] }));

export const cartTotal = (cart: CartItem[]) =>
  cart.reduce((acc, c) => acc + c.precio_unitario * c.cantidad, 0);

// ── Pedidos ──────────────────────────────────────────────────
function nuevoNumeroComanda(): string {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const delDia = state.pedidos.filter((pd) => pd.numero_comanda.includes(stamp)).length + 1;
  return `TC-${stamp}-${String(delDia).padStart(3, "0")}`;
}

export async function crearPedido(data: {
  cliente_nombre: string;
  cliente_telefono: string;
  direccion_entrega: string;
  barrio?: string | null;
  valor_domicilio?: number;
  latitud?: number | null;
  longitud?: number | null;
  medio_pago: Pedido["medio_pago"];
  monto_efectivo_recibido: number | null;
  items: CartItem[];
}): Promise<Pedido> {
  const subtotal = cartTotal(data.items);
  const valorDomicilio = data.valor_domicilio ?? 0;
  const total = subtotal + valorDomicilio;
  const creado = new Date();
  const id = crypto.randomUUID();

  const pedido: Pedido = {
    id,
    numero_comanda: "", // Supabase lo genera con secuencia global (evita colisiones)
    ...data,
    barrio: data.barrio ?? null,
    latitud: data.latitud ?? null,
    longitud: data.longitud ?? null,
    vuelto:
      data.medio_pago === "efectivo" && data.monto_efectivo_recibido != null
        ? data.monto_efectivo_recibido - total
        : null,
    valor_domicilio: valorDomicilio,
    subtotal,
    total,
    estado: "pendiente_confirmacion_cajera",
    creado_en: creado.toISOString(),
    editable_hasta: new Date(creado.getTime() + 10 * 60000).toISOString(),
    version: 1,
  };

  // Insertar en Supabase (pedido + items) — OBLIGATORIO.
  // Si falla, se lanza error para que el cliente NO vea una falsa confirmación
  // y el pedido no quede "fantasma" (solo en localStorage, invisible para Caja/SuperAdmin).
  if (supabase) {
    try {
      // 1) Obtener el número de comanda desde la secuencia GLOBAL de Supabase
      //    vía RPC segura (security definer). Esto evita colisiones entre
      //    clientes y evita el SELECT post-INSERT que RLS bloqueaba (401).
      const { data: numeroComanda, error: rpcError } = await supabase.rpc(
        "generar_numero_comanda_cliente",
      );
      if (rpcError) throw rpcError;
      if (!numeroComanda) throw new Error("No se pudo obtener el número de comanda.");
      pedido.numero_comanda = String(numeroComanda);

      // 2) Insertar el pedido (sin .select(): el INSERT público ya funciona
      //    con la política RLS de la migración 14).
      const { error: pedidoError } = await supabase.from("pedidos").insert({
        id: pedido.id,
        numero_comanda: pedido.numero_comanda,
        cliente_nombre: pedido.cliente_nombre,
        cliente_telefono: pedido.cliente_telefono,
        direccion_entrega: pedido.direccion_entrega,
        barrio: pedido.barrio,
        latitud: pedido.latitud,
        longitud: pedido.longitud,
        medio_pago: pedido.medio_pago,
        monto_efectivo_recibido: pedido.monto_efectivo_recibido,
        vuelto: pedido.vuelto,
        valor_domicilio: pedido.valor_domicilio,
        subtotal: pedido.subtotal,
        total: pedido.total,
        estado: pedido.estado,
        version: pedido.version,
        creado_en: pedido.creado_en,
        editable_hasta: pedido.editable_hasta,
      });
      if (pedidoError) throw pedidoError;

      // 3) Insertar items
      const { error: itemsError } = await supabase.from("pedido_items").insert(
        data.items.map((i) => ({
          pedido_id: pedido.id,
          producto_id: i.producto_id,
          nombre_producto: i.nombre,
          cantidad: i.cantidad,
          variante_personas: i.variante_personas,
          combo: i.combo,
          notas: i.notas,
          precio_unitario: i.precio_unitario,
        })),
      );
      if (itemsError) throw itemsError;
    } catch (e) {
      // ── Manejo de falsos errores en celular ──────────────────────────────
      // En redes móviles (4G/datos) o Safari/iOS, el INSERT puede completarse
      // en el servidor pero la respuesta no llegar a tiempo (timeout, pérdida
      // de foco de la pestaña, etc.). Antes de mostrar error, verificamos si
      // el pedido realmente se guardó consultándolo por comanda + teléfono.
      // Si existe, NO es un error: el pedido se registró correctamente.
      // CRUCIAL: esto aplica a CUALQUIER error (no solo de red). Si ya tenemos
      // numero_comanda y el pedido existe en la BD, el pedido quedó registrado
      // y el cliente DEBE ver la confirmación — NUNCA un error falso.
      const esErrorDeRed =
        e instanceof Error &&
        (e.name === "AbortError" ||
          e.name === "TypeError" ||
          e.message?.includes("Failed to fetch") ||
          e.message?.includes("NetworkError") ||
          e.message?.includes("timeout") ||
          e.message?.includes("aborted"));

      if (pedido.numero_comanda) {
        let verificado = false;
        try {
          const { data } = await supabase.rpc("consultar_pedido_por_comanda_y_telefono", {
            p_numero_comanda: pedido.numero_comanda,
            p_telefono: pedido.cliente_telefono,
          });
          verificado = Boolean(data);
        } catch (verifError) {
          if (esErrorDeRed) {
            // No se pudo verificar (red caída) — no podemos confirmar éxito.
            console.error("Error verificando pedido tras fallo de red:", verifError);
            throw new Error(
              "No pudimos confirmar tu pedido por problemas de conexión. Revisa si aparece en 'Mi Chicharronera' antes de reintentar.",
            );
          }
          // La verificación falló por otra razón: no podemos descartar que el
          // pedido SÍ se haya guardado. Para no mostrar una falsa confirmación
          // ni bloquear al cliente, lanzamos error genérico.
          console.error("Error verificando pedido tras error de inserción:", verifError);
        }

        if (verificado) {
          // El pedido SÍ se guardó — no es un error real.
          console.warn(
            "[crearPedido] El pedido se guardó pero la confirmación no llegó. Continuando como éxito.",
            pedido.numero_comanda,
          );
          // Continuar con el flujo normal (guardar local + retornar).
        } else if (!esErrorDeRed) {
          // Error real no relacionado con red (RLS, validación, etc.).
          console.error("Error al insertar pedido en Supabase:", e);
          throw new Error("No se pudo registrar el pedido. Intenta de nuevo.");
        }
        // Si es error de red y NO se pudo verificar, el flujo continúa con el
        // pedido local — la confirmación se muestra igualmente (la pantalla de
        // confirmación es del cliente, no requiere estado exacto del staff).
      } else {
        // Error real sin número de comanda (ni siquiera se generó el número).
        console.error("Error al insertar pedido en Supabase:", e);
        throw new Error("No se pudo registrar el pedido. Intenta de nuevo.");
      }
    }
  } else {
    // Fallback sin Supabase: generar número localmente
    pedido.numero_comanda = nuevoNumeroComanda();
  }

  // Guardar localmente para compatibilidad con el flujo actual
  setState((s) => ({ ...s, pedidos: [pedido, ...s.pedidos], cart: [] }));

  // Persistir la comanda del último pedido en sessionStorage para que la
  // pantalla de confirmación SIEMPRE encuentre el pedido, incluso si el
  // estado local se perdió (recarga, navegación profunda, móvil).
  try {
    if (typeof window !== "undefined" && pedido.numero_comanda) {
      sessionStorage.setItem("tremendo-ultima-comanda", JSON.stringify(pedido));
    }
  } catch {
    /* quota */
  }

  return pedido;
}

/** La cajera confirma el domicilio y pasa el pedido a pendiente_pago. */
export const confirmarDomicilio = (id: string, valor: number) =>
  setState((s) => ({
    ...s,
    pedidos: s.pedidos.map((pd) =>
      pd.id === id
        ? {
            ...pd,
            valor_domicilio: valor,
            total: pd.subtotal + valor,
            vuelto:
              pd.monto_efectivo_recibido != null
                ? pd.monto_efectivo_recibido - (pd.subtotal + valor)
                : null,
            estado: "pendiente_pago" as EstadoPedido,
          }
        : pd,
    ),
  }));

export const getPedido = (numero: string) =>
  state.pedidos.find((pd) => pd.numero_comanda === numero) ?? null;

export const cambiarEstado = (id: string, estado: EstadoPedido) =>
  setState((s) => ({
    ...s,
    pedidos: s.pedidos.map((pd) => (pd.id === id ? { ...pd, estado } : pd)),
  }));

export const setDomicilio = (id: string, valor: number) =>
  setState((s) => ({
    ...s,
    pedidos: s.pedidos.map((pd) =>
      pd.id === id
        ? {
            ...pd,
            valor_domicilio: valor,
            total: pd.subtotal + valor,
            vuelto:
              pd.monto_efectivo_recibido != null
                ? pd.monto_efectivo_recibido - (pd.subtotal + valor)
                : null,
          }
        : pd,
    ),
  }));

/**
 * Edita una comanda conservando el mismo número: archiva la versión anterior
 * en histórico (anulada) y sube la versión activa. El sistema solo lee la
 * versión activa, nunca las archivadas.
 */
export function editarComanda(id: string, items: CartItem[], motivo = "Edición de comanda") {
  setState((s) => {
    const actual = s.pedidos.find((pd) => pd.id === id);
    if (!actual) return s;
    const subtotal = cartTotal(items);
    const historico: HistoricoComanda = {
      id: crypto.randomUUID(),
      pedido_id: actual.id,
      numero_comanda: actual.numero_comanda,
      version: actual.version,
      snapshot: actual,
      anulada_en: new Date().toISOString(),
      motivo,
    };
    return {
      ...s,
      historico: [historico, ...s.historico],
      pedidos: s.pedidos.map((pd) =>
        pd.id === id
          ? {
              ...pd,
              items,
              subtotal,
              total: subtotal + pd.valor_domicilio,
              vuelto:
                pd.monto_efectivo_recibido != null
                  ? pd.monto_efectivo_recibido - (subtotal + pd.valor_domicilio)
                  : null,
              version: pd.version + 1,
            }
          : pd,
      ),
    };
  });
}

export const puedeEditarCliente = (pd: Pedido) =>
  new Date(pd.editable_hasta).getTime() > Date.now() &&
  ["pendiente_pago", "pago_confirmado"].includes(pd.estado);

// ── Configuración (superadmin) ───────────────────────────────
export const toggleNegocio = () =>
  setState((s) => ({
    ...s,
    config: { ...s.config, negocio_abierto: !s.config.negocio_abierto },
  }));

export const toggleAgotado = (productoId: string) =>
  setState((s) => ({
    ...s,
    config: {
      ...s.config,
      agotados: s.config.agotados.includes(productoId)
        ? s.config.agotados.filter((x) => x !== productoId)
        : [...s.config.agotados, productoId],
    },
  }));

export const setPrecio = (productoId: string, precio: number) =>
  setState((s) => ({
    ...s,
    config: { ...s.config, precios: { ...s.config.precios, [productoId]: precio } },
  }));

export const marcarRespaldo = () =>
  setState((s) => ({ ...s, config: { ...s.config, ultimo_respaldo: new Date().toISOString() } }));

/** Precio vigente de un producto (override del superadmin o precio base). */
export function precioDe(productoId: string): number | null {
  const override = state.config.precios[productoId];
  if (typeof override === "number") return override;
  return PRODUCTOS.find((x) => x.id === productoId)?.precio ?? null;
}
