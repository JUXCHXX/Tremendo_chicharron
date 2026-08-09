import { Link } from "@tanstack/react-router";

export function FooterMenu() {
  return (
    <footer className="mt-16 border-t border-border bg-card/60 px-5 py-12">
      <div className="mx-auto max-w-4xl space-y-10 text-sm text-muted-foreground">
        {/* Información institucional (Nosotros) */}
        <div>
          <h3 className="font-display text-2xl text-primary">Nosotros</h3>
          <ul className="mt-3 space-y-1.5">
            <li>Personal capacitado en BPM (Buenas Prácticas de Manipulación).</li>
            <li>Productos entregados sellados en cristaflex y cerrados en bolsa kraft.</li>
            <li>Comercializadora Tremendo Chicharrón SAS — NIT 901.433.592-5.</li>
            <li>Registrada en la Cámara de Comercio de Manizales.</li>
            <li>Próximamente sedes físicas en Chipre y Milano (Manizales).</li>
          </ul>
        </div>

        {/* Links de navegación */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6">
          <Link to="/" className="text-primary hover:underline">
            Inicio
          </Link>
          <Link to="/menu" className="text-primary hover:underline">
            Menú
          </Link>
          <Link to="/progreso" search={{ comanda: "" }} className="text-primary hover:underline">
            Progreso del pedido
          </Link>
        </div>

        {/* Creado por */}
        <div className="flex items-center justify-between gap-4 border-t border-border pt-8">
          <span className="text-base font-semibold tracking-[0.3em] text-muted-foreground uppercase">
            Creado por
          </span>
          <a
            href="https://veltoai.digitaluplinkco.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/veltomarca.png" alt="Velto" className="h-14 w-auto opacity-90 transition-opacity hover:opacity-100" />
          </a>
        </div>
      </div>
    </footer>
  );
}