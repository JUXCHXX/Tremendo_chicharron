import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Clock, Printer } from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import {
  ESTADOS_FLUJO,
  ESTADO_LABEL_CLIENTE,
  editarComanda,
  puedeEditarCliente,
  useStore,
  type Pedido,
} from "@/lib/store";
import { descargarFactura } from "@/lib/documentos";

export const Route = createFileRoute("/progreso")({
  validateSearch: (s: Record<string, unknown>) => ({ comanda: (s["comanda"] as string) ?? "" }),
  head: () => ({
    meta: [
      { title: "Progreso de tu pedido | Tremendo Chicharrón" },
      {
        name: "description",
        content: "Consulta en tiempo real el estado de tu pedido con tu número de comanda.",
      },
      { property: "og:title", content: "Progreso de tu pedido | Tremendo Chicharrón" },
      { property: "og:description", content: "Sigue tu pedido paso a paso hasta la entrega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Progreso,
});

function Progreso() {
  const { comanda } = Route.useSearch();
  const [busqueda, setBusqueda] = useState(comanda);
  const pedido = useStore(
    (s) =>
      s.pedidos.find((p) => p.numero_comanda.toLowerCase() === busqueda.trim().toLowerCase()) ??
      null,
  );

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16">
      <header className="flex items-center gap-3 py-4">
        <Link to="/" className="text-muted-foreground" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-3xl text-primary">Progreso del pedido</h1>
      </header>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Escribe tu número de comanda (TC-...)"
        className="w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      {!pedido && busqueda.trim() && (
        <p className="mt-4 text-sm text-muted-foreground">No encontramos esa comanda.</p>
      )}

      {pedido && <DetallePedido pedido={pedido} />}
    </main>
  );
}

function DetallePedido({ pedido }: { pedido: Pedido }) {
  const editable = puedeEditarCliente(pedido);
  const minutosRestantes = Math.max(
    0,
    Math.ceil((new Date(pedido.editable_hasta).getTime() - Date.now()) / 60000),
  );
  const idxActual = ESTADOS_FLUJO.indexOf(pedido.estado);

  return (
    <>
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="font-display text-3xl text-primary">{pedido.numero_comanda}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <img src="/tiempoestimado.png" alt="" className="size-5 rounded" />
          Tiempo estimado de entrega: 35–50 min
        </p>

        {pedido.estado === "cancelado" ? (
          <p className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Este pedido fue cancelado.
          </p>
        ) : (
          <ol className="mt-5 space-y-3">
            {ESTADOS_FLUJO.map((e, i) => (
              <li key={e} className="flex items-center gap-3">
                <span
                  className={`size-3 rounded-full ${
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
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
        {pedido.items.map((i) => (
          <div key={i.key} className="flex justify-between py-1">
            <span>
              {i.cantidad}x {i.nombre}
            </span>
            <span className="text-primary">{formatCOP(i.precio_unitario * i.cantidad)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-2">
          <span>Domicilio</span>
          <span>{formatCOP(pedido.valor_domicilio)}</span>
        </div>
        <div className="flex justify-between font-display text-2xl">
          <span>Total</span>
          <span className="text-primary">{formatCOP(pedido.total)}</span>
        </div>
      </section>

      {editable ? (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-2 font-display text-xl text-primary">
            <img src="/editarcomanda.png" alt="" className="size-6 rounded" />
            Puedes editar tu comanda
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> Quedan {minutosRestantes} min de la ventana de edición.
          </p>
          <div className="mt-3 space-y-2">
            {pedido.items.map((i) => (
              <div key={i.key} className="flex items-center justify-between text-sm">
                <span>{i.nombre}</span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-border px-2"
                    onClick={() =>
                      editarComanda(
                        pedido.id,
                        pedido.items
                          .map((x) => (x.key === i.key ? { ...x, cantidad: x.cantidad - 1 } : x))
                          .filter((x) => x.cantidad > 0),
                      )
                    }
                  >
                    −
                  </button>
                  <span>{i.cantidad}</span>
                  <button
                    className="rounded-full border border-border px-2"
                    onClick={() =>
                      editarComanda(
                        pedido.id,
                        pedido.items.map((x) =>
                          x.key === i.key ? { ...x, cantidad: x.cantidad + 1 } : x,
                        ),
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/menu"
            className="mt-3 block rounded-xl border border-primary/40 py-2 text-center text-sm text-primary"
          >
            Agregar más productos
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          La ventana de edición de 10 minutos terminó. Si necesitas cambiar algo, comunícate
          directamente con la caja por WhatsApp.
        </p>
      )}

      {/* El cliente solo puede descargar la factura cuando el pago ya fue confirmado */}
      {["pago_confirmado", "en_cocina", "en_preparacion", "en_camino", "entregado"].includes(
        pedido.estado,
      ) && (
        <button
          onClick={() => void descargarFactura(pedido)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-3 font-display text-xl text-primary transition-colors hover:bg-primary/20"
        >
          <Printer className="size-5" />
          Descargar factura
        </button>
      )}
    </>
  );
}
