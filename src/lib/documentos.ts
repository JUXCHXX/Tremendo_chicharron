import { formatCOP } from "./menu-data";
import type { Pedido } from "./store";
import { ESTADO_LABEL } from "./store";
import { obtenerNit } from "./supabase";
import { jsPDF } from "jspdf";

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
  <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

const filas = (pd: Pedido) =>
  pd.items
    .map(
      (i) =>
        `<tr><td>${i.cantidad}x ${i.nombre}${
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
export async function descargarFactura(pd: Pedido) {
  const nit = await obtenerNit();
  abrirImpresion(
    `Factura ${pd.numero_comanda}`,
    `<h1>Factura de venta</h1>
     <small>Comercializadora Tremendo Chicharrón SAS · NIT ${nit}</small><hr/>
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

/**
 * Factura en PDF con formato profesional (jsPDF).
 * Incluye encabezado con logo, NIT, datos de contacto, comanda, cliente,
 * tabla de productos, desglose de totales y medio de pago.
 */
export async function descargarFacturaPdf(pd: Pedido) {
  const nit = await obtenerNit();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  let y = 20;

  // ── Encabezado ──
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 200, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TREMENDO CHICHARRÓN", M, 14);
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Comercializadora Tremendo Chicharrón SAS", M, 20);
  doc.text(`NIT: ${nit}`, M, 24);
  doc.text("Manizales, Colombia", M, 28);

  // ── Número de comanda y fecha ──
  y = 40;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`FACTURA ${pd.numero_comanda}`, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Fecha: ${new Date(pd.creado_en).toLocaleString("es-CO")}`, W - M, y, {
    align: "right",
  });
  y += 8;
  doc.text(`Versión: v${pd.version}`, W - M, y, { align: "right" });

  // ── Datos del cliente ──
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, W - M, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("DATOS DEL CLIENTE", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Cliente: ${pd.cliente_nombre}`, M, y);
  doc.text(`Teléfono: ${pd.cliente_telefono}`, W / 2, y);
  y += 5;
  doc.text(`Dirección: ${pd.direccion_entrega}`, M, y);
  if (pd.barrio) doc.text(`Barrio: ${pd.barrio}`, W / 2, y);

  // ── Tabla de productos ──
  y += 10;
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y - 4, W - 2 * M, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CANT", M + 2, y);
  doc.text("PRODUCTO", M + 14, y);
  doc.text("P. UNIT", W - M - 40, y, { align: "right" });
  doc.text("SUBTOTAL", W - M - 2, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  pd.items.forEach((i) => {
    const nombre = `${i.cantidad}x ${i.nombre}${i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}${i.combo ? " + combo" : ""}`;
    doc.text(String(i.cantidad), M + 2, y);
    doc.text(nombre, M + 14, y);
    doc.text(formatCOP(i.precio_unitario), W - M - 40, y, { align: "right" });
    doc.text(formatCOP(i.precio_unitario * i.cantidad), W - M - 2, y, { align: "right" });
    if (i.notas) {
      y += 4;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Nota: ${i.notas}`, M + 14, y);
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
    }
    y += 6;
  });

  // ── Desglose de totales ──
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, W - M, y);
  y += 6;
  doc.text("Subtotal", M, y);
  doc.text(formatCOP(pd.subtotal), W - M, y, { align: "right" });
  y += 6;
  doc.text("Domicilio", M, y);
  doc.text(formatCOP(pd.valor_domicilio), W - M, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL", M, y);
  doc.text(formatCOP(pd.total), W - M, y, { align: "right" });

  // ── Medio de pago ──
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Medio de pago: ${pd.medio_pago}`, M, y);
  if (pd.medio_pago === "efectivo" && pd.monto_efectivo_recibido != null) {
    y += 5;
    doc.text(`Recibe: ${formatCOP(pd.monto_efectivo_recibido)}`, M, y);
    doc.text(`Vuelto: ${formatCOP(Math.max(pd.vuelto ?? 0, 0))}`, W - M, y, { align: "right" });
  }

  // ── Pie ──
  y = 280;
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, W - M, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("¡Gracias por tu compra! Tremendo Chicharrón — Manizales, Colombia.", W / 2, y, {
    align: "center",
  });

  doc.save(`Factura_${pd.numero_comanda}.pdf`);
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
    `Domicilio: ${formatCOP(pd.valor_domicilio)}`,
    `*TOTAL: ${formatCOP(pd.total)}*`,
    ``,
    `Nombre: ${pd.cliente_nombre}`,
    `Teléfono: ${pd.cliente_telefono}`,
    `Barrio: ${pd.barrio ?? "—"}`,
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

/**
 * Paso 1 — Mensaje de confirmación de domicilio.
 * Se envía cuando el pedido está en 'pendiente_confirmacion_cajera'.
 * NO incluye el valor del domicilio (todavía no se sabe).
 */
export function generarMensajeConfirmacionDomicilio(pd: Pedido): string {
  const totalItems = pd.items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);
  return [
    `*TREMENDO CHICHARRÓN* 🐷`,
    `Hola, ya hice mi pedido *${pd.numero_comanda}*.`,
    `Total de items: ${formatCOP(totalItems)}.`,
    `Espero confirmación del valor del domicilio.`,
    ``,
    `Nombre: ${pd.cliente_nombre}`,
    `Teléfono: ${pd.cliente_telefono}`,
    `Barrio: ${pd.barrio ?? "—"}`,
    `Dirección: ${pd.direccion_entrega}`,
  ].join("\n");
}

/**
 * Paso 2 — Mensaje de pago.
 * Se envía cuando el pedido está en 'pendiente_pago' (la cajera ya confirmó
 * el domicilio y el total final está calculado).
 */
export function generarMensajePago(pd: Pedido): string {
  const lineas = [
    `*TREMENDO CHICHARRÓN* 🐷`,
    `Hola, número de comanda *${pd.numero_comanda}*.`,
    `Pedido: ${pd.items.reduce((a, i) => a + i.cantidad, 0)} items.`,
    `Total con domicilio: *${formatCOP(pd.total)}*.`,
    `Medio de pago: ${pd.medio_pago}.`,
  ];
  if (pd.medio_pago === "efectivo" && pd.monto_efectivo_recibido != null) {
    lineas.push(
      `Pago con ${formatCOP(pd.monto_efectivo_recibido)}, necesito ${formatCOP(Math.max(pd.vuelto ?? 0, 0))} de vuelto.`,
    );
  }
  return lineas.join("\n");
}

/** Link de WhatsApp para el paso 1 (confirmación de domicilio). */
export function linkConfirmacionDomicilio(pd: Pedido): string {
  const numero = (import.meta.env["VITE_RESTAURANT_WHATSAPP_NUMBER"] as string | undefined) ?? "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(generarMensajeConfirmacionDomicilio(pd))}`;
}

/** Link de WhatsApp para el paso 2 (pago). */
export function linkPago(pd: Pedido): string {
  const numero = (import.meta.env["VITE_RESTAURANT_WHATSAPP_NUMBER"] as string | undefined) ?? "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(generarMensajePago(pd))}`;
}

/** Reporte mensual en CSV (abre en Excel). */
export function descargarExcel(filasCsv: string[][], nombre: string) {
  const csv = filasCsv
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
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
