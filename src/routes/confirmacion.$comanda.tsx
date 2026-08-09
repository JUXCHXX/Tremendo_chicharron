import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import { useStore } from "@/lib/store";
import { linkPago, descargarFactura } from "@/lib/documentos";
import { Model3DPlaceholder } from "@/components/Model3DPlaceholder";

export const Route = createFileRoute("/confirmacion/$comanda")({
  head: () => ({
    meta: [
      { title: "Pedido registrado | Tremendo Chicharrón" },
      {
        name: "description",
        content: "Tu pedido quedó registrado. Confirma el pago por WhatsApp y sigue su progreso.",
      },
      { property: "og:title", content: "Pedido registrado | Tremendo Chicharrón" },
      { property: "og:description", content: "Confirma el pago por WhatsApp y sigue tu pedido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Confirmacion,
});

function Confirmacion() {
  const { comanda } = Route.useParams();
  const pedido = useStore((s) => s.pedidos.find((p) => p.numero_comanda === comanda) ?? null);

  if (!pedido) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-primary">No encontramos esa comanda</h1>
        <Link to="/menu" className="rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground">
          Volver al menú
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 text-center">
      <CheckCircle2 className="mx-auto size-14 text-primary" />
      <h1 className="mt-4 font-display text-4xl text-gradient-brasa">
        ¡Pedido registrado en la plataforma!
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu número de comanda es
        <span className="ml-1 font-display text-2xl text-primary">{pedido.numero_comanda}</span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Model3DPlaceholder src="/Medalla.fbx" label="Medalla" size="sm" />
        <Model3DPlaceholder src="/Corona.fbx" label="Corona" size="sm" />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 text-left text-sm">
        {pedido.items.map((i) => (
          <div key={i.key} className="flex justify-between py-1">
            <span>
              {i.cantidad}x {i.nombre}
              {i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}
            </span>
            <span className="text-primary">{formatCOP(i.precio_unitario * i.cantidad)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-2xl">
          <span>Total</span>
          <span className="text-primary">{formatCOP(pedido.total)}</span>
        </div>
        {pedido.medio_pago === "efectivo" && pedido.monto_efectivo_recibido != null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Pagas con {formatCOP(pedido.monto_efectivo_recibido)} · Vuelto{" "}
            {formatCOP(Math.max(pedido.vuelto ?? 0, 0))}
          </p>
        )}
      </section>

      <a
        href={linkPago(pedido)}
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-brasa py-4 font-display text-2xl text-primary-foreground shadow-glow"
      >
        <MessageCircle className="size-6" /> Ir a Pagar
      </a>
      <p className="mt-2 text-xs text-muted-foreground">
        Se abre WhatsApp con el detalle de tu comanda. El pedido se cancela automáticamente si no se
        confirma el pago en 30 minutos.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          to="/progreso"
          search={{ comanda: pedido.numero_comanda }}
          className="rounded-2xl border border-primary/40 py-3 font-display text-lg text-primary"
        >
          Ver progreso
        </Link>
        <button
          onClick={() => descargarFactura(pedido)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3 font-display text-lg"
        >
          <img src="/descargarfactura.png" alt="" className="size-6 rounded" />
          Factura
        </button>
      </div>
    </main>
  );
}