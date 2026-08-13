import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingBag, Plus, Minus, X } from "lucide-react";
import { VARIANTES_PICADA, dentroDeHorario, formatCOP } from "@/lib/menu-data";
import { addToCart, cartTotal, updateCantidad, useStore } from "@/lib/store";
import { useMenuData, type ProductoDb } from "@/lib/use-menu-data";
import { Model3DPlaceholder } from "@/components/Model3DPlaceholder";
import { DonVelto } from "@/components/DonVelto";
import { FooterMenu } from "@/components/Marca";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menú | Tremendo Chicharrón Manizales" },
      {
        name: "description",
        content:
          "Desayunos, almuerzos, picadas y bebidas. Arma tu pedido a domicilio de Tremendo Chicharrón en Manizales.",
      },
      { property: "og:title", content: "Menú | Tremendo Chicharrón" },
      {
        property: "og:description",
        content: "Explora la carta completa y pide a domicilio en Manizales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Menu,
});

const IMAGENES_CATEGORIA: Record<string, string> = {
  "Tremendo Chicharrón": "/tremendochicharroncard.png",
  "Tremendo Calentado": "/tremendocalentadocard.png",
  "Para Picar / Tardear": "/parapicartardearcard.png",
  Bebidas: "/bebidascard.png",
};

