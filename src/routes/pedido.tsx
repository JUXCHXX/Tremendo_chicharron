import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { formatCOP, dentroDeHorario } from "@/lib/menu-data";
import { cartTotal, crearPedido, useStore } from "@/lib/store";

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

function Checkout() {
  const navigate = useNavigate();
  const cart = useStore((s) => s.cart);
  const negocioAbierto = useStore((s) => s.config.negocio_abierto) && dentroDeHorario();
  const subtotal = cartTotal(cart);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [medio, setMedio] = useState<(typeof MEDIOS)[number]["id"]>("efectivo");
  const [billete, setBillete] = useState("");
  const [error, setError] = useState("");

  const recibido = Number(billete.replace(/\D/g, "")) || 0;
  const vuelto = recibido - subtotal;

  function confirmar() {
    if (!nombre.trim() || telefono.trim().length < 7 || !direccion.trim()) {
      setError("Completa nombre, teléfono y dirección de entrega.");
      return;
    }
    if (medio === "efectivo" && recibido < subtotal) {
      setError("El valor con el que pagas debe ser igual o mayor al total.");
      return;
    }
    const pedido = crearPedido({
      cliente_nombre: nombre.trim(),
      cliente_telefono: telefono.trim(),
      direccion_entrega: direccion.trim(),
      medio_pago: medio,
      monto_efectivo_recibido: medio === "efectivo" ? recibido : null,
      items: cart,
    });
    void navigate({ to: "/confirmacion/$comanda", params: { comanda: pedido.numero_comanda } });
  }

  if (cart.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-primary">Tu carrito está vacío</h1>
        <Link to="/menu" className="rounded-2xl bg-brasa px-6 py-3 font-display text-xl text-primary-foreground">
          Ir al menú
        </Link>
      </main>
    );
  }

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
        <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-2xl">
          <span>Subtotal</span>
          <span className="text-primary">{formatCOP(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          El valor del domicilio lo confirma la caja según tu dirección.
        </p>
      </section>

      <section className="mt-5 space-y-3">
        <Campo label="Nombre" value={nombre} onChange={setNombre} placeholder="Tu nombre" />
        <Campo
          label="Teléfono / WhatsApp"
          value={telefono}
          onChange={setTelefono}
          placeholder="300 000 0000"
          type="tel"
        />
        <label className="block">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            Dirección de entrega
          </span>
          <div className="mt-1 flex gap-2">
            <img src="/ubicacion.png" alt="" className="size-11 rounded-xl" />
            <textarea
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              rows={2}
              placeholder="Barrio, calle, torre/apto, punto de referencia"
              className="flex-1 rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </label>

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
                  medio === m.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={confirmar}
          disabled={!negocioAbierto}
          className="w-full rounded-2xl bg-brasa py-4 font-display text-2xl text-primary-foreground shadow-glow disabled:opacity-40"
        >
          {negocioAbierto ? "Confirmar pedido" : "Cerrado por ahora"}
        </button>
      </section>
    </main>
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