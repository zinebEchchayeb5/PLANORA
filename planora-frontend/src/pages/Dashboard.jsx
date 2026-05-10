import { useState, useEffect } from "react";
import Projets from "./Projets";
import Clients from "./Clients";
import Rapports from "./Rapports";
import Factures from "./Factures";
import Equipe from "./Equipe";
import Planning from "./Planning";
import Stock from "./Stock";
import Comptabilite from "./Comptabilite";
import Fichiers from "./Fichiers";
import VoiceChatbot from "./VoiceChatbot";

const API = "http://127.0.0.1:8000";

export default function Dashboard({ user, onLogout, goPlans }) {
  const [stats, setStats] = useState({ total_projets:0, en_cours:0, termines:0, nb_clients:0, factures_impayees:0, ca_total:0, ca_formatted:"0 MAD" });
  const [prevision, setPrevision] = useState(null);
  const [activeMenu, setActiveMenu] = useState("dashboard");

  useEffect(() => { fetchStats(); fetchPrevision(); }, []);

  const fetchStats = async () => {
    try { const data = await fetch(`${API}/projets/stats`).then(r => r.json()); setStats(data); } catch {}
  };
  const fetchPrevision = async () => {
    try { const data = await fetch(`${API}/ia/prevision-ca`).then(r => r.json()); setPrevision(data); } catch {}
  };

  const menuItems = [
    { id:"dashboard",    label:"Dashboard",        icon:"📊" },
    { id:"plans",        label:"Génération Plans",  icon:"🏠" },
    { id:"projets",      label:"Projets",           icon:"📋" },
    { id:"planning",     label:"Planning",          icon:"🗓️" },
    { id:"clients",      label:"Clients",           icon:"👥" },
    { id:"equipe",       label:"Équipe & Tâches",   icon:"👨‍💼" },
    { id:"factures",     label:"Facturation",       icon:"💰" },
    { id:"stock",        label:"Stock",             icon:"📦" },
    { id:"comptabilite", label:"Comptabilité",      icon:"⚙️" },
    { id:"fichiers",     label:"Fichiers",          icon:"📁" },
    { id:"rapports",     label:"Rapports & Stats",  icon:"📈" },
  ];

  const STAT_CARDS = [
    { label:"Projets en cours",  value:stats.en_cours,         color:"#3B82F6", icon:"📋", sub:`${stats.total_projets} total` },
    { label:"Clients",           value:stats.nb_clients,        color:"#10B981", icon:"👥", sub:"enregistrés" },
    { label:"CA total estimé",   value:stats.ca_formatted,      color:"#8B5CF6", icon:"💰", sub:"budget" },
    { label:"Factures impayées", value:stats.factures_impayees, color:"#EF4444", icon:"⚠️", sub:"en attente" },
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#f8f9fa", fontFamily:"sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width:240, background:"#1e293b", color:"white", display:"flex", flexDirection:"column",
        flexShrink:0, position:"sticky", top:0, height:"100vh", overflowY:"auto" }}>
        <div style={{ padding:"24px 20px", borderBottom:"1px solid #334155" }}>
          <div style={{ fontSize:20, fontWeight:700, letterSpacing:1 }}>PLANORA</div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Bureau d'étude IA</div>
        </div>
        <div style={{ padding:"12px 0", flex:1 }}>
          {menuItems.map(item => (
            <div key={item.id}
              onClick={() => { setActiveMenu(item.id); if (item.id === "plans") goPlans(); }}
              style={{ padding:"10px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, fontSize:13,
                background: activeMenu === item.id ? "#334155" : "transparent",
                borderLeft: activeMenu === item.id ? "3px solid #60a5fa" : "3px solid transparent",
                color: activeMenu === item.id ? "white" : "#94a3b8",
                transition:"all .15s" }}>
              <span style={{ fontSize:16 }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding:"16px 20px", borderTop:"1px solid #334155" }}>
          <div style={{ fontSize:13, color:"white", fontWeight:500 }}>{user.nom}</div>
          <div style={{ fontSize:11, color:"#94a3b8", textTransform:"capitalize", marginBottom:10 }}>{user.role}</div>
          <button onClick={onLogout}
            style={{ width:"100%", padding:"7px", background:"#334155", color:"#94a3b8",
              border:"none", borderRadius:6, cursor:"pointer", fontSize:12 }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, padding:28, overflowY:"auto" }}>

        {activeMenu === "dashboard" && (
          <>
            <div style={{ marginBottom:24 }}>
              <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Bonjour, {user.nom} 👋</h1>
              <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>
                {new Date().toLocaleDateString("fr-FR", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
              </p>
            </div>

            {/* KPI Cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>
              {STAT_CARDS.map(s => (
                <div key={s.label} style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0",
                  cursor:"pointer" }} onClick={() => {
                    if (s.label.includes("Projets")) setActiveMenu("projets");
                    if (s.label.includes("Clients")) setActiveMenu("clients");
                    if (s.label.includes("Factures")) setActiveMenu("factures");
                  }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <span style={{ fontSize:22 }}>{s.icon}</span>
                    <span style={{ fontSize:11, color:"#94a3b8" }}>{s.sub}</span>
                  </div>
                  <div style={{ fontSize: typeof s.value === "string" ? 16 : 26, fontWeight:700, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Prévision CA IA */}
            {prevision && (
              <div style={{ background:"linear-gradient(135deg,#1e293b,#334155)", borderRadius:12, padding:20, marginBottom:20, color:"white" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:12, color:"#94a3b8", marginBottom:4 }}>🤖 Prévision IA — Mois prochain</div>
                    <div style={{ fontSize:28, fontWeight:700, color:"#60a5fa" }}>{prevision.prevision_formatted}</div>
                    <div style={{ fontSize:13, color:"#94a3b8", marginTop:6 }}>
                      Tendance: <span style={{ color: prevision.tendance==="hausse"?"#10B981":prevision.tendance==="baisse"?"#EF4444":"#F59E0B" }}>
                        {prevision.tendance==="hausse"?"📈 En hausse":prevision.tendance==="baisse"?"📉 En baisse":"➡️ Stable"}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{prevision.conseil}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12, color:"#94a3b8" }}>Projets en cours</div>
                    <div style={{ fontSize:32, fontWeight:700, color:"#10B981" }}>{prevision.projets_en_cours}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions rapides */}
            <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0", marginBottom:20 }}>
              <h3 style={{ margin:"0 0 14px", fontSize:15, color:"#1e293b" }}>Actions rapides</h3>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {[
                  { label:"Nouveau projet",   color:"#1e293b", action:() => setActiveMenu("projets") },
                  { label:"Générer un plan",  color:"#3B82F6", action:goPlans },
                  { label:"Ajouter client",   color:"#10B981", action:() => setActiveMenu("clients") },
                  { label:"Nouvelle facture", color:"#F59E0B", action:() => setActiveMenu("factures") },
                  { label:"Stock",            color:"#8B5CF6", action:() => setActiveMenu("stock") },
                  { label:"Fichiers",         color:"#06B6D4", action:() => setActiveMenu("fichiers") },
                  { label:"Comptabilité",     color:"#64748b", action:() => setActiveMenu("comptabilite") },
                ].map(a => (
                  <button key={a.label} onClick={a.action}
                    style={{ padding:"8px 16px", background:a.color, color:"white", border:"none",
                      borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500 }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aperçu */}
            <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <h3 style={{ margin:0, fontSize:15, color:"#1e293b" }}>Aperçu</h3>
                <button onClick={() => setActiveMenu("rapports")}
                  style={{ fontSize:12, color:"#3B82F6", background:"none", border:"none", cursor:"pointer" }}>
                  Voir rapports →
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {[
                  { label:"Terminés",  value:stats.termines,    color:"#10B981" },
                  { label:"En cours",  value:stats.en_cours,     color:"#3B82F6" },
                  { label:"CA estimé", value:stats.ca_formatted, color:"#8B5CF6" },
                ].map(s => (
                  <div key={s.label} style={{ background:"#f8f9fa", borderRadius:8, padding:14, textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeMenu === "projets"      && <Projets />}
        {activeMenu === "clients"      && <Clients />}
        {activeMenu === "equipe"       && <Equipe />}
        {activeMenu === "factures"     && <Factures />}
        {activeMenu === "planning"     && <Planning />}
        {activeMenu === "stock"        && <Stock />}
        {activeMenu === "comptabilite" && <Comptabilite />}
        {activeMenu === "fichiers"     && <Fichiers />}
        {activeMenu === "rapports"     && <Rapports />}
      </div>

      {/* Floating Voice Chatbot */}
      <VoiceChatbot compact={true} />
    </div>
  );
}