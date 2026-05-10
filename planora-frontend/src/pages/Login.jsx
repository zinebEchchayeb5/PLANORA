import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

export default function Login({ onLogin, goRegister }) {
  // Les étapes (steps) possibles de l'interface : "login" | "forgot" | "reset"
  const [step, setStep] = useState("login"); 
  
  const [form, setForm] = useState({ email: "", password: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState(""); 
  const [newPassword, setNewPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Détection automatique du token dans l'URL (si l'utilisateur clique depuis sa boîte mail)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setResetToken(token);
      setStep("reset");
      // Nettoyage esthétique et sécurisé de l'URL pour faire disparaître le token de la barre d'adresse
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // --- ÉTAPE 1 : CONNEXION ---
  const handleLogin = async () => {
    setLoading(true); setError(null); setSuccessMessage(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erreur connexion");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // --- ÉTAPE 2 : ENVOI DE L'EMAIL DE RÉINITIALISATION ---
  const handleForgotPassword = async () => {
    setLoading(true); setError(null); setSuccessMessage(null);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erreur de récupération");
      
      setSuccessMessage("Un e-mail contenant le lien de réinitialisation vous a été envoyé.");
      setStep("login"); // Retour à l'écran de connexion pendant que l'utilisateur consulte ses mails
      setResetEmail("");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // --- ÉTAPE 3 : CONFIRMATION DU NOUVEAU MOT DE PASSE ---
  const handleResetPassword = async () => {
    setLoading(true); setError(null); setSuccessMessage(null);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erreur lors de la modification");
      
      setSuccessMessage("Votre mot de passe a été modifié avec succès ! Connectez-vous à présent.");
      setStep("login");
      
      // Réinitialisation des états
      setNewPassword("");
      setResetToken("");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f8f9fa", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"white", borderRadius:16, padding:40, width:380, boxShadow:"0 4px 24px #0001", border:"1px solid #e2e8f0" }}>
        
        {/* En-tête */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:28, fontWeight:700, color:"#1e293b", letterSpacing:1 }}>PLANORA</div>
          <div style={{ fontSize:13, color:"#94a3b8", marginTop:4 }}>Bureau d'étude architectural</div>
        </div>

        {/* Alertes d'erreur et de succès */}
        {error && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 12px", color:"#dc2626", fontSize:12, marginBottom:14 }}>{error}</div>}
        {successMessage && <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"8px 12px", color:"#16a34a", fontSize:12, marginBottom:14 }}>{successMessage}</div>}

        {/* --- FORMULAIRE 1 : CONNEXION --- */}
        {step === "login" && (
          <>
            <label style={{ fontSize:12, color:"#64748b" }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              placeholder="votre@email.com"
              style={{ width:"100%", marginBottom:14, marginTop:4, padding:"10px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize:12, color:"#64748b" }}>Mot de passe</label>
              <span onClick={() => { setStep("forgot"); setError(null); setSuccessMessage(null); }} style={{ fontSize:11, color:"#1e293b", cursor:"pointer", textDecoration:"underline" }}>
                Oublié ?
              </span>
            </div>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              style={{ width:"100%", marginBottom:20, marginTop:4, padding:"10px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>

            <button onClick={handleLogin} disabled={loading}
              style={{ width:"100%", padding:"11px", background: loading ? "#94a3b8":"#1e293b", color:"white", border:"none", borderRadius:8, cursor: loading ? "not-allowed":"pointer", fontSize:14, fontWeight:600 }}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>

            <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:"#64748b" }}>
              Pas de compte ?{" "}
              <span onClick={goRegister} style={{ color:"#1e293b", fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>
                S'inscrire
              </span>
            </div>
          </>
        )}

        {/* --- FORMULAIRE 2 : MOT DE PASSE OUBLIÉ (SAISIE EMAIL) --- */}
        {step === "forgot" && (
          <>
            <div style={{ fontSize:15, fontWeight:600, color:"#1e293b", marginBottom:10 }}>Récupération du compte</div>
            <p style={{ fontSize:12, color:"#64748b", margin:"0 0 16px 0", lineHeight:"1.4" }}>
              Saisissez l'adresse e-mail de votre compte Planora. Nous vous enverrons un lien pour changer de mot de passe.
            </p>

            <label style={{ fontSize:12, color:"#64748b" }}>Email de récupération</label>
            <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
              placeholder="votre@email.com"
              style={{ width:"100%", marginBottom:20, marginTop:4, padding:"10px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>

            <button onClick={handleForgotPassword} disabled={loading || !resetEmail}
              style={{ width:"100%", padding:"11px", background: (loading || !resetEmail) ? "#94a3b8":"#1e293b", color:"white", border:"none", borderRadius:8, cursor: (loading || !resetEmail) ? "not-allowed":"pointer", fontSize:14, fontWeight:600, marginBottom:12 }}>
              {loading ? "Envoi du lien..." : "Envoyer le lien"}
            </button>

            <div style={{ textAlign:"center", marginTop:12, fontSize:13 }}>
              <span onClick={() => { setStep("login"); setError(null); setSuccessMessage(null); }} style={{ color:"#64748b", cursor:"pointer", textDecoration:"underline" }}>
                Retourner à la connexion
              </span>
            </div>
          </>
        )}

        {/* --- FORMULAIRE 3 : CONFIGURATION DU NOUVEAU MOT DE PASSE --- */}
        {step === "reset" && (
          <>
            <div style={{ fontSize:15, fontWeight:600, color:"#1e293b", marginBottom:10 }}>Créer un nouveau mot de passe</div>
            <p style={{ fontSize:12, color:"#64748b", margin:"0 0 16px 0", lineHeight:"1.4" }}>
              Votre identité a été validée via e-mail. Saisissez votre nouveau mot de passe sécurisé.
            </p>

            <label style={{ fontSize:12, color:"#64748b" }}>Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width:"100%", marginBottom:20, marginTop:4, padding:"10px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>

            <button onClick={handleResetPassword} disabled={loading || !newPassword}
              style={{ width:"100%", padding:"11px", background: (loading || !newPassword) ? "#94a3b8":"#1e293b", color:"white", border:"none", borderRadius:8, cursor: (loading || !newPassword) ? "not-allowed":"pointer", fontSize:14, fontWeight:600 }}>
              {loading ? "Modification..." : "Confirmer le nouveau mot de passe"}
            </button>
          </>
        )}

      </div>
    </div>
  );
}