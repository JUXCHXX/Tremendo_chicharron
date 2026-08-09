import { Link } from "@tanstack/react-router";

export function FooterMenu() {
  return (
    <footer className="mt-16 border-t border-border bg-card/40 px-5 py-10">
      <div className="mx-auto max-w-4xl space-y-8 text-sm text-muted-foreground">
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
        <div className="flex flex-wrap gap-4">
          <Link to="/menu" className="text-primary hover:underline">
            Menú
          </Link>
          <Link to="/progreso" className="text-primary hover:underline">
            Progreso del pedido
          </Link>
          <Link to="/admin" className="text-primary hover:underline">
            Panel caja
          </Link>
          <Link to="/superadmin" className="text-primary hover:underline">
            Panel dueño
          </Link>
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-6">
          <span className="text-xs tracking-widest uppercase">Creado por</span>
          <img src="/veltomarca.png" alt="Velto" className="h-8 w-auto" />
        </div>
      </div>
    </footer>
  );
}