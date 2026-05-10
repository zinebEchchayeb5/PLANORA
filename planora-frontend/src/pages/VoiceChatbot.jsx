import { useState, useEffect, useRef } from "react";

const API = "http://127.0.0.1:8000";

const LANG_VOICES = {
  "darija": { lang: "ar-MA", fallback: "ar-SA", label: "🇲🇦 Darija" },
  "ar":     { lang: "ar-SA", fallback: "ar-EG", label: "🇸🇦 Arabe" },
  "fr":     { lang: "fr-FR", fallback: "fr-FR", label: "🇫🇷 Français" },
  "en":     { lang: "en-US", fallback: "en-US", label: "🇺🇸 English" },
};

const LANG_PLACEHOLDERS = {
  "darija": 'مثلاً: "زيد غرفة نوم" أو "كبر le salon"...',
  "ar":     'مثلاً: "أضف غرفة نوم" أو "غير النمط"...',
  "fr":     'Ex: "Ajoute une chambre" ou "Agrandis le salon"...',
  "en":     'Ex: "Add a bedroom" or "Make kitchen bigger"...',
};

function getBestVoice(lang) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const cfg = LANG_VOICES[lang] || LANG_VOICES["fr"];
  return (
    voices.find(v => v.lang === cfg.lang) ||
    voices.find(v => v.lang.startsWith(cfg.lang.split("-")[0])) ||
    voices.find(v => v.lang === cfg.fallback) ||
    voices[0]
  );
}

