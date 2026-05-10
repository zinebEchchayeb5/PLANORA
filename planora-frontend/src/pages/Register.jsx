import { useState } from "react";

const API = "http://127.0.0.1:8000";

export default function Register({ onLogin, goLogin }) {
  const [form, setForm] = useState({ nom: "", email: "", password: "", role: "architecte" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRegister = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erreur inscription");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f8f9fa", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"white", borderRadius:16, padding:40, width:420, boxShadow:"0 4px 24px #0001", border:"1px solid #e2e8f0" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:28, fontWeight:700, color:"#1e293b", letterSpacing:1 }}>PLANORA</div>
          <div style={{ fontSize:13, color:"#94a3b8", marginTop:4 }}>Créer un compte</div>
        </div>

        {[
          { label:"Nom complet", key:"nom", type:"text", placeholder:"Mohammed Alami" },
          { label:"Email", key:"email", type:"email", placeholder:"votre@email.com" },
          { label:"Mot de passe", key:"password", type:"password", placeholder:"••••••••" },
        ].map(f => (
          <div key={f.key}>
            <label style={{ fontSize:12, color:"#64748b" }}>{f.label}</label>
            <input type={f.type} value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
              placeholder={f.placeholder}
              style={{ width:"100%", marginBottom:14, marginTop:4, padding:"10px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
          </div>
        ))}

        <label style={{ fontSize:12, color:"#64748b" }}>Rôle</label>
        <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
          style={{ width:"100%", marginBottom:20, marginTop:4, padding:"10px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
          <option value="gerant">Gérant</option>
          <option value="architecte">Architecte</option>
          <option value="client">Client</option>
        </select>

        {error && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 12px", color:"#dc2626", fontSize:12, marginBottom:14 }}>{error}</div>}

        <button onClick={handleRegister} disabled={loading}
          style={{ width:"100%", padding:"11px", background: loading ? "#94a3b8":"#1e293b", color:"white", border:"none", borderRadius:8, cursor: loading ? "not-allowed":"pointer", fontSize:14, fontWeight:600 }}>
          {loading ? "Inscription..." : "Créer le compte"}
        </button>

        <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:"#64748b" }}>
          Déjà un compte ?{" "}
          <span onClick={goLogin} style={{ color:"#1e293b", fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>
            Se connecter
          </span>
        </div>
      </div>
    </div>
  );
}