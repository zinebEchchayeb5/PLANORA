import { useState, useEffect, useRef } from "react";

const API = "http://127.0.0.1:8000";

const STATUT_COLORS = {
  impayee: { bg:"#FEF2F2", text:"#991B1B", label:"Impayée" },
  payee:   { bg:"#F0FDF4", text:"#166534", label:"Payée" },
  annulee: { bg:"#F5F5F5", text:"#666",    label:"Annulée" },
};

export default function Facturation() {
  const [factures, setFactures]   = useState([]);
  const [projets, setProjets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [form, setForm] = useState({ projet_id:"", montant:"", statut:"impayee", date_echeance:"" });
  const fileRef = useRef(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [f, p] = await Promise.all([
      fetch(`${API}/factures/`).then(r => r.json()),
      fetch(`${API}/projets/`).then(r => r.json()),
    ]);
    setFactures(f); setProjets(p); setLoading(false);
  };

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true); setScanResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/ocr/scan-facture`, { method:"POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setScanResult(data);
        // Auto-remplir le formulaire
        const d = data.data;
        setForm(f => ({
          ...f,
          montant: d.montant || "",
          statut: d.statut || "impayee",
          date_echeance: d.date_echeance || "",
        }));
        setShowForm(true);
      } else {
        alert("Scan échoué: " + (data.error || "Erreur inconnue"));
      }
    } catch (err) {
      alert("Erreur: " + err.message);
    }
    setScanning(false);
  };

  const save = async () => {
    if (!form.projet_id || !form.montant) return alert("Projet et montant obligatoires");
    await fetch(`${API}/factures/`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...form, montant:+form.montant, projet_id:+form.projet_id })
    });
    setShowForm(false); setScanResult(null);
    setForm({ projet_id:"", montant:"", statut:"impayee", date_echeance:"" });
    fetchData();
  };

  const updateStatut = async (id, statut) => {
    await fetch(`${API}/factures/${id}/statut?statut=${statut}`, { method:"PUT" });
    fetchData();
  };

  const del = async (id) => {
    if (!confirm("Supprimer cette facture?")) return;
    await fetch(`${API}/factures/${id}`, { method:"DELETE" });
    fetchData();
  };

  const total    = factures.reduce((s, f) => s + f.montant, 0);
  const payees   = factures.filter(f => f.statut==="payee").reduce((s,f) => s+f.montant, 0);
  const impayees = factures.filter(f => f.statut==="impayee").reduce((s,f) => s+f.montant, 0);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Facturation</h1>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>{factures.length} factures</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {/* Scan IA */}
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }} onChange={handleScan}/>
          <button onClick={() => fileRef.current?.click()} disabled={scanning}
            style={{ padding:"9px 16px", background: scanning?"#94a3b8":"#8B5CF6", color:"white", border:"none", borderRadius:8, cursor: scanning?"not-allowed":"pointer", fontSize:13, fontWeight:600 }}>
            {scanning ? "⏳ Scan en cours..." : "🤖 Scanner facture IA"}
          </button>
          <button onClick={() => setShowForm(true)}
            style={{ padding:"9px 16px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
            + Nouvelle facture
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"Total facturé",  value:`${total.toLocaleString()} MAD`,    color:"#1e293b", icon:"💰" },
          { label:"Montant payé",   value:`${payees.toLocaleString()} MAD`,   color:"#10B981", icon:"✅" },
          { label:"Montant impayé", value:`${impayees.toLocaleString()} MAD`, color:"#EF4444", icon:"⚠️" },
        ].map(s => (
          <div key={s.label} style={{ background:"white", borderRadius:12, padding:18, border:"1px solid #e2e8f0" }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div style={{ fontSize:20, fontWeight:700, color:s.color, marginTop:8 }}>{s.value}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Résultat scan IA */}
      {scanResult && (
        <div style={{ background:"#F5F3FF", border:"1px solid #8B5CF6", borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:18 }}>🤖</span>
            <h3 style={{ margin:0, fontSize:14, color:"#6d28d9" }}>
              Données extraites automatiquement — Confiance: <strong>{scanResult.confidence}</strong>
            </h3>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {[
              { label:"Montant TTC", value: scanResult.data.montant ? `${scanResult.data.montant.toLocaleString()} MAD` : "Non détecté" },
              { label:"Statut",      value: scanResult.data.statut || "Non détecté" },
              { label:"Date émission", value: scanResult.data.date_emission || "Non détecté" },
              { label:"Date échéance", value: scanResult.data.date_echeance || "Non détecté" },
              { label:"Fournisseur",  value: scanResult.data.fournisseur || "Non détecté" },
              { label:"N° Facture",   value: scanResult.data.numero_facture || "Non détecté" },
              { label:"Montant HT",  value: scanResult.data.montant_ht ? `${scanResult.data.montant_ht} MAD` : "Non détecté" },
              { label:"TVA",         value: scanResult.data.tva ? `${scanResult.data.tva} MAD` : "Non détecté" },
              { label:"Description", value: scanResult.data.description || "Non détecté" },
            ].map(f => (
              <div key={f.label} style={{ background:"white", borderRadius:8, padding:10 }}>
                <div style={{ fontSize:11, color:"#6d28d9", fontWeight:500 }}>{f.label}</div>
                <div style={{ fontSize:13, color:"#1e293b", marginTop:3, fontWeight: f.value!=="Non détecté"?600:400,
                  color: f.value==="Non détecté" ? "#94a3b8":"#1e293b" }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, background:"#f8f9fa", borderRadius:8, padding:10 }}>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Texte extrait (aperçu):</div>
            <div style={{ fontSize:11, color:"#374151", fontFamily:"monospace" }}>{scanResult.text_brut}</div>
          </div>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0", marginBottom:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15 }}>
            {scanResult ? "✅ Confirmer les données scannées" : "Nouvelle facture"}
          </h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Projet *</label>
              <select value={form.projet_id} onChange={e=>setForm({...form,projet_id:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="">-- Choisir projet --</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.titre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Montant (MAD) *</label>
              <input type="number" value={form.montant} onChange={e=>setForm({...form,montant:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13,
                  background: scanResult?.data?.montant ? "#F5F3FF":"white" }}/>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Statut</label>
              <select value={form.statut} onChange={e=>setForm({...form,statut:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13,
                  background: scanResult?.data?.statut ? "#F5F3FF":"white" }}>
                <option value="impayee">Impayée</option>
                <option value="payee">Payée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Date d'échéance</label>
              <input type="date" value={form.date_echeance} onChange={e=>setForm({...form,date_echeance:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13,
                  background: scanResult?.data?.date_echeance ? "#F5F3FF":"white" }}/>
            </div>
          </div>
          {scanResult && (
            <div style={{ marginTop:10, fontSize:12, color:"#6d28d9", background:"#F5F3FF", padding:"8px 12px", borderRadius:6 }}>
              🤖 Les champs en violet ont été remplis automatiquement par l'IA — vérifiez avant de confirmer
            </div>
          )}
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <button onClick={save} style={{ padding:"8px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>
              {scanResult ? "✅ Confirmer et enregistrer" : "Créer"}
            </button>
            <button onClick={()=>{setShowForm(false);setScanResult(null);}} style={{ padding:"8px 18px", background:"#f1f5f9", color:"#333", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste factures */}
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>Chargement...</div> : (
        <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          {factures.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💰</div>
              <p>Aucune facture — créez ou scannez votre première facture !</p>
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f8f9fa", borderBottom:"1px solid #e2e8f0" }}>
                  {["#","Projet","Montant","Statut","Émission","Échéance","Actions"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"12px 14px", color:"#64748b", fontWeight:500, fontSize:12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {factures.map((f) => {
                  const isLate = f.date_echeance && new Date(f.date_echeance) < new Date() && f.statut==="impayee";
                  return (
                    <tr key={f.id} style={{ borderBottom:"1px solid #f1f5f9", background: isLate?"#FFF7F7":"white" }}>
                      <td style={{ padding:"12px 14px", color:"#94a3b8" }}>#{f.id}</td>
                      <td style={{ padding:"12px 14px", fontWeight:500 }}>{f.projet?.titre || "—"}</td>
                      <td style={{ padding:"12px 14px", fontWeight:700, color:"#1e293b" }}>{f.montant.toLocaleString()} MAD</td>
                      <td style={{ padding:"12px 14px" }}>
                        <span style={{ fontSize:11, padding:"3px 10px", borderRadius:12, background:STATUT_COLORS[f.statut]?.bg, color:STATUT_COLORS[f.statut]?.text }}>
                          {STATUT_COLORS[f.statut]?.label}
                        </span>
                      </td>
                      <td style={{ padding:"12px 14px", color:"#64748b" }}>
                        {f.date_emission ? new Date(f.date_emission).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td style={{ padding:"12px 14px", color: isLate?"#EF4444":"#64748b", fontWeight: isLate?600:400 }}>
                        {f.date_echeance ? new Date(f.date_echeance).toLocaleDateString("fr-FR") : "—"}
                        {isLate && <span style={{ fontSize:10, marginLeft:4, color:"#EF4444" }}>EN RETARD</span>}
                      </td>
                      <td style={{ padding:"12px 14px" }}>
                        <div style={{ display:"flex", gap:6 }}>
                          {f.statut==="impayee" && (
                            <button onClick={()=>updateStatut(f.id,"payee")}
                              style={{ padding:"4px 10px", background:"#F0FDF4", color:"#166534", border:"1px solid #BBF7D0", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                              ✓ Payée
                            </button>
                          )}
                          <button onClick={()=>del(f.id)}
                            style={{ padding:"4px 10px", background:"#FEF2F2", color:"#dc2626", border:"1px solid #FECACA", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}