"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Shield, Wallet, Phone, Building2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useProfiles } from "@/lib/hooks2";
import { useCaisses } from "@/lib/hooks";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { Card, Badge } from "@/components/ui";
import { PhotoProfil, PiecesJointesBloc } from "@/components/FicheMedia";
import { formatXOF, formatDate } from "@/lib/format";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-clay/15 text-clay", gerant: "bg-blue-100 text-blue-700", caissier: "bg-leaf-100 text-leaf-600",
};
const roleLabel: Record<string, string> = { admin: "Administrateur", gerant: "Gérant", caissier: "Caissier" };

export default function UtilisateurDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: profiles } = useProfiles();
  const { data: caisses } = useCaisses();
  const user: any = useMemo(() => profiles.find((p: any) => p.id === id), [profiles, id]);
  const caisse = useMemo(() => caisses.find((c: any) => c.assignee_id === id), [caisses, id]);

  const [mvts, setMvts] = useState<any[]>([]);
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !id) return;
    (getClient() as any).from("mouvements_caisse").select("*").eq("par_user", id)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }: any) => setMvts(data ?? []));
  }, [id]);

  if (!user) {
    return (
      <div className="animate-fade-up">
        <button onClick={() => router.push("/utilisateurs")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink"><ArrowLeft size={16} /> Utilisateurs</button>
        <Card className="p-6 text-center text-ink-400">Utilisateur introuvable.</Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <button onClick={() => router.push("/utilisateurs")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink">
        <ArrowLeft size={16} /> Utilisateurs
      </button>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-4">
            <PhotoProfil entite="user" id={user.id} nom={user.nom} photoUrl={(user as any).photo_url} />
            <div>
              <div className="display text-lg font-bold text-ink">{user.nom}</div>
              <Badge className={ROLE_BADGE[user.role]}>{roleLabel[user.role] ?? user.role}</Badge>
            </div>
          </div>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2 text-ink-700"><Shield size={15} className="text-ink-400" /> Identifiant : <span className="num">{user.identifiant ?? "—"}</span></li>
            <li className="flex items-center gap-2 text-ink-700"><Building2 size={15} className="text-ink-400" /> {user.agence}</li>
            <li className="flex items-center gap-2 text-ink-700"><Phone size={15} className="text-ink-400" /> <span className="num">{user.telephone ?? "—"}</span></li>
            <li className="flex items-center gap-2 text-ink-700"><Wallet size={15} className="text-ink-400" /> {caisse ? caisse.nom : "Aucune caisse"}</li>
            <li className="text-ink-400">{user.actif === false ? "Compte inactif" : "Compte actif"}</li>
          </ul>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <PiecesJointesBloc entite="user" id={user.id} />
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-sand-200 px-5 py-4">
          <h3 className="display text-lg font-bold text-ink">Activité récente (caisse)</h3>
        </div>
        <div className="divide-y divide-sand-100">
          {mvts.map((m) => {
            const c = caisses.find((x: any) => x.id === m.caisse_id);
            const positif = m.montant > 0;
            return (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${positif ? "bg-leaf-100 text-leaf-600" : "bg-clay-100 text-clay-700"}`}>
                    {positif ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-ink">{m.libelle}</div>
                    <div className="text-[11px] text-ink-400">{c?.nom ?? m.caisse_id} · {formatDate(m.date_mvt ?? m.created_at)}</div>
                  </div>
                </div>
                <div className={`num text-sm font-semibold ${positif ? "text-leaf-600" : "text-clay-700"}`}>{positif ? "+" : ""}{formatXOF(m.montant)}</div>
              </div>
            );
          })}
          {mvts.length === 0 && <div className="px-5 py-8 text-center text-[13px] text-ink-400">Aucune activité de caisse enregistrée{!SUPABASE_CONFIGURED ? " (disponible en ligne)" : ""}.</div>}
        </div>
      </Card>
    </div>
  );
}
