import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Power,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
} from "lucide-react";
import { estaAutenticado, cerrarSesion } from "@/lib/auth-staff";
import { formatCOP } from "@/lib/menu-data";
import { supabase } from "@/lib/supabase";
import { useMenuData, type ProductoDb, type CategoriaDb, type PromocionDb } from "@/lib/use-menu-data";
import { marcarRespaldo, useStore } from "@/lib/store";
import { descargarExcel, descargarPdfReporte } from "@/lib/documentos";

export const Route = createFileRoute("/superadmin")({
  beforeLoad: async ({ location }) => {
    // La ruta de login NO se protege — siempre debe mostrar el formulario
    if (location.pathname.endsWith("/login")) return;

    const ok = await estaAutenticado("dueno");
    if (!ok) {
      throw redirect({ to: "/superadmin/login" });
    }
  },
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
  const { categorias, productos, promociones, recargar } = useMenuData();
  const config = useStore((s) => s.config);
  const [tab, setTab] = useState<"menu" | "estadisticas" | "promos">("menu");
  const [editandoProducto, setEditandoProducto] = useState<ProductoDb | null>(null);
  const [creandoProducto, setCreandoProducto] = useState(false);
  const [editandoPromo, setEditandoPromo] = useState<PromocionDb | null>(null);
  const [creandoPromo, setCreandoPromo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");


  const diasSinRespaldo = config.ultimo_respaldo
    ? Math.floor((Date.now() - new Date(config.ultimo_respaldo).getTime()) / 86400000)
    : null;
  const alertaRespaldo = diasSinRespaldo === null || diasSinRespaldo >= 30;

  // Subir imagen a Supabase Storage (bucket: menu-imagenes)
  const subirImagen = async (file: File): Promise<string | null> => {
    if (!supabase) return null;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `productos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("menu-imagenes").upload(path, file);
    if (error) {
      setMensaje(`Error al subir imagen: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("menu-imagenes").getPublicUrl(path);
    return data.publicUrl;
  };

  // Guardar producto (crear o editar) usando UUID real de Supabase
  const guardarProducto = async (producto: Partial<ProductoDb>, imagenFile?: File | null) => {
    if (!supabase) return;
    setCargando(true);
    setMensaje("");
    try {
      let imagenUrl = producto.imagen_url ?? null;
      if (imagenFile) {
        imagenUrl = await subirImagen(imagenFile);
        if (!imagenUrl) return;
      }
      if (producto.id) {
        const { error } = await supabase
          .from("productos")
          .update({
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            precio: producto.precio,
            categoria_id: producto.categoria_id,
            imagen_url: imagenUrl,
            disponible: producto.disponible,
          })
          .eq("id", producto.id);
        if (error) throw error;
        setMensaje("Producto actualizado correctamente.");
      } else {
        const { error } = await supabase.from("productos").insert({
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: producto.precio,
          categoria_id: producto.categoria_id,
          imagen_url: imagenUrl,
          disponible: true,
          orden: 99,
        });
        if (error) throw error;
        setMensaje("Producto creado correctamente.");
      }
      await recargar();
      setEditandoProducto(null);
      setCreandoProducto(false);
    } catch (e) {
      setMensaje(`Error: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setCargando(false);
    }
  };

  // Guardar promoción (crear o editar)
  const guardarPromo = async (promo: Partial<PromocionDb>, imagenFile?: File | null) => {
    if (!supabase) return;
    setCargando(true);
    setMensaje("");
    try {
      let imagenUrl = promo.imagen_url ?? null;
      if (imagenFile) {
        imagenUrl = await subirImagen(imagenFile);
        if (!imagenUrl) return;
      }
      if (promo.id) {
        const { error } = await supabase
          .from("promociones")
          .update({
            titulo: promo.titulo,
            descripcion: promo.descripcion,
            imagen_url: imagenUrl,
            activa: promo.activa,
          })
          .eq("id", promo.id);
        if (error) throw error;
        setMensaje("Promoción actualizada correctamente.");
      } else {
        const { error } = await supabase.from("promociones").insert({
          titulo: promo.titulo,
          descripcion: promo.descripcion,
          imagen_url: imagenUrl,
          activa: true,
          tipo_vigencia: "fija",
        });
        if (error) throw error;
        setMensaje("Promoción creada correctamente.");
      }
      await recargar();
      setEditandoPromo(null);
      setCreandoPromo(false);
    } catch (e) {
      setMensaje(`Error: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setCargando(false);
    }
  };

  // Eliminar promoción
  const eliminarPromo = async (id: string) => {
    if (!supabase) return;
    if (!confirm("¿Seguro que quieres eliminar esta promoción?")) return;
    const { error } = await supabase.from("promociones").delete().eq("id", id);
    if (error) {
      setMensaje(`Error: ${error.message}`);
      return;
    }
    setMensaje("Promoción eliminada.");
    await recargar();
  };

  // Toggle agotado en Supabase
  const toggleAgotadoDb = async (producto: ProductoDb) => {
    if (!supabase) return;
    const nuevo = !producto.disponible;
    const { error } = await supabase
      .from("productos")
      .update({ disponible: nuevo })
      .eq("id", producto.id);
    if (error) {
      setMensaje(`Error: ${error.message}`);
      return;
    }
    await recargar();
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <h1 className="font-display text-4xl text-primary">Panel del dueño</h1>
          <p className="text-xs text-muted-foreground">Menú, disponibilidad y estadísticas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => supabase?.from("configuracion").update({ negocio_abierto: !config.negocio_abierto }).eq("id", true).then(() => recargar())}
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
              void cerrarSesion();
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

      {mensaje && (
        <div className="mb-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          {mensaje}
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
          <button
            onClick={() => setCreandoProducto(true)}
            className="flex items-center gap-2 rounded-xl bg-brasa px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Crear producto nuevo
          </button>
          {categorias.map((c) => (
            <section key={c.id}>
              <h2 className="font-display text-2xl text-primary">{c.nombre}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {productos
                  .filter((p) => p.categoria_id === c.id)
                  .map((p) => {
                    const agotado = p.disponible === false;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                      >
                        {p.imagen_url && (
                          <img
                            src={p.imagen_url}
                            alt=""
                            className="size-14 rounded-xl object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold">{p.nombre}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {p.descripcion}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleAgotadoDb(p)}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                            agotado
                              ? "bg-destructive text-destructive-foreground"
                              : "border border-border"
                          }`}
                        >
                          {agotado ? "Agotado" : "Disponible"}
                        </button>
                        <button
                          onClick={() => setEditandoProducto(p)}
                          className="rounded-xl border border-border p-2"
                          aria-label={`Editar ${p.nombre}`}
                        >
                          <Pencil className="size-4" />
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
        <Estadisticas />
      )}

      {tab === "promos" && (
        <div className="mt-5">
          <button
            onClick={() => setCreandoPromo(true)}
            className="mb-4 flex items-center gap-2 rounded-xl bg-brasa px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Crear promoción
          </button>
          <div className="grid gap-3 md:grid-cols-2">
            {promociones.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                {p.imagen_url && (
                  <img src={p.imagen_url} alt="" className="h-32 w-full rounded-xl object-cover" />
                )}
                <p className="mt-3 font-display text-2xl text-primary">{p.titulo}</p>
                <p className="text-sm text-muted-foreground">{p.descripcion}</p>
                <p className="mt-2 text-xs tracking-widest uppercase">
                  Vigencia: {p.tipo_vigencia} · {p.activa ? "Activa" : "Inactiva"}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setEditandoPromo(p)}
                    className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs"
                  >
                    <Pencil className="size-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => eliminarPromo(p.id)}
                    className="flex items-center gap-1 rounded-xl border border-destructive/50 px-3 py-2 text-xs text-destructive"
                  >
                    <Trash2 className="size-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(editandoProducto || creandoProducto) && (
        <ProductoForm
          producto={editandoProducto}
          categorias={categorias}
          onClose={() => {
            setEditandoProducto(null);
            setCreandoProducto(false);
          }}
          onGuardar={guardarProducto}
          cargando={cargando}
        />
      )}

      {(editandoPromo || creandoPromo) && (
        <PromoForm
          promo={editandoPromo}
          onClose={() => {
            setEditandoPromo(null);
            setCreandoPromo(false);
          }}
          onGuardar={guardarPromo}
          cargando={cargando}
        />
      )}
    </main>
  );
}

function Estadisticas() {
  const pedidos = useStore((s) => s.pedidos);
  const validos = pedidos.filter((p) => p.estado !== "cancelado");
  const ventas = validos.reduce((a, p) => a + p.total, 0);
  const top = new Map<string, number>();
  validos.forEach((p) =>
    p.items.forEach((i) => top.set(i.nombre, (top.get(i.nombre) ?? 0) + i.cantidad)),
  );
  const top5 = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const filasReporte = (): string[][] => [
    ["Métrica", "Valor"],
    ["Total de ventas", formatCOP(ventas)],
    ["Pedidos válidos", String(validos.length)],
    ["Ticket promedio", formatCOP(validos.length ? Math.round(ventas / validos.length) : 0)],
    ...top5.map(([nombre, cant]) => [`Vendido: ${nombre}`, String(cant)]),
  ];

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi titulo="Ventas" valor={formatCOP(ventas)} />
        <Kpi titulo="Pedidos" valor={String(validos.length)} />
        <Kpi titulo="Ticket promedio" valor={formatCOP(validos.length ? Math.round(ventas / validos.length) : 0)} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-2xl text-primary">Más vendidos</h2>
        {top5.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">Aún no hay ventas registradas.</p>
        )}
        {top5.map(([nombre, cant]) => (
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

function ProductoForm({
  producto,
  categorias,
  onClose,
  onGuardar,
  cargando,
}: {
  producto: ProductoDb | null;
  categorias: CategoriaDb[];
  onClose: () => void;
  onGuardar: (p: Partial<ProductoDb>, imagenFile?: File | null) => Promise<void>;
  cargando: boolean;
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [precio, setPrecio] = useState(producto?.precio?.toString() ?? "");
  const [categoriaId, setCategoriaId] = useState(producto?.categoria_id ?? categorias[0]?.id ?? "");
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState(producto?.imagen_url ?? "");

  const handleImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenFile(file);
      setImagenPreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/30 bg-popover p-6 shadow-glow">
        <h2 className="font-display text-2xl text-primary">
          {producto ? "Editar producto" : "Crear producto"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Nombre</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Descripción
            </span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Precio</span>
            <input
              type="number"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Categoría
            </span>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Imagen</span>
            <div className="mt-1 flex items-center gap-3">
              {imagenPreview && (
                <img src={imagenPreview} alt="" className="size-16 rounded-xl object-cover" />
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <ImagePlus className="size-4" />
                {imagenPreview ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" accept="image/*" onChange={handleImagen} className="hidden" />
              </label>
            </div>
          </label>
          <button
            onClick={() =>
              onGuardar(
                {
                  ...producto,
                  nombre,
                  descripcion,
                  precio: Number(precio) || null,
                  categoria_id: categoriaId,
                },
                imagenFile,
              )
            }
            disabled={cargando || !nombre.trim()}
            className="w-full rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {cargando ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={onClose} className="w-full rounded-2xl border border-border py-3 text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function PromoForm({
  promo,
  onClose,
  onGuardar,
  cargando,
}: {
  promo: PromocionDb | null;
  onClose: () => void;
  onGuardar: (p: Partial<PromocionDb>, imagenFile?: File | null) => Promise<void>;
  cargando: boolean;
}) {
  const [titulo, setTitulo] = useState(promo?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(promo?.descripcion ?? "");
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState(promo?.imagen_url ?? "");

  const handleImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenFile(file);
      setImagenPreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-primary/30 bg-popover p-6 shadow-glow">
        <h2 className="font-display text-2xl text-primary">
          {promo ? "Editar promoción" : "Crear promoción"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Descripción corta
            </span>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Imagen</span>
            <div className="mt-1 flex items-center gap-3">
              {imagenPreview && (
                <img src={imagenPreview} alt="" className="size-16 rounded-xl object-cover" />
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <ImagePlus className="size-4" />
                {imagenPreview ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" accept="image/*" onChange={handleImagen} className="hidden" />
              </label>
            </div>
          </label>
          <button
            onClick={() => onGuardar({ ...promo, titulo, descripcion }, imagenFile)}
            disabled={cargando || !titulo.trim()}
            className="w-full rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {cargando ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={onClose} className="w-full rounded-2xl border border-border py-3 text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}