import { formatCOP } from "./menu-data";
import type { Pedido } from "./store";
import { ESTADO_LABEL } from "./store";

function abrirImpresion(titulo: string, cuerpo: string) {
  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/>
  <title>${titulo}</title>
  <style>
    body{font-family:ui-monospace,Menlo,monospace;background:#fff;color:#111;padding:18px;font-size:12px}
    h1{font-size:16px;margin:0 0 2px;text-transform:uppercase;letter-spacing:1px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    td{padding:3px 0;vertical-align:top}
    .r{text-align:right}
    hr{border:none;border-top:1px dashed #999;margin:10px 0}
    .tot{font-size:14px;font-weight:700}
    small{color:#555}
  </style></head><body>${cuerpo}
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

const filas = (pd: Pedido) =>
  pd.items
    .map(
      (i) => `<tr><td>${i.cantidad}x ${i.nombre}${
        i.variante_personas ? ` (${i.variante_personas} pers.)` : ""
      }${i.combo ? " + combo" : ""}${
        i.notas ? `<br/><small>Nota: ${i.notas}</small>` : ""
      }</td><td class="r">${formatCOP(i.precio_unitario * i.cantidad)}</td></tr>`,
    )
    .join("");

/** Comanda para cocina/caja (imprimible o guardable como PDF). */
export function imprimirComanda(pd: Pedido) {
  abrirImpresion(
    `Comanda ${pd.numero_comanda}`,
    `<h1>Tremendo Chicharrón</h1>
     <small>Comanda ${pd.numero_comanda} · v${pd.version}</small><hr/>
     <div>${new Date(pd.creado_en).toLocaleString("es-CO")}</div>
     <div>Cliente: ${pd.cliente_nombre} · ${pd.cliente_telefono}</div>
     <div>Dirección: ${pd.direccion_entrega}</div>
     <div>Estado: ${ESTADO_LABEL[pd.estado]}</div><hr/>
     <table>${filas(pd)}</table><hr/>
     <table>
       <tr><td>Subtotal</td><td class="r">${formatCOP(pd.subtotal)}</td></tr>
       <tr><td>Domicilio</td><td class="r">${formatCOP(pd.valor_domicilio)}</td></tr>
       <tr class="tot"><td>TOTAL</td><td class="r">${formatCOP(pd.total)}</td></tr>
     </table>
     <hr/><div>Pago: ${pd.medio_pago}${
       pd.monto_efectivo_recibido != null
         ? ` · Recibe ${formatCOP(pd.monto_efectivo_recibido)} · Vuelto ${formatCOP(pd.vuelto ?? 0)}`
         : ""
     }</div>`,
  );
}

/** Factura del cliente. */
export function descargarFactura(pd: Pedido) {
  abrirImpresion(
    `Factura ${pd.numero_comanda}`,
    `<h1>Factura de venta</h1>
     <small>Comercializadora Tremendo Chicharrón SAS · NIT 901.433.592-5</small><hr/>
     <div>Comanda: <b>${pd.numero_comanda}</b></div>
     <div>Fecha: ${new Date(pd.creado_en).toLocaleString("es-CO")}</div>
     <div>Cliente: ${pd.cliente_nombre} · ${pd.cliente_telefono}</div>
     <div>Entrega: ${pd.direccion_entrega}</div><hr/>
     <table>${filas(pd)}</table><hr/>
     <table>
       <tr><td>Subtotal</td><td class="r">${formatCOP(pd.subtotal)}</td></tr>
       <tr><td>Domicilio</td><td class="r">${formatCOP(pd.valor_domicilio)}</td></tr>
       <tr class="tot"><td>TOTAL</td><td class="r">${formatCOP(pd.total)}</td></tr>
     </table>
     <hr/><small>Gracias por tu compra. Manizales, Colombia.</small>`,
  );
}

/** Mensaje de WhatsApp prellenado para el botón "Ir a Pagar". */
export function mensajeWhatsApp(pd: Pedido): string {
  const lineas = [
    `*TREMENDO CHICHARRÓN* 🐷`,
    `Comanda: *${pd.numero_comanda}*`,
    ``,
    ...pd.items.map(
      (i) =>
        `• ${i.cantidad}x ${i.nombre}${i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}${
          i.combo ? " + combo" : ""
        } — ${formatCOP(i.precio_unitario * i.cantidad)}${i.notas ? `\n   Nota: ${i.notas}` : ""}`,
    ),
    ``,
    `Subtotal: ${formatCOP(pd.subtotal)}`,
    `Domicilio: por confirmar según dirección`,
    `*TOTAL: ${formatCOP(pd.total)}*`,
    ``,
    `Nombre: ${pd.cliente_nombre}`,
    `Teléfono: ${pd.cliente_telefono}`,
    `Dirección: ${pd.direccion_entrega}`,
    `Medio de pago: ${pd.medio_pago}`,
  ];
  if (pd.medio_pago === "efectivo" && pd.monto_efectivo_recibido != null) {
    lineas.push(
      `Paga con: ${formatCOP(pd.monto_efectivo_recibido)}`,
      `Vuelto: ${formatCOP(pd.vuelto ?? 0)}`,
    );
  }
  return lineas.join("\n");
}

export function linkPago(pd: Pedido): string {
  const numero = (import.meta.env['VITE_RESTAURANT_WHATSAPP_NUMBER'] as string | undefined) ?? "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsApp(pd))}`;
}

/** Reporte mensual en CSV (abre en Excel). */
export function descargarExcel(filasCsv: string[][], nombre: string) {
  const csv = filasCsv.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Reporte mensual en PDF (vía diálogo de impresión → Guardar como PDF). */
export function descargarPdfReporte(titulo: string, filasTabla: string[][]) {
  abrirImpresion(
    titulo,
    `<h1>${titulo}</h1><small>Tremendo Chicharrón SAS</small><hr/><table>${filasTabla
      .map((r) => `<tr><td>${r[0]}</td><td class="r">${r[1]}</td></tr>`)
      .join("")}</table>`,
  );
}