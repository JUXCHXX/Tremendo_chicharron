import { formatCOP } from "./menu-data";
import type { Pedido } from "./store";
import { ESTADO_LABEL } from "./store";
import { obtenerNit } from "./supabase";
import { jsPDF } from "jspdf";

/**
 * Abre una ventana de impresión con el formato de ticket térmico (80mm).
 * El ancho de la ventana se ajusta al ancho típico de impresoras térmicas.
 */
function abrirImpresion(titulo: string, cuerpo: string) {
  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/>
  <title>${titulo}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ui-monospace, "Courier New", Menlo, monospace;
      background: #fff;
      color: #000;
      width: 80mm;
      margin: 0 auto;
      padding: 6mm 4mm;
      font-size: 11px;
      line-height: 1.35;
    }
    .centro { text-align: center; }
    .negrita { font-weight: 700; }
    .grande { font-size: 15px; }
    .mediano { font-size: 13px; }
    .pequeno { font-size: 9px; }
    .gris { color: #444; }
    .doble { letter-spacing: 1px; }
    .separador { border-top: 1px dashed #000; margin: 6px 0; }
    .separador-solido { border-top: 1px solid #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .c { text-align: center; }
    .item-nombre { font-weight: 700; }
    .item-nota { color: #333; padding-left: 8px; }
    .item-precio { text-align: right; white-space: nowrap; }
    .fila-total { font-size: 14px; font-weight: 700; }
    .fila-total td { padding-top: 3px; }
    .pago-metodo { font-size: 13px; font-weight: 700; letter-spacing: 2px; }
    .pie { margin-top: 8px; text-align: center; }
    .pie .marca { font-size: 13px; font-weight: 700; letter-spacing: 1px; }
    .nota-pie { font-size: 9px; color: #333; margin-top: 4px; }
    .cliente-bloque { margin-top: 4px; }
    .cliente-bloque .fila { display: flex; justify-content: space-between; }
    .cliente-bloque .fila span:last-child { text-align: right; }
    .encabezado { margin-bottom: 4px; }
    .encabezado .razon { font-size: 9px; color: #333; }
    .encabezado .nit { font-size: 9px; color: #333; }
    .factura-titulo { font-size: 13px; font-weight: 700; letter-spacing: 2px; margin-top: 4px; }
    .factura-meta { display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px; }
    .factura-meta .fecha { text-align: left; }
    .factura-meta .numero { text-align: right; }
    .hora { text-align: right; font-size: 10px; }
    .seccion-titulo { font-size: 10px; font-weight: 700; letter-spacing: 1px; margin-top: 6px; }
    .detalle-encabezado { font-size: 9px; font-weight: 700; border-bottom: 1px solid #000; padding-bottom: 2px; }
    .detalle-encabezado td { padding: 2px 0; }
    .item-bloque { margin-top: 3px; }
    .item-bloque .fila-principal { display: flex; justify-content: space-between; }
    .item-bloque .fila-principal .nombre { font-weight: 700; }
    .item-bloque .fila-principal .total { text-align: right; white-space: nowrap; }
    .item-bloque .nota { color: #333; padding-left: 10px; font-size: 10px; }
    .item-bloque .precio-unitario { color: #333; padding-left: 10px; font-size: 10px; }
    .totales { margin-top: 4px; }
    .totales .fila { display: flex; justify-content: space-between; }
    .totales .fila .label { text-align: left; }
    .totales .fila .valor { text-align: right; white-space: nowrap; }
    .totales .fila-total { font-size: 14px; font-weight: 700; border-top: 1px solid #000; padding-top: 3px; }
    .pago-bloque { margin-top: 6px; }
    .pago-bloque .metodo { font-size: 13px; font-weight: 700; letter-spacing: 2px; }
    .pago-bloque .fila { display: flex; justify-content: space-between; }
    .pago-bloque .fila .label { text-align: left; }
    .pago-bloque .fila .valor { text-align: right; white-space: nowrap; }
    .nota-final { margin-top: 8px; text-align: center; font-size: 9px; color: #333; }
    .marca-final { margin-top: 6px; text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 1px; }
    .gracias { margin-top: 2px; text-align: center; font-size: 10px; }
  </style></head><body>${cuerpo}
  <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

/** Formatea la fecha en formato colombiano: 20/08/2026 */
function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Formatea la hora en formato colombiano: 7:17 p. m. */
function formatearHora(iso: string): string {
  const d = new Date(iso);
  let horas = d.getHours();
  const minutos = String(d.getMinutes()).padStart(2, "0");
  const ampm = horas >= 12 ? "p. m." : "a. m.";
  horas = horas % 12 || 12;
  return `${horas}:${minutos} ${ampm}`;
}

/** Genera el HTML del ticket térmico de factura (formato 80mm). */
function generarTicketFactura(pd: Pedido, nit: string): string {
  const itemsHtml = pd.items
    .map((i) => {
      const nombre = `${i.cantidad}  ${i.nombre}${i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}${i.combo ? " + combo" : ""}`;
      const notas = i.notas
        ? i.notas
            .split("\n")
            .map((n) => `<div class="nota">• ${n}</div>`)
            .join("")
        : "";
      return `<div class="item-bloque">
        <div class="fila-principal">
          <span class="nombre">${nombre}</span>
          <span class="total">${formatCOP(i.precio_unitario * i.cantidad)}</span>
        </div>
        ${notas}
        <div class="precio-unitario">${formatCOP(i.precio_unitario)} c/u</div>
      </div>`;
    })
    .join("");

  const pagoHtml =
    pd.medio_pago === "efectivo" && pd.monto_efectivo_recibido != null
      ? `<div class="pago-bloque">
          <div class="metodo">${pd.medio_pago.toUpperCase()}</div>
          <div class="fila"><span class="label">Recibido</span><span class="valor">${formatCOP(pd.monto_efectivo_recibido)}</span></div>
          <div class="fila"><span class="label">Cambio</span><span class="valor">${formatCOP(Math.max(pd.vuelto ?? 0, 0))}</span></div>
        </div>`
      : `<div class="pago-bloque">
          <div class="metodo">${pd.medio_pago.toUpperCase()}</div>
        </div>`;

  return `
    <div class="encabezado centro">
      <div class="grande negrita doble">TREMENDO CHICHARRÓN</div>
      <div class="razon">Comercializadora Tremendo Chicharrón SAS</div>
      <div class="nit">NIT ${nit} | Manizales, Colombia</div>
    </div>

    <div class="factura-titulo centro">FACTURA DE VENTA</div>
    <div class="factura-meta">
      <span class="fecha">${formatearFecha(pd.creado_en)}</span>
      <span class="numero">No. ${pd.numero_comanda}</span>
    </div>
    <div class="hora">${formatearHora(pd.creado_en)}</div>

    <div class="separador"></div>

    <div class="seccion-titulo">CLIENTE</div>
    <div class="cliente-bloque">
      <div class="fila">
        <span>${pd.cliente_nombre}</span>
        <span>${pd.cliente_telefono}</span>
      </div>
      <div class="fila">
        <span>${pd.direccion_entrega}</span>
      </div>
      ${pd.barrio ? `<div class="fila"><span>Barrio ${pd.barrio}</span></div>` : ""}
    </div>

    <div class="separador"></div>

    <div class="seccion-titulo">DETALLE DE LA COMPRA</div>
    <table class="detalle-encabezado">
      <tr>
        <td style="width:12%">CANT.</td>
        <td>PRODUCTO</td>
        <td class="r" style="width:25%">TOTAL</td>
      </tr>
    </table>
    ${itemsHtml}

    <div class="separador"></div>

    <div class="totales">
      <div class="fila"><span class="label">Subtotal</span><span class="valor">${formatCOP(pd.subtotal)}</span></div>
      <div class="fila"><span class="label">Domicilio</span><span class="valor">${formatCOP(pd.valor_domicilio)}</span></div>
      ${pd.propina > 0 ? `<div class="fila"><span class="label">Propina domiciliario</span><span class="valor">${formatCOP(pd.propina)}</span></div>` : ""}
      <div class="fila fila-total"><span class="label">TOTAL</span><span class="valor">${formatCOP(pd.total)}</span></div>
    </div>

    <div class="separador"></div>

    <div class="seccion-titulo">MÉTODO DE PAGO</div>
    ${pagoHtml}

    <div class="separador"></div>

    <div class="nota-final">
      Gracias por elegirnos. Conserva esta factura<br/>como soporte de tu compra.
    </div>

    <div class="marca-final">TREMENDO CHICHARRÓN</div>
    <div class="gracias">¡Gracias por tu compra!</div>
  `;
}

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
       ${pd.propina > 0 ? `<tr><td>Propina domiciliario</td><td class="r">${formatCOP(pd.propina)}</td></tr>` : ""}
       <tr class="tot"><td>TOTAL</td><td class="r">${formatCOP(pd.total)}</td></tr>
     </table>
     <hr/><div>Pago: ${pd.medio_pago}${
       pd.monto_efectivo_recibido != null
         ? ` · Recibe ${formatCOP(pd.monto_efectivo_recibido)} · Vuelto ${formatCOP(pd.vuelto ?? 0)}`
         : ""
     }</div>`,
  );
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

/**
 * Imprime la factura directamente en la impresora térmica (formato 80mm).
 * Abre el diálogo de impresión del navegador con el ticket ya formateado.
 */
export async function imprimirFacturaTermica(pd: Pedido) {
  const nit = await obtenerNit();
  abrirImpresion(`Factura ${pd.numero_comanda}`, generarTicketFactura(pd, nit));
}

/** Factura del cliente (formato térmico 80mm). */
export async function descargarFactura(pd: Pedido) {
  const nit = await obtenerNit();
  abrirImpresion(`Factura ${pd.numero_comanda}`, generarTicketFactura(pd, nit));
}

/**
 * Factura en PDF con formato térmico (80mm) — una sola hoja/rollo.
 * Reemplaza el formato A4 anterior. Incluye encabezado con NIT, datos del
 * cliente, tabla de productos con notas, desglose de totales, método de pago
 * y pie de agradecimiento.
 */
export async function descargarFacturaPdf(pd: Pedido) {
  const nit = await obtenerNit();
  const doc = new jsPDF({ unit: "mm", format: [80, 200] });
  const W = 80;
  const M = 5;
  let y = 8;

  // ── Encabezado ──
  doc.setFont("courier", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("TREMENDO CHICHARRÓN", W / 2, y, { align: "center" });
  y += 5;
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.text("Comercializadora Tremendo Chicharrón SAS", W / 2, y, { align: "center" });
  y += 3.5;
  doc.text(`NIT ${nit} | Manizales, Colombia`, W / 2, y, { align: "center" });
  y += 5;

  // ── Título factura ──
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.text("FACTURA DE VENTA", W / 2, y, { align: "center" });
  y += 4.5;

  // ── Fecha y número ──
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.text(formatearFecha(pd.creado_en), M, y);
  doc.text(`No. ${pd.numero_comanda}`, W - M, y, { align: "right" });
  y += 3.5;
  doc.text(formatearHora(pd.creado_en), W - M, y, { align: "right" });
  y += 3;

  // ── Separador ──
  doc.setDrawColor(0, 0, 0);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(M, y, W - M, y);
  y += 4;

  // ── Cliente ──
  doc.setFont("courier", "bold");
  doc.setFontSize(7);
  doc.text("CLIENTE", M, y);
  y += 4;
  doc.setFont("courier", "normal");
  doc.text(pd.cliente_nombre, M, y);
  doc.text(pd.cliente_telefono, W - M, y, { align: "right" });
  y += 3.5;
  doc.text(pd.direccion_entrega, M, y);
  y += 3.5;
  if (pd.barrio) {
    doc.text(`Barrio ${pd.barrio}`, M, y);
    y += 3.5;
  }
  y += 1;

  // ── Separador ──
  doc.line(M, y, W - M, y);
  y += 4;

  // ── Detalle de la compra ──
  doc.setFont("courier", "bold");
  doc.setFontSize(7);
  doc.text("DETALLE DE LA COMPRA", M, y);
  y += 4;
  doc.text("CANT.", M, y);
  doc.text("PRODUCTO", M + 10, y);
  doc.text("TOTAL", W - M, y, { align: "right" });
  y += 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineDashPattern([], 0);
  doc.line(M, y, W - M, y);
  y += 3;

  // ── Items ──
  doc.setFont("courier", "normal");
  pd.items.forEach((i) => {
    const nombre = `${i.cantidad}  ${i.nombre}${i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}${i.combo ? " + combo" : ""}`;
    doc.setFont("courier", "bold");
    doc.text(nombre, M, y);
    doc.setFont("courier", "normal");
    doc.text(formatCOP(i.precio_unitario * i.cantidad), W - M, y, { align: "right" });
    y += 3.5;
    if (i.notas) {
      i.notas.split("\n").forEach((n) => {
        doc.setFontSize(6.5);
        doc.text(`• ${n}`, M + 3, y);
        y += 3;
      });
      doc.setFontSize(7);
    }
    doc.text(`${formatCOP(i.precio_unitario)} c/u`, M + 3, y);
    y += 4;
  });

  // ── Separador ──
  doc.setLineDashPattern([1, 1], 0);
  doc.line(M, y, W - M, y);
  y += 4;

  // ── Totales ──
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.text("Subtotal", M, y);
  doc.text(formatCOP(pd.subtotal), W - M, y, { align: "right" });
  y += 3.5;
  doc.text("Domicilio", M, y);
  doc.text(formatCOP(pd.valor_domicilio), W - M, y, { align: "right" });
  y += 3.5;
  if (pd.propina > 0) {
    doc.text("Propina domiciliario", M, y);
    doc.text(formatCOP(pd.propina), W - M, y, { align: "right" });
    y += 3.5;
  }
  y += 0.5;
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL", M, y);
  doc.text(formatCOP(pd.total), W - M, y, { align: "right" });
  y += 5;

  // ── Separador ──
  doc.setLineDashPattern([1, 1], 0);
  doc.line(M, y, W - M, y);
  y += 4;

  // ── Método de pago ──
  doc.setFont("courier", "bold");
  doc.setFontSize(7);
  doc.text("MÉTODO DE PAGO", M, y);
  y += 4;
  doc.setFontSize(9);
  doc.text(pd.medio_pago.toUpperCase(), M, y);
  y += 4;
  if (pd.medio_pago === "efectivo" && pd.monto_efectivo_recibido != null) {
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.text("Recibido", M, y);
    doc.text(formatCOP(pd.monto_efectivo_recibido), W - M, y, { align: "right" });
    y += 3.5;
    doc.text("Cambio", M, y);
    doc.text(formatCOP(Math.max(pd.vuelto ?? 0, 0)), W - M, y, { align: "right" });
    y += 4;
  }

  // ── Separador ──
  doc.setLineDashPattern([1, 1], 0);
  doc.line(M, y, W - M, y);
  y += 4;

  // ── Nota final ──
  doc.setFont("courier", "normal");
  doc.setFontSize(6.5);
  doc.text("Gracias por elegirnos. Conserva esta factura", W / 2, y, { align: "center" });
  y += 3;
  doc.text("como soporte de tu compra.", W / 2, y, { align: "center" });
  y += 5;

  // ── Marca final ──
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.text("TREMENDO CHICHARRÓN", W / 2, y, { align: "center" });
  y += 4;
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.text("¡Gracias por tu compra!", W / 2, y, { align: "center" });

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
    ...(pd.propina > 0 ? [`Propina domiciliario: ${formatCOP(pd.propina)}`] : []),
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
