import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useLocation,
  Outlet,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Printer,
  RefreshCcw,
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  Home,
  X,
  AlertCircle,
  Loader2,
  Phone,
  MapPin,
  StickyNote,
  Bike,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { estaAutenticado, cerrarSesion } from "@/lib/auth-staff";
import { formatCOP } from "@/lib/menu-data";
import { supabase } from "@/lib/supabase";
import { usePedidosRealtime, type PedidoDb } from "@/lib/use-pedidos";
import { ESTADO_LABEL_STAFF, type EstadoPedido } from "@/lib/store";
import { imprimirFacturaTermica } from "@/lib/documentos";
import { DetallePedidoModal } from "@/components/DetallePedidoModal";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const href = location?.href ?? location?.pathname ?? "";
    if (href.split("?")[0]!.split("#")[0]!.endsWith("/login")) return;
    if (typeof window === "undefined") return;
    const ok = await estaAutenticado("caja");
    if (!ok) {
      throw redirect({ to: "/admin/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Panel de caja | Tremendo Chicharrón" },
      {
        name: "description",
        content: "Panel de la cajera: pedidos entrantes, confirmación de pago y comandas.",
      },
      { property: "og:title", content: "Panel de caja | Tremendo Chicharrón" },
      { property: "og:description", content: "Gestión de pedidos y comandas en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const COLUMNAS: EstadoPedido[] = [
  "pendiente_confirmacion_cajera",
  "pendiente_pago",
  "pago_confirmado",
  "en_cocina",
  "en_preparacion",
  "en_camino",
  "entregado",
];

/**
 * Colores de acento por estado (solo borde/acento — el fondo de la tarjeta
 * siempre es oscuro con texto claro para garantizar legibilidad en todas las
 * columnas).
 */
const COLOR_ESTADO: Record<string, string> = {
  pendiente_confirmacion_cajera: "border-purple-500",
  pendiente_pago: "border-amber-500",
  pago_confirmado: "border-yellow-500",
  en_cocina: "border-orange-500",
  en_preparacion: "border-red-500",
  en_camino: "border-blue-500",
  entregado: "border-green-500",
};

const BADGE_ESTADO: Record<string, string> = {
  pendiente_confirmacion_cajera: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  pendiente_pago: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  pago_confirmado: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  en_cocina: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  en_preparacion: "bg-red-500/20 text-red-300 border-red-500/40",
  en_camino: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  entregado: "bg-green-500/20 text-green-300 border-green-500/40",
};

type Seccion = "pedidos" | "historial" | "config";

function Admin() {
  const navigate = useNavigate();
  const { pedidos, recargar, actualizarLocal } = usePedidosRealtime({ staff: true });
  const [seccion, setSeccion] = useState<Seccion>("pedidos");
  const [activoId, setActivoId] = useState<string | null>(null);
  const [activoEstado, setActivoEstado] = useState<EstadoPedido | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState("");
  const [busquedaComanda, setBusquedaComanda] = useState("");
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [domiciliarios, setDomiciliarios] = useState<Record<string, string>>({});

  // Cargar domiciliarios para mostrar el nombre en las tarjetas
  useEffect(() => {
    const cargarDomiciliarios = async () => {
      if (!supabase) return;
      const { data, error } = await supabase.from("domiciliarios").select("id, nombre_completo");
      if (!error && data) {
        const map: Record<string, string> = {};
        data.forEach((d) => {
          map[d.id] = d.nombre_completo;
        });
        setDomiciliarios(map);
      }
    };
    void cargarDomiciliarios();
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { pathname } = useLocation();
  if (pathname.endsWith("/login")) {
    return <Outlet />;
  }

  const cambiarEstadoDb = async (id: string, estado: string): Promise<boolean> => {
    if (!supabase) {
      setErrorAccion("No se pudo conectar con la base de datos.");
      return false;
    }
    setCambiandoId(id);
    setErrorAccion("");
    try {
      const { data: updated, error: updateError } = await supabase
        .from("pedidos")
        .update({ estado })
        .eq("id", id)
        .select("id, estado")
        .single();
      if (updateError) {
        throw new Error(`No se pudo actualizar el estado (${updateError.message}).`);
      }
      if (!updated || updated.estado !== estado) {
        throw new Error("No se confirmó el cambio de estado en la base de datos.");
      }
      // El Kanban solo se mueve después de confirmar la fila persistida.
      actualizarLocal(id, { estado: updated.estado });
      void recargar();
      return true;
    } catch (e) {
      console.error("Error actualizando estado:", e);
      setErrorAccion(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar el pedido. Revisa tu conexión e intenta de nuevo.",
      );
      return false;
    } finally {
      setCambiandoId(null);
    }
  };

  const setDomicilioDb = async (id: string, valor: number, pd: PedidoDb) => {
    if (!supabase) {
      setErrorAccion("No se pudo conectar con la base de datos.");
      return;
    }
    setCambiandoId(id);
    setErrorAccion("");
    try {
      const { error: updateError } = await supabase
        .from("pedidos")
        .update({ valor_domicilio: valor, total: pd.subtotal + valor })
        .eq("id", id);
      if (updateError) {
        throw new Error(`No se pudo actualizar el domicilio (${updateError.message}).`);
      }
      void recargar();
    } catch (e) {
      console.error("Error actualizando domicilio:", e);
      setErrorAccion(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar el domicilio. Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setCambiandoId(null);
    }
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const pd = pedidos.find((p) => p.id === id);
    if (pd) {
      setActivoId(id);
      setActivoEstado(pd.estado as EstadoPedido);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActivoId(null);
    setActivoEstado(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const nuevoEstado = String(over.id) as EstadoPedido;
    const pd = pedidos.find((p) => p.id === id);
    if (pd && pd.estado !== nuevoEstado && COLUMNAS.includes(nuevoEstado)) {
      void cambiarEstadoDb(id, nuevoEstado);
    }
  };

  // Solo pedidos de HOY: el tablero se renueva cada día.
  const inicioDeHoy = new Date();
  inicioDeHoy.setHours(0, 0, 0, 0);
  const pedidosDeHoy = pedidos.filter((p) => new Date(p.creado_en) >= inicioDeHoy);
  const pedidosDelDia = pedidosDeHoy.filter((p) => p.estado !== "cancelado");
  const historial = pedidosDeHoy.filter(
    (p) => p.estado === "cancelado" || p.estado === "entregado",
  );

  // Búsqueda por comanda: filtra el kanban (incluso de días anteriores).
  const busquedaNormalizada = busquedaComanda.trim().toLowerCase();
  const pedidosKanban = busquedaNormalizada
    ? pedidos.filter(
        (p) =>
          p.numero_comanda.toLowerCase().includes(busquedaNormalizada) && p.estado !== "cancelado",
      )
    : pedidosDelDia;

  const resumenPedido = (pd: PedidoDb) => {
    if (!pd.items || pd.items.length === 0) return "Sin items";
    return (
      pd.items
        .map((i) => `${i.cantidad}x ${i.nombre}`)
        .join(", ")
        .slice(0, 60) + (pd.items.length > 1 ? "…" : "")
    );
  };

  const pedidoDetalle = pedidos.find((p) => p.id === detalleId) ?? null;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-16 flex-col items-center gap-2 border-r border-border bg-card py-4 md:w-56 md:items-stretch md:px-3">
        <div className="mb-4 flex items-center justify-center gap-2 md:justify-start">
          <span className="font-display text-2xl text-primary">TC</span>
          <span className="hidden font-display text-sm text-primary md:block">Panel de caja</span>
        </div>

        <button
          onClick={() => setSeccion("pedidos")}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors md:justify-start ${
            seccion === "pedidos"
              ? "bg-brasa text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/30"
          }`}
        >
          <LayoutDashboard className="size-4" />
          <span className="hidden md:block">Pedidos del día</span>
        </button>

        <button
          onClick={() => setSeccion("historial")}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors md:justify-start ${
            seccion === "historial"
              ? "bg-brasa text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/30"
          }`}
        >
          <History className="size-4" />
          <span className="hidden md:block">Historial</span>
        </button>

        <button
          onClick={() => setSeccion("config")}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors md:justify-start ${
            seccion === "config"
              ? "bg-brasa text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/30"
          }`}
        >
          <Settings className="size-4" />
          <span className="hidden md:block">Configuración</span>
        </button>

        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={() => void recargar()}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 md:justify-start"
            title="Recargar"
          >
            <RefreshCcw className="size-4" />
            <span className="hidden md:block">Recargar</span>
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 md:justify-start"
          >
            <Home className="size-4" />
            <span className="hidden md:block">Inicio</span>
          </Link>
          <button
            onClick={() => {
              void cerrarSesion();
              void navigate({ to: "/admin/login" });
            }}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-destructive hover:bg-destructive/10 md:justify-start"
          >
            <LogOut className="size-4" />
            <span className="hidden md:block">Salir</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto px-4 pb-16">
        {seccion === "pedidos" && (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 py-5">
              <div>
                <h1 className="font-display text-3xl text-primary">Pedidos del día</h1>
                <p className="text-xs text-muted-foreground">
                  Arrastra las tarjetas entre columnas para actualizar el estado
                </p>
              </div>
              <input
                value={busquedaComanda}
                onChange={(e) => setBusquedaComanda(e.target.value)}
                placeholder="Buscar comanda (TC-…)"
                className="w-56 rounded-xl bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </header>

            {errorAccion && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span className="flex-1">{errorAccion}</span>
                <button
                  onClick={() => setErrorAccion("")}
                  className="shrink-0 rounded-full p-1 hover:bg-destructive/20"
                  aria-label="Cerrar aviso"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <div className="flex gap-4 pb-4">
                {COLUMNAS.map((estado) => {
                  const enColumna = pedidosKanban.filter((p) => p.estado === estado);
                  return (
                    <KanbanColumna
                      key={estado}
                      estado={estado}
                      pedidos={enColumna}
                      onCambiarEstado={cambiarEstadoDb}
                      onSetDomicilio={setDomicilioDb}
                      cambiandoId={cambiandoId}
                      onVerDetalle={(id) => setDetalleId(id)}
                      domiciliarios={domiciliarios}
                    />
                  );
                })}
              </div>
              <DragOverlay>
                {activoId && activoEstado ? (
                  <TarjetaPedido
                    pd={pedidos.find((p) => p.id === activoId)!}
                    onCambiarEstado={cambiarEstadoDb}
                    onSetDomicilio={setDomicilioDb}
                    cambiandoId={cambiandoId}
                    overlay
                    domiciliarios={domiciliarios}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            <DetallePedidoModal
              pedido={pedidoDetalle}
              abierto={detalleId !== null}
              onCerrar={() => setDetalleId(null)}
              staff
              onGuardado={() => {
                setDetalleId(null);
                void recargar();
              }}
              onImprimir={(pd) => void imprimirFacturaTermica(pd as never)}
            />
          </>
        )}

        {seccion === "historial" && (
          <>
            <header className="py-5">
              <h1 className="font-display text-3xl text-primary">Historial</h1>
              <p className="text-xs text-muted-foreground">Pedidos entregados y cancelados</p>
            </header>
            {historial.length === 0 ? (
              <p className="mt-10 text-sm text-muted-foreground">No hay pedidos en el historial.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {historial.map((pd) => (
                  <article
                    key={pd.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-2xl text-primary">{pd.numero_comanda}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(pd.creado_en).toLocaleString("es-CO")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE_ESTADO[pd.estado] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {ESTADO_LABEL_STAFF[pd.estado as EstadoPedido] ?? pd.estado}
                      </span>
                    </div>
                    <div className="mt-3 text-sm">
                      <p>
                        <b>{pd.cliente_nombre}</b> · {pd.cliente_telefono}
                      </p>
                      <p className="text-muted-foreground">{pd.direccion_entrega}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{resumenPedido(pd)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <span className="font-display text-2xl text-primary">
                        {formatCOP(pd.total)}
                      </span>
                      <button
                        onClick={() => void imprimirFacturaTermica(pd as never)}
                        className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                      >
                        <Printer className="size-4" />
                        Imprimir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {seccion === "config" && (
          <>
            <header className="py-5">
              <h1 className="font-display text-3xl text-primary">Configuración</h1>
              <p className="text-xs text-muted-foreground">Ajustes del panel de caja</p>
            </header>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <p className="text-sm text-muted-foreground">
                La configuración avanzada (precios, agotados, negocio abierto) se gestiona desde el
                panel de superadmin.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function KanbanColumna({
  estado,
  pedidos,
  onCambiarEstado,
  onSetDomicilio,
  cambiandoId,
  onVerDetalle,
  domiciliarios,
}: {
  estado: EstadoPedido;
  pedidos: PedidoDb[];
  onCambiarEstado: (id: string, estado: string) => void;
  onSetDomicilio: (id: string, valor: number, pd: PedidoDb) => void;
  cambiandoId: string | null;
  onVerDetalle: (id: string) => void;
  domiciliarios: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useSortable({ id: estado });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-2xl border-2 bg-muted/20 p-3 ${
        isOver ? "border-primary/60" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{ESTADO_LABEL_STAFF[estado]}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {pedidos.length}
        </span>
      </div>
      <SortableContext items={pedidos.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {pedidos.map((pd) => (
            <TarjetaPedido
              key={pd.id}
              pd={pd}
              onCambiarEstado={onCambiarEstado}
              onSetDomicilio={onSetDomicilio}
              cambiandoId={cambiandoId}
              onVerDetalle={onVerDetalle}
              domiciliarios={domiciliarios}
            />
          ))}
          {pedidos.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Sin pedidos
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function TarjetaPedido({
  pd,
  onCambiarEstado,
  onSetDomicilio,
  cambiandoId,
  onVerDetalle,
  overlay = false,
  domiciliarios,
}: {
  pd: PedidoDb;
  onCambiarEstado: (id: string, estado: string) => void;
  onSetDomicilio: (id: string, valor: number, pd: PedidoDb) => void;
  cambiandoId: string | null;
  onVerDetalle?: (id: string) => void;
  overlay?: boolean;
  domiciliarios: Record<string, string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pd.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const items = pd.items ?? [];

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!overlay && onVerDetalle) {
          e.stopPropagation();
          onVerDetalle(pd.id);
        }
      }}
      className={`cursor-grab rounded-xl border-2 bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        COLOR_ESTADO[pd.estado] ?? "border-border"
      } ${overlay ? "rotate-2" : ""}`}
    >
      {/* Número de comanda + estado + botón de ver detalle */}
      <div className="flex items-start justify-between gap-2">
        <p className="cursor-pointer font-display text-lg text-primary">{pd.numero_comanda}</p>
        <div className="flex items-center gap-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${BADGE_ESTADO[pd.estado] ?? "bg-muted text-muted-foreground"}`}
          >
            {ESTADO_LABEL_STAFF[pd.estado as EstadoPedido] ?? pd.estado}
          </span>
          {!overlay && onVerDetalle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVerDetalle(pd.id);
              }}
              title="Ver detalle del pedido"
              aria-label={`Ver detalle de ${pd.numero_comanda}`}
              className="rounded-lg border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              Detalle
            </button>
          )}
        </div>
      </div>

      {/* Domiciliario asignado */}
      {pd.domiciliario_id && domiciliarios[pd.domiciliario_id] && (
        <p className="mt-2 flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
          <Bike className="size-3 shrink-0" />
          Domiciliario: {domiciliarios[pd.domiciliario_id]}
        </p>
      )}

      {/* Cliente */}
      <p className="mt-2 text-sm font-semibold text-foreground">{pd.cliente_nombre}</p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Phone className="size-3 shrink-0" />
        {pd.cliente_telefono}
      </p>
      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 size-3 shrink-0" />
        <span>
          {pd.direccion_entrega}
          {pd.barrio ? ` · ${pd.barrio}` : ""}
        </span>
      </p>

      {/* Productos con notas */}
      <div className="mt-2 space-y-1.5 border-t border-border pt-2">
        {items.length === 0 && <p className="text-xs text-muted-foreground">Sin items</p>}
        {items.map((item, idx) => (
          <div key={item.key ?? idx} className="text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-foreground">
                <span className="font-bold text-primary">{item.cantidad}x</span> {item.nombre}
                {item.variante_personas ? ` (${item.variante_personas} pers.)` : ""}
                {item.combo ? " + combo" : ""}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatCOP(item.precio_unitario * item.cantidad)}
              </span>
            </div>
            {item.notas ? (
              <div className="mt-0.5 flex items-start gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5">
                <StickyNote className="mt-0.5 size-3 shrink-0 text-amber-400" />
                <span className="text-[11px] text-amber-300">{item.notas}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Total + acciones */}
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <span className="font-display text-xl text-primary">{formatCOP(pd.total)}</span>
        <div className="flex items-center gap-1">
          {cambiandoId === pd.id && <Loader2 className="size-3 animate-spin text-primary" />}
          {pd.estado === "pendiente_confirmacion_cajera" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void onCambiarEstado(pd.id, "pendiente_pago");
              }}
              disabled={cambiandoId === pd.id}
              className="rounded-lg bg-brasa px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-50"
            >
              Confirmar pedido
            </button>
          )}
          {pd.estado === "pendiente_pago" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void onCambiarEstado(pd.id, "pago_confirmado");
              }}
              disabled={cambiandoId === pd.id}
              className="rounded-lg bg-brasa px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-50"
            >
              Confirmar pago
            </button>
          )}
          {/* La cajera solo imprime la factura cuando el pedido está en "Pendiente de pago" */}
          {pd.estado === "pendiente_pago" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void imprimirFacturaTermica(pd as never);
              }}
              className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
              title="Imprimir factura"
            >
              <Printer className="size-3" />
              Imprimir
            </button>
          )}
        </div>
      </div>

      {pd.estado === "pendiente_pago" && (
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            Domicilio
            <input
              type="number"
              defaultValue={pd.valor_domicilio}
              onBlur={(e) => onSetDomicilio(pd.id, Number(e.target.value) || 0, pd)}
              onClick={(e) => e.stopPropagation()}
              className="w-20 rounded-lg bg-input p-1 text-xs outline-none"
            />
          </label>
        </div>
      )}
    </article>
  );
}
