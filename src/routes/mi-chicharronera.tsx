import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Truck, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import { getClienteLocal } from "@/lib/clientes";
import { usePedidosRealtime, type PedidoDb } from "@/lib/use-pedidos";

export const Route = createFileRoute("/mi-chicharronera")({
  head: () => ({
    meta: [
      { title: "Mi Chicharronera | Tremendo Chicharrón" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MiChicharronera,
});


const ESTADO_LABEL: Record<string, string> = {
  pendiente_confirmacion_cajera: "Esperando confirmación de la caja",
  pendiente_pago: "Pendiente de pago",
  pago_confirmado: "Pago confirmado",
  en_cocina: "En cocina",
  en_preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

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
    if (cliente) setTelefono(cliente.telefono);
  }, []);
  const { pedidos, cargando } = usePedidosRealtime({ telefono: cliente?.telefono ?? null });

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
        <Link to="/menu" className="rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground">
          Ver el menú
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16">
      <header className="flex items-center gap-3 py-4">
        <Link to="/" className="text-muted-foreground" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-3xl text-primary">Mi Chicharronera</h1>
      </header>

      {pedidos.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">No tienes pedidos registrados.</p>
          <Link to="/menu" className="mt-4 inline-block rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground">
            Hacer un pedido
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-primary">{p.numero_comanda}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.creado_en).toLocaleString("es-CO")}
                  </p>
                </div>
                <span className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {ESTADO_ICON[p.estado] ?? <Clock className="size-5" />}
                  {ESTADO_LABEL[p.estado] ?? p.estado}
                </span>
              </div>

              <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-xl">
                <span>Total</span>
                <span className="text-primary">{formatCOP(p.total)}</span>
              </div>

              {p.estado === "pendiente_pago" && (
                <Link
                  to="/pedido/$numero_comanda"
                  params={{ numero_comanda: p.numero_comanda }}
                  className="mt-3 block rounded-2xl bg-brasa py-3 text-center font-display text-xl text-primary-foreground shadow-glow"
                >
                  Ir a Pagar · {formatCOP(p.total)}
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}