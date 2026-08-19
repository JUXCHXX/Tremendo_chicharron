import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

// Timeout generoso (30s) para conexiones móviles lentas (4G/datos).
// El default de Supabase es 0 (sin timeout), pero en celular con latencia
// alta o redes inestables, el fetch puede quedarse esperando y el frontend
// interpreta la demora como error aunque el servidor ya procesó el INSERT.
const FETCH_TIMEOUT_MS = 30_000;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
        global: {
          fetch: (input, init) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            return fetch(input, {
              ...init,
              signal: controller.signal,
            }).finally(() => clearTimeout(timeout));
          },
        },
      })
    : null;

export const supabaseDisponible = () => supabase !== null;

const NIT_FALLBACK = "901.433.592-5";

/** Obtiene el NIT desde la tabla `configuracion` (con fallback hardcodeado). */
export async function obtenerNit(): Promise<string> {
  if (!supabase) return NIT_FALLBACK;
  try {
    const { data, error } = await supabase
      .from("configuracion")
      .select("nit")
      .eq("id", true)
      .single();
    if (error || !data?.nit) return NIT_FALLBACK;
    return data.nit as string;
  } catch {
    return NIT_FALLBACK;
  }
}
