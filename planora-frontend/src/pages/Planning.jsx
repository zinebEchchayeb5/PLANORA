import { useState, useEffect, useRef } from "react";

const API = "http://127.0.0.1:8000";

const COLORS_PROJET = [
  "#3B82F6","#8B5CF6","#10B981","#F59E0B","#EF4444","#06B6D4","#EC4899","#84CC16"
];

const STATUT_CFG = {
  en_attente:  { label:"En attente",  color:"#F59E0B", bg:"#FFFBEB" },
  en_cours:    { label:"En cours",    color:"#3B82F6", bg:"#EFF6FF" },
  termine:     { label:"Terminé",     color:"#10B981", bg:"#F0FDF4" },
  annule:      { label:"Annulé",      color:"#EF4444", bg:"#FEF2F2" },
};

const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

// ══════════════════════════════════════════════════
// VUE KANBAN (comme Trello)
// ══════════════════════════════════════════════════
function KanbanView({ projets, clients, onUpdateStatut, onDelete, onEdit }) {
  const colonnes = ["en_attente","en_cours","termine","annule"];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, alignItems:"start" }}>
      {colonnes.map(col => {
        const cfg = STATUT_CFG[col];
        const items = projets.filter(p => p.statut === col);
        return (
          <div key={col}>
            {/* Column header */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12,
              padding:"10px 14px", background:cfg.bg, borderRadius:10,
              border:`1px solid ${cfg.color}33` }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cfg.color, flexShrink:0 }}/>
              <span style={{ fontWeight:600, fontSize:13, color:cfg.color, flex:1 }}>{cfg.label}</span>
              <span style={{ background:"white", borderRadius:20, padding:"1px 8px",
                fontSize:11, color:cfg.color, border:`1px solid ${cfg.color}44`, fontWeight:600 }}>
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ display:"flex", flexDirection:"column", gap:10, minHeight:100 }}>
              {items.map((p, i) => {
                const client = clients.find(c => c.id === p.client_id);
                const colorIdx = p.id % COLORS_PROJET.length;
                return (
                  <div key={p.id} style={{ background:"white", borderRadius:10, padding:14,
                    border:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,.06)",
                    borderTop:`3px solid ${COLORS_PROJET[colorIdx]}` }}>

                    {/* Tags */}
                    <div style={{ display:"flex", gap:4, marginBottom:8, flexWrap:"wrap" }}>
                      {p.type_bien && (
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10,
                          background:COLORS_PROJET[colorIdx]+"22", color:COLORS_PROJET[colorIdx], fontWeight:500 }}>
                          {p.type_bien}
                        </span>
                      )}
                      {p.surface && (
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10,
                          background:"#f1f5f9", color:"#64748b" }}>
                          {p.surface}m²
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div style={{ fontWeight:600, fontSize:14, color:"#1e293b", marginBottom:6, lineHeight:1.3 }}>
                      {p.titre}
                    </div>

                    {/* Description */}
                    {p.description && (
                      <div style={{ fontSize:12, color:"#94a3b8", marginBottom:8,
                        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                        {p.description}
                      </div>
                    )}

                    {/* Client */}
                    {client && (
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                        <div style={{ width:22, height:22, borderRadius:"50%", background:"#1e293b",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color:"white", fontSize:10, fontWeight:700 }}>
                          {client.nom[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize:12, color:"#64748b" }}>{client.nom}</span>
                      </div>
                    )}

                    {/* Budget */}
                    {p.budget_estime && (
                      <div style={{ fontSize:12, color:"#10B981", fontWeight:500, marginBottom:8 }}>
                        💰 {p.budget_estime.toLocaleString()} MAD
                      </div>
                    )}

                    {/* Progress bar */}
                    {p.progression > 0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:10, color:"#94a3b8" }}>Progression</span>
                          <span style={{ fontSize:10, color:"#64748b", fontWeight:500 }}>{p.progression}%</span>
                        </div>
                        <div style={{ height:4, background:"#f1f5f9", borderRadius:2 }}>
                          <div style={{ width:`${p.progression}%`, height:4,
                            background:COLORS_PROJET[colorIdx], borderRadius:2, transition:"width .3s" }}/>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display:"flex", gap:4, marginTop:8, borderTop:"1px solid #f1f5f9", paddingTop:8 }}>
                      {col !== "en_attente" && (
                        <button onClick={() => onUpdateStatut(p.id, colonnes[colonnes.indexOf(col)-1])}
                          style={{ flex:1, padding:"4px 0", background:"#f8fafc", color:"#64748b",
                            border:"1px solid #e2e8f0", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                          ◀
                        </button>
                      )}
                      <button onClick={() => onEdit(p)}
                        style={{ flex:2, padding:"4px 0", background:`${COLORS_PROJET[colorIdx]}11`,
                          color:COLORS_PROJET[colorIdx], border:`1px solid ${COLORS_PROJET[colorIdx]}33`,
                          borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:500 }}>
                        ✏️ Éditer
                      </button>
                      {col !== "annule" && col !== "termine" && (
                        <button onClick={() => onUpdateStatut(p.id, colonnes[colonnes.indexOf(col)+1])}
                          style={{ flex:2, padding:"4px 0", background:STATUT_CFG[colonnes[colonnes.indexOf(col)+1]].bg,
                            color:STATUT_CFG[colonnes[colonnes.indexOf(col)+1]].color,
                            border:`1px solid ${STATUT_CFG[colonnes[colonnes.indexOf(col)+1]].color}44`,
                            borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:500 }}>
                          {col === "en_attente" ? "▶ Démarrer" : "✓ Terminer"}
                        </button>
                      )}
                      <button onClick={() => onDelete(p.id)}
                        style={{ flex:1, padding:"4px 0", background:"#fef2f2", color:"#dc2626",
                          border:"1px solid #fca5a5", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Empty state */}
              {items.length === 0 && (
                <div style={{ padding:"24px 16px", textAlign:"center", color:"#cbd5e1",
                  border:"2px dashed #e2e8f0", borderRadius:10, fontSize:12 }}>
                  Aucun projet
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════
// VUE LISTE
// ══════════════════════════════════════════════════
function ListView({ projets, clients, onUpdateStatut, onDelete, onEdit }) {
  return (
    <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"#f8fafc" }}>
            {["Projet","Client","Type","Surface","Budget","Statut","Progression","Actions"].map(h => (
              <th key={h} style={{ textAlign:"left", padding:"10px 14px", color:"#64748b",
                fontWeight:500, fontSize:12, borderBottom:"1px solid #e2e8f0" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projets.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign:"center", padding:32, color:"#94a3b8" }}>Aucun projet</td></tr>
          ) : projets.map(p => {
            const client = clients.find(c => c.id === p.client_id);
            const cfg = STATUT_CFG[p.statut] || STATUT_CFG.en_attente;
            return (
              <tr key={p.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={{ padding:"10px 14px", fontWeight:500, color:"#1e293b" }}>{p.titre}</td>
                <td style={{ padding:"10px 14px", color:"#64748b" }}>{client?.nom || "—"}</td>
                <td style={{ padding:"10px 14px", color:"#64748b", textTransform:"capitalize" }}>{p.type_bien||"—"}</td>
                <td style={{ padding:"10px 14px", color:"#64748b" }}>{p.surface ? `${p.surface}m²`:"—"}</td>
                <td style={{ padding:"10px 14px", color:"#10B981", fontWeight:500 }}>
                  {p.budget_estime ? `${p.budget_estime.toLocaleString()} MAD`:"—"}
                </td>
                <td style={{ padding:"10px 14px" }}>
                  <span style={{ fontSize:11, padding:"3px 10px", borderRadius:12,
                    background:cfg.bg, color:cfg.color, fontWeight:500 }}>
                    {cfg.label}
                  </span>
                </td>
                <td style={{ padding:"10px 14px", minWidth:100 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ flex:1, height:4, background:"#f1f5f9", borderRadius:2 }}>
                      <div style={{ width:`${p.progression||0}%`, height:4, background:"#3B82F6", borderRadius:2 }}/>
                    </div>
                    <span style={{ fontSize:11, color:"#64748b", minWidth:28 }}>{p.progression||0}%</span>
                  </div>
                </td>
                <td style={{ padding:"10px 14px" }}>
                  <div style={{ display:"flex", gap:5 }}>
                    <button onClick={() => onEdit(p)}
                      style={{ padding:"4px 10px", background:"#eff6ff", color:"#1d4ed8",
                        border:"1px solid #bfdbfe", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                      Éditer
                    </button>
                    <button onClick={() => onDelete(p.id)}
                      style={{ padding:"4px 8px", background:"#fef2f2", color:"#dc2626",
                        border:"1px solid #fca5a5", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════
// VUE GANTT
// ══════════════════════════════════════════════════
function GanttView({ projets, clients }) {
  const now = new Date();
  const year = now.getFullYear();
  const totalDays = 365;

  const dayToPercent = (date) => {
    const d = new Date(date);
    const start = new Date(year, 0, 1);
    const diff = Math.floor((d - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(100, (diff / totalDays) * 100));
  };

  const widthPercent = (start, end) => {
    const s = dayToPercent(start);
    const e = dayToPercent(end);
    return Math.max(2, e - s);
  };

  const todayPct = dayToPercent(now);

  // Projets avec dates simulées si manquantes
  const projetsWithDates = projets.map((p, i) => {
    const startOffset = (i * 45) % 300;
    const dur = 30 + (i * 20) % 120;
    const start = p.date_debut || new Date(year, 0, 1 + startOffset).toISOString();
    const end = p.date_fin_prevue || new Date(year, 0, 1 + startOffset + dur).toISOString();
    return { ...p, _start: start, _end: end };
  });

  return (
    <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
      {/* Header mois */}
      <div style={{ display:"flex", borderBottom:"1px solid #e2e8f0" }}>
        <div style={{ width:220, flexShrink:0, padding:"10px 14px", background:"#f8fafc",
          borderRight:"1px solid #e2e8f0", fontSize:12, color:"#64748b", fontWeight:500 }}>
          Projet
        </div>
        <div style={{ flex:1, display:"flex", background:"#f8fafc" }}>
          {MOIS.map((m, i) => (
            <div key={i} style={{ flex:1, padding:"10px 4px", textAlign:"center",
              fontSize:11, color:"#64748b", borderRight:"1px solid #f1f5f9",
              background: i === now.getMonth() ? "#eff6ff":"#f8fafc",
              fontWeight: i === now.getMonth() ? 600 : 400,
              color: i === now.getMonth() ? "#3B82F6" : "#64748b" }}>
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* Lignes projets */}
      {projetsWithDates.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
          Aucun projet à afficher
        </div>
      ) : projetsWithDates.map((p, i) => {
        const cfg = STATUT_CFG[p.statut] || STATUT_CFG.en_attente;
        const colorIdx = p.id % COLORS_PROJET.length;
        const left = dayToPercent(p._start);
        const width = widthPercent(p._start, p._end);
        const client = clients.find(c => c.id === p.client_id);

        return (
          <div key={p.id} style={{ display:"flex", borderBottom:"1px solid #f8fafc",
            background: i % 2 === 0 ? "white" : "#fafbfc" }}>
            {/* Nom projet */}
            <div style={{ width:220, flexShrink:0, padding:"12px 14px",
              borderRight:"1px solid #e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:COLORS_PROJET[colorIdx], flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:"#1e293b",
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:170 }}>
                  {p.titre}
                </div>
                {client && (
                  <div style={{ fontSize:10, color:"#94a3b8" }}>{client.nom}</div>
                )}
              </div>
            </div>

            {/* Barre Gantt */}
            <div style={{ flex:1, position:"relative", height:48, display:"flex", alignItems:"center" }}>
              {/* Ligne today */}
              <div style={{ position:"absolute", left:`${todayPct}%`, top:0, bottom:0,
                width:2, background:"#EF4444", opacity:.4, zIndex:2 }}/>

              {/* Barre projet */}
              <div style={{
                position:"absolute",
                left:`${left}%`,
                width:`${width}%`,
                height:28,
                background:COLORS_PROJET[colorIdx],
                borderRadius:6,
                display:"flex", alignItems:"center", paddingLeft:8,
                boxShadow:`0 2px 6px ${COLORS_PROJET[colorIdx]}44`,
                zIndex:1, overflow:"hidden", cursor:"default"
              }}
                title={`${p.titre} — ${new Date(p._start).toLocaleDateString("fr-FR")} → ${new Date(p._end).toLocaleDateString("fr-FR")}`}
              >
                {/* Progress fill */}
                <div style={{
                  position:"absolute", left:0, top:0, bottom:0,
                  width:`${p.progression||0}%`,
                  background:"rgba(255,255,255,.25)", borderRadius:6
                }}/>
                <span style={{ fontSize:10, color:"white", fontWeight:500, position:"relative", whiteSpace:"nowrap" }}>
                  {p.titre.length > 15 ? p.titre.slice(0,15)+"…" : p.titre}
                  {p.progression > 0 && ` · ${p.progression}%`}
                </span>
              </div>

              {/* Statut badge */}
              <div style={{ position:"absolute", right:8,
                fontSize:10, padding:"1px 6px", borderRadius:8,
                background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}33` }}>
                {cfg.label}
              </div>
            </div>
          </div>
        );
      })}

      {/* Légende */}
      <div style={{ padding:"10px 14px", borderTop:"1px solid #e2e8f0", display:"flex", gap:16, alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#64748b" }}>
          <div style={{ width:16, height:3, background:"#EF4444", opacity:.4 }}/>
          <span>Aujourd'hui</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#64748b" }}>
          <div style={{ width:16, height:10, background:"rgba(255,255,255,.25)", border:"1px solid #e2e8f0", borderRadius:2 }}/>
          <span>Progression</span>
        </div>
        <span style={{ fontSize:11, color:"#94a3b8", marginLeft:"auto" }}>
          Année {year} — {projetsWithDates.length} projets
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// VUE CALENDRIER
// ══════════════════════════════════════════════════
function CalendarView({ projets, clients }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();

  const projetsMonth = projets.filter(p => {
    if (!p.date_debut && !p.date_fin_prevue) return false;
    const d = new Date(p.date_debut || p.date_fin_prevue);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const getProjectsForDay = (day) => {
    return projets.filter(p => {
      if (!p.date_debut) return false;
      const d = new Date(p.date_debut);
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  };

  const days = [];
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div style={{ background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
      {/* Nav mois */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"14px 20px", borderBottom:"1px solid #e2e8f0" }}>
        <button onClick={() => {
          if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y-1); }
          else setCurrentMonth(m => m-1);
        }} style={{ padding:"6px 12px", background:"#f1f5f9", border:"none", borderRadius:8, cursor:"pointer", fontSize:14 }}>
          ◀
        </button>
        <span style={{ fontWeight:600, fontSize:16, color:"#1e293b" }}>
          {MOIS[currentMonth]} {currentYear}
        </span>
        <button onClick={() => {
          if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y+1); }
          else setCurrentMonth(m => m+1);
        }} style={{ padding:"6px 12px", background:"#f1f5f9", border:"none", borderRadius:8, cursor:"pointer", fontSize:14 }}>
          ▶
        </button>
      </div>

      {/* Jours semaine */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", background:"#f8fafc",
        borderBottom:"1px solid #e2e8f0" }}>
        {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d => (
          <div key={d} style={{ padding:"8px 0", textAlign:"center", fontSize:11,
            color:"#94a3b8", fontWeight:500 }}>{d}</div>
        ))}
      </div>

      {/* Grille jours */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
        {days.map((day, i) => {
          const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
          const dayProjects = day ? getProjectsForDay(day) : [];
          return (
            <div key={i} style={{
              minHeight:90, padding:"6px 8px",
              borderRight: i % 7 !== 6 ? "1px solid #f1f5f9":"none",
              borderBottom:"1px solid #f1f5f9",
              background: !day ? "#fafbfc" : isToday ? "#eff6ff" : "white"
            }}>
              {day && (
                <>
                  <div style={{ fontSize:13, fontWeight: isToday ? 700:400,
                    color: isToday ? "#3B82F6":"#374151",
                    width:24, height:24, borderRadius:"50%",
                    background: isToday ? "#dbeafe":"transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    marginBottom:4 }}>
                    {day}
                  </div>
                  {dayProjects.slice(0,2).map(p => {
                    const colorIdx = p.id % COLORS_PROJET.length;
                    return (
                      <div key={p.id} style={{ fontSize:10, padding:"2px 6px", borderRadius:4,
                        background:COLORS_PROJET[colorIdx]+"22", color:COLORS_PROJET[colorIdx],
                        marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        fontWeight:500 }}>
                        {p.titre}
                      </div>
                    );
                  })}
                  {dayProjects.length > 2 && (
                    <div style={{ fontSize:10, color:"#94a3b8" }}>+{dayProjects.length-2} autres</div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// MODAL PROJET
// ══════════════════════════════════════════════════
function ProjetModal({ projet, clients, onSave, onClose }) {
  const [form, setForm] = useState(projet || {
    titre:"", description:"", type_bien:"maison", style:"moderne",
    surface:"", budget_estime:"", statut:"en_attente", client_id:"",
    date_debut:"", date_fin_prevue:""
  });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"white", borderRadius:16, padding:28, width:520,
        maxHeight:"85vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, color:"#1e293b" }}>
            {projet ? "✏️ Modifier le projet" : "➕ Nouveau projet"}
          </h3>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#94a3b8" }}>✕</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Titre du projet *</label>
            <input value={form.titre} onChange={e => setForm({...form, titre:e.target.value})}
              placeholder="Villa Benali, Appart Hay Riad..."
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8,
                border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
          </div>

          <div>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Type de bien</label>
            <select value={form.type_bien} onChange={e => setForm({...form, type_bien:e.target.value})}
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
              <option value="maison">🏠 Maison</option>
              <option value="villa">🏡 Villa</option>
              <option value="appartement">🏢 Appartement</option>
              <option value="commercial">🏪 Commercial</option>
              <option value="immeuble">🏗️ Immeuble</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Statut</label>
            <select value={form.statut} onChange={e => setForm({...form, statut:e.target.value})}
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
              {Object.entries(STATUT_CFG).map(([v,c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Surface (m²)</label>
            <input type="number" value={form.surface} onChange={e => setForm({...form, surface:e.target.value})}
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
          </div>

          <div>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Budget estimé (MAD)</label>
            <input type="number" value={form.budget_estime} onChange={e => setForm({...form, budget_estime:e.target.value})}
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
          </div>

          <div>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Date début</label>
            <input type="date" value={form.date_debut?.slice(0,10)||""} onChange={e => setForm({...form, date_debut:e.target.value})}
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
          </div>

          <div>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Date fin prévue</label>
            <input type="date" value={form.date_fin_prevue?.slice(0,10)||""} onChange={e => setForm({...form, date_fin_prevue:e.target.value})}
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}/>
          </div>

          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Client</label>
            <select value={form.client_id||""} onChange={e => setForm({...form, client_id:+e.target.value||null})}
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8, border:"1px solid #cbd5e1", boxSizing:"border-box", fontSize:13 }}>
              <option value="">— Sans client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom||""}</option>)}
            </select>
          </div>

          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>Description</label>
            <textarea value={form.description||""} onChange={e => setForm({...form, description:e.target.value})}
              rows={3} placeholder="Détails du projet..."
              style={{ width:"100%", marginTop:4, padding:"9px 12px", borderRadius:8, border:"1px solid #cbd5e1",
                boxSizing:"border-box", fontSize:13, resize:"vertical" }}/>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={() => onSave(form)}
            style={{ flex:1, padding:"10px", background:"#1e293b", color:"white", border:"none",
              borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:600 }}>
            {projet ? "💾 Sauvegarder" : "➕ Créer le projet"}
          </button>
          <button onClick={onClose}
            style={{ padding:"10px 20px", background:"#f1f5f9", color:"#64748b", border:"none",
              borderRadius:8, cursor:"pointer", fontSize:14 }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// MAIN PLANNING PAGE
// ══════════════════════════════════════════════════
export default function Planning() {
  const [projets, setProjets] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("kanban");
  const [modal, setModal] = useState(false);
  const [editProjet, setEditProjet] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        fetch(`${API}/projets/`).then(r => r.json()),
        fetch(`${API}/clients/`).then(r => r.json()),
      ]);
      setProjets(Array.isArray(p) ? p : []);
      setClients(Array.isArray(c) ? c : []);
    } catch {}
    setLoading(false);
  };

  const saveProjet = async (form) => {
    if (!form.titre?.trim()) return alert("Titre obligatoire");
    const body = {
      ...form,
      surface: form.surface ? +form.surface : null,
      budget_estime: form.budget_estime ? +form.budget_estime : null,
      client_id: form.client_id || null,
    };
    try {
      if (editProjet?.id) {
        await fetch(`${API}/projets/${editProjet.id}`, {
          method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
        });
      } else {
        await fetch(`${API}/projets/`, {
          method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
        });
      }
      setModal(false); setEditProjet(null); fetchData();
    } catch { alert("Erreur sauvegarde"); }
  };

  const updateStatut = async (id, statut) => {
    await fetch(`${API}/projets/${id}`, {
      method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ statut })
    });
    fetchData();
  };

  const deleteProjet = async (id) => {
    if (!confirm("Supprimer ce projet?")) return;
    await fetch(`${API}/projets/${id}`, { method:"DELETE" });
    fetchData();
  };

  const openEdit = (p) => { setEditProjet(p); setModal(true); };
  const openNew = () => { setEditProjet(null); setModal(true); };

  const filtered = projets
    .filter(p => filterStatut === "all" || p.statut === filterStatut)
    .filter(p => !search || p.titre.toLowerCase().includes(search.toLowerCase()));

  const views = [
    { id:"kanban",   label:"Kanban",    icon:"⬛" },
    { id:"gantt",    label:"Gantt",     icon:"📊" },
    { id:"liste",    label:"Liste",     icon:"☰"  },
    { id:"calendrier",label:"Calendrier",icon:"📅" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Planning</h1>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>{projets.length} projets · {filtered.length} affichés</p>
        </div>
        <button onClick={openNew}
          style={{ padding:"9px 18px", background:"#1e293b", color:"white", border:"none",
            borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          + Nouveau projet
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        {/* Vue switcher */}
        <div style={{ display:"flex", gap:0, background:"#f1f5f9", borderRadius:10, padding:3 }}>
          {views.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12,
                background: view===v.id ? "white":"transparent",
                color: view===v.id ? "#1e293b":"#94a3b8",
                fontWeight: view===v.id ? 600:400,
                boxShadow: view===v.id ? "0 1px 4px rgba(0,0,0,.1)":"none",
                display:"flex", alignItems:"center", gap:5 }}>
              <span>{v.icon}</span> {v.label}
            </button>
          ))}
        </div>

        {/* Filtres */}
        <div style={{ display:"flex", gap:6 }}>
          {[["all","Tous"],...Object.entries(STATUT_CFG).map(([v,c])=>[v,c.label])].map(([v,l]) => (
            <button key={v} onClick={() => setFilterStatut(v)}
              style={{ padding:"5px 12px", borderRadius:20, border:"1px solid #e2e8f0", fontSize:12, cursor:"pointer",
                background: filterStatut===v ? "#1e293b":"white",
                color: filterStatut===v ? "white":"#64748b" }}>
              {l}
            </button>
          ))}
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher..."
          style={{ padding:"7px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13,
            outline:"none", marginLeft:"auto", width:200 }}/>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
          <p>Chargement...</p>
        </div>
      ) : (
        <>
          {view === "kanban" && (
            <KanbanView projets={filtered} clients={clients}
              onUpdateStatut={updateStatut} onDelete={deleteProjet} onEdit={openEdit}/>
          )}
          {view === "gantt" && <GanttView projets={filtered} clients={clients}/>}
          {view === "liste" && (
            <ListView projets={filtered} clients={clients}
              onUpdateStatut={updateStatut} onDelete={deleteProjet} onEdit={openEdit}/>
          )}
          {view === "calendrier" && <CalendarView projets={filtered} clients={clients}/>}
        </>
      )}

      {/* Modal */}
      {modal && (
        <ProjetModal
          projet={editProjet}
          clients={clients}
          onSave={saveProjet}
          onClose={() => { setModal(false); setEditProjet(null); }}
        />
      )}
    </div>
  );
}