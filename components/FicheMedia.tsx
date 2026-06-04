"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Paperclip, FileText, Trash2, ExternalLink, Upload } from "lucide-react";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { uploadAvatar, uploadPiece, urlPiece, supprimerPiece, usePiecesJointes, type PieceJointe } from "@/lib/storage";

type Entite = "client" | "user" | "produit" | "operateur";

function useUserId() {
  const [uid, setUid] = useState("");
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { const d = getDemoSession(); if (d) setUid(d.id); return; }
    getClient().auth.getUser().then(({ data }) => { if (data.user) setUid(data.user.id); });
  }, []);
  return uid;
}

function initiales(nom: string) {
  return nom.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
}

export function PhotoProfil({ entite, id, nom, photoUrl }: { entite: Entite; id: string; nom: string; photoUrl?: string | null }) {
  const [url, setUrl] = useState<string | null>(photoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image trop lourde (5 Mo max)."); return; }
    setBusy(true);
    try { const u = await uploadAvatar(entite, id, file); setUrl(u); }
    catch (err: any) { alert(err?.message ?? "Échec de l'envoi."); }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-clay/10 text-2xl font-bold text-clay">
          {url ? <img src={url} alt={nom} className="h-full w-full object-cover" /> : initiales(nom || "?")}
        </div>
        {SUPABASE_CONFIGURED && (
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sand-50 shadow-card hover:bg-ink-700 disabled:opacity-50"
            title="Changer la photo">
            <Camera size={15} />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {busy && <span className="mt-2 text-[11px] text-ink-400">Envoi…</span>}
    </div>
  );
}

function tailleLisible(o?: number | null) {
  if (!o) return "";
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / 1024 / 1024).toFixed(1)} Mo`;
}

export function PiecesJointesBloc({ entite, id }: { entite: Entite; id: string }) {
  const { data: pieces, refetch } = usePiecesJointes(entite, id);
  const userId = useUserId();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Fichier trop lourd (10 Mo max)."); return; }
    setBusy(true);
    try { await uploadPiece(entite, id, file, userId); refetch(); }
    catch (err: any) { alert(err?.message ?? "Échec de l'envoi."); }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function ouvrir(p: PieceJointe) {
    const u = await urlPiece(p.chemin);
    if (u) window.open(u, "_blank"); else alert("Lien indisponible.");
  }
  async function supprimer(p: PieceJointe) {
    if (!confirm(`Supprimer « ${p.nom} » ?`)) return;
    try { await supprimerPiece(p); refetch(); } catch (e: any) { alert(e?.message ?? "Erreur."); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
          <Paperclip size={14} /> Pièces jointes
        </h3>
        {SUPABASE_CONFIGURED && (
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sand-100 px-3 py-1.5 text-[13px] font-medium text-ink-700 hover:bg-sand-200 disabled:opacity-50">
            <Upload size={14} /> {busy ? "Envoi…" : "Ajouter"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" className="hidden" onChange={onFile} />
      {pieces.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand-200 px-4 py-6 text-center text-[13px] text-ink-400">
          Aucune pièce jointe. {SUPABASE_CONFIGURED ? "Ajoutez un contrat, une CNIB, un justificatif…" : "Disponible en ligne."}
        </p>
      ) : (
        <ul className="space-y-2">
          {pieces.map(p => (
            <li key={p.id} className="flex items-center justify-between rounded-xl border border-sand-200 bg-white px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText size={16} className="flex-shrink-0 text-ink-400" />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{p.nom}</div>
                  <div className="text-[11px] text-ink-400">{tailleLisible(p.taille)} · {new Date(p.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => ouvrir(p)} title="Ouvrir" className="p-1.5 rounded-lg text-ink-400 hover:bg-sand-200 hover:text-clay"><ExternalLink size={15} /></button>
                <button onClick={() => supprimer(p)} title="Supprimer" className="p-1.5 rounded-lg text-ink-400 hover:bg-sand-200 hover:text-ember-600"><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
