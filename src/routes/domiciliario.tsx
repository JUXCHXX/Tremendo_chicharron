import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LogOut,
  Home,
  Bike,
  MapPin,
  Phone,
  Coins,
  PackageCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  estaAutenticadoDomiciliario,
  cerrarSesionDomiciliario,
  type DomiciliarioDb,
} from "@/lib/auth-domiciliario";
import { formatCOP } from "@/lib/menu-data";
import { supabase } from "@/lib/supabase";
import { usePedidosRealtime, type PedidoDb } from "@/lib/use-pedidos";

export const Route = createFileRoute("/domiciliario")({
  beforeLoad: async ({ location }) => {
    const href = location?.href ?? location?.pathname ?? "";
    if (href.split("?")[0]!.split("#")[0]!.endsWith("/login")) return;
    if (typeof window === "undefined") return;
    const ok = await estaAutenticadoDomiciliario();
    if (!ok) {
      throw redirect({ to: "/domiciliario/login" });
    }
  },
  head: () => ({
    meta: [{ title: "Domiciliario | Tremendo Chicharrón" }, { name: "robots", content: "noindex" }],
  }),
  component: Domiciliario,
});

function Domiciliario() {
  const navigate = useNavigate();
  const location = useLocation();
  const [perfil, setPerfil] = useState<DomiciliarioDb | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [numeroComanda, setNumeroComanda] = useState("");
  const [asignando, setAsignando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [propinasHoyData, setPropinasHoyData] = useState<{
    total_propinas: number;
    pedidos_entregados: number;
  }>({ total_propinas: 0, pedidos_entregados: 0 });

  // Cargar perfil del domiciliario autenticado
  useEffect(() => {
    const cargarPerfil = async () => {
      // Si estamos en /domiciliario/login, el componente hijo (login) se
      // encarga de la UI. No ejecutar la lógica de redirección aquí para
      // evitar un loop infinito de recarga.
      if (location.pathname.endsWith("/login")) {
        setCargandoPerfil(false);
        return;
      }
      if (!supabase) {
        setCargandoPerfil(false);
        return;
      }
      // getSession() es síncrono (lee de localStorage), no hace round-trip
      // al servidor y no se cuelga como getUser().
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      // Sin sesión activa → redirigir al login (es lo normal, no un error).
      // Usamos window.location.assign para forzar una navegación completa
      // y evitar loops del router. NO hacemos await en signOut.
      if (!userId) {
        void cerrarSesionDomiciliario();
        window.location.assign("/domiciliario/login");
        return;
      }
      const { data, error } = await supabase
        .from("domiciliarios")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (!error && data) {
        setPerfil(data as DomiciliarioDb);
      } else {
        // Sesión activa pero sin perfil de domiciliario → cerrar sesión
        // y redirigir al login limpio (no dejar al usuario atascado).
        void cerrarSesionDomiciliario();
        window.location.assign("/domiciliario/login");
        return;
      }
      setCargandoPerfil(false);
    };
    void cargarPerfil();
  }, [location.pathname]);

  // Pedidos asignados a este domiciliario (Realtime)
  const { pedidos, recargar } = usePedidosRealtime({ staff: true });

  const misPedidos = perfil ? pedidos.filter((p) => p.domiciliario_id === perfil.id) : [];

  const pedidosActivos = misPedidos.filter(
    (p) =>
      p.estado === "en_camino" ||
      p.estado === "en_preparacion" ||
      p.estado === "pago_confirmado" ||
      p.estado === "en_cocina",
  );
  const pedidosEntregadosHoy = misPedidos.filter((p) => {
    if (p.estado !== "entregado") return false;
    const hoy = new Date();
    const entregado = new Date(p.entregado_en ?? p.creado_en);
    return (
      entregado.getFullYear() === hoy.getFullYear() &&
      entregado.getMonth() === hoy.getMonth() &&
      entregado.getDate() === hoy.getDate()
    );
  });

  // Consultar la vista propinas_por_domiciliario para el día de hoy
  useEffect(() => {
    if (!supabase || !perfil) return;
    const sb = supabase;
    const inicioDeHoy = new Date();
    inicioDeHoy.setHours(0, 0, 0, 0);
    const cargarPropinasHoy = async () => {
      const { data, error } = await sb
        .from("propinas_por_domiciliario")
        .select("*")
        .eq("domiciliario_id", perfil.id)
        .eq("dia", inicioDeHoy.toISOString())
        .maybeSingle();
      if (!error && data) {
        setPropinasHoyData({
          total_propinas: Number(data.total_propinas) || 0,
          pedidos_entregados: Number(data.pedidos_entregados) || 0,
        });
      }
    };
    void cargarPropinasHoy();
  }, [perfil, pedidos]);

  const asignarPedido = async () => {
    if (!numeroComanda.trim()) {
      setError("Escribe el número de comanda.");
      return;
    }
    setAsignando(true);
    setError("");
    setExito("");
    try {
      if (!supabase) {
        setError("No se pudo conectar con la base de datos.");
        return;
      }
      // El frontend arma el TC- + lo que escribió el domiciliario
      const comandaCompleta = `TC-${numeroComanda.trim()}`;
      const { data, error } = await supabase.rpc("asignar_pedido_a_domiciliario", {
        p_numero_comanda: comandaCompleta,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setExito("Pedido asignado correctamente.");
      setNumeroComanda("");
      void recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar el pedido.");
    } finally {
      setAsignando(false);
    }
  };

  const cambiarEstadoPedido = async (pd: PedidoDb, nuevoEstado: "en_camino" | "entregado") => {
    if (!supabase) return;
    setError("");
    setExito("");
    try {
      const updates: Record<string, unknown> = { estado: nuevoEstado };
      if (nuevoEstado === "en_camino") {
        updates["en_camino_en"] = new Date().toISOString();
      } else if (nuevoEstado === "entregado") {
        updates["entregado_en"] = new Date().toISOString();
      }
      const { data: updated, error } = await supabase
        .from("pedidos")
        .update(updates)
        .eq("id", pd.id)
        .select("id, estado")
        .single();
      if (error) {
        setError(error.message);
        return;
      }
      if (!updated || updated.estado !== nuevoEstado) {
        setError("La base de datos no confirmó el cambio de estado.");
        return;
      }
      setExito(
        nuevoEstado === "en_camino"
          ? "Pedido marcado como en camino."
          : "Pedido entregado. ¡Buen trabajo!",
      );
      void recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar el pedido.");
    }
  };

  const cerrarSesion = async () => {
    await cerrarSesionDomiciliario();
    void navigate({ to: "/domiciliario/login" });
  };

  // Si estamos en /domiciliario/login, renderizar el hijo (login) directamente.
  // El componente padre no debe mostrar spinner ni error en esta ruta.
  if (location.pathname.endsWith("/login")) {
    return <Outlet />;
  }

  if (cargandoPerfil) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!perfil) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-primary/30 bg-popover p-6 text-center shadow-glow">
          <p className="text-sm text-muted-foreground">No se pudo cargar tu perfil.</p>
          <button
            onClick={() => void cerrarSesion()}
            className="mt-4 rounded-xl bg-brasa px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Volver al login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-16">
      {/* Encabezado */}
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-brasa text-primary-foreground">
            <Bike className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-primary">Hola, {perfil.nombre_completo}</h1>
            <p className="text-xs text-muted-foreground">Panel de domiciliario</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <Home className="size-3.5" /> Inicio
          </Link>
          <button
            onClick={() => void cerrarSesion()}
            className="flex items-center gap-1 rounded-xl border border-destructive/50 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-3.5" /> Salir
          </button>
        </div>
      </header>

      {/* Mensajes */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            className="shrink-0 rounded-full p-1 hover:bg-destructive/20"
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}
      {exito && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="flex-1">{exito}</span>
          <button
            onClick={() => setExito("")}
            className="shrink-0 rounded-full p-1 hover:bg-green-500/20"
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}

      {/* Tarjeta de propinas de hoy — usa la vista propinas_por_domiciliario */}
      <section className="rounded-3xl border border-primary/30 bg-card p-6 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/15">
            <Coins className="size-6 text-primary" />
          </div>
          <div>
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Propinas de hoy
            </p>
            <p className="font-display text-5xl text-primary">
              {formatCOP(propinasHoyData.total_propinas)}
            </p>
            <p className="text-xs text-muted-foreground">
              {propinasHoyData.pedidos_entregados} pedido
              {propinasHoyData.pedidos_entregados !== 1 ? "s" : ""} entregado
              {propinasHoyData.pedidos_entregados !== 1 ? "s" : ""} hoy
            </p>
          </div>
        </div>
      </section>

      {/* Tomar un pedido */}
      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl text-primary">Tomar un pedido</h2>
        <p className="text-xs text-muted-foreground">
          Escribe el número de comanda que te dio la cajera
        </p>
        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex flex-1 items-center overflow-hidden rounded-xl bg-input">
            <span className="flex items-center border-r border-border bg-muted px-3 py-3 text-sm font-bold text-primary">
              TC-
            </span>
            <input
              value={numeroComanda}
              onChange={(e) => setNumeroComanda(e.target.value.replace(/^TC-?/i, ""))}
              onKeyDown={(e) => e.key === "Enter" && void asignarPedido()}
              placeholder="260821-044"
              className="w-full bg-transparent px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => void asignarPedido()}
            disabled={asignando}
            className="flex items-center gap-2 rounded-xl bg-brasa px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {asignando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PackageCheck className="size-4" />
            )}
            Asignarme
          </button>
        </div>
      </section>

      {/* Mis pedidos activos */}
      <section className="mt-6">
        <h2 className="font-display text-2xl text-primary">Mis pedidos activos</h2>
        {pedidosActivos.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No tienes pedidos asignados en este momento.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {pedidosActivos.map((pd) => (
              <article
                key={pd.id}
                className="rounded-2xl border border-primary/25 bg-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl text-primary">{pd.numero_comanda}</p>
                    <p className="text-sm font-semibold text-foreground">{pd.cliente_nombre}</p>
                  </div>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                    {pd.estado === "en_camino"
                      ? "En camino"
                      : pd.estado === "en_preparacion"
                        ? "En preparación"
                        : pd.estado === "en_cocina"
                          ? "En cocina"
                          : "Pago confirmado"}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" />
                    {pd.cliente_telefono}
                  </p>
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {pd.direccion_entrega}
                      {pd.barrio ? ` · ${pd.barrio}` : ""}
                    </span>
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <p className="font-display text-2xl text-primary">{formatCOP(pd.total)}</p>
                    {pd.propina > 0 && (
                      <p className="text-xs text-primary">Propina: {formatCOP(pd.propina)}</p>
                    )}
                  </div>
                  {pd.estado === "en_camino" ? (
                    <button
                      onClick={() => void cambiarEstadoPedido(pd, "entregado")}
                      className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Marcar entregado
                    </button>
                  ) : (
                    <button
                      onClick={() => void cambiarEstadoPedido(pd, "en_camino")}
                      className="rounded-xl bg-brasa px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Marcar en camino
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Entregados hoy */}
      {pedidosEntregadosHoy.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-2xl text-primary">Entregados hoy</h2>
          <div className="mt-3 space-y-2">
            {pedidosEntregadosHoy.map((pd) => (
              <div
                key={pd.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{pd.numero_comanda}</p>
                  <p className="text-xs text-muted-foreground">{pd.cliente_nombre}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">{formatCOP(pd.total)}</p>
                  {pd.propina > 0 && (
                    <p className="text-xs text-primary">Propina: {formatCOP(pd.propina)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
