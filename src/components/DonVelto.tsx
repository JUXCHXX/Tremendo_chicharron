import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { PRODUCTOS, CATEGORIAS, formatCOP, VARIANTES_PICADA } from "@/lib/menu-data";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const cartaTexto = CATEGORIAS.map(
  (c) =>
    `${c.nombre}:\n` +
    PRODUCTOS.filter((p) => p.categoria_id === c.id)
      .map(
        (p) =>
          `- ${p.nombre} (${p.precio ? formatCOP(p.precio) : "precio por persona"}): ${p.descripcion}`,
      )
      .join("\n"),
).join("\n\n");

const SYSTEM_PROMPT = `Eres "Don Velto", el mesero virtual de Tremendo Chicharrón, una cocina oculta 100% domicilios en Manizales, Colombia.
Hablas en español colombiano, cálido, breve y con chispa paisa. Nunca inventas platos ni precios.
Recomiendas según antojo, presupuesto y número de personas. Si preguntan por la picada, usas esta tabla por personas: ${VARIANTES_PICADA.map((v) => `${v.personas} pers ${formatCOP(v.precio)}`).join(", ")}.
Horarios: lunes a jueves 8am-8pm, viernes y sábado 8am-11pm, domingo 7am-4pm.
Medios de pago: efectivo, transferencia y tarjetas. El pago se confirma por WhatsApp.
Respuestas de máximo 4 frases. Esta es la carta:\n\n${cartaTexto}`;

// Rate limit básico del lado cliente (el definitivo va en la Edge Function).
const VENTANA_MS = 60000;
const MAX_MENSAJES = 8;

export function DonVelto() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content: "¡Quiubo pues! Soy Don Velto 🐷 ¿Le antojo algo tremendo? Dígame para cuántos y con cuánto cuenta.",
    },
  ]);
  const stamps = useRef<number[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || loading) return;

    const ahora = Date.now();
    stamps.current = stamps.current.filter((t) => ahora - t < VENTANA_MS);
    if (stamps.current.length >= MAX_MENSAJES) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "Despacio mijo, deme un minutico y seguimos 😄" },
      ]);
      return;
    }
    stamps.current.push(ahora);

    const nuevos: Msg[] = [...msgs, { role: "user", content: texto }];
    setMsgs(nuevos);
    setInput("");
    setLoading(true);

    const apiKey = import.meta.env['VITE_GROQ_API_KEY'] as string | undefined;
    if (!apiKey) {
      setMsgs([
        ...nuevos,
        {
          role: "assistant",
          content:
            "Aún no tengo configurada mi llave de IA (VITE_GROQ_API_KEY). Agrégala en el .env y vuelvo a atenderte.",
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...nuevos],
        }),
      });
      if (res.status === 429) throw new Error("rate");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMsgs([
        ...nuevos,
        { role: "assistant", content: data.choices?.[0]?.message?.content ?? "..." },
      ]);
    } catch (e) {
      setMsgs([
        ...nuevos,
        {
          role: "assistant",
          content:
            (e as Error).message === "rate"
              ? "Estoy atendiendo muchas mesas, intente en un momentico."
              : "Se me enredó la bandeja 😅 Intente de nuevo o escríbanos por WhatsApp.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir chat con Don Velto"
        className="fixed right-4 bottom-24 z-50 flex size-14 items-center justify-center rounded-full bg-brasa text-primary-foreground shadow-glow transition-transform hover:scale-105 md:bottom-6"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>

      {open && (
        <div className="fixed right-4 bottom-42 z-50 flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-primary/25 bg-popover shadow-glow md:bottom-24">
          <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-brasa font-display text-lg text-primary-foreground">
              DV
            </div>
            <div>
              <p className="font-display text-lg leading-none text-primary">Don Velto</p>
              <p className="text-[11px] text-muted-foreground">Su mesero virtual</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Don Velto está pensando…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
            className="flex gap-2 border-t border-border p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="¿Qué me recomienda?"
              className="flex-1 rounded-full bg-input px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="flex size-9 items-center justify-center rounded-full bg-brasa text-primary-foreground"
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}