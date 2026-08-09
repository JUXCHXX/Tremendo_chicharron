/**
 * Datos semilla del menú de Tremendo Chicharrón.
 * Esta capa refleja exactamente el esquema SQL de /database para que migrar
 * a Lovable Cloud / Supabase sea un reemplazo directo del data-layer.
 */

export type CategoriaId = "desayunos" | "almuerzos" | "picar" | "bebidas";

export interface Categoria {
  id: CategoriaId;
  nombre: string;
  orden: number;
  plato_destacado_id: string | null;
  modelo_3d_url: string | null;
}

export interface Producto {
  id: string;
  categoria_id: CategoriaId;
  nombre: string;
  descripcion: string;
  precio: number | null;
  imagen_url: string | null;
  disponible: boolean;
  destacado_3d: boolean;
  modelo_3d_url: string | null;
  por_persona?: boolean;
  combo_gratis?: boolean;
}

export const VARIANTES_PICADA: { personas: number; precio: number }[] = [
  { personas: 1, precio: 34000 },
  { personas: 2, precio: 60000 },
  { personas: 3, precio: 86000 },
  { personas: 4, precio: 120000 },
  { personas: 5, precio: 150500 },
  { personas: 6, precio: 175000 },
  { personas: 8, precio: 230000 },
  { personas: 10, precio: 295000 },
];

export const CATEGORIAS: Categoria[] = [
  {
    id: "desayunos",
    nombre: "Desayunos",
    orden: 1,
    plato_destacado_id: "des-tremendo-chicharron",
    modelo_3d_url: "/desayunos-tremendo-chicharron.fbx",
  },
  {
    id: "almuerzos",
    nombre: "Almuerzos",
    orden: 2,
    plato_destacado_id: "alm-paella",
    modelo_3d_url: "/almuerzos-tremenda-paella.fbx",
  },
  {
    id: "picar",
    nombre: "Para Picar / Tardear",
    orden: 3,
    plato_destacado_id: "pic-picada",
    modelo_3d_url: "/picar-tremenda-picada.fbx",
  },
  { id: "bebidas", nombre: "Bebidas", orden: 4, plato_destacado_id: null, modelo_3d_url: null },
];

const p = (
  id: string,
  categoria_id: CategoriaId,
  nombre: string,
  precio: number | null,
  descripcion: string,
  extra: Partial<Producto> = {},
): Producto => ({
  id,
  categoria_id,
  nombre,
  descripcion,
  precio,
  imagen_url: null,
  disponible: true,
  destacado_3d: false,
  modelo_3d_url: null,
  ...extra,
});

