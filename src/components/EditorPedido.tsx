import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, StickyNote, Loader2, AlertCircle, Search, Check } from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import { useMenuData, type ProductoDb, type CategoriaDb } from "@/lib/use-menu-data";
import type { PedidoDb, PedidoItemNormalizado } from "@/lib/use-pedidos";
import { guardarEdicionPedido, calcularSubtotal } from "@/lib/editar-pedido";

interface Props {
  pedido: PedidoDb;
  telefonoCliente?: string | null | undefined;
  onGuardado: (result: { subtotal: number; total: number; version: number }) => void;
  onCancelar: () => void;
}

export function EditorPedido({ pedido, telefonoCliente, onGuardado, onCancelar }: Props) {
  const { categorias, productos, cargando: cargandoCatalogo } = useMenuData();
  const [items, setItems] = useState<PedidoItemNormalizado[]>(pedido.items ?? []);
  const [valorDomicilio, setValorDomicilio] = useState(pedido.valor_domicilio);
  const [buscando, setBuscando] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  const subtotal = useMemo(() => calcularSubtotal(items), [items]);
  const total = subtotal + valorDomicilio;

  // Si el estado del pedido cambió a en_cocina mientras se está editando,
  // cerramos la edición automáticamente (regla de negocio punto 19).
  useEffect(() => {
    if (
      pedido.estado !== "pendiente_confirmacion_cajera" &&
      pedido.estado !== "pendiente_pago" &&
      pedido.estado !== "pago_confirmado"
    ) {
      onCancelar();
    }
  }, [pedido.estado, onCancelar]);

  const categoriaDe = (productoId: string): CategoriaDb | undefined =>
    categorias.find((c) => c.id === productos.find((p) => p.id === productoId)?.categoria_id);

  const productosFiltrados = useMemo(() => {
    const q = buscando.trim().toLowerCase();
    if (!q) return [];
    return productos.filter(
      (p) =>
        p.disponible &&
        (p.nombre.toLowerCase().includes(q) || (p.descripcion ?? "").toLowerCase().includes(q)),
    );
  }, [buscando, productos]);

  function cambiarCantidad(key: string, delta: number) {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i))
        .filter((i) => i.cantidad > 0),
    );
  }

  function cambiarNotas(key: string, notas: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, notas } : i)));
  }

  function quitarItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function agregarProducto(producto: ProductoDb) {
    const precio = producto.precio ?? 0;
    const key = `${producto.id}|${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        key,
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: 1,
        variante_personas: null,
        combo: false,
        notas: "",
        precio_unitario: precio,
      },
    ]);
    setBuscando("");
  }

  async function guardar() {
    if (items.length === 0) {
      setError("El pedido debe tener al menos un producto.");
      return;
    }
    setGuardando(true);
    setError("");
    const res = await guardarEdicionPedido(pedido.id, items, valorDomicilio, telefonoCliente);
    setGuardando(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar la edición.");
      return;
    }
    setExito(true);
    onGuardado({
      subtotal: res.subtotal ?? subtotal,
      total: res.total ?? total,
      version: res.version ?? pedido.version + 1,
    });
  }

  const categoriasConFiltro = useMemo(() => {
    const ids = new Set(productosFiltrados.map((p) => p.categoria_id));
    return categorias.filter((c) => ids.has(c.id));
  }, [categorias, productosFiltrados]);

  return (
    <div className="space-y-4">
      {/* Resumen del encabezado */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="font-display text-xl text-primary">{pedido.numero_comanda}</p>
        <p className="text-xs text-muted-foreground">
          Edición disponible solo antes de que el pedido pase a cocina.
        </p>
      </div>

      {/* Items actuales */}
      <div className="space-y-2">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Productos</p>
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            No hay productos. Agrega uno desde el catálogo.
          </p>
        )}

        {items.map((i) => {
          const cat = categoriaDe(i.producto_id ?? "");
          return (
            <div key={i.key} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {i.nombre}
                    {i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}
                    {i.combo ? " + combo" : ""}
                  </p>
                  {cat && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {cat.nombre}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatCOP(i.precio_unitario)} c/u · total{" "}
                    <b className="text-primary">{formatCOP(i.precio_unitario * i.cantidad)}</b>
                  </p>
                </div>
                <button
                  onClick={() => quitarItem(i.key)}
                  className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                  aria-label={`Quitar ${i.nombre}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {/* Cantidad */}
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => cambiarCantidad(i.key, -1)}
                  className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted/50"
                  aria-label="Disminuir cantidad"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center text-sm font-bold">{i.cantidad}</span>
                <button
                  onClick={() => cambiarCantidad(i.key, 1)}
                  className="flex size-8 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  aria-label="Aumentar cantidad"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {/* Notas */}
              <label className="mt-2 flex items-start gap-1.5">
                <StickyNote className="mt-2 size-3.5 shrink-0 text-amber-400" />
                <textarea
                  value={i.notas}
                  onChange={(e) => cambiarNotas(i.key, e.target.value)}
                  rows={1}
                  placeholder="Notas / observaciones (ej. sin cebolla)…"
                  className="min-h-8 flex-1 resize-none rounded-lg bg-input px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
            </div>
          );
        })}
      </div>

      {/* Agregar productos del catálogo */}
      <div>
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Agregar producto</p>
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-input px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={buscando}
            onChange={(e) => setBuscando(e.target.value)}
            placeholder="Buscar producto del menú…"
            className="flex-1 bg-transparent py-2.5 text-sm outline-none"
          />
          {cargandoCatalogo && (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>

        {buscando.trim() ? (
          <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-border bg-card">
            {productosFiltrados.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">Sin resultados.</p>
            )}
            {categoriasConFiltro.map((cat) => (
              <div key={cat.id}>
                <p className="bg-muted/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat.nombre}
                </p>
                {productosFiltrados
                  .filter((p) => p.categoria_id === cat.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => agregarProducto(p)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary/10"
                    >
                      <span className="min-w-0 truncate">{p.nombre}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.precio != null ? formatCOP(p.precio) : "—"}
                      </span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Escribe para buscar y agregar productos al pedido.
          </p>
        )}
      </div>

      {/* Domicilio + totales */}
      <div className="rounded-2xl border border-border bg-card p-4 text-sm">
        <div className="flex items-center justify-between">
          <span>Domicilio</span>
          <input
            type="number"
            value={valorDomicilio}
            onChange={(e) => setValorDomicilio(Number(e.target.value) || 0)}
            className="w-28 rounded-lg bg-input px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="mt-1 flex justify-between">
          <span>Subtotal</span>
          <span className="text-primary">{formatCOP(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-border pt-2 font-display text-2xl">
          <span>Total</span>
          <span className="text-primary">{formatCOP(total)}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {exito && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          <Check className="size-4 shrink-0" />
          <span>Pedido actualizado correctamente.</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          disabled={guardando}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brasa py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {guardando && <Loader2 className="size-4 animate-spin" />}
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
