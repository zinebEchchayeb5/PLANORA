import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom:"", email:"", telephone:"", adresse:"" });

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    setLoading(true);
    const data = await fetch(`${API}/clients/`).then(r => r.json());
    setClients(data); setLoading(false);
  };

  const save = async () => {
    if (!form.nom.trim()) return alert("Nom obligatoire");
    await fetch(`${API}/clients/`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    setShowForm(false); setForm({ nom:"", email:"", telephone:"", adresse:"" });
    fetchClients();
  };

  const del = async (id) => {
    if (!confirm("Supprimer ce client?")) return;
    await fetch(`${API}/clients/${id}`, { method:"DELETE" });
    fetchClients();
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22 }}>Clients</h1>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>{clients.length} clients enregistrés</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding:"9px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          + Nouveau client
        </button>
      </div>

      {showForm && (
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0", marginBottom:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15 }}>Nouveau client</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[{l:"Nom complet *",k:"nom"},{l:"Email",k:"email"},{l:"Téléphone",k:"telephone"},{l:"Adresse",k:"adresse"}].map(f=>(
              <div key={f.k}>
                <label style={{ fontSize:12, color:"#64748b" }}>{f.l}</label>
                <input type="text" value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})}
                  style={{ width:"100%", marginTop:3, padding:"8px 10px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <button onClick={save} style={{ padding:"8px 18px", background:"#1e293b", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Créer</button>
            <button onClick={()=>setShowForm(false)} style={{ padding:"8px 18px", background:"#f1f5f9", color:"#333", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Annuler</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>Chargement...</div> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
          {clients.length === 0 ? (
            <div style={{ background:"white", borderRadius:12, padding:40, border:"1px solid #e2e8f0", textAlign:"center", color:"#94a3b8", gridColumn:"1/-1" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>👥</div>
              <p>Aucun client — ajoutez votre premier client !</p>
            </div>
          ) : clients.map(c => (
            <div key={c.id} style={{ background:"white", borderRadius:12, padding:18, border:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ width:38, height:38, background:"#1e293b", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:700, fontSize:16, marginBottom:10 }}>
                    {c.nom[0].toUpperCase()}
                  </div>
                  <div style={{ fontWeight:600, fontSize:15, color:"#1e293b" }}>{c.nom}</div>
                  {c.email && <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>✉️ {c.email}</div>}
                  {c.telephone && <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>📞 {c.telephone}</div>}
                  {c.adresse && <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>📍 {c.adresse}</div>}
                </div>
                <button onClick={()=>del(c.id)}
                  style={{ padding:"4px 8px", background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                  ✕
                </button>
              </div>
              <div style={{ marginTop:12, padding:"8px 0", borderTop:"1px solid #f1f5f9" }}>
                <span style={{ fontSize:12, color:"#64748b" }}>📋 {c.nb_projets} projet(s)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}