export function FondoGlobal() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <img src="/fondo.png" alt="" className="absolute inset-0 size-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/55 to-background" />
    </div>
  );
}
