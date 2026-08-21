import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Printer } from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import { useStore, type Pedido } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Model3DPlaceholder } from "@/components/Model3DPlaceholder";
import { linkPago, descargarFactura } from "@/lib/documentos";
import { getClienteLocal, normalizarTelefono } from "@/lib/clientes";

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

/**
 * Lee la comanda persistida en sessionStorage por crearPedido().
 * Es la red de seguridad principal: si el estado local (useStore) no tiene
 * el pedido (recarga, navegación profunda, celular), la pantalla de
 * confirmación SIEMPRE encuentra la comanda recién creada.
 */
function comandaEnSessionStorage(comanda: string): Pedido | null {
  try {
    const raw = sessionStorage.getItem("tremendo-ultima-comanda");
    if (!raw) return null;
    const pd = JSON.parse(raw) as Pedido;
    if (pd.numero_comanda !== comanda) return null;
    return pd;
  } catch {
    return null;
  }
}

/** Consulta pública segura vía RPC (comanda + teléfono). */
async function consultarComanda(comanda: string, telefono: string): Promise<Pedido | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("consultar_pedido_por_comanda_y_telefono", {
      p_numero_comanda: comanda,
      p_telefono: telefono,
    });
    if (error || !data) return null;
    const pedidoRaw = (data as { pedido: Record<string, unknown> }).pedido;
    const itemsRaw = (data as { items: Record<string, unknown>[] }).items ?? [];
    const p = pedidoRaw as Record<string, unknown>;
    const pedido: Pedido = {
      id: String(p["id"]),
      numero_comanda: String(p["numero_comanda"]),
      cliente_nombre: String(p["cliente_nombre"]),
      cliente_telefono: String(p["cliente_telefono"]),
      direccion_entrega: String(p["direccion_entrega"]),
      barrio: p["barrio"] != null ? String(p["barrio"]) : null,
      latitud: p["latitud"] != null ? Number(p["latitud"]) : null,
      longitud: p["longitud"] != null ? Number(p["longitud"]) : null,
      medio_pago: p["medio_pago"] as Pedido["medio_pago"],
      monto_efectivo_recibido:
        p["monto_efectivo_recibido"] != null ? Number(p["monto_efectivo_recibido"]) : null,
      vuelto: p["vuelto"] != null ? Number(p["vuelto"]) : null,
      valor_domicilio: Number(p["valor_domicilio"] ?? 0),
      subtotal: Number(p["subtotal"] ?? 0),
      total: Number(p["total"] ?? 0),
      estado: p["estado"] as Pedido["estado"],
      creado_en: String(p["creado_en"]),
      editable_hasta: String(p["editable_hasta"]),
      version: Number(p["version"] ?? 1),
      items: (itemsRaw ?? []).map((i: Record<string, unknown>) => ({
        key: String(i["id"]),
        producto_id: i["producto_id"] ? String(i["producto_id"]) : "",
        nombre: String(i["nombre_producto"]),
        cantidad: Number(i["cantidad"] ?? 0),
        variante_personas: i["variante_personas"] != null ? Number(i["variante_personas"]) : null,
        notas: String(i["notas"] ?? ""),
        precio_unitario: Number(i["precio_unitario"] ?? 0),
        combo: Boolean(i["combo"]),
      })),
    };
    return pedido;
  } catch {
    return null;
  }
}

/**
 * Vista del CLIENTE (pantalla de celebración):
 *  - SIEMPRE muestra "¡Pedido registrado en la plataforma!" + número de comanda + confeti.
 *  - El estado interno del pedido (pendiente_confirmacion_cajera, etc.) NUNCA se
 *    muestra aquí. Solo se usa para decidir si mostrar el botón "Ir a Pagar".
 *  - Si el pedido no está en el store local, se busca en sessionStorage y luego
 *    en la BD (comanda + teléfono del cliente guardado).
 */
