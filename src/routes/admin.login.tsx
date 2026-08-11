import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { iniciarSesion } from "@/lib/auth-staff";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (s: Record<string, unknown>) => {
    const e = s["error"];
    return typeof e === "string" && e ? { error: e } : {};
  },
  head: () => ({
    meta: [{ title: "Acceso caja | Tremendo Chicharrón" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { error: errorParam } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam);
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    if (!email.trim() || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }
    setCargando(true);
    setError("");
    const res = await iniciarSesion(email.trim(), password, "admin");
    setCargando(false);
    if (!res.ok) {
      setError(res.error ?? "Error al iniciar sesión.");
      return;
    }
    void navigate({ to: "/admin" });
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
            <Lock className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-primary">Panel de caja</h1>
            <p className="text-xs text-muted-foreground">Acceso restringido al personal</p>
          </div>
        </div>

        <label className="mt-6 block">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cajera@tremendochicharron.com"
            className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            Contraseña
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            placeholder="••••••••"
            className="mt-1 w-full rounded-xl bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <button
          onClick={entrar}
          disabled={cargando}
          className="mt-5 w-full rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {cargando ? "Verificando…" : "Entrar"}
        </button>
      </div>
    </main>
  );
}