function speak(text, lang) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[#*_~`]/g, "").replace(/__LANG__\w+__/g, "").substring(0, 400);
  const utt = new SpeechSynthesisUtterance(clean);
  utt.voice = getBestVoice(lang);
  utt.rate = 0.95; utt.pitch = 1; utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

function detectLang(text) {
  const darija = ["wach","kifach","bghit","mzyan","safi","daba","walakin","zid","dir","bdel","kbr","hder","nta","ana"];
  const tl = text.toLowerCase();
  if (darija.some(w => tl.includes(w))) return "darija";
  const arChars = [...text].filter(c => c >= '\u0600' && c <= '\u06FF').length;
  if (arChars > text.length * 0.3) return "ar";
  if (["how","add","make","change","remove","what"].some(w => tl.includes(w))) return "en";
  return "fr";
}

export default function VoiceChatbot({ planContext = null, onPlanModified = null, compact = false }) {
  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [currentLang, setCurrentLang] = useState("fr");
  const [isOpen, setIsOpen] = useState(!compact);
  const [editHistory, setEditHistory] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", () => window.speechSynthesis?.getVoices());
    return () => window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Chrome requis pour la reconnaissance vocale"); return; }
    if (recognitionRef.current) {
      recognitionRef.current.stop(); recognitionRef.current = null; setListening(false); return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    const langMap = { darija:"ar-MA", ar:"ar-SA", fr:"fr-FR", en:"en-US" };
    rec.lang = langMap[currentLang] || "fr-FR";
    rec.continuous = false; rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => { setListening(false); recognitionRef.current = null; };
    rec.onerror = () => { setListening(false); recognitionRef.current = null; };
    rec.onresult = e => {
      const t = e.results[0][0].transcript;
      setQuestion(t);
      setTimeout(() => sendMessage(t), 300);
    };
    rec.start();
  };

  const sendMessage = async (text) => {
    const q = (text || question).trim();
    if (!q || loading) return;
    setQuestion(""); setLoading(true);

    const lang = detectLang(q);
    const isPlanEdit = planContext && isEditInstruction(q);

    // Add user message
    setChat(c => [...c, { role: "user", text: q, isPlanEdit }]);

    if (isPlanEdit && planContext) {
      // ── PLAN EDIT MODE ────────────────────────────
      setChat(c => [...c, {
        role: "agent", text: "", lang, loading: true, isPlanEdit: true,
        status: "editing"
      }]);

      try {
        const res = await fetch(`${API}/plan-editor/edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instruction: q,
            plan: planContext,
            history: []
          })
        });
        const data = await res.json();

        if (data.success && data.plan) {
          // Save undo
          setUndoStack(s => [...s.slice(-9), planContext]);

          // Apply plan changes
          onPlanModified && onPlanModified(data.plan);

          // Update edit history
          setEditHistory(h => [...h, { role: "user", content: q }, { role: "assistant", content: data.message }]);

          const changes = data.changes?.length
            ? "\n\n✅ **Changements:**\n" + data.changes.map(c => `• ${c}`).join("\n")
            : "";

          const msg = (data.message || "Plan modifié") + changes;

          setChat(c => {
            const u = [...c];
            u[u.length-1] = { role:"agent", text: msg, lang, loading:false, isPlanEdit:true, status:"done", planUpdated:true };
            return u;
          });

          if (ttsEnabled) setTimeout(() => speak(data.message || "Plan modifié", lang), 200);

        } else {
          setChat(c => {
            const u = [...c];
            u[u.length-1] = { role:"agent", text: `❌ ${data.error || "Impossible de modifier le plan"}`, lang, loading:false, status:"error" };
            return u;
          });
        }

      } catch (e) {
        setChat(c => {
          const u = [...c];
          u[u.length-1] = { role:"agent", text:"❌ Erreur de connexion au backend", lang, loading:false, status:"error" };
          return u;
        });
      }

    } else {
      // ── NORMAL CHAT MODE ─────────────────────────
      setChat(c => [...c, { role: "agent", text: "", lang, loading: true }]);

      let fullText = "";
      try {
        const resp = await fetch(`${API}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            history: chat.slice(-6).map(m => ({ role: m.role, content: m.text })),
            plan_context: planContext
          })
        });
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const token = dec.decode(value);
          const langMatch = token.match(/__LANG__(\w+)__/);
          const clean = token.replace(/__LANG__\w+__/, "");
          fullText += clean;
          setChat(c => {
            const u = [...c];
            u[u.length-1] = { ...u[u.length-1], text: fullText, loading: false, lang };
            return u;
          });
        }
        if (ttsEnabled && fullText) setTimeout(() => speak(fullText, lang), 200);
      } catch {
        setChat(c => {
          const u = [...c];
          u[u.length-1] = { role:"agent", text:"❌ Erreur connexion backend", lang, loading:false };
          return u;
        });
      }
    }

    setLoading(false);
  };

  const handleUndo = () => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length-1];
    setUndoStack(s => s.slice(0,-1));
    onPlanModified && onPlanModified(prev);
    setChat(c => [...c, { role:"agent", text:"↩️ Annulation effectuée — plan restauré.", lang:"fr", loading:false }]);
  };

  const clearChat = () => { setChat([]); setEditHistory([]); window.speechSynthesis?.cancel(); };

  if (compact && !isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        style={{ position:"fixed", bottom:24, right:24, width:56, height:56,
          borderRadius:"50%", background:"#1e293b", color:"white", border:"none",
          cursor:"pointer", fontSize:22, boxShadow:"0 4px 20px rgba(0,0,0,.3)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
        💬
      </button>
    );
  }

  return (
    <div style={{
      background:"white", borderRadius:16, border:"1px solid #e2e8f0",
      overflow:"hidden", display:"flex", flexDirection:"column",
      ...(compact ? {
        position:"fixed", bottom:24, right:24, width:400, height:560,
        boxShadow:"0 8px 40px rgba(0,0,0,.25)", zIndex:1000
      } : {})
    }}>
      {/* Header */}
      <div style={{ background:"#1e293b", padding:"11px 14px", display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background: loading?"#F59E0B":"#10B981" }}/>
        <span style={{ color:"white", fontWeight:600, fontSize:13, flex:1 }}>
          ✏️ Assistant PLANORA — Éditeur de plan
        </span>
        {undoStack.length > 0 && (
          <button onClick={handleUndo}
            style={{ background:"#334155", border:"none", color:"#94a3b8", cursor:"pointer",
              fontSize:11, padding:"3px 8px", borderRadius:6 }}
            title="Annuler dernière modification">
            ↩️ Annuler
          </button>
        )}
        <button onClick={() => setTtsEnabled(!ttsEnabled)}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:15,
            color: ttsEnabled?"#10B981":"#64748b" }}>
          {ttsEnabled ? "🔊" : "🔇"}
        </button>
        <button onClick={clearChat}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#64748b" }}>✕</button>
        {compact && (
          <button onClick={() => setIsOpen(false)}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:15, color:"#64748b" }}>—</button>
        )}
      </div>

      {/* Plan context indicator */}
      {planContext && (
        <div style={{ background:"#f0fdf4", borderBottom:"1px solid #86efac",
          padding:"6px 14px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:10, color:"#166534" }}>✅</span>
          <span style={{ fontSize:11, color:"#166534", fontWeight:500 }}>
            Plan connecté: {planContext.context?.type_bien} · {planContext.total_surface}m² · {planContext.rooms?.length} pièces
          </span>
        </div>
      )}

      {/* Lang selector */}
      <div style={{ display:"flex", gap:4, padding:"7px 12px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", flexWrap:"wrap" }}>
        {Object.entries(LANG_VOICES).map(([k, v]) => (
          <button key={k} onClick={() => setCurrentLang(k)}
            style={{ padding:"2px 10px", borderRadius:20, border:"1px solid #e2e8f0",
              fontSize:11, cursor:"pointer",
              background: currentLang===k?"#1e293b":"white",
              color: currentLang===k?"white":"#64748b" }}>
            {v.label}
          </button>
        ))}

        {/* Quick actions */}
        {planContext && (
          <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
            {[
              { label:"+ Chambre", cmd: "Ajoute une chambre au plan" },
              { label:"+ SDB",     cmd: "Ajoute une salle de bain" },
              { label:"+ Fenêtre", cmd: "Ajoute des fenêtres supplémentaires" },
            ].map(a => (
              <button key={a.label} onClick={() => sendMessage(a.cmd)}
                style={{ padding:"2px 8px", borderRadius:6, border:"1px solid #3B82F6",
                  fontSize:10, cursor:"pointer", background:"#EFF6FF", color:"#1D4ED8", fontWeight:500 }}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:12, minHeight:180,
        maxHeight: compact ? 280 : 340 }}>
        {chat.length === 0 && (
          <div style={{ textAlign:"center", color:"#94a3b8", padding:"20px 16px" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>✏️</div>
            <p style={{ fontSize:12, margin:0, fontWeight:500 }}>
              {planContext ? "Plan connecté — dis-moi quoi modifier!" : "Pose une question sur l'architecture"}
            </p>
            {planContext && (
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  { darija:"زيد غرفة نوم أخرى", fr:"Ajoute une chambre" },
                  { darija:"كبر le salon à 30m²", fr:"Agrandis le salon" },
                  { darija:"بدل le style marocain", fr:"Change le style" },
                  { darija:"حط fenêtre في المطبخ", fr:"Ajoute une fenêtre" },
                ].map((ex, i) => (
                  <button key={i}
                    onClick={() => sendMessage(currentLang==="darija"?ex.darija:ex.fr)}
                    style={{ padding:"5px 10px", background:"#f8fafc", border:"1px solid #e2e8f0",
                      borderRadius:8, cursor:"pointer", fontSize:11, color:"#374151", textAlign:"left" }}>
                    💡 {currentLang==="darija" ? ex.darija : ex.fr}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {chat.map((m, i) => (
          <div key={i} style={{ marginBottom:10,
            display:"flex", justifyContent: m.role==="user"?"flex-end":"flex-start" }}>
            {m.role==="agent" && (
              <div style={{ width:26, height:26, borderRadius:"50%",
                background: m.status==="done" && m.planUpdated ? "#10B981" :
                           m.status==="error" ? "#EF4444" : "#1e293b",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"white", fontSize:11, marginRight:7, flexShrink:0, alignSelf:"flex-end" }}>
                {m.status==="done" && m.planUpdated ? "✓" : "P"}
              </div>
            )}
            <div style={{
              maxWidth:"80%", padding:"8px 12px", borderRadius:12,
              background: m.role==="user" ? "#1e293b" :
                         m.planUpdated ? "#f0fdf4" :
                         m.status==="error" ? "#fef2f2" : "#f1f5f9",
              color: m.role==="user" ? "white" :
                    m.planUpdated ? "#166534" :
                    m.status==="error" ? "#dc2626" : "#1e293b",
              border: m.planUpdated ? "1px solid #86efac" :
                     m.status==="error" ? "1px solid #fca5a5" : "none",
              fontSize:12, lineHeight:1.6,
              borderBottomRightRadius: m.role==="user" ? 4 : 12,
              borderBottomLeftRadius: m.role==="agent" ? 4 : 12,
              whiteSpace:"pre-wrap"
            }}>
              {m.loading ? (
                <span style={{ display:"inline-flex", gap:3, alignItems:"center" }}>
                  {m.isPlanEdit ? (
                    <>
                      <span style={{ fontSize:10 }}>✏️ Modification du plan</span>
                      <span style={{ animation:"pulse 1s infinite" }}>...</span>
                    </>
                  ) : (
                    <>
                      <span style={{ animation:"bounce 0.8s infinite", animationDelay:"0s" }}>●</span>
                      <span style={{ animation:"bounce 0.8s infinite", animationDelay:"0.15s" }}>●</span>
                      <span style={{ animation:"bounce 0.8s infinite", animationDelay:"0.3s" }}>●</span>
                    </>
                  )}
                </span>
              ) : m.text}
              {m.role==="agent" && m.text && ttsEnabled && !m.loading && (
                <button onClick={() => speak(m.text, m.lang||"fr")}
                  style={{ display:"block", marginTop:4, background:"none", border:"none",
                    cursor:"pointer", color:"#94a3b8", fontSize:10, padding:0 }}>
                  🔊
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef}/>
      </div>

      {/* Input */}
      <div style={{ padding:"9px 12px", borderTop:"1px solid #e2e8f0", background:"white" }}>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMessage()}
            placeholder={LANG_PLACEHOLDERS[currentLang]}
            style={{ flex:1, padding:"8px 11px", borderRadius:10, border:"1px solid #e2e8f0",
              fontSize:12, outline:"none", background:"#f8fafc",
              direction: ["darija","ar"].includes(currentLang) ? "rtl" : "ltr" }}
          />
          <button onClick={startVoice}
            style={{ width:36, height:36, borderRadius:"50%", border:"none", cursor:"pointer",
              background: listening ? "#EF4444" : "#f1f5f9",
              color: listening ? "white" : "#64748b", fontSize:15,
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              boxShadow: listening ? "0 0 0 4px rgba(239,68,68,.2)" : "none" }}>
            {listening ? "⏹" : "🎤"}
          </button>
          <button onClick={() => sendMessage()} disabled={loading || !question.trim()}
            style={{ width:36, height:36, borderRadius:"50%", border:"none",
              cursor: loading||!question.trim() ? "not-allowed":"pointer",
              background: loading||!question.trim() ? "#e2e8f0":"#1e293b",
              color:"white", fontSize:15,
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            ➤
          </button>
        </div>
        {listening && (
          <div style={{ textAlign:"center", fontSize:10, color:"#EF4444", marginTop:4,
            display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#EF4444",
              display:"inline-block", animation:"pulse 1s infinite" }}/>
            Écoute... {LANG_VOICES[currentLang]?.label}
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  );
}

// Helper — detect if instruction is a plan modification
function isEditInstruction(text) {
  const editWords = [
    // Darija
    "zid","bdel","kbr","s9r","dir","hder","supprime","sup","hde",
    // French
    "ajoute","ajouter","supprime","supprimer","agrandir","agrandis","réduire","réduis",
    "change","changer","modifier","modifie","déplace","déplacer","ajoute","enlève",
    "mets","mettre","crée","créer","refaire","refais","nouveau","nouvelle",
    // English
    "add","remove","delete","change","modify","make","resize","move","create","put",
    // Arabic
    "أضف","احذف","غير","كبر","صغر","أنشئ","ضع",
  ];
  const tl = text.toLowerCase();
  return editWords.some(w => tl.includes(w));
}