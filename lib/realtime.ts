"use client";

import { useEffect, useRef } from "react";
import { getClient, SUPABASE_CONFIGURED } from "./supabase";

/**
 * useRealtimeRefetch — abonne le composant aux changements Supabase
 * sur les tables listées. Déclenche refetch() avec debounce après
 * chaque INSERT / UPDATE / DELETE.
 *
 * @param tables  Noms des tables à surveiller (immuable après montage)
 * @param refetch Fonction de rechargement (référence stable grâce à useCallback)
 * @param debounce Délai en ms avant de refetch (défaut 700)
 */
export function useRealtimeRefetch(
  tables: string[],
  refetch: () => void,
  debounce = 700,
) {
  const refetchRef = useRef(refetch);
  useEffect(() => { refetchRef.current = refetch; }, [refetch]);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || tables.length === 0) return;

    const sb = getClient() as any;
    // Nom de channel unique par ensemble de tables + instance
    const key = `rt::${tables.sort().join("+")}::${Math.random().toString(36).slice(2, 7)}`;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refetchRef.current(), debounce);
    };

    const ch = sb.channel(key);
    tables.forEach(table =>
      ch.on("postgres_changes", { event: "*", schema: "public", table }, trigger)
    );
    ch.subscribe((status: string) => {
      if (status === "CHANNEL_ERROR") console.warn("[RT] channel error", key);
    });

    return () => {
      if (timer) clearTimeout(timer);
      sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
