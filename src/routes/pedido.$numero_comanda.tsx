import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Search, MessageCircle, Printer } from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import { supabase } from "@/lib/supabase";
import { linkPago, descargarFactura } from "@/lib/documentos";
import { ESTADOS_FLUJO, ESTADO_LABEL_CLIENTE, type Pedido } from "@/lib/store";

export const Route = createFileRoute("/pedido/$numero_comanda")({
  head: () => ({
    meta: [
      { title: "Consultar pedido | Tremendo Chicharrón" },
      {
        name: "description",
        content: "Consulta el estado de tu pedido con tu número de comanda y teléfono.",
      },
      { property: "og:title", content: "Consultar pedido | Tremendo Chicharrón" },
      { property: "og:description", content: "Sigue tu pedido paso a paso hasta la entrega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsultarPedido,
});

function ConsultarPedido() {
  const { numero_comanda } = Route.useParams();
  const [telefono, setTelefono] = useState("");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  // Estrategia única: polling por la RPC segura. La RPC valida comanda y
  // teléfono sin exponer pedidos ajenos y sí puede usar el header esperado.
  useEffect(() => {
    if (!supabase || !pedido || !telefono.trim()) return;
    if (pedido.estado === "entregado" || pedido.estado === "cancelado") return;

    let activo = true;
    const actualizar = async () => {
      const { data, error: err } = await supabase.rpc("consultar_pedido_por_comanda_y_telefono", {
        p_numero_comanda: numero_comanda,
        p_telefono: telefono.trim(),
      });
      if (!activo || err || !data) return;
      const pedidoRaw = (data as { pedido: Record<string, unknown> }).pedido;
      const itemsRaw = (data as { items?: Record<string, unknown>[] }).items ?? [];
      setPedido(convertirPedido(pedidoRaw, itemsRaw));
    };

    const intervalo = setInterval(() => void actualizar(), 4_000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [numero_comanda, pedido, pedido?.id, pedido?.estado, telefono]);

  async function consultar() {
    if (telefono.trim().length < 7) {
      setError("Ingresa el teléfono con el que hiciste el pedido.");
      return;
    }
    setCargando(true);
    setError("");
    setPedido(null);
    setConsultado(false);

    try {
      if (!supabase) {
        setError("La consulta en línea no está disponible en este momento.");
        return;
      }
      // Consulta pública segura vía RPC: valida que numero_comanda y telefono
      // coincidan antes de devolver el pedido (nunca expone pedidos ajenos).
      const { data, error: err } = await supabase.rpc("consultar_pedido_por_comanda_y_telefono", {
        p_numero_comanda: numero_comanda,
        p_telefono: telefono.trim(),
      });

      if (err) throw err;
      if (!data) {
        setError("No encontramos un pedido con ese número de comanda y teléfono.");
        return;
      }

      const pedidoRaw = (
        data as { pedido: Record<string, unknown>; items: Record<string, unknown>[] }
      ).pedido;
      const itemsRaw = (
        data as { pedido: Record<string, unknown>; items: Record<string, unknown>[] }
      ).items;
      const pedidoObj = pedidoRaw as unknown as Record<string, unknown>;

      setPedido(convertirPedido(pedidoObj, itemsRaw));
      setConsultado(true);
    } catch {
      setError("Ocurrió un error al consultar. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16">
      <header className="flex items-center gap-3 py-4">
        <Link to="/" className="text-muted-foreground" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-3xl text-primary">Consultar pedido</h1>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-2xl text-primary">{numero_comanda}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Para ver el estado, confirma el teléfono con el que hiciste el pedido.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Tu teléfono"
            type="tel"
            inputMode="tel"
            className="flex-1 rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => void consultar()}
            disabled={cargando}
            className="flex items-center gap-2 rounded-xl bg-brasa px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Search className="size-4" />
            {cargando ? "Buscando…" : "Consultar"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      {pedido && <DetallePedido pedido={pedido} />}
    </main>
  );
}

function convertirPedido(
  pedidoObj: Record<string, unknown>,
  itemsRaw: Record<string, unknown>[],
): Pedido {
  return {
    id: String(pedidoObj["id"]),
    numero_comanda: String(pedidoObj["numero_comanda"]),
    cliente_nombre: String(pedidoObj["cliente_nombre"]),
    cliente_telefono: String(pedidoObj["cliente_telefono"]),
    direccion_entrega: String(pedidoObj["direccion_entrega"]),
    barrio: pedidoObj["barrio"] != null ? String(pedidoObj["barrio"]) : null,
    latitud: pedidoObj["latitud"] != null ? Number(pedidoObj["latitud"]) : null,
    longitud: pedidoObj["longitud"] != null ? Number(pedidoObj["longitud"]) : null,
    medio_pago: pedidoObj["medio_pago"] as Pedido["medio_pago"],
    monto_efectivo_recibido:
      pedidoObj["monto_efectivo_recibido"] != null
        ? Number(pedidoObj["monto_efectivo_recibido"])
        : null,
    vuelto: pedidoObj["vuelto"] != null ? Number(pedidoObj["vuelto"]) : null,
    valor_domicilio: Number(pedidoObj["valor_domicilio"] ?? 0),
    propina: Number(pedidoObj["propina"] ?? 0),
    subtotal: Number(pedidoObj["subtotal"] ?? 0),
    total: Number(pedidoObj["total"] ?? 0),
    estado: pedidoObj["estado"] as Pedido["estado"],
    creado_en: String(pedidoObj["creado_en"]),
    editable_hasta: String(pedidoObj["editable_hasta"]),
    version: Number(pedidoObj["version"] ?? 1),
    items: itemsRaw.map((i): Pedido["items"][number] => ({
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
}

function DetallePedido({ pedido }: { pedido: Pedido }) {
  const idxActual = ESTADOS_FLUJO.indexOf(pedido.estado);
  const puedePagar =
    pedido.estado === "pendiente_confirmacion_cajera" || pedido.estado === "pendiente_pago";

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
        {pedido.barrio && (
          <div className="flex justify-between pt-1">
            <span>Barrio</span>
            <span>{pedido.barrio}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-border pt-2">
          <span>Domicilio</span>
          <span>{formatCOP(pedido.valor_domicilio)}</span>
        </div>
        {pedido.propina > 0 && (
          <div className="flex justify-between pt-1">
            <span>Propina domiciliario</span>
            <span>{formatCOP(pedido.propina)}</span>
          </div>
        )}
        <div className="flex justify-between font-display text-2xl">
          <span>Total</span>
          <span className="text-primary">{formatCOP(pedido.total)}</span>
        </div>
      </section>

      {puedePagar && (
        <a
          href={linkPago(pedido)}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-brasa py-4 font-display text-2xl text-primary-foreground shadow-glow"
        >
          <MessageCircle className="size-6" /> Ir a Pagar
        </a>
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
