/**
 * Autenticación de staff usando Supabase Auth.
 * Verifica el rol del usuario autenticado en la tabla `usuarios`
 * (vinculada a auth.users por user_id).
 *
 * IMPORTANTE (SSR): en el servidor no existe `localStorage`, por lo que
 * `supabase.auth.getUser()` no puede restaurar la sesión y devolvería null.
 * Para evitar redirigir al login al refrescar (F5), el guard `beforeLoad`
 * DEBE devolver `true` en SSR (dejar pasar) y verificar en el cliente vía
 * `verificarSesionCliente()` que sí tiene acceso a localStorage y puede
 * restaurar la sesión de Supabase Auth.
 */
import { supabase } from "./supabase";

export type PanelStaff = "caja" | "dueno";
export type RolUsuario = "admin" | "superadmin";

/** Detección de entorno SSR (TanStack Start / Nitro). */
const esServer = () => typeof window === "undefined";

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

/**
 * Verifica la sesión del staff en el cliente.
 * - SSR (servidor): devuelve `true` para no redirigir durante el render
 *   del servidor; el guard del cliente (`clienteYaAutenticado`) se encarga
 *   de la verificación real.
 * - Cliente: espera a que Supabase restaure la sesión desde localStorage
 *   (persistSession) antes de validar el rol.
 */
export async function estaAutenticado(panel: PanelStaff): Promise<boolean> {
  if (esServer()) return true; // SSR: dejar pasar, el cliente verifica
  if (!supabase) return false;

  try {
    // getUser() espera a que Supabase restaure la sesión desde localStorage
    // (persistSession: true en supabase.ts). A diferencia de getSession(),
    // getUser() hace un round-trip y refresca el token si es necesario.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return false;

    const rol = panel === "caja" ? "admin" : "superadmin";
    // Si el rol ya está cacheado en sessionStorage lo reutilizamos
    // para evitar un round-trip innecesario en cada refresh.
    try {
      const cacheKey = `tc-sesion-${panel}`;
      const cache = sessionStorage.getItem(cacheKey);
      if (cache === data.user.id) return true;
    } catch {
      /* sessionStorage no disponible */
    }

    const tieneElRol = await tieneRol(data.user.id, rol);
    if (tieneElRol) {
      try {
        sessionStorage.setItem(`tc-sesion-${panel}`, data.user.id);
      } catch {
        /* sessionStorage no disponible */
      }
    }
    return tieneElRol;
  } catch {
    return false;
  }
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
  if (esServer()) return { ok: false, error: "No se puede iniciar sesión desde el servidor." };

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
  // Cachear la sesión en sessionStorage para agilizar los refrescos
  try {
    const cacheKey = `tc-sesion-${rolEsperado === "admin" ? "caja" : "dueno"}`;
    sessionStorage.setItem(cacheKey, data.user.id);
  } catch {
    /* sessionStorage no disponible */
  }
  return { ok: true, rol };
}

export async function cerrarSesion() {
  // Limpiar la caché de sessionStorage al cerrar sesión
  try {
    sessionStorage.removeItem("tc-sesion-caja");
    sessionStorage.removeItem("tc-sesion-dueno");
  } catch {
    /* sessionStorage no disponible */
  }
  if (supabase) {
    if (esServer()) return;
    await supabase.auth.signOut();
  }
}