/** Convierte "Tremendo Chorizo" → "tremendo-chorizo" (placeholder de imagen en /public). */
function slugifyNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Menu() {
  const { categorias, productos, cargando, error } = useMenuData();
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<ProductoDb | null>(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  // Alterna entre las dos sub-marcas con crossfade
  const [submarca, setSubmarca] = useState(0);
  const SUBMARCAS = ["Tremendo Chicharrón", "Tremendo Calentado"];
  useEffect(() => {
    const t = setInterval(() => setSubmarca((s) => (s + 1) % SUBMARCAS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const cart = useStore((s) => s.cart);
  const agotados = useStore((s) => s.config.agotados);
  const precios = useStore((s) => s.config.precios);
  const negocioAbierto = useStore((s) => s.config.negocio_abierto);
  const abierto = negocioAbierto && dentroDeHorario();

  const total = cartTotal(cart);
  const unidades = cart.reduce((a, c) => a + c.cantidad, 0);
  const precioDe = (p: ProductoDb) => precios[p.id] ?? p.precio;

  const toggleCategoria = (id: string) => {
    setCategoriaAbierta((prev) => (prev === id ? null : id));
  };

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-display text-2xl text-primary">Cargando menú…</p>
      </main>
    );
  }

  if (error || categorias.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-primary">No se pudo cargar el menú</h1>
        <p className="text-sm text-muted-foreground">{error ?? "Sin datos disponibles."}</p>
        <Link
          to="/"
          className="rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground"
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-primary/20 bg-background/95 shadow-card backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-5 py-5">
          <Link
            to="/"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-card/80 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            aria-label="Volver"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <img
            src="/logo-tremendochicharron.jpeg"
            alt=""
            className="size-12 shrink-0 rounded-full border-2 border-primary/60 object-cover shadow-glow"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-2xl leading-none text-primary">
              Tremendo Chicharrón
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={`inline-block size-1.5 rounded-full ${
                  abierto ? "bg-emerald-400" : "bg-destructive"
                }`}
              />
              {abierto ? "Abierto · domicilios en Manizales" : "Cerrado · no se reciben pedidos"}
            </p>
            <p className="mt-1 inline-block rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary transition-opacity duration-500">
              {SUBMARCAS[submarca]}
            </p>
          </div>
          <button
            onClick={() => setCarritoAbierto(true)}
            className="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-card/80 text-primary transition-colors hover:border-primary hover:bg-card"
            aria-label="Ver carrito"
          >
            <ShoppingBag className="size-5" />
            {unidades > 0 && (
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                {unidades}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-5">
        {!abierto && (
          <div className="mb-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Estamos cerrados en este momento. Puedes mirar la carta, pero no se pueden enviar
            pedidos.
          </div>
        )}

        <div className="space-y-4">
          {categorias.map((c) => {
            const abierta = categoriaAbierta === c.id;
            const productosCat = productos.filter((p) => p.categoria_id === c.id);
            const destacado = productos.find((p) => p.id === c.plato_destacado_id);
            const portada = IMAGENES_CATEGORIA[c.nombre] ?? "";
            return (
              <article
                key={c.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
              >
                <button
                  onClick={() => toggleCategoria(c.id)}
                  className="block w-full overflow-hidden bg-card"
                  aria-expanded={abierta}
                  aria-label={c.nombre}
                >
                  {portada && (
                    <img
                      src={portada}
                      alt={c.nombre}
                      className="block h-auto w-full object-contain"
                    />
                  )}
                </button>

                {abierta && (
                  <div className="animate-despliegue border-t border-border">
                    {c.modelo_3d_url && (
                      <section className="p-4 pb-0">
                        <p className="mb-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
                          Plato destacado de {c.nombre}
                        </p>
                        <Model3DPlaceholder src={c.modelo_3d_url} label={destacado?.nombre ?? ""} />
                      </section>
                    )}

                    <div className="divide-y divide-border/20">
                      {productosCat.map((p) => {
                        const agotado = agotados.includes(p.id) || !p.disponible;
                        const precio = precioDe(p);
                        const textoPrecio = p.por_persona
                          ? "Desde " + formatCOP(VARIANTES_PICADA[0]!.precio)
                          : precio
                            ? formatCOP(precio)
                            : "Precio por definir";
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSeleccion(p)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                          >
                            <img
                              src={p.imagen_url ?? `/${slugifyNombre(p.nombre)}.png`}
                              alt=""
                              className="size-20 shrink-0 rounded-xl object-cover"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-foreground">
                                {p.nombre}
                              </span>
                              <span className="line-clamp-2 block text-xs text-muted-foreground">
                                {p.descripcion}
                              </span>
                              <span className="mt-0.5 block font-display text-lg text-primary">
                                {textoPrecio}
                              </span>
                            </span>
                            {agotado ? (
                              <img
                                src="/soldout.png"
                                alt="Agotado"
                                className="size-12 shrink-0 object-contain"
                              />
                            ) : (
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brasa text-primary-foreground">
                                <Plus className="size-4" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <FooterMenu />
      <DonVelto />

      {carritoAbierto && (
        <Modal onClose={() => setCarritoAbierto(false)} titulo="Tu pedido">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <ShoppingBag className="size-10 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                Tu carrito está vacío. Agrega algo del menú y vuelve aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((i) => (
                <div key={i.key} className="flex items-start gap-3 border-b border-border pb-3">
                  <div className="flex-1">
                    <p className="font-semibold">
                      {i.nombre}
                      {i.variante_personas ? ` · ${i.variante_personas} pers.` : ""}
                    </p>
                    {i.combo && <p className="text-xs text-accent">Con combo incluido</p>}
                    {i.notas && <p className="text-xs text-muted-foreground">Nota: {i.notas}</p>}
                    <p className="text-sm text-primary">
                      {formatCOP(i.precio_unitario * i.cantidad)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCantidad(i.key, i.cantidad - 1)}
                      className="rounded-full border border-border p-2"
                      aria-label="Quitar uno"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-5 text-center">{i.cantidad}</span>
                    <button
                      onClick={() => updateCantidad(i.key, i.cantidad + 1)}
                      className="rounded-full border border-border p-2"
                      aria-label="Agregar uno"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-primary/25 bg-card p-4">
                <div className="flex justify-between font-display text-2xl">
                  <span>Total</span>
                  <span className="text-primary">{formatCOP(total)}</span>
                </div>
              </div>
              <Link
                to="/pedido"
                onClick={() => setCarritoAbierto(false)}
                className="block rounded-2xl bg-brasa py-3 text-center font-display text-xl text-primary-foreground shadow-glow"
              >
                Ir al checkout
              </Link>
            </div>
          )}
        </Modal>
      )}

      {seleccion && (
        <AgregarProducto
          producto={seleccion}
          precioBase={precioDe(seleccion)}
          onClose={() => setSeleccion(null)}
        />
      )}
    </main>
  );
}

function Modal({
  titulo,
  children,
  onClose,
}: {
  titulo: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-primary/25 bg-popover p-5 shadow-glow sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl text-primary">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AgregarProducto({
  producto,
  precioBase,
  onClose,
}: {
  producto: ProductoDb;
  precioBase: number | null;
  onClose: () => void;
}) {
  const [personas, setPersonas] = useState(VARIANTES_PICADA[0]!.personas);
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState("");
  const [combo, setCombo] = useState(false);

  const precio = producto.por_persona
    ? (VARIANTES_PICADA.find((v) => v.personas === personas)?.precio ?? 0)
    : (precioBase ?? 0);

  return (
    <Modal titulo={producto.nombre} onClose={onClose}>
      {producto.imagen_url && (
        <img
          src={producto.imagen_url}
          alt=""
          className="mb-3 h-40 w-full rounded-2xl object-cover"
        />
      )}
      <p className="text-sm text-muted-foreground">{producto.descripcion}</p>

      {producto.por_persona && (
        <div className="mt-4">
          <p className="mb-2 text-xs tracking-widest uppercase">¿Para cuántas personas?</p>
          <div className="flex flex-wrap gap-2">
            {VARIANTES_PICADA.map((v) => (
              <button
                key={v.personas}
                onClick={() => setPersonas(v.personas)}
                className={`rounded-xl px-3 py-2 text-sm ${
                  personas === v.personas
                    ? "bg-brasa text-primary-foreground"
                    : "border border-border bg-card"
                }`}
              >
                {v.personas} · {formatCOP(v.precio)}
              </button>
            ))}
          </div>
        </div>
      )}

      {producto.combo_gratis && (
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <input
            type="checkbox"
            checked={combo}
            onChange={(e) => setCombo(e.target.checked)}
            className="size-4 accent-[oklch(0.82_0.155_85)]"
          />
          Agregar combo: papas en casco + gaseosa (sin costo adicional)
        </label>
      )}

      <label className="mt-4 block text-sm">
        <span className="text-xs tracking-widest uppercase">Notas para la cocina</span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="Ej: sin cebolla, chocolate espeso…"
          className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            className="rounded-full border border-border p-2"
            aria-label="Menos"
          >
            <Minus className="size-4" />
          </button>
          <span className="font-display text-2xl">{cantidad}</span>
          <button
            onClick={() => setCantidad((c) => c + 1)}
            className="rounded-full border border-border p-2"
            aria-label="Más"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <span className="font-display text-2xl text-primary">{formatCOP(precio * cantidad)}</span>
      </div>

      <button
        onClick={() => {
          addToCart({
            producto_id: producto.id,
            nombre: producto.nombre,
            cantidad,
            variante_personas: producto.por_persona ? personas : null,
            notas,
            precio_unitario: precio,
            combo,
          });
          onClose();
        }}
        className="mt-5 w-full rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow"
      >
        Agregar al pedido
      </button>
    </Modal>
  );
}