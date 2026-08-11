import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function DonVelto() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "¡Quiubo pues! Soy Don Velto 🐷 ¿Le antojo algo tremendo? Dígame para cuántos y con cuánto cuenta.",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || loading) return;

    const nuevos: Msg[] = [...msgs, { role: "user", content: texto }];
    setMsgs(nuevos);
    setInput("");
    setLoading(true);

    if (!supabase) {
      setMsgs([
        ...nuevos,
        {
          role: "assistant",
          content: "Aún no tengo configurada mi conexión. Verifica que Supabase esté configurado.",
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("chat-don-velto", {
        body: { messages: nuevos },
      });

      if (error) {
        if (error.context?.status === 429) {
          setMsgs([
            ...nuevos,
            {
              role: "assistant",
              content: "Estoy atendiendo muchas mesas, intente en un momentico.",
            },
          ]);
        } else {
          setMsgs([
            ...nuevos,
            {
              role: "assistant",
              content: "Se me enredó la bandeja 😅 Intente de nuevo o escríbanos por WhatsApp.",
            },
          ]);
        }
        return;
      }

      const content = data?.choices?.[0]?.message?.content ?? "...";
      setMsgs([...nuevos, { role: "assistant", content }]);
    } catch {
      setMsgs([
        ...nuevos,
        {
          role: "assistant",
          content: "Se me enredó la bandeja 😅 Intente de nuevo o escríbanos por WhatsApp.",
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
        className="fixed right-4 bottom-24 z-50 flex size-14 items-center justify-center overflow-hidden rounded-full border-2 border-primary/50 bg-card shadow-glow transition-transform hover:scale-105 md:bottom-6"
      >
        {open ? (
          <X className="size-6 text-primary" />
        ) : (
          <img
            src="/velto.png"
            alt="Don Velto"
            className="size-full object-cover"
            onError={(e) => {
              const img = e.currentTarget;
              img.style.display = "none";
              img.parentElement?.classList.add("bg-brasa");
            }}
          />
        )}
      </button>

      {open && (
        <div className="fixed right-4 bottom-42 z-50 flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-primary/25 bg-popover shadow-glow md:bottom-24">
          <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <img
              src="/velto.png"
              alt="Don Velto"
              className="size-10 rounded-full border-2 border-primary/40 object-cover"
              onError={(e) => {
                // Fallback si el archivo velto.png no se puede cargar
                const img = e.currentTarget;
                img.style.display = "none";
              }}
            />
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
