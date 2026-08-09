import { useEffect, useState } from "react";
import { User, Phone, X } from "lucide-react";
import { getClienteLocal, guardarCliente, type Cliente } from "@/lib/clientes";

export function MiniLoginCliente({
  onGuardado,
}: {
  onGuardado?: (cliente: Cliente) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!getClienteLocal()) setAbierto(true);
  }, []);

  async function guardar() {
    if (!nombre.trim() || telefono.trim().length < 7) {
      setError("Ingresa tu nombre y un teléfono válido.");
      return;
    }
    setGuardando(true);
    const cliente: Cliente = { nombre: nombre.trim(), telefono: telefono.trim() };
    await guardarCliente(cliente);
    setGuardando(false);
    setAbierto(false);
    onGuardado?.(cliente);
  }

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-primary/30 bg-popover p-6 shadow-glow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl text-primary">¡Bienvenido!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuéntanos quién eres para agilizar tu pedido.
            </p>
          </div>
          <button
            onClick={() => setAbierto(false)}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Tu nombre
            </span>
            <div className="mt-1 flex items-center gap-2 rounded-xl bg-input px-3 focus-within:ring-2 focus-within:ring-ring">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Teléfono / WhatsApp
            </span>
            <div className="mt-1 flex items-center gap-2 rounded-xl bg-input px-3 focus-within:ring-2 focus-within:ring-ring">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="300 000 0000"
                type="tel"
                inputMode="tel"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={() => void guardar()}
            disabled={guardando}
            className="w-full rounded-2xl bg-brasa py-3.5 font-display text-xl text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Continuar"}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Tus datos se guardan en este dispositivo para precargar tus pedidos.
          </p>
        </div>
      </div>
    </div>
  );
}