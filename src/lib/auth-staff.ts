/**
 * Autenticación de staff usando Supabase Auth.
 * Verifica el rol del usuario autenticado en la tabla `usuarios`
 * (vinculada a auth.users por user_id).
 */
import { supabase } from "./supabase";

export type PanelStaff = "caja" | "dueno";
export type RolUsuario = "admin" | "superadmin";

export async function obtenerRolUsuario(userId: string): Promise<RolUsuario | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data.rol as RolUsuario;
}

export async function estaAutenticado(panel: PanelStaff): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  const rol = await obtenerRolUsuario(data.session.user.id);
  if (!rol) return false;
  return panel === "caja" ? rol === "admin" : rol === "superadmin";
}

export async function iniciarSesion(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string; rol?: RolUsuario }> {
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Credenciales incorrectas." };
  }
  const rol = await obtenerRolUsuario(data.user.id);
  if (!rol) {
    await supabase.auth.signOut();
    return { ok: false, error: "Tu usuario no tiene un rol asignado en el sistema." };
  }
  return { ok: true, rol };
}

export async function cerrarSesion() {
  if (supabase) await supabase.auth.signOut();
}