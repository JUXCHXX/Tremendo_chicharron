import { useEffect, useState } from "react";
import { supabase } from "./supabase";

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

export function useMenuData() {
  const [categorias, setCategorias] = useState<CategoriaDb[]>([]);
  const [productos, setProductos] = useState<ProductoDb[]>([]);
  const [promociones, setPromociones] = useState<PromocionDb[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    if (!supabase) {
      setError("Supabase no está configurado.");
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

      setCategorias(cats.data as CategoriaDb[]);
      setProductos(prods.data as ProductoDb[]);
      setPromociones(promos.data as PromocionDb[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el menú.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  return { categorias, productos, promociones, cargando, error, recargar: cargar };
}