export const PRODUCTOS: Producto[] = [
  // ── Desayunos ──────────────────────────────────────────────
  p(
    "des-chorizo",
    "desayunos",
    "Tremendo Chorizo",
    18000,
    "2 chorizos de cerdo artesanales, arepa, papa salada, plátano maduro horneado, tomate, limón, guacamole y barbecue.",
  ),
  p(
    "des-huevos",
    "desayunos",
    "Tremendos Huevos al Gusto",
    16000,
    "Huevos al gusto, cebolla, tomate, arepa y chocolate caliente.",
  ),
  p(
    "des-calentado",
    "desayunos",
    "Tremendo Calentado",
    20000,
    "Arroz con huevo, con o sin vegetales, arepa o pan, opción chorizo o chicharrón, chocolate o aguapanela.",
  ),
  p(
    "des-calentado-paisa",
    "desayunos",
    "Tremendo Calentado Paisa",
    22000,
    "Fríjoles, arroz, cebolla, arepa al carbón, huevos al gusto, chorizo o chicharrón, chocolate espeso o aguado.",
  ),
  p(
    "des-calentado-criollo",
    "desayunos",
    "Tremendo Calentado Criollo",
    22000,
    "Arroz, papa, carne desmechada, arepa al carbón, huevo blando, chorizo o chicharrón, chocolate espeso o aguado.",
  ),
  p(
    "des-migas",
    "desayunos",
    "Tremendas Migas",
    24000,
    "Migas con arepa remojada en leche, vegetales frescos, especias, huevos, sándwich de jamón y chocolate.",
  ),
  p(
    "des-sabanero",
    "desayunos",
    "Tremendo Calentado Sabanero",
    22000,
    "Papas sabaneras fritas, cebolla, tomate, chorizo artesanal, 2 huevos de yema blanda, pan o arepa y chocolate.",
  ),
  p(
    "des-tremendo-chicharron",
    "desayunos",
    "Tremendo Chicharrón (300g)",
    34000,
    "Arepa, papa salada, plátano maduro, limón, guacamole y barbecue.",
    { destacado_3d: true, modelo_3d_url: "/desayunos-tremendo-chicharron.fbx" },
  ),
  p(
    "des-picada",
    "desayunos",
    "Tremenda Picada de Chicharrón",
    null,
    "Chicharrón crocante, chorizos, papa salada, plátano maduro, arepa, limón y guacamole.",
    { por_persona: true },
  ),
  p(
    "des-ceviche",
    "desayunos",
    "Tremendo Ceviche de Chicharrón",
    null,
    "Chicharrón crocante, guacamole, leche de tigre, pico de gallo y nachos mexicanos. (Precio por definir)",
  ),

  // ── Almuerzos ──────────────────────────────────────────────
  p(
    "alm-tremendo-chicharron",
    "almuerzos",
    "Tremendo Chicharrón (300g)",
    34000,
    "Arepa, papa salada, plátano maduro, limón, guacamole y barbecue.",
  ),
  p(
    "alm-paella",
    "almuerzos",
    "Tremenda Paella de Chicharrón",
    34000,
    "Fusión de paella española con chicharrón colombiano y chorizo artesanal, arroz de alta calidad, vegetales, cebolla morada y casco de limón.",
    { destacado_3d: true, modelo_3d_url: "/almuerzos-tremenda-paella.fbx" },
  ),
  p(
    "alm-picada",
    "almuerzos",
    "Tremenda Picada de Chicharrón",
    null,
    "Chicharrón crocante, chorizo, papa salada, plátano maduro, arepa, limón y guacamole.",
    { por_persona: true },
  ),
  p(
    "alm-albondigas",
    "almuerzos",
    "Tremendas Albóndigas de Chicharrón",
    26000,
    "3 albóndigas de 100g en bondiola de cerdo, rostizadas con chicharrón, papa, arepa, maduro, guacamole y barbecue.",
  ),
  p(
    "alm-combo-montanero",
    "almuerzos",
    "Tremendo Combo Montañero",
    30000,
    "Frijoles a leña, arroz, chicharrón, chorizo, plátano maduro, aguacate + mazamorra michelada incluida.",
  ),
  p(
    "alm-combo-bowl-cafetero",
    "almuerzos",
    "Tremendo Combo Bowl Cafetero",
    30000,
    "Arroz especiado, papas sabaneras, carne desmechada, chicharrón, plátano maduro, aguacate + mazamorra michelada incluida.",
  ),
  p(
    "alm-bowl-cafetal",
    "almuerzos",
    "Tremendo Bowl del Cafetal (sencillo)",
    22000,
    "Arroz especiado, papas sabaneras, carne desmechada, chicharrón, plátano maduro y aguacate. Sin mazamorra michelada.",
  ),
  p(
    "alm-bowl-montanero",
    "almuerzos",
    "Tremendo Bowl Montañero (sencillo)",
    22000,
    "Frijol a leña, arroz, chorizo, plátano maduro, aguacate en juliana y chicharrón. Sin mazamorra michelada.",
  ),

  // ── Para Picar / Tardear ───────────────────────────────────
  p(
    "pic-chuzarron",
    "picar",
    "Tremendo Chuzarrón",
    22000,
    "Chicharrón crocante con chorizo artesanal, arepa, papa salada, plátano maduro, limón y guacamole casero.",
  ),
  p(
    "pic-hamburguesa",
    "picar",
    "Hamburguesa de Chicharrón",
    25000,
    "Chicharrón, lechuga, tomate, cebolla caramelizada, patacón horneado con quesillo, guacamole y pan artesanal.",
    { combo_gratis: true },
  ),
  p(
    "pic-picada",
    "picar",
    "Tremenda Picada de Chicharrón",
    null,
    "Chicharrón crocante, chorizo, papa salada, plátano maduro, arepa, limón y guacamole.",
    { por_persona: true, destacado_3d: true, modelo_3d_url: "/picar-tremenda-picada.fbx" },
  ),
  p(
    "pic-ceviche",
    "picar",
    "Tremendo Ceviche de Chicharrón",
    34000,
    "Chicharrón crocante, guacamole, leche de tigre, pico de gallo y nachos mexicanos.",
  ),
  p(
    "pic-mazamorra",
    "picar",
    "Tremenda Mazamorra Michelada",
    15000,
    "Maíz pelado a leña, toque michelado, arequipe, panela rallada y porción extra de leche.",
  ),

  // ── Bebidas ────────────────────────────────────────────────
  p("beb-gaseosa", "bebidas", "Gaseosa Postobón", 6000, "Botella personal, sabores surtidos."),
  p("beb-agua", "bebidas", "Agua saborizada", 6000, "Botella personal."),
  p("beb-limonada", "bebidas", "Limonada natural", 10000, "Preparada al momento."),
  p(
    "beb-limonada-sab",
    "bebidas",
    "Limonada saborizada",
    10000,
    "Cereza o yerbabuena, elige al agregar la nota.",
  ),
];

export interface Promocion {
  id: string;
  titulo: string;
  descripcion: string;
  imagen_url: string;
  tipo_vigencia: "fija" | "rotativa" | "por_fecha";
  activa: boolean;
}

export const PROMOCIONES: Promocion[] = [
  {
    id: "promo-dia-del-padre",
    titulo: "Día del Padre — Desayuno Sorpresa",
    descripcion:
      "Escoge cualquier desayuno de la carta y lo entregamos en caja especial con moño, tarjeta, serpentina y dulces por dentro.",
    imagen_url: "/logo-tremendochicharron.jpeg",
    tipo_vigencia: "por_fecha",
    activa: true,
  },
];

export const HORARIOS = [
  { dias: "Lunes a jueves", texto: "8:00 AM – 8:00 PM", rango: [8, 20] },
  { dias: "Viernes y sábado", texto: "8:00 AM – 11:00 PM", rango: [8, 23] },
  { dias: "Domingo", texto: "7:00 AM – 4:00 PM", rango: [7, 16] },
];

/** Devuelve true si la hora actual (Colombia) está dentro del horario de atención. */
export function dentroDeHorario(d = new Date()): boolean {
  // Siempre se evalúa en hora de Colombia, sin importar el dispositivo.
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "0";
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = dias.indexOf(get("weekday"));
  const h = (Number(get("hour")) % 24) + Number(get("minute")) / 60;
  if (day === 0) return h >= 7 && h < 16;
  if (day === 5 || day === 6) return h >= 8 && h < 23;
  return h >= 8 && h < 20;
}

export const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);