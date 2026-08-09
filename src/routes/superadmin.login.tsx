import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { iniciarSesion } from "@/lib/auth-staff";

export const Route = createFileRoute("/superadmin/login")({
  head: () => ({
    meta: [
      { title: "Acceso dueño | Tremendo Chicharrón" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperAdminLogin,
});

function SuperAdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function entrar() {
    if (iniciarSesion("dueno", password)) {
      void navigate({ to: "/superadmin" });
    } else {
      setError("Contraseña incorrecta.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-primary/30 bg-popover p-6 shadow-glow">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Inicio
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-brasa text-primary-foreground">
            <Lock className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-primary">Panel del dueño</h1>
            <p className="text-xs text-muted-foreground">Acceso restringido</p>
          </div>
        </div>

        <label className="mt-6 block">
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
          className="mt-5 w-full rounded-2xl bg-brasa py-3 font-display text-xl text-primary-foreground shadow-glow"
        >
          Entrar
        </button>
      </div>
    </main>
  );
}