import { supabase } from "./supabase";

export interface Cliente {
  nombre: string;
  telefono: string;
}

/** Normaliza un teléfono a dígitos solos (sin espacios, guiones, +, etc.) */
export function normalizarTelefono(telefono: string): string {
  return telefono.replace(/\D/g, "");
}

const KEY = "tremendo-chicharron-cliente-v1";

export function getClienteLocal(): Cliente | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cliente;
    if (!parsed.nombre || !parsed.telefono) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function guardarClienteLocal(cliente: Cliente) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cliente));
  } catch {
    /* quota */
  }
}

/** Registra el cliente en Supabase (tabla `clientes`) si está disponible. */
export async function registrarClienteSupabase(cliente: Cliente): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("clientes").upsert(
      {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
      },
      { onConflict: "telefono", ignoreDuplicates: false },
    );
  } catch {
    /* no bloquea la experiencia si falla */
  }
}

export async function guardarCliente(cliente: Cliente): Promise<void> {
  guardarClienteLocal(cliente);
  await registrarClienteSupabase(cliente);
}
