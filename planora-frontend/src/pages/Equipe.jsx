import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

const ROLE_COLORS = {
  gerant:     { bg:"#EDE9FE", text:"#5B21B6", label:"Gérant" },
  architecte: { bg:"#EFF6FF", text:"#1D4ED8", label:"Architecte" },
  client:     { bg:"#F0FDF4", text:"#166534", label:"Client" },
};

const PRIORITE_COLORS = {
  haute:    { bg:"#FEF2F2", text:"#991B1B", dot:"#EF4444" },
  normale:  { bg:"#EFF6FF", text:"#1D4ED8", dot:"#3B82F6" },
  basse:    { bg:"#F0FDF4", text:"#166534", dot:"#10B981" },
};

const STATUT_TACHE = {
  todo:        { bg:"#F5F5F5", text:"#666",    label:"À faire" },
  in_progress: { bg:"#EFF6FF", text:"#1D4ED8", label:"En cours" },
  done:        { bg:"#F0FDF4", text:"#166534", label:"Terminé" },
};

export default function Equipe() {
  const [membres, setMembres]   = useState([]);
  const [taches, setTaches]     = useState([]);
  const [projets, setProjets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("kanban");
  const [showTacheForm, setShowTacheForm] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [tacheForm, setTacheForm] = useState({
    titre:"", description:"", projet_id:"", user_id:"",
    statut:"todo", priorite:"normale", deadline:""
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        fetch(`${API}/taches/`).then(r => r.json()),
        fetch(`${API}/projets/`).then(r => r.json()),
      ]);
      setTaches(Array.isArray(t) ? t : []);
      setProjets(Array.isArray(p) ? p : []);
      // Membres simulés depuis les projets
      setMembres([
        { id:1, nom:"Gérant Principal", role:"gerant", email:"gerant@planora.ma", specialite:"Direction", nb_projets: p.length },
        { id:2, nom:"Architecte Senior", role:"architecte", email:"arch1@planora.ma", specialite:"Architecture", nb_projets: Math.floor(p.length/2) },
        { id:3, nom:"Ingénieur Civil", role:"architecte", email:"ing1@planora.ma", specialite:"Structure", nb_projets: Math.floor(p.length/3) },
      ]);
    } catch {}
    setLoading(false);
  };

  const saveTache = async () => {
    if (!tacheForm.titre.trim()) return alert("Titre obligatoire");
    await fetch(`${API}/taches/`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        ...tacheForm,
        projet_id: tacheForm.projet_id ? +tacheForm.projet_id : null,
        user_id: tacheForm.user_id ? +tacheForm.user_id : null,
      })
    });
    setShowTacheForm(false);
    setTacheForm({ titre:"", description:"", projet_id:"", user_id:"", statut:"todo", priorite:"normale", deadline:"" });
    fetchData();
  };

  const updateTache = async (id, updates) => {
    await fetch(`${API}/taches/${id}`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(updates)
    });
    fetchData();
  };

  const delTache = async (id) => {
    if (!confirm("Supprimer cette tâche?")) return;
    await fetch(`${API}/taches/${id}`, { method:"DELETE" });
    fetchData();
  };

  const handleDrop = async (e, newStatut) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("tache_id");
    if (id) await updateTache(+id, { statut: newStatut });
    setDragOver(null);
  };

  const tachesByStatut = (statut) => taches.filter(t => t.statut === statut);

  const stats = {
    total: taches.length,
    todo: tachesByStatut("todo").length,
    in_progress: tachesByStatut("in_progress").length,
    done: tachesByStatut("done").length,
    haute_priorite: taches.filter(t => t.priorite === "haute").length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Équipe & Tâches</h1>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>
            {membres.length} membres · {taches.length} tâches
          </p>
        </div>
        <button onClick={() => setShowTacheForm(true)}
          style={{ padding:"9px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          + Nouvelle tâche
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total tâches",    value:stats.total,         color:"#1e293b", icon:"📋" },
          { label:"À faire",         value:stats.todo,          color:"#64748b", icon:"⏳" },
          { label:"En cours",        value:stats.in_progress,   color:"#3B82F6", icon:"🔄" },
          { label:"Terminées",       value:stats.done,          color:"#10B981", icon:"✅" },
          { label:"Haute priorité",  value:stats.haute_priorite,color:"#EF4444", icon:"🔴" },
        ].map(s => (
          <div key={s.label} style={{ background:"white", borderRadius:12, padding:16, border:"1px solid #e2e8f0" }}>
            <span style={{ fontSize:20 }}>{s.icon}</span>
            <div style={{ fontSize:22, fontWeight:700, color:s.color, marginTop:6 }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {[["kanban","🗂️ Kanban"],["liste","📋 Liste tâches"],["membres","👥 Membres"]].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ padding:"7px 16px", background:activeTab===id?"#1e293b":"white", color:activeTab===id?"white":"#64748b",
              border:"1px solid #e2e8f0", borderRadius:8, cursor:"pointer", fontSize:13 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Formulaire tâche */}
      {showTacheForm && (
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0", marginBottom:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15 }}>Nouvelle tâche</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Titre *</label>
              <input value={tacheForm.titre} onChange={e => setTacheForm({...tacheForm, titre:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Description</label>
              <textarea value={tacheForm.description} onChange={e => setTacheForm({...tacheForm, description:e.target.value})} rows={2}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13, resize:"vertical" }}/>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Projet</label>
              <select value={tacheForm.projet_id} onChange={e => setTacheForm({...tacheForm, projet_id:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="">-- Sans projet --</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.titre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Assigné à</label>
              <select value={tacheForm.user_id} onChange={e => setTacheForm({...tacheForm, user_id:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="">-- Non assigné --</option>
                {membres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Priorité</label>
              <select value={tacheForm.priorite} onChange={e => setTacheForm({...tacheForm, priorite:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
                <option value="basse">🟢 Basse</option>
                <option value="normale">🔵 Normale</option>
                <option value="haute">🔴 Haute</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#64748b" }}>Deadline</label>
              <input type="date" value={tacheForm.deadline} onChange={e => setTacheForm({...tacheForm, deadline:e.target.value})}
                style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <button onClick={saveTache} style={{ padding:"8px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Créer</button>
            <button onClick={() => setShowTacheForm(false)} style={{ padding:"8px 18px", background:"#f1f5f9", color:"#333", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Annuler</button>
          </div>
        </div>
      )}

      {/* KANBAN */}
      {activeTab === "kanban" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          {[["todo","⏳ À faire","#64748b"],["in_progress","🔄 En cours","#3B82F6"],["done","✅ Terminé","#10B981"]].map(([statut, label, color]) => (
            <div key={statut}
              onDragOver={e => { e.preventDefault(); setDragOver(statut); }}
              onDrop={e => handleDrop(e, statut)}
              onDragLeave={() => setDragOver(null)}
              style={{ background: dragOver===statut ? "#EFF6FF":"#f8f9fa", borderRadius:12, padding:14, minHeight:300,
                border: dragOver===statut ? "2px dashed #3B82F6":"2px solid transparent", transition:"all .2s" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:700, color }}>{label}</span>
                <span style={{ fontSize:11, background:"white", padding:"2px 8px", borderRadius:10, color:"#64748b", border:"1px solid #e2e8f0" }}>
                  {tachesByStatut(statut).length}
                </span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {tachesByStatut(statut).map(t => (
                  <div key={t.id} draggable
                    onDragStart={e => e.dataTransfer.setData("tache_id", t.id)}
                    style={{ background:"white", borderRadius:10, padding:12, border:"1px solid #e2e8f0",
                      cursor:"grab", boxShadow:"0 1px 4px #0001",
                      borderLeft:`3px solid ${PRIORITE_COLORS[t.priorite||"normale"]?.dot||"#3B82F6"}` }}>
                    <div style={{ fontWeight:600, fontSize:13, color:"#1e293b", marginBottom:4 }}>{t.titre}</div>
                    {t.description && <div style={{ fontSize:11, color:"#64748b", marginBottom:6 }}>{t.description}</div>}
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                      {t.priorite && (
                        <span style={{ fontSize:10, padding:"1px 6px", borderRadius:8,
                          background:PRIORITE_COLORS[t.priorite]?.bg, color:PRIORITE_COLORS[t.priorite]?.text }}>
                          {t.priorite}
                        </span>
                      )}
                      {t.deadline && (
                        <span style={{ fontSize:10, color: new Date(t.deadline) < new Date() ? "#EF4444":"#64748b" }}>
                          📅 {new Date(t.deadline).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
                        {statut !== "done" && (
                          <button onClick={() => updateTache(t.id, { statut: statut==="todo"?"in_progress":"done" })}
                            style={{ padding:"2px 6px", background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", borderRadius:4, cursor:"pointer", fontSize:10 }}>
                            →
                          </button>
                        )}
                        <button onClick={() => delTache(t.id)}
                          style={{ padding:"2px 6px", background:"#FEF2F2", color:"#dc2626", border:"1px solid #FECACA", borderRadius:4, cursor:"pointer", fontSize:10 }}>
                          ✕
                        </button>
                      </div>
                    </div>
                    {/* Progression bar */}
                    {t.progression > 0 && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ height:3, background:"#f1f5f9", borderRadius:2 }}>
                          <div style={{ width:`${t.progression}%`, height:3, background:color, borderRadius:2 }}/>
                        </div>
                        <span style={{ fontSize:10, color:"#94a3b8" }}>{t.progression}%</span>
                      </div>
                    )}
                  </div>
                ))}
                {tachesByStatut(statut).length === 0 && (
                  <div style={{ textAlign:"center", padding:"20px 0", color:"#94a3b8", fontSize:12 }}>
                    Glisser une tâche ici
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LISTE */}
      {activeTab === "liste" && (
        <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          {taches.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
              <p>Aucune tâche — créez votre première tâche !</p>
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f8f9fa", borderBottom:"1px solid #e2e8f0" }}>
                  {["Tâche","Projet","Priorité","Statut","Deadline","Actions"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"11px 14px", color:"#64748b", fontWeight:500, fontSize:12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taches.map((t,i) => (
                  <tr key={t.id} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"white":"#fafafa" }}>
                    <td style={{ padding:"11px 14px" }}>
                      <div style={{ fontWeight:600, color:"#1e293b" }}>{t.titre}</div>
                      {t.description && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{t.description}</div>}
                    </td>
                    <td style={{ padding:"11px 14px", color:"#64748b", fontSize:12 }}>
                      {projets.find(p => p.id === t.projet_id)?.titre || "—"}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ fontSize:11, padding:"2px 8px", borderRadius:8,
                        background:PRIORITE_COLORS[t.priorite||"normale"]?.bg,
                        color:PRIORITE_COLORS[t.priorite||"normale"]?.text }}>
                        {t.priorite||"normale"}
                      </span>
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <select value={t.statut} onChange={e => updateTache(t.id, { statut:e.target.value })}
                        style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #cbd5e1", fontSize:12, cursor:"pointer" }}>
                        <option value="todo">À faire</option>
                        <option value="in_progress">En cours</option>
                        <option value="done">Terminé</option>
                      </select>
                    </td>
                    <td style={{ padding:"11px 14px", fontSize:12,
                      color: t.deadline && new Date(t.deadline) < new Date() && t.statut!=="done" ? "#EF4444":"#64748b" }}>
                      {t.deadline ? new Date(t.deadline).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <button onClick={() => delTache(t.id)}
                        style={{ padding:"4px 8px", background:"#FEF2F2", color:"#dc2626", border:"1px solid #FECACA", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MEMBRES */}
      {activeTab === "membres" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px,1fr))", gap:16, marginBottom:20 }}>
            {membres.map((m,i) => (
              <div key={i} style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                  <div style={{ width:48, height:48, background:"#1e293b", borderRadius:"50%",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"white", fontWeight:700, fontSize:20, flexShrink:0 }}>
                    {m.nom[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:"#1e293b" }}>{m.nom}</div>
                    <div style={{ fontSize:12, color:"#64748b" }}>{m.email}</div>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, marginTop:4, display:"inline-block",
                      background:ROLE_COLORS[m.role]?.bg, color:ROLE_COLORS[m.role]?.text }}>
                      {ROLE_COLORS[m.role]?.label}
                    </span>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[
                    { label:"Spécialité", value:m.specialite||"—" },
                    { label:"Projets actifs", value:m.nb_projets||0 },
                    { label:"Tâches", value:taches.filter(t=>t.user_id===m.id).length },
                    { label:"Terminées", value:taches.filter(t=>t.user_id===m.id&&t.statut==="done").length },
                  ].map(s => (
                    <div key={s.label} style={{ background:"#f8f9fa", borderRadius:8, padding:"8px 10px" }}>
                      <div style={{ fontSize:10, color:"#94a3b8" }}>{s.label}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:"#1e293b", marginTop:2 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Charge de travail */}
                <div style={{ marginTop:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#64748b", marginBottom:4 }}>
                    <span>Charge de travail</span>
                    <span>{Math.min(100, (m.nb_projets||0) * 25)}%</span>
                  </div>
                  <div style={{ height:6, background:"#f1f5f9", borderRadius:3 }}>
                    <div style={{ width:`${Math.min(100,(m.nb_projets||0)*25)}%`, height:6, borderRadius:3,
                      background: (m.nb_projets||0)*25 > 75 ? "#EF4444":(m.nb_projets||0)*25 > 50 ? "#F59E0B":"#10B981" }}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}