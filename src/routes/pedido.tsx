import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  Plus,
  Copy,
  Camera,
  X,
  QrCode,
} from "lucide-react";
import { formatCOP, dentroDeHorario } from "@/lib/menu-data";
import { addToCart, cartTotal, clearCart, crearPedido, useStore } from "@/lib/store";
import { getClienteLocal, guardarCliente, normalizarTelefono } from "@/lib/clientes";
import { MapaUbicacion } from "@/components/MapaUbicacion";
import { buscarBarrios, useTarifasDomicilio, type TarifaDomicilio } from "@/lib/tarifas-domicilio";
import { supabase } from "@/lib/supabase";
import { linkPago } from "@/lib/documentos";

const CUENTAS_TRANSFERENCIA = [
  {
    banco: "Bancolombia",
    tipo: "Cuenta corriente",
    numero: "37300002870",
    logo: "/logos/bancolombia.png",
    color: "#0033A0",
  },
  { banco: "Nequi", tipo: null, numero: "3016112924", logo: "/logos/nequi.png", color: "#DA1884" },
  {
    banco: "Bre-B",
    tipo: "Llave",
    numero: "0080575087",
    logo: "/logos/breb.png",
    color: "#008C99",
  },
  {
    banco: "Bold",
    tipo: "Paga con QR desde cualquier banco",
    numero: null,
    logo: "/logos/logobold.png",
    color: "#E0264F",
    esQR: true,
    qrImagen: "/logos/bold.png",
  },
] as const;

export const Route = createFileRoute("/pedido")({
  head: () => ({
    meta: [
      { title: "Confirmar pedido | Tremendo Chicharrón" },
      {
        name: "description",
        content:
          "Completa tus datos de entrega, elige medio de pago y confirma tu pedido a domicilio.",
      },
      { property: "og:title", content: "Confirmar pedido | Tremendo Chicharrón" },
      {
        property: "og:description",
        content: "Datos de entrega y medio de pago para tu pedido a domicilio en Manizales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Checkout,
});

const MEDIOS = [
  { id: "efectivo", label: "Efectivo", icono: "/efectivo.png" },
  { id: "transferencia", label: "Transferencia", icono: "/transferencias.png" },
  { id: "tarjeta", label: "Tarjeta", icono: "/transferencias.png" },
] as const;

// Combos sugeridos para "Completa tu pedido" (entrada + bebida)
const COMBOS_SUGERIDOS = [
  {
    id: "combo-mazamorra-limonada",
    entrada: {
      producto_id: "pic-mazamorra",
      nombre: "Tremenda Mazamorra Michelada",
      precio: 15000,
    },
    bebida: { producto_id: "beb-limonada", nombre: "Limonada natural", precio: 10000 },
    total: 25000,
  },
  {
    id: "combo-chuzarron-gaseosa",
    entrada: { producto_id: "pic-chuzarron", nombre: "Tremendo Chuzarrón", precio: 22000 },
    bebida: { producto_id: "beb-gaseosa", nombre: "Gaseosa Postobón", precio: 6000 },
    total: 28000,
  },
  {
    id: "combo-mazamorra-gaseosa",
    entrada: {
      producto_id: "pic-mazamorra",
      nombre: "Tremenda Mazamorra Michelada",
      precio: 15000,
    },
    bebida: { producto_id: "beb-gaseosa", nombre: "Gaseosa Postobón", precio: 6000 },
    total: 21000,
  },
  {
    id: "combo-chuzarron-limonada",
    entrada: { producto_id: "pic-chuzarron", nombre: "Tremendo Chuzarrón", precio: 22000 },
    bebida: { producto_id: "beb-limonada", nombre: "Limonada natural", precio: 10000 },
    total: 32000,
  },
] as const;

const CHECKOUT_DRAFT_KEY = "tremendo-chicharron-checkout-v1";
type CheckoutDraft = {
  nombre: string;
  telefono: string;
  barrioTexto: string;
  barrioSel: TarifaDomicilio | null;
  direccion: string;
  lat: number | null;
  lng: number | null;
  medio: (typeof MEDIOS)[number]["id"];
  billete: string;
  propina: number;
  propinaOtro: boolean;
};

function leerBorradorCheckout(): CheckoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHECKOUT_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CheckoutDraft) : null;
  } catch {
    return null;
  }
}

function guardarBorradorCheckout(borrador: CheckoutDraft) {
  try {
    localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(borrador));
  } catch {
    /* quota */
  }
}

