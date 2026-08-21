import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  Star,
  Send,
  Printer,
} from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import { getClienteLocal, normalizarTelefono } from "@/lib/clientes";
import { usePedidosRealtime, type PedidoDb, type PedidoItemNormalizado } from "@/lib/use-pedidos";
import { linkPago, descargarFactura } from "@/lib/documentos";
import { ESTADOS_FLUJO, ESTADO_LABEL_CLIENTE } from "@/lib/store";
import { cargarValoraciones, crearValoracion, type ValoracionDb } from "@/lib/valoraciones";
import { StarRating } from "@/components/StarRating";

export const Route = createFileRoute("/mi-chicharronera")({
  head: () => ({
    meta: [
      { title: "Mi Chicharronera | Tremendo Chicharrón" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MiChicharronera,
});

const ESTADO_ICON: Record<string, React.ReactNode> = {
  pendiente_confirmacion_cajera: <Clock className="size-5 text-amber-500" />,
  pendiente_pago: <Clock className="size-5 text-amber-500" />,
  pago_confirmado: <CheckCircle2 className="size-5 text-emerald-500" />,
  en_cocina: <Loader2 className="size-5 text-blue-500" />,
  en_preparacion: <Loader2 className="size-5 text-blue-500" />,
  en_camino: <Truck className="size-5 text-purple-500" />,
  entregado: <CheckCircle2 className="size-5 text-emerald-500" />,
  cancelado: <XCircle className="size-5 text-red-500" />,
};

function MiChicharronera() {
  const [telefono, setTelefono] = useState("");
  const cliente = getClienteLocal();
  useEffect(() => {
    if (cliente) setTelefono(normalizarTelefono(cliente.telefono));
  }, [cliente]);
  const telefonoNormalizado = cliente ? normalizarTelefono(cliente.telefono) : null;
  const { pedidos, cargando } = usePedidosRealtime({ telefono: telefonoNormalizado });

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-display text-2xl text-primary">Cargando tus pedidos…</p>
      </main>
    );
  }

  if (!telefono) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-primary">Mi Chicharronera</h1>
        <p className="text-sm text-muted-foreground">
          Aún no has hecho ningún pedido desde este dispositivo.
        </p>
        <Link
          to="/menu"
          className="rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground"
        >
          Ver el menú
        </Link>
      </main>
    );
  }

  const activos = pedidos.filter((p) => p.estado !== "cancelado");
  const cancelados = pedidos.filter((p) => p.estado === "cancelado");

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16">
      <header className="flex items-center gap-3 py-4">
        <Link to="/" className="text-muted-foreground" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-3xl text-primary">Mi Chicharronera</h1>
      </header>

      {/* Banner de bienvenida */}
      <div className="mb-5 rounded-2xl border border-primary/40 bg-primary/10 p-4 shadow-glow">
        <p className="font-display text-xl text-primary">
          ¡Quiubo! Bienvenido a tu Chicharronera 🐷
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aquí puedes seguir tus pedidos en tiempo real, ver el estado de tu comanda, pagar cuando
          esté pendiente y calificar cada plato que ya te entregaron. Si tienes dudas, escríbenos
          por WhatsApp.
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">No tienes pedidos registrados.</p>
          <Link
            to="/menu"
            className="mt-4 inline-block rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground"
          >
            Hacer un pedido
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {activos.map((p) => (
            <PedidoCard key={p.id} pedido={p} telefono={telefonoNormalizado} />
          ))}

          {cancelados.length > 0 && (
            <div className="pt-4">
              <p className="mb-3 text-xs tracking-widest text-muted-foreground uppercase">
                Pedidos cancelados
              </p>
              <div className="space-y-4 opacity-60">
                {cancelados.map((p) => (
                  <PedidoCard key={p.id} pedido={p} telefono={telefonoNormalizado} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function PedidoCard({ pedido: p, telefono }: { pedido: PedidoDb; telefono: string | null }) {
  const idxActual = ESTADOS_FLUJO.indexOf(p.estado as (typeof ESTADOS_FLUJO)[number]);
  const entregado = p.estado === "entregado";
  const [valoraciones, setValoraciones] = useState<ValoracionDb[]>([]);

  // Cargar valoraciones existentes de este pedido
  useEffect(() => {
    if (!entregado || !p.items?.length) return;
    let activo = true;
    void Promise.all(
      (p.items ?? []).filter((i) => i.producto_id).map((i) => cargarValoraciones(i.producto_id!)),
    ).then((resultados) => {
      if (!activo) return;
      const todas = resultados.flat();
      setValoraciones(todas.filter((v) => v.pedido_id === p.id));
    });
    return () => {
      activo = false;
    };
  }, [entregado, p.id, p.items]);

  const itemsCalificables = (p.items ?? []).filter((i) => i.producto_id);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-primary">{p.numero_comanda}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(p.creado_en).toLocaleString("es-CO")}
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {ESTADO_ICON[p.estado] ?? <Clock className="size-5" />}
          {ESTADO_LABEL_CLIENTE[p.estado as keyof typeof ESTADO_LABEL_CLIENTE] ?? p.estado}
        </span>
      </div>

      {p.estado !== "cancelado" && (
        <ol className="mt-4 space-y-2">
          {ESTADOS_FLUJO.map((e, i) => (
            <li key={e} className="flex items-center gap-3">
              <span
                className={`size-2.5 rounded-full ${
                  i <= idxActual ? "bg-brasa shadow-glow" : "bg-secondary"
                }`}
              />
              <span className={i <= idxActual ? "text-foreground" : "text-muted-foreground"}>
                {ESTADO_LABEL_CLIENTE[e]}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-xl">
        <span>Total</span>
        <span className="text-primary">{formatCOP(p.total)}</span>
      </div>

      {(p.estado === "pendiente_confirmacion_cajera" || p.estado === "pendiente_pago") && (
        <a
          href={linkPago(p as never)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow"
        >
          <MessageCircle className="size-5" /> Pagar ahora · {formatCOP(p.total)}
        </a>
      )}

      {/* El cliente solo puede descargar la factura cuando el pago ya fue confirmado */}
      {["pago_confirmado", "en_cocina", "en_preparacion", "en_camino", "entregado"].includes(
        p.estado,
      ) && (
        <button
          onClick={() => void descargarFactura(p as never)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-3 font-display text-xl text-primary transition-colors hover:bg-primary/20"
        >
          <Printer className="size-5" /> Descargar factura
        </button>
      )}

      {/* Califica tu pedido — solo cuando el pedido fue entregado. Cada plato se califica por separado. */}
      {entregado && itemsCalificables.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs tracking-widest text-muted-foreground uppercase">
            <Star className="size-3.5 text-primary" /> Califica tu pedido
          </p>
          <div className="space-y-3">
            {itemsCalificables.map((item) =>
              valoraciones.some((v) => v.producto_id === item.producto_id) ? (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm">
                    {item.cantidad}x {item.nombre}
                  </span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    ✓ Calificado
                  </span>
                </div>
              ) : (
                <CalificarPlatoItem
                  key={item.key}
                  pedido={p}
                  item={item}
                  telefono={telefono}
                  onValorado={(v) => setValoraciones((prev) => [...prev, v])}
                />
              ),
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function CalificarPlatoItem({
  pedido,
  item,
  telefono,
  onValorado,
}: {
  pedido: PedidoDb;
  item: PedidoItemNormalizado;
  telefono: string | null;
  onValorado: (v: ValoracionDb) => void;
}) {
  const [calificacionLocal, setCalificacionLocal] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  if (!item.producto_id || pedido.estado !== "entregado") return null;
  const productoId = item.producto_id;

  async function enviar() {
    if (calificacionLocal < 1) {
      setError("Selecciona al menos 1 estrella.");
      return;
    }
    if (!telefono) {
      setError("No pudimos verificar tu teléfono. Recarga la página.");
      return;
    }
    setEnviando(true);
    setError("");
    const res = await crearValoracion({
      pedido_id: pedido.id,
      producto_id: productoId,
      cliente_nombre: pedido.cliente_nombre,
      cliente_telefono: telefono,
      calificacion: calificacionLocal,
      ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
    });
    setEnviando(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar la valoración. Intenta de nuevo.");
      return;
    }

    onValorado({
      id: crypto.randomUUID(),
      pedido_id: pedido.id,
      pedido_item_id: null,
      producto_id: productoId,
      cliente_nombre: pedido.cliente_nombre,
      cliente_telefono: telefono,
      calificacion: calificacionLocal,
      comentario: comentario.trim() || null,
      creado_en: new Date().toISOString(),
    });
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="font-semibold">{item.nombre}</p>
      <p className="text-xs text-muted-foreground">Pedido {pedido.numero_comanda}</p>

      <div className="mt-3 flex flex-col items-center gap-1">
        <StarRating
          value={calificacionLocal}
          tamano={30}
          interactive
          onChange={setCalificacionLocal}
        />
        <p className="text-xs text-muted-foreground">
          {calificacionLocal > 0
            ? `${calificacionLocal} ${calificacionLocal === 1 ? "estrella" : "estrellas"}`
            : "Toca las estrellas para calificar"}
        </p>
      </div>

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        placeholder="Cuéntanos qué tal estuvo (opcional)…"
        className="mt-3 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <button
        onClick={() => void enviar()}
        disabled={enviando}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brasa py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        <Send className="size-4" />
        {enviando ? "Enviando…" : "Enviar valoración"}
      </button>
    </div>
  );
}
