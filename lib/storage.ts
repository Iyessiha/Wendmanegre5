"use client";

import { useCallback, useEffect, useState } from "react";
import { getClient } from "./supabase";

export interface PieceJointe {
  id: string;
  entite: string;
  entite_id: string;
  nom: string;
  chemin: string;
  type_mime: string | null;
  taille: number | null;
  uploaded_by: string | null;
  created_at: string;
}

type Entite = "client" | "user" | "facture" | "pret" | "produit" | "operateur";
const TABLE_AVATAR: Record<string, string> = { client: "clients", user: "profiles", produit: "produits", operateur: "operateurs" };

// ── Photo de profil (bucket public "avatars") ──
export async function uploadAvatar(entite: Entite, id: string, file: File): Promise<string> {
  const sb = getClient() as any;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const chemin = `${entite}/${id}.${ext}`;
  const { error } = await sb.storage.from("avatars").upload(chemin, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = sb.storage.from("avatars").getPublicUrl(chemin);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  const table = TABLE_AVATAR[entite];
  if (table) {
    const { error: e2 } = await sb.from(table).update({ photo_url: url }).eq("id", id);
    if (e2) throw e2;
  }
  return url;
}

// ── Pièces jointes (bucket privé "documents") ──
export async function uploadPiece(entite: Entite, id: string, file: File, userId?: string): Promise<void> {
  const sb = getClient() as any;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const chemin = `${entite}/${id}/${Date.now()}-${safe}`;
  const { error } = await sb.storage.from("documents").upload(chemin, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { error: e2 } = await sb.from("pieces_jointes").insert({
    entite, entite_id: id, nom: file.name, chemin, type_mime: file.type, taille: file.size, uploaded_by: userId || null,
  });
  if (e2) throw e2;
}

export async function urlPiece(chemin: string): Promise<string | null> {
  const sb = getClient() as any;
  const { data, error } = await sb.storage.from("documents").createSignedUrl(chemin, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function supprimerPiece(p: PieceJointe): Promise<void> {
  const sb = getClient() as any;
  await sb.storage.from("documents").remove([p.chemin]);
  const { error } = await sb.from("pieces_jointes").delete().eq("id", p.id);
  if (error) throw error;
}

export function usePiecesJointes(entite: Entite, id: string | undefined) {
  const [data, setData] = useState<PieceJointe[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    if (!id) { setData([]); setLoading(false); return; }
    try {
      const { data: rows } = await (getClient() as any)
        .from("pieces_jointes").select("*").eq("entite", entite).eq("entite_id", id).order("created_at", { ascending: false });
      setData(rows ?? []);
    } catch { setData([]); }
    setLoading(false);
  }, [entite, id]);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}
