import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

const STATUT_COLORS = {
  impayee:  { bg:"#FFFBEB", text:"#B45309", label:"Impayée" },
  payee:    { bg:"#F0FDF4", text:"#166534", label:"Payée" },
  annulee:  { bg:"#FEF2F2", text:"#991B1B", label:"Annulée" },
  devis:    { bg:"#EFF6FF", text:"#1D4ED8", label:"Devis" },
};

export default function Factures() {
  const [factures, setFactures] = useState([]);
  const [projets, setProjets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ projet_id:"", montant:"", statut:"impayee", date_echeance:"" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [f, p] = await Promise.all([
        fetch(`${API}/factures/`).then(r => r.json()),
        fetch(`${API}/projets/`).then(r => r.json()),
      ]);
      setFactures(Array.isArray(f) ? f : []);
      setProjets(Array.isArray(p) ? p : []);
    } catch {}
    setLoading(false);
  };

  const save = async () => {
    if (!form.projet_id || !form.montant) return alert("Projet et montant obligatoires");
    try {
      await fetch(`${API}/factures/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, projet_id: +form.projet_id, montant: +form.montant })
      });
      setShowForm(false);
      setForm({ projet_id:"", montant:"", statut:"impayee", date_echeance:"" });
      fetchData();
    } catch { alert("Erreur création"); }
  };

  const updateStatut = async (id, statut) => {
    await fetch(`${API}/factures/${id}/statut?statut=${statut}`, { method:"PUT" });
    fetchData();
  };

  const del = async (id) => {
    if (!confirm("Supprimer?")) return;
    await fetch(`${API}/factures/${id}`, { method:"DELETE" });
    fetchData();
  };

  const filtered = filter === "all" ? factures : factures.filter(f => f.statut === filter);
  const totalImpaye = factures.filter(f => f.statut === "impayee").reduce((s, f) => s + (f.montant||0), 0);
  const totalPaye = factures.filter(f => f.statut === "payee").reduce((s, f) => s + (f.montant||0), 0);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Facturation</h1>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>{factures.length} documents</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding:"9px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          + Nouvelle facture
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"Total factures", value:factures.length, color:"#1e293b", icon:"📄" },
          { label:"Montant impayé", value:`${totalImpaye.toLocaleString()} MAD`, color:"#EF4444", icon:"⚠️" },
          { label:"Montant encaissé", value:`${totalPaye.toLocaleString()} MAD`, color:"#10B981", icon:"✅" },
        ].map(k => (
          <div key={k.label} style={{ background:"white", borderRadius:12, padding:18, border:"1px solid #e2e8f0" }}>
            <div style={{ fontSize:22, marginBottom:8 }}>{k.icon}</div>
            <div style={{ fontSize:20, fontWeight:700, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0", marginBottom:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15 }}>Nouvelle facture / devis</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Projet *</label>
              <select value={form.projet_id} onChange={e => setForm({...form, projet_id:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="">-- Sélectionner --</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.titre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Montant (MAD) *</label>
              <input type="number" value={form.montant} onChange={e => setForm({...form, montant:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Type</label>
              <select value={form.statut} onChange={e => setForm({...form, statut:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="impayee">Facture</option>
                <option value="devis">Devis</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Date échéance</label>
              <input type="date" value={form.date_echeance} onChange={e => setForm({...form, date_echeance:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <button onClick={save} style={{ padding:"8px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Créer</button>
            <button onClick={() => setShowForm(false)} style={{ padding:"8px 18px", background:"#f1f5f9", color:"#333", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["all","Tout"],["impayee","Impayées"],["payee","Payées"],["devis","Devis"],["annulee","Annulées"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding:"5px 14px", borderRadius:20, border:"1px solid #e2e8f0", fontSize:12, cursor:"pointer",
              background: filter===v ? "#1e293b":"white", color: filter===v ? "white":"#64748b" }}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>Chargement...</div> : (
        <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["#","Projet","Montant","Statut","Date émission","Échéance","Actions"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"10px 14px", color:"#64748b", fontWeight:500, fontSize:12, borderBottom:"1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:"center", padding:32, color:"#94a3b8" }}>Aucune facture</td></tr>
              ) : filtered.map((f, i) => (
                <tr key={f.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"10px 14px", color:"#94a3b8" }}>#{f.id}</td>
                  <td style={{ padding:"10px 14px", fontWeight:500 }}>{f.projet?.titre || "—"}</td>
                  <td style={{ padding:"10px 14px", fontWeight:600, color:"#1e293b" }}>{(f.montant||0).toLocaleString()} MAD</td>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:12,
                      background:STATUT_COLORS[f.statut]?.bg, color:STATUT_COLORS[f.statut]?.text }}>
                      {STATUT_COLORS[f.statut]?.label || f.statut}
                    </span>
                  </td>
                  <td style={{ padding:"10px 14px", color:"#64748b" }}>
                    {f.date_emission ? new Date(f.date_emission).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td style={{ padding:"10px 14px", color: f.date_echeance && new Date(f.date_echeance) < new Date() && f.statut==="impayee" ? "#EF4444":"#64748b" }}>
                    {f.date_echeance ? new Date(f.date_echeance).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      {f.statut === "impayee" && (
                        <button onClick={() => updateStatut(f.id, "payee")}
                          style={{ padding:"4px 10px", background:"#f0fdf4", color:"#166534", border:"1px solid #bbf7d0", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                          ✓ Payer
                        </button>
                      )}
                      {f.statut === "devis" && (
                        <button onClick={() => updateStatut(f.id, "impayee")}
                          style={{ padding:"4px 10px", background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                          → Facture
                        </button>
                      )}
                      <button onClick={() => del(f.id)}
                        style={{ padding:"4px 8px", background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}