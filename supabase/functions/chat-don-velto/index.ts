// ============================================================================
// Edge Function: chat-don-velto
// Mesero virtual de Tremendo Chicharrón usando Groq (LLaMA 3.3 70B).
//
// Configuración en Supabase Dashboard:
//   Settings → Edge Functions → Secrets:
//     GROQ_API_KEY=tu-api-key-de-groq
//     SUPABASE_URL=tu-url-de-supabase
//     SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_ROLE_KEY ?? "");

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cliente-telefono",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const VARIANTES_PICADA = [
  { personas: 1, precio: 34000 },
  { personas: 2, precio: 60000 },
  { personas: 3, precio: 86000 },
  { personas: 4, precio: 120000 },
  { personas: 5, precio: 150500 },
  { personas: 6, precio: 175000 },
  { personas: 8, precio: 230000 },
  { personas: 10, precio: 295000 },
];

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);

interface Categoria {
  id: string;
  nombre: string;
}

interface Producto {
  categoria_id: string;
  nombre: string;
  precio: number | null;
  descripcion: string;
}

async function generarCartaTexto(categorias: Categoria[], productos: Producto[]): Promise<string> {
  return categorias
    .map(
      (c) =>
        `${c.nombre}:\n` +
        productos
          .filter((p) => p.categoria_id === c.id)
          .map(
            (p) =>
              `- ${p.nombre} (${p.precio ? formatCOP(p.precio) : "precio por persona"}): ${p.descripcion}`,
          )
          .join("\n"),
    )
    .join("\n\n");
}

async function generarSystemPrompt(
  slug: string,
): Promise<{ prompt: string; apiKey: string; modelo: string }> {
  const { data: restaurante } = await supabase
    .from("restaurantes")
    .select("id, nombre, domicilios_activos, chat_ia_activo")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();
  if (!restaurante?.id || !restaurante.chat_ia_activo)
    throw new Error("El chat no está activo para este restaurante.");
  const { data: ia } = await supabase
    .from("restaurante_ia")
    .select("api_key, modelo, nombre, personalidad")
    .eq("restaurante_id", restaurante.id)
    .maybeSingle();
  const apiKey = ia?.api_key ?? GROQ_API_KEY;
  if (!apiKey) throw new Error("No hay API key de IA configurada para este restaurante.");
  const { data: categorias, error: errCats } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("orden");

  const { data: productos, error: errProds } = await supabase
    .from("productos")
    .select("categoria_id, nombre, precio, descripcion")
    .order("orden");

  if (errCats || errProds) {
    throw new Error("Error cargando la carta desde la base de datos.");
  }

  const carta = await generarCartaTexto(categorias ?? [], productos ?? []);
  return {
    prompt: `Eres "${ia?.nombre ?? "Don Velto"}", el mesero virtual de ${restaurante.nombre}.
${ia?.personalidad ?? "Hablas en español colombiano, cálido, breve y con chispa paisa."} Nunca inventas platos ni precios.
Recomiendas según antojo, presupuesto y número de personas. Si preguntan por la picada, usas esta tabla por personas: ${VARIANTES_PICADA.map((v) => `${v.personas} pers ${formatCOP(v.precio)}`).join(", ")}.
Horarios: lunes a jueves 8am-8pm, viernes y sábado 8am-11pm, domingo 7am-4pm.
Medios de pago: efectivo, transferencia y tarjetas. El pago se confirma por WhatsApp.
Respuestas de máximo 4 frases. Esta es la carta:\n\n${carta}`,
    apiKey,
    modelo: ia?.modelo ?? "openai/gpt-oss-120b",
  };
}

// Rate limiting: 8 mensajes por minuto por sesión/IP
async function verificarRateLimit(identificador: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("consumir_rate_limit", {
    _identificador: identificador,
    _accion: "chat_don_velto",
    _limite: 8,
    _ventana: "1 minute",
  });
  if (error) return false;
  return data as boolean;
}

Deno.serve(async (req: Request) => {
  // CORS preflight — debe responder ANTES de cualquier otra lógica
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const mensajes = body.messages as { role: string; content: string }[] | undefined;
    if (!mensajes || !Array.isArray(mensajes) || mensajes.length === 0) {
      return new Response(JSON.stringify({ error: "Mensajes requeridos." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Rate limiting por IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const permitido = await verificarRateLimit(ip);
    if (!permitido) {
      return new Response(
        JSON.stringify({ error: "Estoy atendiendo muchas mesas, intente en un momentico." }),
        { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const slug = req.headers.get("x-restaurante-slug") ?? "tremendochicharron";
    const configuracion = await generarSystemPrompt(slug);

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configuracion.apiKey}`,
      },
      body: JSON.stringify({
        model: configuracion.modelo,
        temperature: 0.7,
        messages: [{ role: "system", content: configuracion.prompt }, ...mensajes],
      }),
    });

    if (res.status === 429) {
      return new Response(
        JSON.stringify({ error: "Estoy atendiendo muchas mesas, intente en un momentico." }),
        { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Groq error: ${res.status}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "Error interno" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
