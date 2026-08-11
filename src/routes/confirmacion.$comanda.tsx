import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import { useStore } from "@/lib/store";
import { Model3DPlaceholder } from "@/components/Model3DPlaceholder";
import { linkConfirmacionDomicilio } from "@/lib/documentos";

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

  // Confeti de celebración al cargar la pantalla
  useEffect(() => {
    let activo = true;
    let limpiar: (() => void) | undefined;

    // Import dinámico para no bloquear el bundle inicial ni la carga de los modelos 3D
    import("canvas-confetti").then((mod) => {
      if (!activo) return;
      const confetti = mod.default;

      // Estallido central
      confetti({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#f5c542", "#e8a020", "#d97706", "#fbbf24", "#fde68a"],
        zIndex: 9999,
      });

      // Lluvia lateral izquierda
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 60,
          origin: { x: 0, y: 0.7 },
          colors: ["#f5c542", "#e8a020", "#d97706", "#fbbf24", "#fde68a"],
          zIndex: 9999,
        });
      }, 250);

      // Lluvia lateral derecha
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 60,
          origin: { x: 1, y: 0.7 },
          colors: ["#f5c542", "#e8a020", "#d97706", "#fbbf24", "#fde68a"],
          zIndex: 9999,
        });
      }, 500);

      // Última ráfaga arriba
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.2 },
          colors: ["#f5c542", "#e8a020", "#d97706", "#fbbf24", "#fde68a"],
          zIndex: 9999,
        });
      }, 800);
    });

    return () => {
      activo = false;
      limpiar?.();
    };
  }, []);

  if (!pedido) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-primary">No encontramos esa comanda</h1>
        <Link
          to="/menu"
          className="rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground"
        >
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
        <div className="animate-entrada-modelo">
          <Model3DPlaceholder src="/Medalla.glb" label="Medalla" size="sm" />
        </div>
        <div className="animate-entrada-modelo-delay">
          <Model3DPlaceholder src="/Corona.glb" label="Corona" size="sm" />
        </div>
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

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left text-sm">
        <Clock className="size-5 shrink-0 text-primary" />
        <p>
          La caja está confirmando el valor del domicilio. En unos minutos podrás pagar desde la
          pantalla de seguimiento de tu pedido.
        </p>
      </div>

      {pedido.estado === "pendiente_confirmacion_cajera" && (
        <a
          href={linkConfirmacionDomicilio(pedido)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-brasa py-4 font-display text-2xl text-primary-foreground shadow-glow"
        >
          <MessageCircle className="size-6" /> Enviar para confirmación de domicilio
        </a>
      )}

      <Link
        to="/pedido/$numero_comanda"
        params={{ numero_comanda: pedido.numero_comanda }}
        className="mt-6 block rounded-2xl bg-brasa py-4 text-center font-display text-2xl text-primary-foreground shadow-glow"
      >
        Ver estado de mi pedido
      </Link>
      <p className="mt-2 text-xs text-muted-foreground">
        Guárdate el número de comanda. También puedes consultarlo desde cualquier dispositivo con tu
        número de teléfono.
      </p>
    </main>
  );
}
