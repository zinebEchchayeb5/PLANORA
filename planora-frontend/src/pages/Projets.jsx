import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

const STATUT_COLORS = {
  en_cours:   { bg:"#EFF6FF", text:"#1D4ED8", label:"En cours",   dot:"#3B82F6" },
  en_attente: { bg:"#FFFBEB", text:"#B45309", label:"En attente", dot:"#F59E0B" },
  termine:    { bg:"#F0FDF4", text:"#166534", label:"Terminé",    dot:"#10B981" },
  annule:     { bg:"#FEF2F2", text:"#991B1B", label:"Annulé",     dot:"#EF4444" },
};

const PRIORITE_COLORS = {
  haute:   { bg:"#FEF2F2", text:"#991B1B" },
  normale: { bg:"#EFF6FF", text:"#1D4ED8" },
  basse:   { bg:"#F0FDF4", text:"#166534" },
};

const TYPE_ICONS = {
  maison:"🏠", villa:"🏡", appartement:"🏢", commercial:"🏪"
};

export default function Projets() {
  const [projets, setProjets]     = useState([]);
  const [clients, setClients]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [filterStatut, setFilterStatut] = useState("all");
  const [search, setSearch]       = useState("");
  const [view, setView]           = useState("cards");
  const [form, setForm] = useState({
    titre:"", description:"", client_id:"", surface:"",
    type_bien:"maison", budget_estime:"", statut:"en_cours",
    priorite:"normale", date_debut:"", date_fin:"", notes:""
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([
      fetch(`${API}/projets/`).then(r => r.json()),
      fetch(`${API}/clients/`).then(r => r.json()),
    ]);
    setProjets(Array.isArray(p)?p:[]); setClients(Array.isArray(c)?c:[]); setLoading(false);
  };

  const save = async () => {
    if (!form.titre.trim()) return alert("Titre obligatoire");
    const body = {
      ...form,
      client_id: form.client_id ? +form.client_id : null,
      surface: form.surface ? +form.surface : null,
      budget_estime: form.budget_estime ? +form.budget_estime : null,
    };
    await fetch(`${API}/projets/`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    setShowForm(false);
    setForm({ titre:"", description:"", client_id:"", surface:"", type_bien:"maison", budget_estime:"", statut:"en_cours", priorite:"normale", date_debut:"", date_fin:"", notes:"" });
    fetchData();
  };

  const del = async (id) => {
    if (!confirm("Supprimer ce projet?")) return;
    await fetch(`${API}/projets/${id}`, { method:"DELETE" });
    fetchData();
  };

  const updateStatut = async (id, statut) => {
    await fetch(`${API}/projets/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ statut }) });
    fetchData();
  };

  const filtered = projets.filter(p =>
    (filterStatut === "all" || p.statut === filterStatut) &&
    (p.titre.toLowerCase().includes(search.toLowerCase()) ||
     (p.client?.nom||"").toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    total: projets.length,
    en_cours: projets.filter(p=>p.statut==="en_cours").length,
    termine: projets.filter(p=>p.statut==="termine").length,
    budget: projets.reduce((s,p)=>s+(p.budget_estime||0),0),
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Projets</h1>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>{projets.length} projets au total</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding:"9px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          + Nouveau projet
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"Total projets",   value:stats.total,                          color:"#1e293b", icon:"📋" },
          { label:"En cours",        value:stats.en_cours,                       color:"#3B82F6", icon:"🔄" },
          { label:"Terminés",        value:stats.termine,                        color:"#10B981", icon:"✅" },
          { label:"Budget total",    value:`${stats.budget.toLocaleString()} MAD`,color:"#8B5CF6", icon:"💰" },
        ].map(s => (
          <div key={s.label} style={{ background:"white", borderRadius:12, padding:18, border:"1px solid #e2e8f0" }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div style={{ fontSize:typeof s.value==="string"?14:24, fontWeight:700, color:s.color, marginTop:8 }}>{s.value}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0", marginBottom:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15 }}>Nouveau projet</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Titre *</label>
              <input value={form.titre} onChange={e=>setForm({...form,titre:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Client</label>
              <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="">-- Sans client --</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Type de bien</label>
              <select value={form.type_bien} onChange={e=>setForm({...form,type_bien:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="maison">🏠 Maison</option>
                <option value="villa">🏡 Villa</option>
                <option value="appartement">🏢 Appartement</option>
                <option value="commercial">🏪 Commercial</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Priorité</label>
              <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="basse">🟢 Basse</option>
                <option value="normale">🔵 Normale</option>
                <option value="haute">🔴 Haute</option>
              </select>
            </div>
            {[
              {l:"Surface (m²)",k:"surface",t:"number"},
              {l:"Budget estimé (MAD)",k:"budget_estime",t:"number"},
              {l:"Date début",k:"date_debut",t:"date"},
              {l:"Date fin prévue",k:"date_fin",t:"date"},
            ].map(f=>(
              <div key={f.k}>
                <label style={{ fontSize:12, color:"#64748b" }}>{f.l}</label>
                <input type={f.t} value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})}
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
              </div>
            ))}
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Description</label>
              <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13, resize:"vertical" }}/>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Notes internes</label>
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13, resize:"vertical" }}/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <button onClick={save} style={{ padding:"8px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Créer</button>
            <button onClick={()=>setShowForm(false)} style={{ padding:"8px 18px", background:"#f1f5f9", color:"#333", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
          style={{ padding:"7px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, width:200 }}/>
        {[["all","Tous"],["en_cours","En cours"],["en_attente","En attente"],["termine","Terminés"],["annule","Annulés"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilterStatut(v)}
            style={{ padding:"5px 14px", borderRadius:20, border:"1px solid #e2e8f0", fontSize:12, cursor:"pointer",
              background:filterStatut===v?"#1e293b":"white", color:filterStatut===v?"white":"#64748b" }}>
            {l}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
          {[["cards","⊞"],["list","☰"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)}
              style={{ padding:"5px 10px", borderRadius:6, border:"1px solid #e2e8f0", fontSize:14, cursor:"pointer",
                background:view===v?"#1e293b":"white", color:view===v?"white":"#64748b" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* CARDS VIEW */}
      {!loading && view === "cards" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px,1fr))", gap:16 }}>
          {filtered.length === 0 ? (
            <div style={{ background:"white", borderRadius:12, padding:40, border:"1px solid #e2e8f0", textAlign:"center", color:"#94a3b8", gridColumn:"1/-1" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
              <p>Aucun projet trouvé</p>
            </div>
          ) : filtered.map(p => (
            <div key={p.id} style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0",
              overflow:"hidden", cursor:"pointer", transition:"all .2s",
              borderTop:`3px solid ${STATUT_COLORS[p.statut]?.dot||"#e2e8f0"}` }}
              onClick={() => setSelected(selected?.id===p.id ? null : p)}>
              <div style={{ padding:18 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:20 }}>{TYPE_ICONS[p.type_bien]||"🏠"}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{p.titre}</div>
                      {p.client && <div style={{ fontSize:11, color:"#64748b" }}>👤 {p.client.nom}</div>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:4, flexDirection:"column", alignItems:"flex-end" }}>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8,
                      background:STATUT_COLORS[p.statut]?.bg, color:STATUT_COLORS[p.statut]?.text }}>
                      {STATUT_COLORS[p.statut]?.label}
                    </span>
                    {p.priorite && p.priorite !== "normale" && (
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8,
                        background:PRIORITE_COLORS[p.priorite]?.bg, color:PRIORITE_COLORS[p.priorite]?.text }}>
                        {p.priorite}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display:"flex", gap:12, fontSize:12, color:"#64748b", marginBottom:12, flexWrap:"wrap" }}>
                  {p.surface && <span>📐 {p.surface}m²</span>}
                  {p.budget_estime && <span>💰 {p.budget_estime.toLocaleString()} MAD</span>}
                  {p.type_bien && <span>🏗️ {p.type_bien}</span>}
                </div>

                {/* Progression */}
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#64748b", marginBottom:4 }}>
                    <span>Progression</span>
                    <span>{p.progression||0}%</span>
                  </div>
                  <div style={{ height:6, background:"#f1f5f9", borderRadius:3 }}>
                    <div style={{ width:`${p.progression||0}%`, height:6, borderRadius:3,
                      background:STATUT_COLORS[p.statut]?.dot||"#1e293b", transition:"width .3s" }}/>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding:"10px 18px", borderTop:"1px solid #f1f5f9", display:"flex", gap:6, background:"#fafafa" }}
                onClick={e => e.stopPropagation()}>
                <select value={p.statut} onChange={e=>updateStatut(p.id,e.target.value)}
                  style={{ flex:1, padding:"5px 8px", borderRadius:6, border:"1px solid #e2e8f0", fontSize:12, cursor:"pointer" }}>
                  <option value="en_cours">En cours</option>
                  <option value="en_attente">En attente</option>
                  <option value="termine">Terminé</option>
                  <option value="annule">Annulé</option>
                </select>
                <button onClick={()=>del(p.id)}
                  style={{ padding:"5px 10px", background:"#FEF2F2", color:"#dc2626", border:"1px solid #FECACA", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                  Supprimer
                </button>
              </div>

              {/* Détails expandés */}
              {selected?.id === p.id && (
                <div style={{ padding:18, borderTop:"1px solid #f1f5f9", background:"#f8f9fa" }}>
                  {p.description && <p style={{ margin:"0 0 8px", fontSize:13, color:"#374151" }}>{p.description}</p>}
                  {p.notes && (
                    <div style={{ background:"#FFF8E1", borderRadius:8, padding:10, marginBottom:8 }}>
                      <div style={{ fontSize:11, color:"#92400E", fontWeight:600, marginBottom:4 }}>📝 Notes internes</div>
                      <div style={{ fontSize:12, color:"#374151" }}>{p.notes}</div>
                    </div>
                  )}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {[
                      { label:"Tâches", value:`${p.progression||0}% complété` },
                      { label:"Créé le", value:new Date(p.created_at).toLocaleDateString("fr-FR") },
                    ].map(s=>(
                      <div key={s.label} style={{ background:"white", borderRadius:6, padding:"8px 10px" }}>
                        <div style={{ fontSize:10, color:"#94a3b8" }}>{s.label}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* LIST VIEW */}
      {!loading && view === "list" && (
        <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8f9fa", borderBottom:"1px solid #e2e8f0" }}>
                {["Projet","Client","Type","Surface","Budget","Priorité","Statut","Progression","Actions"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"11px 12px", color:"#64748b", fontWeight:500, fontSize:12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign:"center", padding:32, color:"#94a3b8" }}>Aucun projet</td></tr>
              ) : filtered.map((p,i)=>(
                <tr key={p.id} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"white":"#fafafa" }}>
                  <td style={{ padding:"11px 12px" }}>
                    <div style={{ fontWeight:600, color:"#1e293b" }}>{p.titre}</div>
                    {p.description && <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>{p.description.substring(0,40)}...</div>}
                  </td>
                  <td style={{ padding:"11px 12px", color:"#64748b" }}>{p.client?.nom||"—"}</td>
                  <td style={{ padding:"11px 12px" }}>{TYPE_ICONS[p.type_bien]||""} {p.type_bien||"—"}</td>
                  <td style={{ padding:"11px 12px", color:"#64748b" }}>{p.surface?`${p.surface}m²`:"—"}</td>
                  <td style={{ padding:"11px 12px", color:"#64748b" }}>{p.budget_estime?`${p.budget_estime.toLocaleString()} MAD`:"—"}</td>
                  <td style={{ padding:"11px 12px" }}>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:8,
                      background:PRIORITE_COLORS[p.priorite||"normale"]?.bg,
                      color:PRIORITE_COLORS[p.priorite||"normale"]?.text }}>
                      {p.priorite||"normale"}
                    </span>
                  </td>
                  <td style={{ padding:"11px 12px" }}>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:8,
                      background:STATUT_COLORS[p.statut]?.bg, color:STATUT_COLORS[p.statut]?.text }}>
                      {STATUT_COLORS[p.statut]?.label}
                    </span>
                  </td>
                  <td style={{ padding:"11px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ flex:1, height:4, background:"#f1f5f9", borderRadius:2, minWidth:50 }}>
                        <div style={{ width:`${p.progression||0}%`, height:4, background:STATUT_COLORS[p.statut]?.dot||"#1e293b", borderRadius:2 }}/>
                      </div>
                      <span style={{ fontSize:11, color:"#64748b", minWidth:28 }}>{p.progression||0}%</span>
                    </div>
                  </td>
                  <td style={{ padding:"11px 12px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <select value={p.statut} onChange={e=>updateStatut(p.id,e.target.value)}
                        style={{ padding:"4px 6px", borderRadius:6, border:"1px solid #e2e8f0", fontSize:11, cursor:"pointer" }}>
                        <option value="en_cours">En cours</option>
                        <option value="en_attente">En attente</option>
                        <option value="termine">Terminé</option>
                        <option value="annule">Annulé</option>
                      </select>
                      <button onClick={()=>del(p.id)}
                        style={{ padding:"4px 8px", background:"#FEF2F2", color:"#dc2626", border:"1px solid #FECACA", borderRadius:6, cursor:"pointer", fontSize:11 }}>
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

      {loading && <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>Chargement...</div>}
    </div>
  );
}