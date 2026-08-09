import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Power, AlertTriangle, FileSpreadsheet, FileText } from "lucide-react";
import { estaAutenticado, cerrarSesion } from "@/lib/auth-staff";
import { CATEGORIAS, PRODUCTOS, PROMOCIONES, formatCOP } from "@/lib/menu-data";
import {
  ESTADOS_FLUJO,
  ESTADO_LABEL,
  marcarRespaldo,
  setPrecio,
  toggleAgotado,
  toggleNegocio,
  useStore,
} from "@/lib/store";
import { descargarExcel, descargarPdfReporte } from "@/lib/documentos";

export const Route = createFileRoute("/superadmin")({
  head: () => ({
    meta: [
      { title: "Panel del dueño | Tremendo Chicharrón" },
      {
        name: "description",
        content: "Gestión de menú, disponibilidad, promociones, estadísticas y reportes mensuales.",
      },
      { property: "og:title", content: "Panel del dueño | Tremendo Chicharrón" },
      { property: "og:description", content: "Control total del menú y de las ventas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperAdmin,
});

function SuperAdmin() {
  const navigate = useNavigate();
  const pedidos = useStore((s) => s.pedidos);
  const config = useStore((s) => s.config);
  const [tab, setTab] = useState<"menu" | "estadisticas" | "promos">("menu");

  // Si no hay sesión activa, redirige al login.
  useEffect(() => {
    if (!estaAutenticado("dueno")) {
      void navigate({ to: "/superadmin/login" });
    }
  }, [navigate]);

  const stats = useMemo(() => {
    const validos = pedidos.filter((p) => p.estado !== "cancelado");
    const ventas = validos.reduce((a, p) => a + p.total, 0);
    const porEstado = ESTADOS_FLUJO.concat("cancelado").map((e) => ({
      estado: e,
      cantidad: pedidos.filter((p) => p.estado === e).length,
    }));
    const conteo = new Map<string, number>();
    validos.forEach((p) =>
      p.items.forEach((i) => conteo.set(i.nombre, (conteo.get(i.nombre) ?? 0) + i.cantidad)),
    );
    const top = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      ventas,
      pedidos: validos.length,
      ticket: validos.length ? Math.round(ventas / validos.length) : 0,
      porEstado,
      top,
    };
  }, [pedidos]);

  const diasSinRespaldo = config.ultimo_respaldo
    ? Math.floor((Date.now() - new Date(config.ultimo_respaldo).getTime()) / 86400000)
    : null;
  const alertaRespaldo = diasSinRespaldo === null || diasSinRespaldo >= 30;

  const filasReporte = (): string[][] => [
    ["Métrica", "Valor"],
    ["Total de ventas", formatCOP(stats.ventas)],
    ["Pedidos válidos", String(stats.pedidos)],
    ["Ticket promedio", formatCOP(stats.ticket)],
    ...stats.porEstado.map((e) => [`Pedidos ${ESTADO_LABEL[e.estado]}`, String(e.cantidad)]),
    ...stats.top.map(([nombre, cant]) => [`Vendido: ${nombre}`, String(cant)]),
  ];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <h1 className="font-display text-4xl text-primary">Panel del dueño</h1>
          <p className="text-xs text-muted-foreground">Menú, disponibilidad y estadísticas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleNegocio}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              config.negocio_abierto
                ? "bg-brasa text-primary-foreground"
                : "border border-destructive/50 text-destructive"
            }`}
          >
            <Power className="size-4" />
            {config.negocio_abierto ? "Negocio abierto" : "Negocio cerrado"}
          </button>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            ← Inicio
          </Link>
          <button
            onClick={() => {
              cerrarSesion("dueno");
              void navigate({ to: "/superadmin/login" });
            }}
            className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {alertaRespaldo && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <AlertTriangle className="size-5 text-primary" />
          <span className="flex-1">
            Recuerda exportar y respaldar el histórico de pedidos para no saturar la base de datos.
            {diasSinRespaldo !== null && ` Último respaldo hace ${diasSinRespaldo} días.`}
          </span>
          <button
            onClick={marcarRespaldo}
            className="rounded-xl bg-brasa px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Ya respaldé
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {(["menu", "estadisticas", "promos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === t ? "bg-brasa text-primary-foreground" : "border border-border bg-card"
            }`}
          >
            {t === "menu" ? "Menú" : t === "estadisticas" ? "Estadísticas" : "Promociones"}
          </button>
        ))}
      </div>

      {tab === "menu" && (
        <div className="mt-5 space-y-8">
          {CATEGORIAS.map((c) => (
            <section key={c.id}>
              <h2 className="font-display text-2xl text-primary">{c.nombre}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {PRODUCTOS.filter((p) => p.categoria_id === c.id).map((p) => {
                  const agotado = config.agotados.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="flex-1">
                        <p className="font-semibold">{p.nombre}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {p.descripcion}
                        </p>
                      </div>
                      <input
                        type="number"
                        defaultValue={config.precios[p.id] ?? p.precio ?? 0}
                        onBlur={(e) => setPrecio(p.id, Number(e.target.value) || 0)}
                        className="w-24 rounded-lg bg-input p-1.5 text-sm outline-none"
                        aria-label={`Precio de ${p.nombre}`}
                      />
                      <button
                        onClick={() => toggleAgotado(p.id)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                          agotado
                            ? "bg-destructive text-destructive-foreground"
                            : "border border-border"
                        }`}
                      >
                        {agotado ? "Agotado" : "Disponible"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "estadisticas" && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi titulo="Ventas" valor={formatCOP(stats.ventas)} />
            <Kpi titulo="Pedidos" valor={String(stats.pedidos)} />
            <Kpi titulo="Ticket promedio" valor={formatCOP(stats.ticket)} />
          </div>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display text-2xl text-primary">Pedidos por estado</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {stats.porEstado.map((e) => (
                <div key={e.estado} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{ESTADO_LABEL[e.estado]}</span>
                  <span>{e.cantidad}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display text-2xl text-primary">Más vendidos</h2>
            {stats.top.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">Aún no hay ventas registradas.</p>
            )}
            {stats.top.map(([nombre, cant]) => (
              <div key={nombre} className="mt-2 flex justify-between text-sm">
                <span>{nombre}</span>
                <span className="text-primary">{cant} und.</span>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                descargarExcel(
                  filasReporte(),
                  `reporte-tremendo-chicharron-${new Date().toISOString().slice(0, 7)}`,
                )
              }
              className="flex items-center gap-2 rounded-xl bg-brasa px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              <FileSpreadsheet className="size-4" /> Exportar Excel
            </button>
            <button
              onClick={() =>
                descargarPdfReporte(
                  `Reporte mensual ${new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" })}`,
                  filasReporte(),
                )
              }
              className="flex items-center gap-2 rounded-xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary"
            >
              <FileText className="size-4" /> Exportar PDF
            </button>
          </div>
        </div>
      )}

      {tab === "promos" && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {PROMOCIONES.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <img src={p.imagen_url} alt="" className="h-32 w-full rounded-xl object-cover" />
              <p className="mt-3 font-display text-2xl text-primary">{p.titulo}</p>
              <p className="text-sm text-muted-foreground">{p.descripcion}</p>
              <p className="mt-2 text-xs tracking-widest uppercase">
                Vigencia: {p.tipo_vigencia} · {p.activa ? "Activa" : "Inactiva"}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-card p-4 shadow-card">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{titulo}</p>
      <p className="font-display text-3xl text-primary">{valor}</p>
    </div>
  );
}