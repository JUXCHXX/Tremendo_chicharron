import { createFileRoute, Link } from "@tanstack/react-router";
import { UtensilsCrossed, Truck, MapPin, BadgePercent } from "lucide-react";
import { dentroDeHorario, HORARIOS } from "@/lib/menu-data";
import { useMenuData, promocionVigente } from "@/lib/use-menu-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tremendo Chicharrón | Domicilios en Manizales" },
      {
        name: "description",
        content:
          "Chicharrón crocante, picadas, calentados y paella de chicharrón a domicilio en Manizales. Pide en línea y paga por WhatsApp.",
      },
      { property: "og:title", content: "Tremendo Chicharrón | Domicilios en Manizales" },
      {
        property: "og:description",
        content: "Menú digital y pedidos a domicilio de la cocina más tremenda de Manizales.",
      },
      { property: "og:type", content: "restaurant.restaurant" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const BOTONES = [
  { to: "/menu", label: "Ver Menú", icon: UtensilsCrossed, subtitulo: undefined },
  {
    to: "/mi-chicharronera",
    label: "Mi Chicharronera",
    icon: Truck,
    subtitulo: "Seguimiento de pedidos",
  },
] as const;

function Home() {
  const abierto = useStore((s) => s.config.negocio_abierto) && dentroDeHorario();
  const { promociones } = useMenuData();
  const promoVigente = promociones.find((p) => promocionVigente(p));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center px-6 py-12">
        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-brasa opacity-30 blur-2xl" />
          <img
            src="/logo-tremendochicharron.jpeg"
            alt="Logo Tremendo Chicharrón"
            className="relative size-40 rounded-full border-2 border-primary/70 object-cover shadow-glow"
          />
        </div>

        <h1 className="mt-6 text-center text-5xl leading-none">
          <span className="text-gradient-brasa">Tremendo</span>
          <br />
          <span className="text-foreground">Chicharrón</span>
        </h1>
        <p className="mt-2 text-center text-sm tracking-[0.25em] text-muted-foreground uppercase">
          Manizales · 100% domicilio
        </p>

        <span
          className={`mt-5 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide uppercase ${
            abierto
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          }`}
        >
          {abierto ? "Abierto ahora" : "Cerrado por el momento"}
        </span>

        {promoVigente && (
          <Link
            to="/menu"
            className="mt-6 block w-full overflow-hidden rounded-2xl border border-accent/60 bg-gradient-to-br from-card to-card/60 shadow-glow transition-transform hover:scale-[1.02]"
          >
            {promoVigente.imagen_url && (
              <img src={promoVigente.imagen_url} alt="" className="h-32 w-full object-cover" />
            )}
            <div className="p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                <BadgePercent className="size-4" /> Promoción vigente
              </p>
              <p className="mt-1 font-display text-2xl leading-tight text-primary">
                {promoVigente.titulo}
              </p>
              {promoVigente.descripcion && (
                <p className="mt-1 text-sm text-muted-foreground">{promoVigente.descripcion}</p>
              )}
            </div>
          </Link>
        )}

        <nav className="mt-7 w-full space-y-3">
          {BOTONES.map(({ to, label, icon: Icon, subtitulo }) => (
            <Link
              key={label}
              to={to}
              className="flex w-full items-center gap-3 rounded-2xl bg-brasa px-5 py-4 font-display text-2xl text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              <Icon className="size-6" strokeWidth={2.2} />
              <span className="flex flex-col items-start leading-tight">
                {label}
                {subtitulo && (
                  <span className="text-xs font-normal text-primary-foreground/80">
                    {subtitulo}
                  </span>
                )}
              </span>
            </Link>
          ))}
          <a
            href="https://www.google.com/maps/search/?api=1&query=Manizales+Caldas+Colombia"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-card/70 px-5 py-4 font-display text-2xl text-primary transition-colors hover:bg-card"
          >
            <MapPin className="size-6" strokeWidth={2.2} />
            Cómo Llegar
          </a>
        </nav>

        <div className="mt-8 w-full rounded-2xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
          <p className="font-display text-lg text-primary">Horarios</p>
          {HORARIOS.map((h) => (
            <p key={h.dias} className="mt-1 flex justify-between">
              <span>{h.dias}</span>
              <span className="text-foreground">{h.texto}</span>
            </p>
          ))}
        </div>

        <div className="mt-8 flex gap-5">
          <a href="https://wa.me/" target="_blank" rel="noreferrer" aria-label="WhatsApp">
            <img src="/whatsapp.png" alt="WhatsApp" className="size-11 rounded-xl" />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
            <img src="/instagram.png" alt="Instagram" className="size-11 rounded-xl" />
          </a>
        </div>

        <div className="mt-auto flex flex-col items-center gap-3 pt-10">
          <span className="text-sm font-semibold tracking-[0.3em] text-muted-foreground uppercase">
            Creado por
          </span>
          <img src="/veltomarca.png" alt="Velto" className="h-14 w-auto opacity-90" />
        </div>
      </div>
    </main>
  );
}
