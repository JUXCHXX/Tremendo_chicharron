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

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

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

async function generarSystemPrompt(): Promise<string> {
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
  return `Eres "Don Velto", el mesero virtual de Tremendo Chicharrón, una cocina oculta 100% domicilios en Manizales, Colombia.
Hablas en español colombiano, cálido, breve y con chispa paisa. Nunca inventas platos ni precios.
Recomiendas según antojo, presupuesto y número de personas. Si preguntan por la picada, usas esta tabla por personas: ${VARIANTES_PICADA.map((v) => `${v.personas} pers ${formatCOP(v.precio)}`).join(", ")}.
Horarios: lunes a jueves 8am-8pm, viernes y sábado 8am-11pm, domingo 7am-4pm.
Medios de pago: efectivo, transferencia y tarjetas. El pago se confirma por WhatsApp.
Respuestas de máximo 4 frases. Esta es la carta:\n\n${carta}`;
}

// Rate limiting: 8 mensajes por minuto por sesión/IP
async function verificarRateLimit(identificador: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("consumir_rate_limit", {
    _identificador: identificador,
    _accion: "chat_don_velto",
    _limite: 8,
    _ventana: "1 minute",
  });
  if (error) {
    throw new Error(`No se pudo verificar el límite de mensajes: ${error.message}`);
  }
  return data as boolean;
}

Deno.serve(async (req: Request) => {
  // CORS preflight — debe responder ANTES de cualquier otra lógica
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const configuracionFaltante = [
      !GROQ_API_KEY && "GROQ_API_KEY",
      !SUPABASE_URL && "SUPABASE_URL",
      !SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    if (configuracionFaltante.length > 0) {
      console.error("[chat-don-velto] Faltan secretos/configuración:", configuracionFaltante);
      return jsonResponse(
        {
          error: "El asistente no está configurado correctamente en el servidor.",
          code: "CONFIGURATION_ERROR",
          details: `Falta: ${configuracionFaltante.join(", ")}`,
        },
        500,
      );
    }

    let body: { messages?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "El cuerpo de la solicitud no es JSON válido.", code: "INVALID_JSON" },
        400,
      );
    }

    const mensajes = body.messages as { role: string; content: string }[] | undefined;
    if (
      !Array.isArray(mensajes) ||
      mensajes.length === 0 ||
      mensajes.some(
        (mensaje) =>
          !mensaje || typeof mensaje.role !== "string" || typeof mensaje.content !== "string",
      )
    ) {
      return jsonResponse(
        { error: "Mensajes requeridos con rol y contenido válidos.", code: "INVALID_MESSAGES" },
        400,
      );
    }

    // Rate limiting por IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const permitido = await verificarRateLimit(ip);
    if (!permitido) {
      return jsonResponse(
        { error: "Estoy atendiendo muchas mesas, intente en un momentico.", code: "RATE_LIMITED" },
        429,
      );
    }

    const systemPrompt = await generarSystemPrompt();

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.7,
        messages: [{ role: "system", content: systemPrompt }, ...mensajes],
      }),
    });

    if (res.status === 429) {
      return jsonResponse(
        {
          error: "Estoy atendiendo muchas mesas, intente en un momentico.",
          code: "GROQ_RATE_LIMITED",
        },
        429,
      );
    }
    if (!res.ok) {
      const detalle = (await res.text()).slice(0, 500);
      console.error(`[chat-don-velto] Groq respondió ${res.status}:`, detalle);
      return jsonResponse(
        {
          error: `El proveedor de IA rechazó la solicitud (${res.status}).`,
          code: "GROQ_ERROR",
          details: detalle || undefined,
        },
        502,
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    console.error("[chat-don-velto] Error no controlado:", e);
    return jsonResponse(
      {
        error: "No se pudo procesar el mensaje de Don Velto.",
        code: "INTERNAL_ERROR",
        details,
      },
      500,
    );
  }
});
