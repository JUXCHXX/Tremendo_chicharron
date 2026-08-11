/**
 * Autenticación de staff usando Supabase Auth.
 * Verifica el rol del usuario autenticado en la tabla `usuarios`
 * (vinculada a auth.users por user_id).
 */
import { supabase } from "./supabase";

export type PanelStaff = "caja" | "dueno";
export type RolUsuario = "admin" | "superadmin";

/**
 * Verifica si el usuario tiene un rol específico usando la función SQL
 * `tiene_rol` (SECURITY DEFINER) que evita recursión en las políticas RLS.
 */
export async function tieneRol(userId: string, rol: RolUsuario): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("tiene_rol", {
    _user_id: userId,
    _rol: rol,
  });
  if (error) {
    console.error("Error verificando rol:", error);
    return false;
  }
  return data === true;
}

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
  const rol = panel === "caja" ? "admin" : "superadmin";
  return tieneRol(data.session.user.id, rol);
}

/**
 * Inicia sesión y verifica con la función SQL `tiene_rol` que el usuario
 * tenga el rol esperado. Si no lo tiene, cierra la sesión y devuelve error.
 */
export async function iniciarSesion(
  email: string,
  password: string,
  rolEsperado?: RolUsuario,
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
  // Verificación con la función SQL tiene_rol (SECURITY DEFINER, sin recursión RLS)
  if (rolEsperado) {
    const tieneElRol = await tieneRol(data.user.id, rolEsperado);
    if (!tieneElRol) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error:
          rolEsperado === "admin"
            ? "No tienes permisos de administrador."
            : "No tienes permisos de superadministrador.",
      };
    }
  }
  return { ok: true, rol };
}

export async function cerrarSesion() {
  if (supabase) await supabase.auth.signOut();
}
