import { useEffect, useState } from "react";
import {
  Phone,
  MapPin,
  StickyNote,
  Printer,
  Pencil,
  LogOut,
  Clock,
  Package,
  User,
  CreditCard,
  Home,
  AlertCircle,
} from "lucide-react";
import { formatCOP } from "@/lib/menu-data";
import type { PedidoDb } from "@/lib/use-pedidos";
import { ETAPA_LABEL, ETAPA_LABEL_CLIENTE, etapaVisualEstado } from "@/lib/store";
import { estadoEditable } from "@/lib/editar-pedido";
import { EditorPedido } from "@/components/EditorPedido";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  pedido: PedidoDb | null;
  abierto: boolean;
  onCerrar: () => void;
  /** true = panel de caja (staff); false = vista del cliente */
  staff?: boolean;
  /** teléfono del cliente (requerido para edición del cliente) */
  telefonoCliente?: string | null;
  onGuardado?: (result: { subtotal: number; total: number; version: number }) => void;
  /** callback para imprimir desde el modal */
  onImprimir?: (pd: PedidoDb) => void;
}

export function DetallePedidoModal({
  pedido,
  abierto,
  onCerrar,
  staff = true,
  telefonoCliente,
  onGuardado,
  onImprimir,
}: Props) {
  const [editando, setEditando] = useState(false);

  // Al cerrar el modal, salir del modo edición.
  useEffect(() => {
    if (!abierto) setEditando(false);
  }, [abierto]);

  if (!pedido) return null;

  const label =
    pedido.estado === "cancelado"
      ? "Cancelado"
      : (staff ? ETAPA_LABEL : ETAPA_LABEL_CLIENTE)[etapaVisualEstado(pedido.estado)];

  const editable =
    estadoEditable(pedido.estado) &&
    (staff || new Date(pedido.editable_hasta).getTime() > Date.now());

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            {pedido.numero_comanda}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                staff
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-primary/40 bg-primary/10 text-primary"
              }`}
            >
              <Clock className="size-3" />
              {label}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(pedido.creado_en).toLocaleString("es-CO", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {pedido.version > 1 ? ` · v${pedido.version}` : ""}
            </span>
          </DialogDescription>
        </DialogHeader>

        {editando && editable ? (
          <EditorPedido
            pedido={pedido}
            telefonoCliente={telefonoCliente}
            onCancelar={() => setEditando(false)}
            onGuardado={(r) => {
              setEditando(false);
              onGuardado?.(r);
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* Datos del cliente */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <User className="size-3.5" /> Datos del cliente
              </p>
              <p className="text-sm font-semibold text-foreground">{pedido.cliente_nombre}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5 shrink-0" /> {pedido.cliente_telefono}
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {pedido.direccion_entrega}
                  {pedido.barrio ? ` · Barrio ${pedido.barrio}` : ""}
                </span>
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CreditCard className="size-3.5 shrink-0" />
                Pago: <b className="capitalize">{pedido.medio_pago}</b>
                {pedido.medio_pago === "efectivo" && pedido.monto_efectivo_recibido != null && (
                  <span>
                    {" "}
                    · Recibe {formatCOP(pedido.monto_efectivo_recibido)} · Vuelto{" "}
                    {formatCOP(Math.max(pedido.vuelto ?? 0, 0))}
                  </span>
                )}
              </p>
            </section>

            {/* Productos */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Package className="size-3.5" /> Productos
              </p>
              <div className="space-y-2.5">
                {(pedido.items ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin productos.</p>
                )}
                {(pedido.items ?? []).map((i, idx) => (
                  <div
                    key={i.key ?? idx}
                    className="rounded-xl border border-border bg-muted/20 p-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 font-medium text-foreground">
                        <span className="font-bold text-primary">{i.cantidad}x</span> {i.nombre}
                        {i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}
                        {i.combo ? " + combo" : ""}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatCOP(i.precio_unitario * i.cantidad)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatCOP(i.precio_unitario)} c/u
                    </p>
                    {i.notas ? (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1">
                        <StickyNote className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                        <span className="text-xs text-amber-300">{i.notas}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {/* Totales */}
            <section className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-primary">{formatCOP(pedido.subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Domicilio</span>
                <span className="text-primary">{formatCOP(pedido.valor_domicilio)}</span>
              </div>
              {pedido.propina > 0 && (
                <div className="mt-1 flex justify-between">
                  <span>Propina domiciliario</span>
                  <span className="text-primary">{formatCOP(pedido.propina)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-display text-2xl">
                <span>Total</span>
                <span className="text-primary">{formatCOP(pedido.total)}</span>
              </div>
            </section>

            {/* Acciones */}
            <div className="flex flex-wrap gap-2">
              {editable && !editando && (
                <button
                  onClick={() => setEditando(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brasa px-4 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  <Pencil className="size-4" /> Editar pedido
                </button>
              )}
              {!editable && (
                <p className="flex w-full items-center gap-1.5 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <AlertCircle className="size-3.5 shrink-0" />
                  Este pedido ya pasó a cocina o fue finalizado: su contenido es de solo lectura.
                </p>
              )}
              {onImprimir && (
                <button
                  onClick={() => onImprimir(pedido)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20"
                >
                  <Printer className="size-4" /> Imprimir
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Home className="size-3" /> Tremendo Chicharrón
          </span>
          {pedido.estado !== "cancelado" && (
            <span className="flex items-center gap-1">
              <LogOut className="size-3" /> {label}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
