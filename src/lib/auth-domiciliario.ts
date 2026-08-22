/**
 * Autenticaciรณn de domiciliarios usando Supabase Auth.
 * Verifica que el usuario autenticado tenga un perfil activo en la tabla
 * `domiciliarios` (vinculada a auth.users por user_id).
 *
 * Mismo patrรณn que auth-staff.ts: en SSR no existe localStorage, por lo que
 * el guard `beforeLoad` DEBE devolver `true` en SSR y verificar en el cliente
 * vรญa `estaAutenticadoDomiciliario()`.
 */
import { supabase } from "./supabase";

export interface DomiciliarioDb {
  id: string;
  user_id: string;
  nombre_completo: string;
  correo: string;
  activo: boolean;
  creado_en: string;
}

/** Detecciรณn de entorno SSR (TanStack Start / Nitro). */
const esServer = () => typeof window === "undefined";

/**
 * Verifica si el usuario autenticado es un domiciliario activo.
 * Usa la funciรณn SQL `es_domiciliario` (SECURITY DEFINER, sin recursiรณn RLS).
 */
export async function esDomiciliarioActivo(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("es_domiciliario", {
    _user_id: userId,
  });
  if (error) {
    console.error("Error verificando domiciliario:", error);
    return false;
  }
  return data === true;
}

/** Obtiene el perfil del domiciliario autenticado (su propia fila). */
export async function obtenerMiPerfilDomiciliario(): Promise<DomiciliarioDb | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;
  const { data, error } = await supabase
    .from("domiciliarios")
    .select("*")
    .eq("user_id", userData.user.id)
    .single();
  if (error || !data) return null;
  return data as DomiciliarioDb;
}

/**
 * Verifica la sesiรณn del domiciliario en el cliente.
 * - SSR (servidor): devuelve `true` para no redirigir durante el render.
 * - Cliente: espera a que Supabase restaure la sesiรณn antes de validar.
 */
export async function estaAutenticadoDomiciliario(): Promise<boolean> {
  if (esServer()) return true; // SSR: dejar pasar, el cliente verifica
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return false;

    // Cache en sessionStorage para evitar round-trip en cada refresh.
    try {
      const cacheKey = "tc-sesion-domiciliario";
      const cache = sessionStorage.getItem(cacheKey);
      if (cache === data.user.id) return true;
    } catch {
      /* sessionStorage no disponible */
    }

    const esActivo = await esDomiciliarioActivo(data.user.id);
    if (esActivo) {
      try {
        sessionStorage.setItem("tc-sesion-domiciliario", data.user.id);
      } catch {
        /* sessionStorage no disponible */
      }
    }
    return esActivo;
  } catch {
    return false;
  }
}

/**
 * Inicia sesiรณn como domiciliario y verifica que tenga perfil activo.
 * Si no lo tiene, cierra la sesiรณn y devuelve error.
 */
export async function iniciarSesionDomiciliario(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string; perfil?: DomiciliarioDb }> {
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  if (esServer()) return { ok: false, error: "No se puede iniciar sesión desde el servidor." };

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "Credenciales incorrectas." };
    }

    const esActivo = await esDomiciliarioActivo(data.user.id);
    if (!esActivo) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: "Tu usuario no tiene un perfil de domiciliario activo en el sistema.",
      };
    }

    const perfil = await obtenerMiPerfilDomiciliario();
    if (!perfil) {
      await supabase.auth.signOut();
      return { ok: false, error: "No se pudo cargar tu perfil de domiciliario." };
    }

    try {
      sessionStorage.setItem("tc-sesion-domiciliario", data.user.id);
    } catch {
      /* sessionStorage no disponible */
    }

    return { ok: true, perfil };
  } catch (e) {
    console.error("Error en iniciarSesionDomiciliario:", e);
    return {
      ok: false,
      error:
        e instanceof Error && e.message
          ? e.message
          : "No se pudo iniciar sesión. Revisa tu conexión e intenta de nuevo.",
    };
  }
}

/**
 * Registra un nuevo domiciliario: crea el usuario en Supabase Auth y en el
 * mismo flujo inserta la fila en `domiciliarios` con user_id, nombre y correo.
 */
export async function registrarDomiciliario(
  nombreCompleto: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string; perfil?: DomiciliarioDb }> {
  if (!supabase) return { ok: false, error: "Supabase no está configurado." };
  if (esServer()) return { ok: false, error: "No se puede registrar desde el servidor." };

  try {
    // 1) Crear usuario en Supabase Auth.
    //    El trigger `trg_auto_crear_perfil_domiciliario` inserta automáticamente
    //    la fila en `domiciliarios` en el momento exacto de la creación.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { rol: "domiciliario", nombre_completo: nombreCompleto },
      },
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "No se pudo crear la cuenta." };
    }

    // 2) Si la confirmación de email está deshabilitada, signUp() devuelve
    //    sesión activa. Si está habilitada, no hay sesión → intentamos
    //    iniciar sesión automáticamente con las mismas credenciales.
    if (!data.session) {
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError || !loginData.user) {
        // La confirmación de email está habilitada y el usuario debe confirmar.
        return {
          ok: false,
          error: "Tu cuenta fue creada. Revisa tu correo para confirmarla y luego inicia sesión.",
        };
      }
    }

    // 3) Verificar que el perfil se haya creado (por el trigger o el RPC).
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? data.user.id;

    // Respaldo: si el trigger no se ejecutó (por ejemplo, en un entorno
    // donde no está instalado), intentar insertar vía RPC.
    const { data: rpcData, error: perfilError } = await supabase.rpc("registrar_domiciliario", {
      p_user_id: userId,
      p_nombre_completo: nombreCompleto.trim(),
      p_correo: email.trim().toLowerCase(),
    });
    if (perfilError) {
      console.error("Error insertando perfil de domiciliario:", perfilError);
    }

    // 4) Verificar que el perfil exista en la base de datos.
    const perfil = await obtenerMiPerfilDomiciliario();
    if (!perfil) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error:
          "No se pudo asignar tu perfil de domiciliario. Contacta al administrador del sistema.",
      };
    }

    try {
      sessionStorage.setItem("tc-sesion-domiciliario", userId);
    } catch {
      /* sessionStorage no disponible */
    }

    return { ok: true, perfil };
  } catch (e) {
    console.error("Error en registrarDomiciliario:", e);
    return {
      ok: false,
      error:
        e instanceof Error && e.message
          ? e.message
          : "No se pudo completar el registro. Revisa tu conexión e intenta de nuevo.",
    };
  }
}

export async function cerrarSesionDomiciliario() {
  try {
    sessionStorage.removeItem("tc-sesion-domiciliario");
  } catch {
    /* sessionStorage no disponible */
  }
  if (supabase) {
    if (esServer()) return;
    await supabase.auth.signOut();
  }
}
