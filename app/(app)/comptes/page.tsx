"use client";

import { useState } from "react";
import { Building2, Smartphone, Banknote, RefreshCw, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { useComptesBancaires, useTresorerie, syncComptesBancaires, TYPE_LABEL, TYPE_COLOR, type TypeCompte } from "@/lib/hooks-comptes";
import { PageHeader, Card, Badge } from "@/components/ui";
import { formatXOF } from "@/lib/format";

const TYPE_ICON: Record<TypeCompte, React.ReactNode> = {
  banque:         <Building2  size={18} className="text-blue-600" />,
  caisse_especes: <Banknote   size={18} className="text-leaf-600" />,
  mobile_money:   <Smartphone size={18} className="text-orange-500" />,
  autre:          <Building2  size={18} className="text-ink-400" />,
};

export default function ComptesPage() {
  const { data: comptes, loading, refetch } = useComptesBancaires();
  const tr = useTresorerie();

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSync() {
    setSyncing(true); setSyncMsg(null);
    try {
      const { upserted, total } = await syncComptesBancaires();
      setSyncMsg({ ok: true, msg: `${upserted} comptes mis à jour sur ${total} (Dolibarr)` });
      await refetch();
    } catch (e: any) {
      setSyncMsg({ ok: false, msg: e?.message ?? "Erreur de synchronisation" });
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(null), 6000);
  }

  const actifs = comptes.filter(c => c.actif);
  const fermes = comptes.filter(c => !c.actif);
  const groups: TypeCompte[] = ["banque", "caisse_especes", "mobile_money", "autre"];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Banques & Caisses"
        subtitle={`${actifs.length} comptes actifs · position globale ${formatXOF(tr.totalGlobal)}`}
        action={
          <button onClick={handleSync} disabled={syncing}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium tap
              ${syncing ? "bg-sand-200 text-ink-400 cursor-wait" : "bg-clay text-sand-50 hover:bg-clay-700"}`}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Synchronisation…" : "Actualiser les soldes"}
          </button>
        }
      />

      {syncMsg && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium
          ${syncMsg.ok ? "bg-leaf-100 text-leaf-700" : "bg-ember-100 text-ember-700"}`}>
          {syncMsg.ok ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
          {syncMsg.msg}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total banques",       val: tr.totalBanque,  n: tr.nbBanques,  icon: <Building2 size={17}/>, cls: "text-blue-600" },
          { label: "Caisses espèces",     val: tr.totalEspeces, n: tr.nbEspeces,  icon: <Banknote size={17}/>,  cls: "text-leaf-600" },
          { label: "Flotte Mobile Money", val: tr.totalMobile,  n: tr.nbMobile,   icon: <Smartphone size={17}/>,cls: "text-orange-500" },
          { label: "Position totale",     val: tr.totalGlobal,  n: actifs.length, icon: <Building2 size={17}/>, cls: "text-ink" },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 text-ink-400">{s.icon}<span className="text-[12px]">{s.label}</span></div>
            <div className={`num mt-1 text-xl font-bold ${s.cls}`}>{formatXOF(s.val)}</div>
            <div className="text-[11px] text-ink-400">{s.n} compte{s.n > 1 ? "s" : ""}</div>
          </Card>
        ))}
      </div>

      {groups.map(type => {
        const liste = actifs.filter(c => c.type === type);
        if (liste.length === 0) return null;
        const totalGrp = liste.reduce((s, c) => s + Number(c.solde_dolibarr), 0);
        return (
          <div key={type} className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {TYPE_ICON[type]}
                <h3 className="display text-base font-bold text-ink">{TYPE_LABEL[type]}s</h3>
              </div>
              <div className="num text-[13px] font-medium text-ink-600">Total : {formatXOF(totalGrp)}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map(c => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink truncate">{c.nom}</div>
                      {c.banque && <div className="text-[12px] text-ink-500">{c.banque}</div>}
                    </div>
                    <Badge className={TYPE_COLOR[c.type]}>{TYPE_LABEL[c.type]}</Badge>
                  </div>
                  <div className="num mt-3 text-2xl font-bold text-ink">{formatXOF(Number(c.solde_dolibarr))}</div>
                  <div className="mt-2 space-y-1 text-[12px] text-ink-500">
                    {c.numero_compte && <div>N° <span className="num font-medium text-ink">{c.numero_compte}</span></div>}
                    {c.iban && <div>IBAN <span className="num font-medium text-ink-700">{c.iban}</span></div>}
                    {c.titulaire && <div>Titulaire : <span className="font-medium text-ink">{c.titulaire}</span></div>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {fermes.length > 0 && (
        <div className="mt-2">
          <h3 className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink-400">
            <Lock size={14}/> Comptes fermés
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fermes.map(c => (
              <Card key={c.id} className="p-4 opacity-50">
                <div className="font-semibold text-ink">{c.nom}</div>
                <div className="num mt-2 text-lg font-bold text-ink-400">{formatXOF(Number(c.solde_dolibarr))}</div>
                {c.numero_compte && <div className="text-[12px] text-ink-400">N° {c.numero_compte}</div>}
              </Card>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[12px] text-ink-400">
        Soldes synchronisés depuis Dolibarr · gescom.wendmanegre.com · Cliquez «&nbsp;Actualiser les soldes&nbsp;» pour récupérer les derniers soldes
      </p>
    </div>
  );
}
