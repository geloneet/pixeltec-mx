"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "pixeltec-mx:favorites";
const LEGACY_KEY = "pixeltec-os:favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Leer del localStorage solo en el cliente (evita mismatch de hidratación).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const migrated = JSON.parse(raw) as string[];
        setFavorites(new Set(migrated));
        localStorage.setItem(KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch {
      /* localStorage no disponible — ignorar */
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        /* ignorar */
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.has(id),
    [favorites]
  );

  return { favorites, toggle, isFavorite };
}
