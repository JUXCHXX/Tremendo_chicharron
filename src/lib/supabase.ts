import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
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
