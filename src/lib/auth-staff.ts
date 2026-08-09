/**
 * Autenticación simple para los paneles de staff (caja y dueño).
 * Las contraseñas se pueden cambiar editando estas constantes o, en el futuro,
 * migrando a Supabase Auth con la tabla `usuarios`.
 */

const KEY_CAJA = "tremendo-auth-caja-v1";
const KEY_DUENO = "tremendo-auth-dueno-v1";

// TODO: cambiar estas contraseñas en producción
const PASS_CAJA = "caja2024";
const PASS_DUENO = "dueno2024";

export type PanelStaff = "caja" | "dueno";

export function estaAutenticado(panel: PanelStaff): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = panel === "caja" ? KEY_CAJA : KEY_DUENO;
    return localStorage.getItem(key) === "ok";
  } catch {
    return false;
  }
}

export function iniciarSesion(panel: PanelStaff, password: string): boolean {
  const valida = panel === "caja" ? password === PASS_CAJA : password === PASS_DUENO;
  if (!valida) return false;
  try {
    const key = panel === "caja" ? KEY_CAJA : KEY_DUENO;
    localStorage.setItem(key, "ok");
  } catch {
    /* ignore */
  }
  return true;
}

export function cerrarSesion(panel: PanelStaff) {
  try {
    const key = panel === "caja" ? KEY_CAJA : KEY_DUENO;
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}