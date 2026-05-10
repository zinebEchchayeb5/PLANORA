import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API = "http://127.0.0.1:8000";
const COLORS = ["#1e293b","#3B82F6","#10B981","#F59E0B","#8B5CF6","#EF4444"];

function KpiCard({ label, value, icon, color, status }) {
  const statusColors = { bon:"#10B981", moyen:"#F59E0B", mauvais:"#EF4444", info:"#3B82F6", ok:"#10B981", danger:"#EF4444" };
  return (
    <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0",
      borderTop:`3px solid ${statusColors[status]||color}` }}>
      <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:18, fontWeight:700, color:statusColors[status]||color }}>{value}</div>
      <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{label}</div>
    </div>
  );
}

export default function Comptabilite() {
  const [tab, setTab] = useState("dashboard");
  const [kpis, setKpis] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [balance, setBalance] = useState([]);
  const [ecritures, setEcritures] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ compte:"411", libelle:"", debit:0, credit:0, journal:"VT", numero_piece:"" });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [k, r, b, e, bg] = await Promise.all([
        fetch(`${API}/comptabilite/kpis`).then(r => r.json()),
        fetch(`${API}/comptabilite/compte-resultat`).then(r => r.json()),
        fetch(`${API}/comptabilite/balance`).then(r => r.json()),
        fetch(`${API}/comptabilite/ecritures`).then(r => r.json()),
        fetch(`${API}/comptabilite/budgets`).then(r => r.json()),
      ]);
      setKpis(k); setResultat(r);
      setBalance(Array.isArray(b) ? b : []);
      setEcritures(Array.isArray(e) ? e : []);
      setBudgets(Array.isArray(bg) ? bg : []);
    } catch {}
    setLoading(false);
  };

  const runAudit = async () => {
    setAuditLoading(true);
    try {
      const data = await fetch(`${API}/comptabilite/audit-ia`).then(r => r.json());
      setAudit(data);
      setTab("audit");
    } catch {}
    setAuditLoading(false);
  };

  const saveEcriture = async () => {
    try {
      await fetch(`${API}/comptabilite/ecritures`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form)
      });
      setModal(false);
      setForm({ compte:"411", libelle:"", debit:0, credit:0, journal:"VT", numero_piece:"" });
      fetchAll();
    } catch { alert("Erreur"); }
  };

  const tabs = [
    { id:"dashboard", label:"Dashboard", icon:"📊" },
    { id:"resultat",  label:"Compte de résultat", icon:"📈" },
    { id:"balance",   label:"Balance", icon:"⚖️" },
    { id:"journal",   label:"Journal", icon:"📒" },
    { id:"budgets",   label:"Budgets projets", icon:"🎯" },
    { id:"audit",     label:"Audit IA", icon:"🤖" },
  ];

  if (loading) return (
    <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>⚙️</div>
      <p>Chargement comptabilité...</p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Comptabilité & Finance</h1>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>
            {new Date().toLocaleDateString("fr-FR", { year:"numeric", month:"long" })}
          </p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={runAudit} disabled={auditLoading}
            style={{ padding:"9px 16px", background:auditLoading?"#94a3b8":"#8B5CF6", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500 }}>
            {auditLoading?"⏳ Audit en cours...":"🤖 Audit IA"}
          </button>
          <button onClick={() => setModal(true)}
            style={{ padding:"9px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
            + Écriture
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:20, background:"#f1f5f9", borderRadius:10, padding:3, flexWrap:"wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12,
              background:tab===t.id?"white":"transparent",
              color:tab===t.id?"#1e293b":"#94a3b8",
              fontWeight:tab===t.id?600:400,
              boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,.1)":"none",
              display:"flex", alignItems:"center", gap:5 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && kpis && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
            {kpis.indicateurs?.map((ind, i) => (
              <KpiCard key={i} label={ind.label} value={ind.value} icon={["💰","📊","⚠️","🏗️"][i]} color={COLORS[i]} status={ind.status}/>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Résultat simplifié */}
            {resultat && (
              <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
                <h3 style={{ margin:"0 0 16px", fontSize:14, color:"#1e293b" }}>Compte de résultat simplifié</h3>
                {[
                  { label:"Chiffre d'affaires", value:resultat.produits?.chiffre_affaires, color:"#10B981", sign:"+" },
                  { label:"Charges personnel", value:resultat.charges?.personnel, color:"#EF4444", sign:"-" },
                  { label:"Charges exploitation", value:resultat.charges?.exploitation, color:"#EF4444", sign:"-" },
                  { label:"Charges financières", value:resultat.charges?.financieres, color:"#EF4444", sign:"-" },
                ].map((r, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0",
                    borderBottom:"1px solid #f1f5f9" }}>
                    <span style={{ fontSize:13, color:"#64748b" }}>{r.label}</span>
                    <span style={{ fontSize:13, fontWeight:500, color:r.color }}>{r.sign} {(r.value||0).toLocaleString()} MAD</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", marginTop:4,
                  borderTop:"2px solid #1e293b" }}>
                  <span style={{ fontSize:14, fontWeight:700, color:"#1e293b" }}>Résultat net</span>
                  <span style={{ fontSize:16, fontWeight:700,
                    color: resultat.resultat_net >= 0 ? "#10B981":"#EF4444" }}>
                    {(resultat.resultat_net||0).toLocaleString()} MAD
                  </span>
                </div>
                <div style={{ textAlign:"center", marginTop:8, fontSize:12, color:"#64748b" }}>
                  Marge: <b style={{ color: resultat.marge >= 30?"#10B981":resultat.marge >= 10?"#F59E0B":"#EF4444" }}>
                    {resultat.marge}%
                  </b>
                </div>
              </div>
            )}

            {/* Balance comptes */}
            <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
              <h3 style={{ margin:"0 0 16px", fontSize:14, color:"#1e293b" }}>Balance des comptes</h3>
              {balance.length === 0 ? (
                <div style={{ textAlign:"center", padding:20, color:"#94a3b8", fontSize:13 }}>
                  Aucune écriture comptable
                </div>
              ) : (
                <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid #e2e8f0" }}>
                      {["Compte","Débit","Crédit","Solde"].map(h => (
                        <th key={h} style={{ textAlign: h==="Compte"?"left":"right", padding:"4px 8px", color:"#64748b", fontWeight:500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {balance.slice(0,8).map((b, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid #f8fafc" }}>
                        <td style={{ padding:"6px 8px", fontWeight:500 }}>{b.compte}</td>
                        <td style={{ padding:"6px 8px", textAlign:"right", color:"#3B82F6" }}>{b.debit.toLocaleString()}</td>
                        <td style={{ padding:"6px 8px", textAlign:"right", color:"#EF4444" }}>{b.credit.toLocaleString()}</td>
                        <td style={{ padding:"6px 8px", textAlign:"right", fontWeight:600,
                          color: b.solde >= 0?"#10B981":"#EF4444" }}>
                          {b.solde.toLocaleString()} {b.sens}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── COMPTE DE RÉSULTAT ── */}
      {tab === "resultat" && resultat && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:15 }}>Produits</h3>
            {[
              { label:"Chiffre d'affaires encaissé", value:resultat.produits?.chiffre_affaires },
              { label:"Devis en cours", value:resultat.produits?.devis_en_cours },
            ].map((r,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
                <span style={{ fontSize:13, color:"#64748b" }}>{r.label}</span>
                <span style={{ fontSize:13, fontWeight:600, color:"#10B981" }}>{(r.value||0).toLocaleString()} MAD</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", fontWeight:700, borderTop:"2px solid #e2e8f0", marginTop:4 }}>
              <span>Total produits</span>
              <span style={{ color:"#10B981" }}>{(resultat.produits?.total||0).toLocaleString()} MAD</span>
            </div>
          </div>

          <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:15 }}>Charges</h3>
            {[
              { label:"Charges de personnel", value:resultat.charges?.personnel },
              { label:"Charges d'exploitation", value:resultat.charges?.exploitation },
              { label:"Charges financières", value:resultat.charges?.financieres },
            ].map((r,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
                <span style={{ fontSize:13, color:"#64748b" }}>{r.label}</span>
                <span style={{ fontSize:13, fontWeight:600, color:"#EF4444" }}>{(r.value||0).toLocaleString()} MAD</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", fontWeight:700, borderTop:"2px solid #e2e8f0", marginTop:4 }}>
              <span>Total charges</span>
              <span style={{ color:"#EF4444" }}>{(resultat.charges?.total||0).toLocaleString()} MAD</span>
            </div>
          </div>

          <div style={{ gridColumn:"1/-1", background: resultat.resultat_net >= 0 ? "#f0fdf4":"#fef2f2",
            borderRadius:12, padding:24, border:`1px solid ${resultat.resultat_net >= 0?"#86efac":"#fca5a5"}`,
            textAlign:"center" }}>
            <div style={{ fontSize:14, color:"#64748b", marginBottom:8 }}>RÉSULTAT NET</div>
            <div style={{ fontSize:36, fontWeight:700, color: resultat.resultat_net >= 0?"#10B981":"#EF4444" }}>
              {(resultat.resultat_net||0).toLocaleString()} MAD
            </div>
            <div style={{ fontSize:14, color:"#64748b", marginTop:8 }}>
              Marge nette: <b>{resultat.marge}%</b>
            </div>
          </div>
        </div>
      )}

      {/* ── BALANCE ── */}
      {tab === "balance" && (
        <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#1e293b" }}>
                {["N° Compte","Intitulé","Débit","Crédit","Solde","Sens"].map(h => (
                  <th key={h} style={{ padding:"12px 14px", color:"white", fontWeight:500, fontSize:12,
                    textAlign: h==="N° Compte"||h==="Intitulé"?"left":"right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balance.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
                  Aucune écriture — créez des écritures comptables
                </td></tr>
              ) : balance.map((b, i) => (
                <tr key={i} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"white":"#fafbfc" }}>
                  <td style={{ padding:"10px 14px", fontWeight:600 }}>{b.compte}</td>
                  <td style={{ padding:"10px 14px", color:"#64748b" }}>Compte {b.compte}</td>
                  <td style={{ padding:"10px 14px", textAlign:"right", color:"#3B82F6" }}>{b.debit.toLocaleString()} MAD</td>
                  <td style={{ padding:"10px 14px", textAlign:"right", color:"#EF4444" }}>{b.credit.toLocaleString()} MAD</td>
                  <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700,
                    color:b.solde>=0?"#10B981":"#EF4444" }}>
                    {Math.abs(b.solde).toLocaleString()} MAD
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"right" }}>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10,
                      background:b.sens==="D"?"#eff6ff":"#fef2f2",
                      color:b.sens==="D"?"#1d4ed8":"#dc2626", fontWeight:600 }}>
                      {b.sens}
                    </span>
                  </td>
                </tr>
              ))}
              <tr style={{ background:"#f8fafc", borderTop:"2px solid #1e293b" }}>
                <td colSpan={2} style={{ padding:"12px 14px", fontWeight:700 }}>TOTAUX</td>
                <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:700, color:"#3B82F6" }}>
                  {balance.reduce((s,b) => s+b.debit, 0).toLocaleString()} MAD
                </td>
                <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:700, color:"#EF4444" }}>
                  {balance.reduce((s,b) => s+b.credit, 0).toLocaleString()} MAD
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── JOURNAL ── */}
      {tab === "journal" && (
        <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Date","N° Pièce","Journal","Compte","Libellé","Débit","Crédit"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"10px 14px", color:"#64748b", fontWeight:500, fontSize:12, borderBottom:"1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ecritures.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
                  Aucune écriture — cliquez sur "+ Écriture" pour commencer
                </td></tr>
              ) : ecritures.map((e, i) => (
                <tr key={i} style={{ borderBottom:"1px solid #f8fafc", background:i%2===0?"white":"#fafbfc" }}>
                  <td style={{ padding:"9px 14px", color:"#64748b" }}>{e.date}</td>
                  <td style={{ padding:"9px 14px", color:"#94a3b8", fontSize:11 }}>{e.numero_piece||"—"}</td>
                  <td style={{ padding:"9px 14px" }}>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:8, background:"#eff6ff", color:"#1d4ed8", fontWeight:500 }}>{e.journal}</span>
                  </td>
                  <td style={{ padding:"9px 14px", fontWeight:600 }}>{e.compte}</td>
                  <td style={{ padding:"9px 14px" }}>{e.libelle}</td>
                  <td style={{ padding:"9px 14px", color:"#3B82F6", fontWeight:500, textAlign:"right" }}>
                    {e.debit > 0 ? `${e.debit.toLocaleString()} MAD`:""}
                  </td>
                  <td style={{ padding:"9px 14px", color:"#EF4444", fontWeight:500, textAlign:"right" }}>
                    {e.credit > 0 ? `${e.credit.toLocaleString()} MAD`:""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BUDGETS ── */}
      {tab === "budgets" && (
        <div>
          {budgets.length === 0 ? (
            <div style={{ background:"white", borderRadius:12, padding:60, border:"1px solid #e2e8f0", textAlign:"center", color:"#94a3b8" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🎯</div>
              <p>Aucun budget défini — créez des budgets par projet</p>
            </div>
          ) : (
            <div style={{ display:"grid", gap:12 }}>
              {budgets.map((b, i) => (
                <div key={i} style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color:"#1e293b" }}>{b.projet_titre}</div>
                      <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{b.poste}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:12, color:"#64748b" }}>Réalisé / Prévu</div>
                      <div style={{ fontWeight:700, fontSize:14, color: b.taux_realisation > 100?"#EF4444":"#1e293b" }}>
                        {b.budget_realise.toLocaleString()} / {b.budget_prevu.toLocaleString()} MAD
                      </div>
                    </div>
                  </div>
                  <div style={{ height:8, background:"#f1f5f9", borderRadius:4 }}>
                    <div style={{ width:`${Math.min(b.taux_realisation, 100)}%`, height:8, borderRadius:4,
                      background: b.taux_realisation > 100?"#EF4444": b.taux_realisation > 80?"#F59E0B":"#10B981",
                      transition:"width .5s" }}/>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                    <span style={{ fontSize:11, color:"#64748b" }}>{b.taux_realisation}% réalisé</span>
                    <span style={{ fontSize:11, color: b.ecart >= 0?"#10B981":"#EF4444", fontWeight:500 }}>
                      Écart: {b.ecart >= 0 ? "+":""}{b.ecart.toLocaleString()} MAD
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT IA ── */}
      {tab === "audit" && (
        <div>
          {!audit ? (
            <div style={{ background:"white", borderRadius:12, padding:60, border:"1px solid #e2e8f0", textAlign:"center", color:"#94a3b8" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🤖</div>
              <p>Cliquez sur "Audit IA" pour lancer l'analyse</p>
              <button onClick={runAudit} disabled={auditLoading}
                style={{ marginTop:16, padding:"10px 24px", background:"#8B5CF6", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:600 }}>
                {auditLoading?"⏳ Analyse en cours...":"🤖 Lancer l'audit IA"}
              </button>
            </div>
          ) : (
            <div>
              {/* Score santé */}
              <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:16, marginBottom:20 }}>
                <div style={{ background:"white", borderRadius:12, padding:24, border:"1px solid #e2e8f0", textAlign:"center", minWidth:160 }}>
                  <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>Score de santé</div>
                  <div style={{ fontSize:48, fontWeight:700,
                    color: audit.score_sante >= 80?"#10B981":audit.score_sante >= 50?"#F59E0B":"#EF4444" }}>
                    {audit.score_sante}
                  </div>
                  <div style={{ fontSize:12, color:"#94a3b8" }}>/100</div>
                  <div style={{ marginTop:8, fontSize:11, padding:"3px 10px", borderRadius:10, display:"inline-block",
                    background: audit.score_sante>=80?"#f0fdf4":audit.score_sante>=50?"#fffbeb":"#fef2f2",
                    color: audit.score_sante>=80?"#166534":audit.score_sante>=50?"#92400e":"#991b1b" }}>
                    {audit.score_sante>=80?"Excellent":audit.score_sante>=50?"Moyen":"Attention"}
                  </div>
                </div>

                <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
                  <div style={{ fontSize:12, color:"#64748b", marginBottom:12 }}>Résumé — {audit.date_audit}</div>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                    {audit.resume && Object.entries(audit.resume).map(([k,v]) => (
                      <div key={k} style={{ background:"#f8fafc", borderRadius:8, padding:"10px 16px" }}>
                        <div style={{ fontSize:11, color:"#94a3b8", textTransform:"capitalize" }}>{k}</div>
                        <div style={{ fontSize:16, fontWeight:700, color:"#1e293b", marginTop:2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rapport audit */}
              <div style={{ background:"white", borderRadius:12, padding:24, border:"1px solid #8B5CF6" }}>
                <h3 style={{ margin:"0 0 16px", fontSize:15, color:"#6d28d9" }}>🤖 Rapport d'audit IA</h3>
                <div style={{ fontSize:13, color:"#374151", lineHeight:1.8, whiteSpace:"pre-wrap" }}>
                  {audit.audit}
                </div>
                <button onClick={() => { setAudit(null); runAudit(); }} disabled={auditLoading}
                  style={{ marginTop:16, padding:"8px 16px", background:"#8B5CF6", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:12 }}>
                  🔄 Relancer l'audit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal écriture */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}
          onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div style={{ background:"white", borderRadius:16, padding:28, width:460 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:15 }}>📒 Nouvelle écriture comptable</h3>
              <button onClick={() => setModal(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={{ fontSize:12, color:"#64748b" }}>N° Compte *</label>
                <input value={form.compte} onChange={e => setForm({...form,compte:e.target.value})}
                  placeholder="411, 512, 706..."
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#64748b" }}>Journal</label>
                <select value={form.journal} onChange={e => setForm({...form,journal:e.target.value})}
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                  <option value="VT">VT — Ventes</option>
                  <option value="BQ">BQ — Banque</option>
                  <option value="AC">AC — Achats</option>
                  <option value="OD">OD — Opérations diverses</option>
                  <option value="CA">CA — Caisse</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ fontSize:12, color:"#64748b" }}>Libellé *</label>
                <input value={form.libelle} onChange={e => setForm({...form,libelle:e.target.value})}
                  placeholder="Ex: Règlement facture client..."
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#64748b" }}>Débit (MAD)</label>
                <input type="number" value={form.debit} onChange={e => setForm({...form,debit:+e.target.value})}
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#64748b" }}>Crédit (MAD)</label>
                <input type="number" value={form.credit} onChange={e => setForm({...form,credit:+e.target.value})}
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ fontSize:12, color:"#64748b" }}>N° Pièce</label>
                <input value={form.numero_piece} onChange={e => setForm({...form,numero_piece:e.target.value})}
                  placeholder="FAC-2024-001..."
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={saveEcriture} style={{ flex:1, padding:"10px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:600 }}>
                Sauvegarder
              </button>
              <button onClick={() => setModal(false)} style={{ padding:"10px 20px", background:"#f1f5f9", border:"none", borderRadius:8, cursor:"pointer" }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}