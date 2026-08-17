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
} from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import { getClienteLocal, normalizarTelefono } from "@/lib/clientes";
import { usePedidosRealtime, type PedidoDb } from "@/lib/use-pedidos";
import { linkPago } from "@/lib/documentos";
import { ESTADOS_FLUJO, ESTADO_LABEL } from "@/lib/store";

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
          Aquí puedes seguir tus pedidos en tiempo real, ver el estado de tu comanda y pagar cuando
          esté pendiente. Si tienes dudas, escríbenos por WhatsApp.
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
            <PedidoCard key={p.id} pedido={p} />
          ))}

          {cancelados.length > 0 && (
            <div className="pt-4">
              <p className="mb-3 text-xs tracking-widest text-muted-foreground uppercase">
                Pedidos cancelados
              </p>
              <div className="space-y-4 opacity-60">
                {cancelados.map((p) => (
                  <PedidoCard key={p.id} pedido={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function PedidoCard({ pedido: p }: { pedido: PedidoDb }) {
  const idxActual = ESTADOS_FLUJO.indexOf(p.estado as (typeof ESTADOS_FLUJO)[number]);

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
          {ESTADO_LABEL[p.estado as keyof typeof ESTADO_LABEL] ?? p.estado}
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
                {ESTADO_LABEL[e]}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-xl">
        <span>Total</span>
        <span className="text-primary">{formatCOP(p.total)}</span>
      </div>

      {p.estado === "pendiente_pago" && (
        <a
          href={linkPago(p as never)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow"
        >
          <MessageCircle className="size-5" /> Pagar ahora · {formatCOP(p.total)}
        </a>
      )}
    </article>
  );
}
