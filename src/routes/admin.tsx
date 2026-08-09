import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, RefreshCcw } from "lucide-react";
import { estaAutenticado, cerrarSesion } from "@/lib/auth-staff";
import { formatCOP } from "@/lib/menu-data";
import {
  ESTADOS_FLUJO,
  ESTADO_LABEL,
  autoCancelar,
  cambiarEstado,
  confirmarDomicilio,
  editarComanda,
  setDomicilio,
  useStore,
  type EstadoPedido,
} from "@/lib/store";
import { imprimirComanda } from "@/lib/documentos";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const ok = await estaAutenticado("caja");
    if (!ok) {
      throw redirect({ to: "/admin/login", search: { from: location.href } });
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

const FILTROS: ("todos" | EstadoPedido)[] = [
  "todos",
  "pendiente_confirmacion_cajera",
  ...ESTADOS_FLUJO,
  "cancelado",
];

function Admin() {
  const navigate = useNavigate();
  const pedidos = useStore((s) => s.pedidos);
  const [filtro, setFiltro] = useState<"todos" | EstadoPedido>("todos");


  // Cron local: revisa cada minuto los pedidos vencidos (en producción lo hace
  // la Scheduled Function de Supabase definida en /database/03_cron.sql).
  useEffect(() => {
    const t = setInterval(autoCancelar, 60000);
    return () => clearInterval(t);
  }, []);

  const lista = pedidos.filter((p) => filtro === "todos" || p.estado === filtro);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <h1 className="font-display text-4xl text-primary">Panel de caja</h1>
          <p className="text-xs text-muted-foreground">
            Pedidos entrantes, confirmación de pago y comandas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            ← Inicio
          </Link>
          <button
            onClick={() => {
              void cerrarSesion();
              void navigate({ to: "/admin/login" });
            }}
            className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filtro === f ? "bg-brasa text-primary-foreground" : "border border-border bg-card"
            }`}
          >
            {f === "todos" ? "Todos" : ESTADO_LABEL[f]}
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">No hay pedidos en este filtro.</p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {lista.map((pd) => (
          <article key={pd.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl text-primary">{pd.numero_comanda}</p>
                <p className="text-xs text-muted-foreground">
                  v{pd.version} · {new Date(pd.creado_en).toLocaleString("es-CO")}
                </p>
              </div>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {ESTADO_LABEL[pd.estado]}
              </span>
            </div>

            <div className="mt-3 text-sm">
              <p>
                <b>{pd.cliente_nombre}</b> · {pd.cliente_telefono}
              </p>
              <p className="text-muted-foreground">{pd.direccion_entrega}</p>
            </div>

            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              {pd.items.map((i) => (
                <li key={i.key} className="flex justify-between gap-2">
                  <span>
                    {i.cantidad}x {i.nombre}
                    {i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}
                    {i.combo ? " + combo" : ""}
                    {i.notas && (
                      <em className="block text-xs text-muted-foreground">Nota: {i.notas}</em>
                    )}
                  </span>
                  <span className="text-primary">{formatCOP(i.precio_unitario * i.cantidad)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
              <label className="flex items-center gap-2">
                Domicilio
                <input
                  data-domicilio={pd.id}
                  type="number"
                  defaultValue={pd.valor_domicilio}
                  onBlur={(e) => setDomicilio(pd.id, Number(e.target.value) || 0)}
                  className="w-24 rounded-lg bg-input p-1.5 text-sm outline-none"
                />
              </label>
              <span className="ml-auto font-display text-2xl text-primary">
                {formatCOP(pd.total)}
              </span>
            </div>

            {pd.estado === "pendiente_confirmacion_cajera" && (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  Confirma el valor del domicilio para pasar el pedido a pendiente de pago y
                  habilitar el botón "Ir a Pagar" del cliente.
                </p>
                <button
                  onClick={() => {
                    const valorInput = document.querySelector<HTMLInputElement>(
                      `input[data-domicilio="${pd.id}"]`,
                    );
                    confirmarDomicilio(pd.id, Number(valorInput?.value) || 0);
                  }}
                  className="mt-2 rounded-xl bg-brasa px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Confirmar domicilio y pasar a pago
                </button>
              </div>
            )}

            <p className="mt-1 text-xs text-muted-foreground">
              Pago: {pd.medio_pago}
              {pd.monto_efectivo_recibido != null &&
                ` · Recibe ${formatCOP(pd.monto_efectivo_recibido)} · Vuelto ${formatCOP(Math.max(pd.vuelto ?? 0, 0))}`}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {pd.estado === "pendiente_pago" && (
                <button
                  onClick={() => cambiarEstado(pd.id, "pago_confirmado")}
                  className="rounded-xl bg-brasa px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Confirmar pago
                </button>
              )}
              {ESTADOS_FLUJO.slice(2).map((e) => (
                <button
                  key={e}
                  onClick={() => cambiarEstado(pd.id, e)}
                  className="rounded-xl border border-border px-3 py-2 text-xs"
                >
                  {ESTADO_LABEL[e]}
                </button>
              ))}
              <button
                onClick={() => imprimirComanda(pd)}
                className="flex items-center gap-1 rounded-xl border border-primary/40 px-3 py-2 text-xs text-primary"
              >
                <Printer className="size-3.5" /> Comanda
              </button>
              <button
                onClick={() => {
                  editarComanda(pd.id, pd.items, "Reimpresión: versión anterior anulada");
                  imprimirComanda({ ...pd, version: pd.version + 1 });
                }}
                className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs"
                title="Anula la versión anterior y reimprime con el mismo número"
              >
                <RefreshCcw className="size-3.5" /> Reimprimir (anula anterior)
              </button>
              <button
                onClick={() => cambiarEstado(pd.id, "cancelado")}
                className="rounded-xl border border-destructive/50 px-3 py-2 text-xs text-destructive"
              >
                Cancelar
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
