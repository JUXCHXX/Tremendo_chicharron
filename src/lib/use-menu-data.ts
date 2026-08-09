import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { CATEGORIAS, PRODUCTOS, PROMOCIONES } from "./menu-data";

export interface CategoriaDb {
  id: string;
  nombre: string;
  orden: number;
  plato_destacado_id: string | null;
  modelo_3d_url: string | null;
}

export interface ProductoDb {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string;
  precio: number | null;
  imagen_url: string | null;
  disponible: boolean;
  destacado_3d: boolean;
  modelo_3d_url: string | null;
  por_persona: boolean;
  combo_gratis: boolean;
  orden: number;
}

export interface PromocionDb {
  id: string;
  titulo: string;
  descripcion: string;
  imagen_url: string | null;
  tipo_vigencia: string;
  activa: boolean;
}

// Fallback: datos estáticos del menú cuando Supabase no está disponible
// o no tiene datos sembrados. Esto permite que el menú siempre cargue.
const FALLBACK_CATEGORIAS: CategoriaDb[] = CATEGORIAS.map((c) => ({
  id: c.id,
  nombre: c.nombre,
  orden: c.orden,
  plato_destacado_id: c.plato_destacado_id,
  modelo_3d_url: c.modelo_3d_url,
}));

const FALLBACK_PRODUCTOS: ProductoDb[] = PRODUCTOS.map((p) => ({
  id: p.id,
  categoria_id: p.categoria_id,
  nombre: p.nombre,
  descripcion: p.descripcion,
  precio: p.precio,
  imagen_url: p.imagen_url,
  disponible: p.disponible,
  destacado_3d: p.destacado_3d,
  modelo_3d_url: p.modelo_3d_url,
  por_persona: p.por_persona ?? false,
  combo_gratis: p.combo_gratis ?? false,
  orden: 0,
}));

const FALLBACK_PROMOCIONES: PromocionDb[] = PROMOCIONES.map((p) => ({
  id: p.id,
  titulo: p.titulo,
  descripcion: p.descripcion,
  imagen_url: p.imagen_url,
  tipo_vigencia: p.tipo_vigencia,
  activa: p.activa,
}));

export function useMenuData() {
  const [categorias, setCategorias] = useState<CategoriaDb[]>(FALLBACK_CATEGORIAS);
  const [productos, setProductos] = useState<ProductoDb[]>(FALLBACK_PRODUCTOS);
  const [promociones, setPromociones] = useState<PromocionDb[]>(FALLBACK_PROMOCIONES);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    if (!supabase) {
      // Sin Supabase: usar fallback estático
      setCategorias(FALLBACK_CATEGORIAS);
      setProductos(FALLBACK_PRODUCTOS);
      setPromociones(FALLBACK_PROMOCIONES);
      setError(null);
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const [cats, prods, promos] = await Promise.all([
        supabase.from("categorias").select("*").order("orden"),
        supabase.from("productos").select("*").order("orden"),
        supabase.from("promociones").select("*").order("creado_en", { ascending: false }),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      if (promos.error) throw promos.error;

      // Si Supabase devuelve datos, usarlos; si no, usar fallback
      if (cats.data && cats.data.length > 0) {
        setCategorias(cats.data as CategoriaDb[]);
      } else {
        setCategorias(FALLBACK_CATEGORIAS);
      }
      if (prods.data && prods.data.length > 0) {
        setProductos(prods.data as ProductoDb[]);
      } else {
        setProductos(FALLBACK_PRODUCTOS);
      }
      if (promos.data && promos.data.length > 0) {
        setPromociones(promos.data as PromocionDb[]);
      } else {
        setPromociones(FALLBACK_PROMOCIONES);
      }
      setError(null);
    } catch (e) {
      // Si hay error, usar fallback estático
      setCategorias(FALLBACK_CATEGORIAS);
      setProductos(FALLBACK_PRODUCTOS);
      setPromociones(FALLBACK_PROMOCIONES);
      setError(null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  return { categorias, productos, promociones, cargando, error, recargar: cargar };
}