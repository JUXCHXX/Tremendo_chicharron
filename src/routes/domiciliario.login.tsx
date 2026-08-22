import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, ArrowLeft, User, Mail, Lock, Loader2 } from "lucide-react";
import { iniciarSesionDomiciliario, registrarDomiciliario } from "@/lib/auth-domiciliario";

export const Route = createFileRoute("/domiciliario/login")({
  head: () => ({
    meta: [
      { title: "Acceso domiciliario | Tremendo Chicharrón" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DomiciliarioLogin,
});

type Modo = "login" | "registro";

function DomiciliarioLogin() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    if (modo === "registro" && !nombre.trim()) {
      setError("Escribe tu nombre y apellido.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }
    if (modo === "registro" && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCargando(true);
    setError("");

    const res =
      modo === "login"
        ? await iniciarSesionDomiciliario(email.trim(), password)
        : await registrarDomiciliario(nombre, email.trim(), password);

    setCargando(false);
    if (!res.ok) {
      setError(res.error ?? "Error al procesar la solicitud.");
      return;
    }
    void navigate({ to: "/domiciliario" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-primary/30 bg-popover p-6 shadow-glow">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Inicio
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-brasa text-primary-foreground">
            <Bike className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-primary">Domiciliario</h1>
            <p className="text-xs text-muted-foreground">
              {modo === "login" ? "Inicia sesión para tomar pedidos" : "Crea tu cuenta de domiciliario"}
            </p>
          </div>
        </div>

        {/* Toggle login / registro */}
        <div className="mt-5 flex rounded-xl bg-muted p-1">
          <button
            onClick={() => {
              setModo("login");
              setError("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              modo === "login" ? "bg-brasa text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => {
              setModo("registro");
              setError("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              modo === "registro" ? "bg-brasa text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Registrarme
          </button>
        </div>

        {modo === "registro" && (
          <label className="mt-5 block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Nombre y apellido
            </span>
            <div className="mt-1 flex items-center gap-2 rounded-xl bg-input px-3">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full bg-transparent py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </label>
        )}

        <label className="mt-3 block">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">Correo</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-input px-3">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="domiciliario@tremendochicharron.com"
              className="w-full bg-transparent py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </label>

        <label className="mt-3 block">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            Contraseña
          </span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-input px-3">
            <Lock className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void enviar()}
              placeholder="••••••••"
              className="w-full bg-transparent py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </label>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <button
          onClick={() => void enviar()}
          disabled={cargando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {cargando && <Loader2 className="size-5 animate-spin" />}
          {cargando
            ? "Procesando…"
            : modo === "login"
              ? "Entrar"
              : "Crear cuenta"}
        </button>
      </div>
    </main>
  );
}