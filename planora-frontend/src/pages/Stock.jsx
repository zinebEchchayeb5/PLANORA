import { useState, useEffect, useRef } from "react";

const API = "http://127.0.0.1:8000";

const CATEGORIES = ["Matériaux", "Outillage", "Fournitures bureau", "Équipement", "Autre"];

export default function Stock() {
  const [items, setItems] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("liste");
  const [modal, setModal] = useState(false);
  const [mouvementModal, setMouvementModal] = useState(null);
  const [analyse, setAnalyse] = useState(null);
  const [analyseLoading, setAnalyseLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAlerte, setFilterAlerte] = useState(false);
  const [form, setForm] = useState({ nom:"", reference:"", categorie:"Matériaux", unite:"unité", quantite:0, quantite_min:5, prix_unitaire:0, fournisseur:"", localisation:"", description:"" });
  const [editId, setEditId] = useState(null);
  const [mvtForm, setMvtForm] = useState({ type_mouvement:"entree", quantite:1, motif:"" });
  const fileRef = useRef();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, a, st] = await Promise.all([
        fetch(`${API}/stock/`).then(r => r.json()),
        fetch(`${API}/stock/alertes/stock-bas`).then(r => r.json()),
        fetch(`${API}/stock/stats/overview`).then(r => r.json()),
      ]);
      setItems(Array.isArray(s) ? s : []);
      setAlertes(Array.isArray(a) ? a : []);
      setStats(st);
    } catch {}
    setLoading(false);
  };

  const save = async () => {
    if (!form.nom.trim()) return alert("Nom obligatoire");
    try {
      if (editId) await fetch(`${API}/stock/${editId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      else await fetch(`${API}/stock/`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      setModal(false); setEditId(null);
      setForm({ nom:"", reference:"", categorie:"Matériaux", unite:"unité", quantite:0, quantite_min:5, prix_unitaire:0, fournisseur:"", localisation:"", description:"" });
      fetchData();
    } catch { alert("Erreur"); }
  };

  const addMouvement = async () => {
    try {
      const res = await fetch(`${API}/stock/mouvement`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ item_id: mouvementModal.id, ...mvtForm, quantite: +mvtForm.quantite }) });
      const data = await res.json();
      if (data.error) alert(data.error);
      else { setMouvementModal(null); fetchData(); }
    } catch(e) { alert(e.message); }
  };

  const getAnalyse = async () => {
    setAnalyseLoading(true);
    try {
      const data = await fetch(`${API}/stock/ia/analyse`).then(r => r.json());
      setAnalyse(data.analyse);
    } catch {}
    setAnalyseLoading(false);
  };

  const scanDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const data = await fetch(`${API}/stock/ia/scan-produit`, { method:"POST", body:fd }).then(r => r.json());
      if (data.success && data.extracted) {
        const ex = data.extracted;
        setForm(f => ({...f,
          nom: ex.nom || f.nom,
          reference: ex.reference || f.reference,
          categorie: ex.categorie || f.categorie,
          prix_unitaire: ex.prix_unitaire || f.prix_unitaire,
          unite: ex.unite || f.unite,
          fournisseur: ex.fournisseur || f.fournisseur,
          description: ex.description || f.description,
        }));
        setModal(true);
      } else alert("Impossible d'extraire les données");
    } catch { alert("Erreur scan"); }
    e.target.value = "";
  };

  const filtered = items
    .filter(i => !search || i.nom.toLowerCase().includes(search.toLowerCase()) || (i.reference||"").toLowerCase().includes(search.toLowerCase()))
    .filter(i => !filterAlerte || i.alerte_stock);

  const openEdit = (item) => {
    setForm({ nom:item.nom, reference:item.reference||"", categorie:item.categorie||"Matériaux",
      unite:item.unite, quantite:item.quantite, quantite_min:item.quantite_min,
      prix_unitaire:item.prix_unitaire, fournisseur:item.fournisseur||"",
      localisation:item.localisation||"", description:item.description||"" });
    setEditId(item.id); setModal(true);
  };

  const s = { card: { background:"white", borderRadius:12, padding:"16px 20px", border:"1px solid #e2e8f0" } };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Gestion de Stock</h1>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>{items.length} articles · {alertes.length} alertes</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => fileRef.current?.click()}
            style={{ padding:"9px 16px", background:"#8B5CF6", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500 }}>
            📷 Scanner document
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }} onChange={scanDocument}/>
          <button onClick={() => { setEditId(null); setForm({ nom:"", reference:"", categorie:"Matériaux", unite:"unité", quantite:0, quantite_min:5, prix_unitaire:0, fournisseur:"", localisation:"", description:"" }); setModal(true); }}
            style={{ padding:"9px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
            + Nouvel article
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
          {[
            { label:"Total articles", value:stats.total_articles, icon:"📦", color:"#1e293b" },
            { label:"Valeur stock", value:stats.valeur_formatted, icon:"💰", color:"#10B981" },
            { label:"Alertes stock bas", value:stats.alertes_stock_bas, icon:"⚠️", color:"#EF4444" },
            { label:"Catégories", value:stats.categories?.length||0, icon:"🗂️", color:"#8B5CF6" },
          ].map(k => (
            <div key={k.label} style={s.card}>
              <div style={{ fontSize:20, marginBottom:6 }}>{k.icon}</div>
              <div style={{ fontSize:20, fontWeight:700, color:k.color }}>{k.value}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alertes */}
      {alertes.length > 0 && (
        <div style={{ ...s.card, marginBottom:20, borderColor:"#fca5a5", background:"#fef2f2" }}>
          <div style={{ fontWeight:600, fontSize:13, color:"#991b1b", marginBottom:8 }}>⚠️ Alertes stock bas ({alertes.length})</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {alertes.map(a => (
              <span key={a.id} style={{ background:"white", border:"1px solid #fca5a5", borderRadius:20, padding:"3px 12px", fontSize:12, color:"#dc2626" }}>
                {a.nom}: {a.quantite}/{a.quantite_min} {a.unite}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..."
          style={{ padding:"7px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, width:220 }}/>
        <button onClick={() => setFilterAlerte(!filterAlerte)}
          style={{ padding:"6px 14px", borderRadius:20, border:"1px solid #e2e8f0", fontSize:12, cursor:"pointer",
            background:filterAlerte?"#EF4444":"white", color:filterAlerte?"white":"#64748b" }}>
          ⚠️ Alertes seulement
        </button>
        <button onClick={getAnalyse} disabled={analyseLoading}
          style={{ padding:"6px 16px", background:analyseLoading?"#94a3b8":"#8B5CF6", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:12, marginLeft:"auto" }}>
          {analyseLoading?"⏳ Analyse...":"🤖 Analyse IA"}
        </button>
      </div>

      {/* Analyse IA */}
      {analyse && (
        <div style={{ ...s.card, marginBottom:16, borderColor:"#8B5CF6", borderWidth:1.5 }}>
          <div style={{ fontWeight:600, fontSize:13, color:"#6d28d9", marginBottom:8 }}>🤖 Analyse IA du stock</div>
          <div style={{ fontSize:13, color:"#374151", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{analyse}</div>
          <button onClick={() => setAnalyse(null)}
            style={{ marginTop:8, padding:"4px 10px", background:"#f1f5f9", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, color:"#64748b" }}>
            Fermer
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>Chargement...</div>
      ) : (
        <div style={{ ...s.card, padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Réf","Article","Catégorie","Quantité","Prix Unit.","Valeur","Fournisseur","Statut","Actions"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"10px 12px", color:"#64748b", fontWeight:500, fontSize:11, borderBottom:"1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📦</div>
                  Aucun article — ajoutez votre premier article!
                </td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} style={{ borderBottom:"1px solid #f1f5f9", background: item.alerte_stock ? "#fffbeb":"white" }}>
                  <td style={{ padding:"10px 12px", color:"#94a3b8", fontSize:11 }}>{item.reference}</td>
                  <td style={{ padding:"10px 12px", fontWeight:500, color:"#1e293b" }}>{item.nom}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:"#eff6ff", color:"#1d4ed8" }}>{item.categorie||"—"}</span>
                  </td>
                  <td style={{ padding:"10px 12px", fontWeight:600, color: item.alerte_stock?"#EF4444":"#1e293b" }}>
                    {item.quantite} {item.unite}
                    {item.alerte_stock && <span style={{ fontSize:10, marginLeft:4 }}>⚠️</span>}
                  </td>
                  <td style={{ padding:"10px 12px", color:"#64748b" }}>{item.prix_unitaire.toLocaleString()} MAD</td>
                  <td style={{ padding:"10px 12px", color:"#10B981", fontWeight:500 }}>{item.valeur_totale.toLocaleString()} MAD</td>
                  <td style={{ padding:"10px 12px", color:"#64748b" }}>{item.fournisseur||"—"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10,
                      background: item.alerte_stock?"#fef2f2":"#f0fdf4",
                      color: item.alerte_stock?"#dc2626":"#166534" }}>
                      {item.alerte_stock?"Stock bas":"OK"}
                    </span>
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <button onClick={() => setMouvementModal(item)}
                        style={{ padding:"3px 8px", background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", borderRadius:5, cursor:"pointer", fontSize:10 }}>
                        ± Mvt
                      </button>
                      <button onClick={() => window.open(`${API}/stock/${item.id}/qrcode`)}
                        style={{ padding:"3px 8px", background:"#f0fdf4", color:"#166534", border:"1px solid #bbf7d0", borderRadius:5, cursor:"pointer", fontSize:10 }}>
                        QR
                      </button>
                      <button onClick={() => openEdit(item)}
                        style={{ padding:"3px 8px", background:"#f8fafc", color:"#64748b", border:"1px solid #e2e8f0", borderRadius:5, cursor:"pointer", fontSize:10 }}>
                        ✏️
                      </button>
                      <button onClick={async () => { if(!confirm("Supprimer?"))return; await fetch(`${API}/stock/${item.id}`,{method:"DELETE"}); fetchData(); }}
                        style={{ padding:"3px 8px", background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:5, cursor:"pointer", fontSize:10 }}>
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

      {/* Modal article */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}
          onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div style={{ background:"white", borderRadius:16, padding:28, width:520, maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16 }}>{editId?"✏️ Modifier":"➕ Nouvel article"}</h3>
              <button onClick={() => setModal(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[["nom","Nom *"],["reference","Référence"],["fournisseur","Fournisseur"],["localisation","Localisation"]].map(([k,l]) => (
                <div key={k}>
                  <label style={{ fontSize:12, color:"#64748b" }}>{l}</label>
                  <input value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
                    style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
                </div>
              ))}
              <div>
                <label style={{ fontSize:12, color:"#64748b" }}>Catégorie</label>
                <select value={form.categorie} onChange={e => setForm({...form,categorie:e.target.value})}
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#64748b" }}>Unité</label>
                <select value={form.unite} onChange={e => setForm({...form,unite:e.target.value})}
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                  {["unité","kg","g","L","m","m²","m³","pièce","boîte","palette"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {[["quantite","Quantité initiale","number"],["quantite_min","Quantité minimum","number"],["prix_unitaire","Prix unitaire (MAD)","number"]].map(([k,l,t]) => (
                <div key={k}>
                  <label style={{ fontSize:12, color:"#64748b" }}>{l}</label>
                  <input type={t} value={form[k]} onChange={e => setForm({...form,[k]:+e.target.value})}
                    style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
                </div>
              ))}
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ fontSize:12, color:"#64748b" }}>Description</label>
                <textarea value={form.description} onChange={e => setForm({...form,description:e.target.value})} rows={2}
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13, resize:"vertical" }}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={save} style={{ flex:1, padding:"10px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:600 }}>
                {editId?"Sauvegarder":"Créer l'article"}
              </button>
              <button onClick={() => setModal(false)} style={{ padding:"10px 20px", background:"#f1f5f9", border:"none", borderRadius:8, cursor:"pointer" }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal mouvement */}
      {mouvementModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}
          onClick={e => e.target===e.currentTarget && setMouvementModal(null)}>
          <div style={{ background:"white", borderRadius:16, padding:28, width:380 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:15 }}>Mouvement de stock</h3>
            <p style={{ margin:"0 0 16px", color:"#64748b", fontSize:13 }}>{mouvementModal.nom} — Stock actuel: <b>{mouvementModal.quantite} {mouvementModal.unite}</b></p>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Type</label>
              <select value={mvtForm.type_mouvement} onChange={e => setMvtForm({...mvtForm,type_mouvement:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="entree">📥 Entrée (réception)</option>
                <option value="sortie">📤 Sortie (utilisation)</option>
                <option value="ajustement">🔧 Ajustement (inventaire)</option>
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Quantité</label>
              <input type="number" value={mvtForm.quantite} onChange={e => setMvtForm({...mvtForm,quantite:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Motif</label>
              <input value={mvtForm.motif} onChange={e => setMvtForm({...mvtForm,motif:e.target.value})} placeholder="Ex: Chantier Villa Benali..."
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={addMouvement} style={{ flex:1, padding:"10px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>Confirmer</button>
              <button onClick={() => setMouvementModal(null)} style={{ padding:"10px 16px", background:"#f1f5f9", border:"none", borderRadius:8, cursor:"pointer" }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}