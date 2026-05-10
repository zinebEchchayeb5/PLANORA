import { useState, useRef, useEffect } from "react";
import PlanRenderer from "./PlanRenderer";
import VoiceChatbot from "./VoiceChatbot";

const API = "http://127.0.0.1:8000";

export default function Plans({ user, goBack }) {
  const [form, setForm] = useState({
    surface: 120, chambres: 3, sdb: 2,
    style: "moderne", type_bien: "maison", contexte: "sur_rue"
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [rapport, setRapport] = useState(null);
  const [rapportLoading, setRapportLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [currentCost, setCurrentCost] = useState(null);
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    if (result) {
      setCurrentPlan(result.plan);
      setCurrentCost(result.cost);
    }
  }, [result]);

  const generate = async () => {
    setLoading(true); setError(null); setConflicts(null); setRapport(null);
    try {
      const res = await fetch(`${API}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        try {
          const cf = await fetch(`${API}/ia/detect-conflicts`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data.plan)
          });
          setConflicts(await cf.json());
        } catch {}
      } else setError(data.error || "Erreur génération");
    } catch { setError("Backend hors ligne — vérifiez uvicorn"); }
    setLoading(false);
  };

  const generateRapport = async () => {
    if (!result) return;
    setRapportLoading(true);
    try {
      const res = await fetch(`${API}/ia/generate-rapport`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: result.plan, titre: `Rapport ${form.type_bien} ${form.surface}m²` })
      });
      const data = await res.json();
      if (data.success) setRapport(data.rapport);
    } catch {}
    setRapportLoading(false);
  };

  const exportPDF = async () => {
    if (!result || !rapport) return alert("Générez d'abord un rapport IA");
    try {
      const res = await fetch(`${API}/export/rapport-pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titre: `Plan ${form.type_bien} ${form.surface}m²`, rapport, plan: result.plan })
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `planora_${form.type_bien}_${form.surface}m2.pdf`;
      a.click();
    } catch { alert("Erreur export PDF"); }
  };

  const handlePlanModified = (newPlan, newCost) => {
    setCurrentPlan(newPlan);
    setCurrentCost(newCost);
    setResult(prev => ({ ...prev, plan: newPlan, cost: newCost }));
  };

  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", background: "#f8f9fa" }}>
      {/* Header */}
      <div style={{ background: "#1e293b", color: "white", padding: "14px 28px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={goBack}
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>PLANORA</span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>Génération de plans IA</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{user?.nom}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, padding: 20, maxWidth: 1400, margin: "0 auto" }}>
        {/* Sidebar paramètres */}
        <div>
          <div style={{ background: "white", borderRadius: 12, padding: 18, border: "1px solid #e2e8f0", marginBottom: 14 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 15, color: "#1e293b" }}>Paramètres</h2>

            {[
              { label: "Surface (m²)", key: "surface", type: "number" },
              { label: "Chambres", key: "chambres", type: "number" },
              { label: "Salles de bain", key: "sdb", type: "number" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: "#64748b" }}>{f.label}</label>
                <input type={f.type} value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: +e.target.value })}
                  style={{ width: "100%", marginBottom: 10, marginTop: 3, padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: 13 }} />
              </div>
            ))}

            {[
              { label: "Type de bien", key: "type_bien", opts: [["maison","🏠 Maison"],["villa","🏡 Villa"],["appartement","🏢 Appartement"]] },
              { label: "Style", key: "style", opts: [["moderne","Moderne"],["traditionnel","Traditionnel"],["marocain","Marocain"],["minimaliste","Minimaliste"]] },
              { label: "Contexte urbain", key: "contexte", opts: [["sur_rue","Sur rue"],["milieu_urbain","Milieu urbain"],["residentiel","Résidentiel"]] },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: "#64748b" }}>{f.label}</label>
                <select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: "100%", marginBottom: 10, marginTop: 3, padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: 13 }}>
                  {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}

            <button onClick={generate} disabled={loading}
              style={{ width: "100%", padding: "10px", background: loading ? "#94a3b8" : "#1e293b", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {loading ? "⏳ Génération + analyse..." : "🏠 Générer le plan"}
            </button>
            {error && <p style={{ color: "red", fontSize: 11, marginTop: 6 }}>{error}</p>}
          </div>

          {/* Conformité normes */}
          {conflicts && (
            <div style={{ background: "white", borderRadius: 12, padding: 16, border: `1px solid ${conflicts.score >= 80 ? "#86efac" : "#fca5a5"}`, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: conflicts.score >= 80 ? "#F0FDF4" : conflicts.score >= 60 ? "#FFFBEB" : "#FEF2F2",
                  fontSize: 18 }}>
                  {conflicts.score >= 80 ? "✅" : conflicts.score >= 60 ? "⚠️" : "❌"}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>Conformité normes</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Score: {conflicts.score}/100</div>
                </div>
              </div>
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, marginBottom: 10 }}>
                <div style={{ width: `${conflicts.score}%`, height: 6, borderRadius: 3, transition: "width .5s",
                  background: conflicts.score >= 80 ? "#10B981" : conflicts.score >= 60 ? "#F59E0B" : "#EF4444" }} />
              </div>
              {conflicts.conflicts?.map((c, i) => (
                <div key={i} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "5px 10px", marginBottom: 4, fontSize: 11, color: "#991B1B" }}>
                  ❌ {c.message}
                </div>
              ))}
              {conflicts.warnings?.map((w, i) => (
                <div key={i} style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "5px 10px", marginBottom: 4, fontSize: 11, color: "#92400E" }}>
                  ⚠️ {w.message}
                </div>
              ))}
              {conflicts.conflicts?.length === 0 && conflicts.warnings?.length === 0 && (
                <div style={{ fontSize: 12, color: "#166534" }}>✅ Toutes les normes marocaines respectées</div>
              )}
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{conflicts.normes_ref}</div>
            </div>
          )}

          {/* Actions */}
          {result && (
            <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 13, color: "#1e293b" }}>Actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={generateRapport} disabled={rapportLoading}
                  style={{ padding: "8px", background: rapportLoading ? "#94a3b8" : "#8B5CF6", color: "white", border: "none", borderRadius: 8, cursor: rapportLoading ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500 }}>
                  {rapportLoading ? "⏳ Génération rapport..." : "🤖 Générer rapport IA"}
                </button>
                {rapport && (
                  <button onClick={exportPDF}
                    style={{ padding: "8px", background: "#EF4444", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
                    📄 Exporter PDF
                  </button>
                )}
                <button onClick={generate}
                  style={{ padding: "8px", background: "#f1f5f9", color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
                  🔄 Générer variante
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div>
          {!result && !loading && (
            <div style={{ background: "white", borderRadius: 12, padding: 60, border: "1px solid #e2e8f0", textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🏠</div>
              <p style={{ fontSize: 16, margin: 0 }}>Configurez les paramètres et générez votre plan professionnel</p>
              <p style={{ fontSize: 13, marginTop: 8, color: "#cbd5e1" }}>Plan 2D architecturé · Vue 3D réaliste · Normes marocaines · Rapport IA</p>
            </div>
          )}

          {loading && (
            <div style={{ background: "white", borderRadius: 12, padding: 60, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <p>Génération du plan + analyse des normes en cours...</p>
            </div>
          )}

          {result && currentPlan && (
            <>
              <PlanRenderer plan={currentPlan} cost={currentCost} />
              {rapport && (
                <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #8B5CF6", marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, color: "#6d28d9" }}>🤖 Rapport technique IA</h3>
                    <button onClick={exportPDF}
                      style={{ padding: "5px 12px", background: "#EF4444", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>
                      📄 PDF
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{rapport}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bouton flottant pour ouvrir/fermer le chatbot */}
      {result && currentPlan && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000 }}>
          <button
            onClick={() => setShowChatbot(!showChatbot)}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: "#1e293b",
              color: "white",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              fontSize: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
          >
            {showChatbot ? "✕" : "💬"}
          </button>

          {/* Fenêtre du chatbot (affichée conditionnellement) */}
          {showChatbot && (
            <div style={{
              position: "absolute",
              bottom: 70,
              right: 0,
              width: 380,
              maxWidth: "calc(100vw - 40px)",
              background: "white",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
              border: "1px solid #e2e8f0"
            }}>
              <VoiceChatbot planContext={currentPlan} onPlanModified={handlePlanModified} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}