function Confirmacion() {
  const { comanda } = Route.useParams();
  const pedidoStore = useStore((s) => s.pedidos.find((p) => p.numero_comanda === comanda) ?? null);
  const [pedidoExtra, setPedidoExtra] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);

  // Sincroniza: primero sessionStorage, luego BD.
  useEffect(() => {
    let activo = true;

    async function buscar() {
      const deSession = comandaEnSessionStorage(comanda);
      if (deSession) {
        if (activo) setPedidoExtra(deSession);
        return;
      }

      const cliente = getClienteLocal();
      const telefono = cliente ? normalizarTelefono(cliente.telefono) : "";
      if (telefono) {
        const deDb = await consultarComanda(comanda, telefono);
        if (activo) setPedidoExtra(deDb);
      }
    }

    void buscar().finally(() => {
      if (activo) setCargando(false);
    });

    return () => {
      activo = false;
    };
  }, [comanda]);

  const pedido = pedidoStore ?? pedidoExtra;

  // Confeti de celebración al cargar la pantalla — SIEMPRE, incluso si aún
  // estamos buscando el pedido en la BD. La confirmación es del cliente.
  useEffect(() => {
    let activo = true;

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
    };
  }, []);

  // La pantalla de confirmación del cliente NUNCA debe ser un callejón sin
  // salida: incluso si el pedido no está disponible en ninguna fuente, el
  // cliente ve la confirmación con su número de comanda (que sí está en la URL).
  if (!pedido) {
    if (cargando) {
      return (
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <CheckCircle2 className="mx-auto size-14 animate-pulse text-primary" />
          <h1 className="mt-4 font-display text-4xl text-gradient-brasa">
            ¡Pedido registrado en la plataforma!
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu número de comanda es
            <span className="ml-1 font-display text-2xl text-primary">{comanda}</span>
          </p>
          <p className="text-xs text-muted-foreground">Cargando detalles…</p>
        </main>
      );
    }

    // Sin datos: aún mostramos la confirmación (comanda de la URL) en lugar de
    // "No encontramos esa comanda" — la info de gestión NO es bloqueante aquí.
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-10 text-center">
        <CheckCircle2 className="mx-auto size-14 text-primary" />
        <h1 className="mt-4 font-display text-4xl text-gradient-brasa">
          ¡Pedido registrado en la plataforma!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu número de comanda es
          <span className="ml-1 font-display text-2xl text-primary">{comanda}</span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="animate-entrada-modelo">
            <Model3DPlaceholder src="/Medalla.glb" label="Medalla" size="sm" />
          </div>
          <div className="animate-entrada-modelo-delay">
            <Model3DPlaceholder src="/Corona.glb" label="Corona" size="sm" />
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Estamos preparando todo. El restaurante te contactará por WhatsApp para confirmar el pago
          y el domicilio.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Guárdate el número de comanda. También puedes consultarlo desde cualquier dispositivo con
          tu número de teléfono.
        </p>
      </main>
    );
  }

  const puedePagar =
    pedido.estado === "pendiente_confirmacion_cajera" || pedido.estado === "pendiente_pago";

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
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
          <span>Domicilio</span>
          <span className="text-primary">{formatCOP(pedido.valor_domicilio)}</span>
        </div>
        <div className="flex justify-between font-display text-2xl">
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

      {puedePagar && (
        <a
          href={linkPago(pedido)}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-brasa py-4 font-display text-2xl text-primary-foreground shadow-glow"
        >
          <MessageCircle className="size-6" /> Ir a Pagar · {formatCOP(pedido.total)}
        </a>
      )}

      {/* El cliente solo puede descargar la factura cuando el pago ya fue confirmado */}
      {["pago_confirmado", "en_cocina", "en_preparacion", "en_camino", "entregado"].includes(
        pedido.estado,
      ) && (
        <button
          onClick={() => void descargarFactura(pedido)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-3 font-display text-xl text-primary transition-colors hover:bg-primary/20"
        >
          <Printer className="size-5" />
          Descargar factura
        </button>
      )}

      <Link
        to="/mi-chicharronera"
        className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-3 font-display text-xl text-primary transition-colors hover:bg-primary/20"
      >
        Ir a mi Chicharronera
      </Link>

      <p className="mt-2 text-xs text-muted-foreground">
        Guárdate el número de comanda. También puedes consultarlo desde cualquier dispositivo con tu
        número de teléfono.
      </p>
    </main>
  );
}