function limpiarBorradorCheckout() {
  try {
    localStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function Checkout() {
  const navigate = useNavigate();
  const borradorInicial = leerBorradorCheckout();
  const tieneBorrador = borradorInicial !== null;
  const cart = useStore((s) => s.cart);
  const negocioAbierto = useStore((s) => s.config.negocio_abierto) && dentroDeHorario();
  const subtotal = cartTotal(cart);
  const { tarifas, cargando: cargandoTarifas } = useTarifasDomicilio();

  const [nombre, setNombre] = useState(borradorInicial?.nombre ?? "");
  const [telefono, setTelefono] = useState(borradorInicial?.telefono ?? "");
  const [barrioTexto, setBarrioTexto] = useState(borradorInicial?.barrioTexto ?? "");
  const [barrioSel, setBarrioSel] = useState<TarifaDomicilio | null>(
    borradorInicial?.barrioSel ?? null,
  );
  const [direccion, setDireccion] = useState(borradorInicial?.direccion ?? "");
  const [lat, setLat] = useState<number | null>(borradorInicial?.lat ?? null);
  const [lng, setLng] = useState<number | null>(borradorInicial?.lng ?? null);
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [medio, setMedio] = useState<(typeof MEDIOS)[number]["id"]>(
    borradorInicial?.medio ?? "efectivo",
  );
  const [billete, setBillete] = useState(borradorInicial?.billete ?? "");
  const [error, setError] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [propina, setPropina] = useState(borradorInicial?.propina ?? 0);
  const [propinaOtro, setPropinaOtro] = useState(borradorInicial?.propinaOtro ?? false);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const pedidoTransferRef = useRef<Awaited<ReturnType<typeof crearPedido>> | null>(null);
  const barrioRef = useRef<HTMLDivElement>(null);

  // Precarga los datos del cliente guardados en el mini-login.
  useEffect(() => {
    const cliente = getClienteLocal();
    if (cliente && !tieneBorrador) {
      setNombre(cliente.nombre);
      setTelefono(cliente.telefono);
    }
  }, [tieneBorrador]);

  useEffect(() => {
    guardarBorradorCheckout({
      nombre,
      telefono,
      barrioTexto,
      barrioSel,
      direccion,
      lat,
      lng,
      medio,
      billete,
      propina,
      propinaOtro,
    });
  }, [
    nombre,
    telefono,
    barrioTexto,
    barrioSel,
    direccion,
    lat,
    lng,
    medio,
    billete,
    propina,
    propinaOtro,
  ]);

  useEffect(() => {
    function restaurarAlVolver() {
      if (document.visibilityState !== "visible") return;
      const borrador = leerBorradorCheckout();
      if (!borrador) return;
      setNombre(borrador.nombre);
      setTelefono(borrador.telefono);
      setBarrioTexto(borrador.barrioTexto);
      setBarrioSel(borrador.barrioSel);
      setDireccion(borrador.direccion);
      setLat(borrador.lat);
      setLng(borrador.lng);
      setMedio(borrador.medio);
      setBillete(borrador.billete);
      setPropina(borrador.propina);
      setPropinaOtro(borrador.propinaOtro);
    }
    document.addEventListener("visibilitychange", restaurarAlVolver);
    return () => document.removeEventListener("visibilitychange", restaurarAlVolver);
  }, []);

  // Cierra la lista desplegable al hacer clic fuera del combobox.
  useEffect(() => {
    function alClicFuera(e: MouseEvent) {
      if (barrioRef.current && !barrioRef.current.contains(e.target as Node)) {
        setListaAbierta(false);
      }
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, []);

  const coincidencias = useMemo(() => buscarBarrios(tarifas, barrioTexto), [tarifas, barrioTexto]);

  // Recomendación inteligente: sugiere un combo que NO esté ya en el carrito
  const comboRecomendado = useMemo(() => {
    const idsEnCarrito = new Set(cart.map((i) => i.producto_id));
    // Prioriza combos donde ni la entrada ni la bebida estén en el carrito
    const disponibles = COMBOS_SUGERIDOS.filter(
      (c) => !idsEnCarrito.has(c.entrada.producto_id) && !idsEnCarrito.has(c.bebida.producto_id),
    );
    if (disponibles.length > 0) return disponibles[0];
    // Si todos tienen algo en el carrito, sugiere el primero que no tenga la entrada
    const sinEntrada = COMBOS_SUGERIDOS.find((c) => !idsEnCarrito.has(c.entrada.producto_id));
    if (sinEntrada) return sinEntrada;
    // Si todos tienen la entrada, sugiere el primero que no tenga la bebida
    const sinBebida = COMBOS_SUGERIDOS.find((c) => !idsEnCarrito.has(c.bebida.producto_id));
    return sinBebida ?? null;
  }, [cart]);

  const valorDomicilio = barrioSel?.tarifa ?? 0;
  const total = subtotal + valorDomicilio + propina;
  const recibido = Number(billete.replace(/\D/g, "")) || 0;
  const vuelto = recibido - total;

  function seleccionarBarrio(t: TarifaDomicilio) {
    setBarrioTexto(t.ubicacion);
    setBarrioSel(t);
    setListaAbierta(false);
    setError("");
  }

  function cambiarBarrioTexto(v: string) {
    setBarrioTexto(v);
    setBarrioSel(null);
    setListaAbierta(true);
    setError("");
  }

  async function confirmar() {
    // Evitar doble clic / reintentos mientras se procesa (previene duplicados)
    if (procesando) return;
    if (!nombre.trim() || telefono.trim().length < 7) {
      setError("Completa nombre y teléfono.");
      return;
    }
    if (!barrioSel) {
      setError(
        "Selecciona un barrio válido de la lista. Si no aparece, verifica la ortografía o contáctanos por WhatsApp.",
      );
      return;
    }
    if (!direccion.trim()) {
      setError("Completa la dirección exacta (calle, torre/apto, punto de referencia).");
      return;
    }
    if (medio === "efectivo" && recibido < total) {
      setError("El valor con el que pagas debe ser igual o mayor al total.");
      return;
    }
    if (medio === "transferencia" && !comprobante) {
      setError("Sube una foto del comprobante para continuar.");
      return;
    }
    // Guardar cliente en localStorage + Supabase (teléfono normalizado)
    const telefonoNormalizado = normalizarTelefono(telefono);
    await guardarCliente({ nombre: nombre.trim(), telefono: telefonoNormalizado });

    setProcesando(true);
    setError("");
    try {
      const pedido =
        pedidoTransferRef.current ??
        (await crearPedido({
          cliente_nombre: nombre.trim(),
          cliente_telefono: telefonoNormalizado,
          direccion_entrega: direccion.trim(),
          barrio: barrioSel.ubicacion,
          valor_domicilio: barrioSel.tarifa,
          propina,
          medio_pago: medio,
          monto_efectivo_recibido: medio === "efectivo" ? recibido : null,
          items: cart,
          latitud: lat,
          longitud: lng,
        }));
      if (medio === "transferencia" && !pedidoTransferRef.current)
        pedidoTransferRef.current = pedido;
      if (medio === "transferencia" && comprobante) {
        if (!supabase)
          throw new Error("No hay conexión con el servidor para subir el comprobante.");
        const ruta = `comprobantes/${pedido.numero_comanda}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("menu-imagenes")
          .upload(ruta, comprobante, {
            contentType: comprobante.type || "image/jpeg",
            upsert: false,
          });
        if (uploadError) throw new Error(`No se pudo subir el comprobante: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from("menu-imagenes").getPublicUrl(ruta);
        const { data: pedidoConComprobante, error: registroError } = await supabase.rpc(
          "registrar_comprobante_pago",
          {
            p_pedido_id: pedido.id,
            p_telefono: pedido.cliente_telefono,
            p_comprobante_url: urlData.publicUrl,
          },
        );
        if (registroError)
          throw new Error(`No se pudo registrar el comprobante: ${registroError.message}`);
        if (!pedidoConComprobante?.comprobante_pago_url) {
          throw new Error("El comprobante se subió, pero no se confirmó en el pedido.");
        }
        pedido.comprobante_pago_url = urlData.publicUrl;
        pedido.estado = "pendiente_pago";
        window.open(linkPago(pedido), "_blank", "noopener,noreferrer");
      }
      clearCart();
      limpiarBorradorCheckout();
      void navigate({ to: "/confirmacion/$comanda", params: { comanda: pedido.numero_comanda } });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar el pedido. Intenta de nuevo.",
      );
    } finally {
      setProcesando(false);
    }
  }

  if (cart.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-primary">Tu carrito está vacío</h1>
        <Link
          to="/menu"
          className="rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground"
        >
          Ir al menú
        </Link>
      </main>
    );
  }

  const barrioNoEncontrado =
    barrioTexto.trim().length > 0 && !barrioSel && coincidencias.length === 0;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-16">
      <header className="flex items-center gap-3 py-4">
        <Link to="/menu" className="text-muted-foreground" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-3xl text-primary">Confirmar pedido</h1>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        {cart.map((i) => (
          <div key={i.key} className="flex justify-between gap-3 py-1.5 text-sm">
            <span>
              {i.cantidad}x {i.nombre}
              {i.variante_personas ? ` (${i.variante_personas} pers.)` : ""}
              {i.combo ? " + combo" : ""}
            </span>
            <span className="text-primary">{formatCOP(i.precio_unitario * i.cantidad)}</span>
          </div>
        ))}
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
          <span>Subtotal</span>
          <span className="text-primary">{formatCOP(subtotal)}</span>
        </div>
        <div className="flex justify-between pt-1 text-sm">
          <span>Domicilio</span>
          <span className="text-primary">{barrioSel ? formatCOP(valorDomicilio) : "—"}</span>
        </div>
        {propina > 0 && (
          <div className="flex justify-between pt-1 text-sm">
            <span>Propina domiciliario</span>
            <span className="text-primary">{formatCOP(propina)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-border pt-2 font-display text-2xl">
          <span>Total</span>
          <span className="text-primary">{formatCOP(total)}</span>
        </div>
      </section>

      {/* Completa tu pedido — recomendación inteligente */}
      {comboRecomendado && (
        <section className="mt-5 rounded-2xl border border-accent/50 bg-gradient-to-br from-card to-card/80 p-4 shadow-glow">
          <p className="flex items-center gap-1.5 text-xs tracking-widest text-accent uppercase">
            <Sparkles className="size-3.5" /> Completa tu pedido
          </p>
          <p className="mt-1 font-display text-xl text-primary">
            + {comboRecomendado.entrada.nombre} + {comboRecomendado.bebida.nombre}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agrega ambos por{" "}
            <span className="font-semibold text-primary">{formatCOP(comboRecomendado.total)}</span>
          </p>
          <button
            onClick={() => {
              addToCart({
                producto_id: comboRecomendado.entrada.producto_id,
                nombre: comboRecomendado.entrada.nombre,
                cantidad: 1,
                variante_personas: null,
                notas: "",
                precio_unitario: comboRecomendado.entrada.precio,
                combo: false,
              });
              addToCart({
                producto_id: comboRecomendado.bebida.producto_id,
                nombre: comboRecomendado.bebida.nombre,
                cantidad: 1,
                variante_personas: null,
                notas: "",
                precio_unitario: comboRecomendado.bebida.precio,
                combo: false,
              });
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brasa py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Plus className="size-4" /> Agregar combo al pedido
          </button>
        </section>
      )}

      <section className="mt-5 space-y-3">
        <Campo label="Nombre" value={nombre} onChange={setNombre} placeholder="Tu nombre" />
        <Campo
          label="Teléfono / WhatsApp"
          value={telefono}
          onChange={setTelefono}
          placeholder="300 000 0000"
          type="tel"
        />

        {/* Barrio — combobox con búsqueda */}
        <div ref={barrioRef} className="relative">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">Barrio</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-input px-3 focus-within:ring-2 focus-within:ring-ring">
            <input
              value={barrioTexto}
              onChange={(e) => cambiarBarrioTexto(e.target.value)}
              onFocus={() => setListaAbierta(true)}
              placeholder="Escribe tu barrio…"
              className="flex-1 bg-transparent py-3 text-sm outline-none"
              autoComplete="off"
            />
            {cargandoTarifas ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            )}
          </div>

          {listaAbierta && !cargandoTarifas && coincidencias.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card shadow-card">
              {coincidencias.map((t) => (
                <li key={t.ubicacion}>
                  <button
                    type="button"
                    onClick={() => seleccionarBarrio(t)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-primary/10"
                  >
                    <span>{t.ubicacion}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {formatCOP(t.tarifa)}
                      {barrioSel?.ubicacion === t.ubicacion && (
                        <Check className="size-4 text-primary" />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {barrioNoEncontrado && (
            <p className="mt-1 text-xs text-destructive">
              Barrio no encontrado, verifica la ortografía o contáctanos por WhatsApp.
            </p>
          )}
          {barrioSel && (
            <p className="mt-1 text-xs text-primary">
              📍 {barrioSel.ubicacion} · Domicilio {formatCOP(barrioSel.tarifa)}
            </p>
          )}
        </div>

        {/* Dirección exacta */}
        <label className="block">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            Dirección exacta
          </span>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setMapaAbierto(true)}
              className="shrink-0"
              aria-label="Seleccionar ubicación en el mapa"
            >
              <img src="/ubicacion.png" alt="" className="size-11 rounded-xl" />
            </button>
            <textarea
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              rows={2}
              placeholder="Calle, torre/apto, punto de referencia"
              className="flex-1 rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {lat !== null && lng !== null && (
            <p className="mt-1 text-xs text-primary">
              📍 Coordenadas: {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          )}
        </label>

        {/* Propina para el domiciliario */}
        <div>
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            ¿Deseas dejar propina para el domiciliario?
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[1000, 2000, 3000].map((monto) => (
              <button
                key={monto}
                type="button"
                onClick={() => {
                  setPropina(monto);
                  setPropinaOtro(false);
                }}
                className={`rounded-xl border p-3 text-sm font-semibold ${
                  propina === monto && !propinaOtro
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card"
                }`}
              >
                {formatCOP(monto)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPropinaOtro(true);
                setPropina(0);
              }}
              className={`rounded-xl border p-3 text-sm font-semibold ${
                propinaOtro ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
              }`}
            >
              Otro monto
            </button>
            <button
              type="button"
              onClick={() => {
                setPropina(0);
                setPropinaOtro(false);
              }}
              className={`rounded-xl border p-3 text-sm font-semibold ${
                propina === 0 && !propinaOtro
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card"
              }`}
            >
              No dar propina
            </button>
          </div>
          {propinaOtro && (
            <input
              inputMode="numeric"
              value={propina === 0 ? "" : String(propina)}
              onChange={(e) => setPropina(Number(e.target.value.replace(/\D/g, "")) || 0)}
              placeholder="Escribe el monto en pesos"
              className="mt-2 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          {propina > 0 && (
            <p className="mt-1 text-xs text-primary">
              💛 Propina domiciliario: {formatCOP(propina)}
            </p>
          )}
        </div>

        <div>
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            Medio de pago
          </span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {MEDIOS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMedio(m.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs font-semibold ${
                  medio === m.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card"
                }`}
              >
                <img src={m.icono} alt="" className="size-8 rounded-lg" />
                {m.label}
              </button>
            ))}
          </div>
          {medio === "tarjeta" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Recibimos Visa, Mastercard, American Express, Diners Club y Discover. El cobro lo
              gestiona el restaurante con su datáfono/pasarela.
            </p>
          )}
        </div>

        {medio === "efectivo" && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="font-display text-xl text-primary">¿Con cuánto vas a pagar?</p>
            <input
              inputMode="numeric"
              value={billete}
              onChange={(e) => setBillete(e.target.value)}
              placeholder="Ej: 50000"
              className="mt-2 w-full rounded-xl bg-input p-3 outline-none focus:ring-2 focus:ring-ring"
            />
            {recibido > 0 && (
              <p className="mt-2 text-sm">
                Tu vuelto:{" "}
                <span className={vuelto >= 0 ? "text-primary" : "text-destructive"}>
                  {formatCOP(Math.max(vuelto, 0))}
                </span>
              </p>
            )}
          </div>
        )}

        {medio === "transferencia" && (
          <TransferenciaPago
            comprobante={comprobante}
            onComprobante={setComprobante}
            copiado={copiado}
            onCopiar={async (numero) => {
              await navigator.clipboard.writeText(numero);
              setCopiado(numero);
              window.setTimeout(
                () => setCopiado((actual) => (actual === numero ? null : actual)),
                2000,
              );
            }}
            onQuitar={() => setComprobante(null)}
          />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={confirmar}
          disabled={!negocioAbierto || procesando || (medio === "transferencia" && !comprobante)}
          className="w-full rounded-2xl bg-brasa py-4 font-display text-2xl text-primary-foreground shadow-glow disabled:opacity-40"
        >
          {procesando
            ? medio === "transferencia"
              ? "Subiendo comprobante…"
              : "Registrando pedido…"
            : negocioAbierto
              ? "Confirmar pedido"
              : "Cerrado por ahora"}
        </button>
      </section>

      {mapaAbierto && (
        <MapaUbicacion
          onUbicacion={(lat, lng, dir) => {
            setLat(lat);
            setLng(lng);
            setDireccion(dir);
          }}
          onClose={() => setMapaAbierto(false)}
        />
      )}
    </main>
  );
}

function TransferenciaPago({
  comprobante,
  onComprobante,
  copiado,
  onCopiar,
  onQuitar,
}: {
  comprobante: File | null;
  onComprobante: (file: File | null) => void;
  copiado: string | null;
  onCopiar: (numero: string) => Promise<void>;
  onQuitar: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [qrAbierto, setQrAbierto] = useState(false);

  useEffect(() => {
    if (!qrAbierto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [qrAbierto]);

  return (
    <section className="space-y-4 rounded-2xl border border-primary/25 bg-card/80 p-4">
      <div>
        <p className="font-display text-2xl text-primary">Paga por transferencia</p>
        <p className="text-xs text-muted-foreground">
          Usa cualquiera de estas cuentas y guarda tu comprobante.
        </p>
      </div>
      <div className="space-y-3">
        {CUENTAS_TRANSFERENCIA.map((cuenta) => (
          <article
            key={cuenta.banco}
            className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-3"
            style={{ borderLeft: `4px solid ${cuenta.color}` }}
          >
            <img
              src={cuenta.logo}
              alt={cuenta.banco}
              className="size-12 shrink-0 rounded-xl bg-white object-contain p-1"
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white">{cuenta.banco}</p>
              {cuenta.tipo && <p className="text-xs text-muted-foreground">{cuenta.tipo}</p>}
              {!cuenta.esQR && (
                <p className="truncate font-mono text-lg tracking-wide text-foreground">
                  {cuenta.numero}
                </p>
              )}
            </div>
            {cuenta.esQR ? (
              <button
                type="button"
                onClick={() => setQrAbierto(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition duration-200 hover:scale-105 hover:brightness-110"
              >
                <QrCode className="size-4" /> Ver QR
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onCopiar(cuenta.numero!)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition duration-200 hover:scale-105 hover:brightness-110"
              >
                {copiado === cuenta.numero ? (
                  <Check className="size-4 text-emerald-700" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copiado === cuenta.numero ? "¡Copiado!" : "Copiar"}
              </button>
            )}
          </article>
        ))}
      </div>
      <div>
        <p className="font-display text-xl text-primary">Sube tu comprobante de pago</p>
        <p className="text-xs text-muted-foreground">
          Lo revisamos y confirmamos tu pedido enseguida
        </p>
      </div>
      {comprobante ? (
        <div className="relative inline-block max-w-full">
          <img
            src={URL.createObjectURL(comprobante)}
            alt="Vista previa del comprobante"
            className="max-h-56 max-w-full rounded-2xl object-contain"
          />
          <button
            type="button"
            onClick={onQuitar}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1.5 text-white shadow-lg"
            aria-label="Quitar comprobante"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-background/40 text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5"
        >
          <Camera className="size-8 text-primary" />
          <span>Toca para subir una foto</span>
          <span className="text-[11px]">JPG, PNG o foto desde tu cámara</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onComprobante(e.target.files?.[0] ?? null)}
      />
      {qrAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Código QR de Bold"
          onClick={() => setQrAbierto(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-primary/30 bg-card p-5 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQrAbierto(false)}
              className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Cerrar QR"
            >
              <X className="size-5" />
            </button>
            <p className="font-display text-2xl text-primary">QR Bold</p>
            <img
              src="/logos/bold.png"
              alt="Código QR de Bold"
              className="mx-auto mt-4 max-h-[min(65vh,420px)] w-auto max-w-full rounded-2xl bg-white p-3 object-contain"
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Escanea desde la app de tu banco — límite $11.000.000 por transacción
            </p>
            <a
              href="/logos/bold.png"
              download="bold-qr.png"
              className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110"
            >
              Descargar QR
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs tracking-widest text-muted-foreground uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
