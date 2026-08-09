import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ShoppingBag, Plus, Minus, X } from "lucide-react";
import {
  CATEGORIAS,
  PRODUCTOS,
  PROMOCIONES,
  VARIANTES_PICADA,
  dentroDeHorario,
  formatCOP,
  type CategoriaId,
  type Producto,
} from "@/lib/menu-data";
import { addToCart, cartTotal, updateCantidad, useStore } from "@/lib/store";
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

function Menu() {
  const [cat, setCat] = useState<CategoriaId>("desayunos");
  const [promoAbierta, setPromoAbierta] = useState(true);
  const [seleccion, setSeleccion] = useState<Producto | null>(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  const cart = useStore((s) => s.cart);
  const agotados = useStore((s) => s.config.agotados);
  const precios = useStore((s) => s.config.precios);
  const negocioAbierto = useStore((s) => s.config.negocio_abierto);
  const abierto = negocioAbierto && dentroDeHorario();

  const categoria = CATEGORIAS.find((c) => c.id === cat)!;
  const productos = useMemo(() => PRODUCTOS.filter((p) => p.categoria_id === cat), [cat]);
  const promo = PROMOCIONES.find((x) => x.activa);
  const total = cartTotal(cart);
  const unidades = cart.reduce((a, c) => a + c.cantidad, 0);
  const precioDe = (p: Producto) => precios[p.id] ?? p.precio;

  return (
    <main className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link to="/" className="text-muted-foreground hover:text-primary" aria-label="Volver">
            <ArrowLeft className="size-5" />
          </Link>
          <img
            src="/logo-tremendochicharron.jpeg"
            alt=""
            className="size-9 rounded-full border border-primary/50 object-cover"
          />
          <div className="flex-1">
            <p className="font-display text-xl leading-none text-primary">Tremendo Chicharrón</p>
            <p className="text-[11px] text-muted-foreground">
              {abierto ? "Abierto · domicilios en Manizales" : "Cerrado · no se reciben pedidos"}
            </p>
          </div>
        </div>
        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto px-4 pb-3">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                c.id === cat
                  ? "bg-brasa text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-5">
        {!abierto && (
          <div className="mb-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Estamos cerrados en este momento. Puedes mirar la carta, pero no se pueden enviar
            pedidos.
          </div>
        )}

        {categoria.modelo_3d_url && (
          <section className="mb-6">
            <p className="mb-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Plato destacado de {categoria.nombre}
            </p>
            <Model3DPlaceholder
              src={categoria.modelo_3d_url}
              label={PRODUCTOS.find((p) => p.id === categoria.plato_destacado_id)?.nombre ?? ""}
            />
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          {productos.map((p) => {
            const agotado = agotados.includes(p.id);
            const precio = precioDe(p);
            return (
              <article
                key={p.id}
                className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
              >
                {agotado && (
                  <img
                    src="/soldout.png"
                    alt="Agotado"
                    className="pointer-events-none absolute inset-0 size-full object-cover opacity-80"
                  />
                )}
                <h2 className="font-display text-2xl leading-tight text-foreground">{p.nombre}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.descripcion}</p>
                {p.combo_gratis && (
                  <p className="mt-2 text-xs font-semibold text-accent">
                    Puedes agregar combo (papas en casco + gaseosa) sin costo
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-display text-2xl text-primary">
                    {p.por_persona
                      ? "Desde " + formatCOP(VARIANTES_PICADA[0]!.precio)
                      : precio
                        ? formatCOP(precio)
                        : "Precio por definir"}
                  </span>
                  <button
                    disabled={agotado || !abierto || (!p.por_persona && !precio)}
                    onClick={() => setSeleccion(p)}
                    className="relative z-10 rounded-full bg-brasa px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Agregar
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      <FooterMenu />
      <DonVelto />

      {/* Barra de carrito */}
      {unidades > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/30 bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <button
              onClick={() => setCarritoAbierto(true)}
              className="flex flex-1 items-center gap-3 text-left"
            >
              <span className="relative">
                <ShoppingBag className="size-7 text-primary" />
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                  {unidades}
                </span>
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Ver carrito</span>
                <span className="font-display text-xl text-primary">{formatCOP(total)}</span>
              </span>
            </button>
            <Link
              to="/pedido"
              className="rounded-full bg-brasa px-6 py-3 font-display text-xl text-primary-foreground shadow-glow"
            >
              Continuar
            </Link>
          </div>
        </div>
      )}

      {carritoAbierto && (
        <Modal onClose={() => setCarritoAbierto(false)} titulo="Tu pedido">
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
                  <p className="text-sm text-primary">{formatCOP(i.precio_unitario * i.cantidad)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCantidad(i.key, i.cantidad - 1)}
                    className="rounded-full border border-border p-1"
                    aria-label="Quitar uno"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-5 text-center">{i.cantidad}</span>
                  <button
                    onClick={() => updateCantidad(i.key, i.cantidad + 1)}
                    className="rounded-full border border-border p-1"
                    aria-label="Agregar uno"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-display text-2xl">
              <span>Total</span>
              <span className="text-primary">{formatCOP(total)}</span>
            </div>
            <Link
              to="/pedido"
              onClick={() => setCarritoAbierto(false)}
              className="block rounded-2xl bg-brasa py-3 text-center font-display text-xl text-primary-foreground"
            >
              Ir al checkout
            </Link>
          </div>
        </Modal>
      )}

      {seleccion && (
        <AgregarProducto
          producto={seleccion}
          precioBase={precioDe(seleccion)}
          onClose={() => setSeleccion(null)}
        />
      )}

      {promo && promoAbierta && (
        <Modal onClose={() => setPromoAbierta(false)} titulo={promo.titulo}>
          <img
            src={promo.imagen_url}
            alt={promo.titulo}
            className="mb-3 h-40 w-full rounded-xl object-cover"
          />
          <p className="text-sm text-muted-foreground">{promo.descripcion}</p>
          <button
            onClick={() => setPromoAbierta(false)}
            className="mt-4 w-full rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground"
          >
            ¡Quiero verlo!
          </button>
        </Modal>
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
  producto: Producto;
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