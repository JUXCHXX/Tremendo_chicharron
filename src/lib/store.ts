/**
 * Capa de datos local (localStorage) que replica el esquema de /database.
 * Cuando conectes Supabase, reemplaza estas funciones por queries reales:
 * la forma de los objetos es idéntica a la de las tablas SQL.
 */
import { useSyncExternalStore } from "react";
import { PRODUCTOS } from "./menu-data";

export type EstadoPedido =
  | "pendiente_pago"
  | "pago_confirmado"
  | "en_cocina"
  | "en_preparacion"
  | "en_camino"
  | "entregado"
  | "cancelado";

export const ESTADOS_FLUJO: EstadoPedido[] = [
  "pendiente_pago",
  "pago_confirmado",
  "en_cocina",
  "en_preparacion",
  "en_camino",
  "entregado",
];

export const ESTADO_LABEL: Record<EstadoPedido, string> = {
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

/** Auto-cancelación: pedidos en pendiente_pago con más de 30 min pasan a cancelado. */
export function autoCancelar() {
  const ahora = Date.now();
  let cambio = false;
  const pedidos = state.pedidos.map((pd) => {
    if (pd.estado === "pendiente_pago" && ahora - new Date(pd.creado_en).getTime() > 30 * 60000) {
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

export function crearPedido(data: {
  cliente_nombre: string;
  cliente_telefono: string;
  direccion_entrega: string;
  medio_pago: Pedido["medio_pago"];
  monto_efectivo_recibido: number | null;
  items: CartItem[];
}): Pedido {
  const subtotal = cartTotal(data.items);
  const creado = new Date();
  const pedido: Pedido = {
    id: crypto.randomUUID(),
    numero_comanda: nuevoNumeroComanda(),
    ...data,
    vuelto:
      data.medio_pago === "efectivo" && data.monto_efectivo_recibido != null
        ? data.monto_efectivo_recibido - subtotal
        : null,
    valor_domicilio: 0,
    subtotal,
    total: subtotal,
    estado: "pendiente_pago",
    creado_en: creado.toISOString(),
    editable_hasta: new Date(creado.getTime() + 10 * 60000).toISOString(),
    version: 1,
  };
  setState((s) => ({ ...s, pedidos: [pedido, ...s.pedidos], cart: [] }));
  return pedido;
}

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
  setState((s) => ({ ...s, config: { ...s.config, precios: { ...s.config.precios, [productoId]: precio } } }));

export const marcarRespaldo = () =>
  setState((s) => ({ ...s, config: { ...s.config, ultimo_respaldo: new Date().toISOString() } }));

/** Precio vigente de un producto (override del superadmin o precio base). */
export function precioDe(productoId: string): number | null {
  const override = state.config.precios[productoId];
  if (typeof override === "number") return override;
  return PRODUCTOS.find((x) => x.id === productoId)?.precio ?? null;
}