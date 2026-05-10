import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from "recharts";

const API = "http://127.0.0.1:8000";

const COLORS = ["#1e293b", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];

const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <span style={{ fontSize:24 }}>{icon}</span>
        {sub && <span style={{ fontSize:11, color:"#94a3b8", background:"#f1f5f9", padding:"2px 8px", borderRadius:10 }}>{sub}</span>}
      </div>
      <div style={{ fontSize: typeof value === "string" && value.length > 8 ? 16 : 26, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{label}</div>
    </div>
  );
}

export default function Rapports() {
  const [stats, setStats] = useState(null);
  const [projets, setProjets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetch(`${API}/projets/stats`).then(r => r.json()),
        fetch(`${API}/projets/`).then(r => r.json()),
      ]);
      setStats(s); setProjets(p);
    } catch {}
    setLoading(false);
  };

  if (loading) return (
    <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
      <p>Chargement des rapports...</p>
    </div>
  );

  // Calcul données charts depuis projets réels
  const statutData = [
    { name:"En cours",   value: projets.filter(p=>p.statut==="en_cours").length,   color:"#3B82F6" },
    { name:"Terminés",   value: projets.filter(p=>p.statut==="termine").length,    color:"#10B981" },
    { name:"En attente", value: projets.filter(p=>p.statut==="en_attente").length, color:"#F59E0B" },
    { name:"Annulés",    value: projets.filter(p=>p.statut==="annule").length,     color:"#EF4444" },
  ].filter(d => d.value > 0);

  const typeData = ["maison","villa","appartement","commercial"].map(t => ({
    name: t.charAt(0).toUpperCase() + t.slice(1),
    value: projets.filter(p => p.type_bien === t).length
  })).filter(d => d.value > 0);

  // Simulation CA mensuel (basé sur projets créés)
  const caData = MOIS.map((m, i) => {
    const projetsMonth = projets.filter(p => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);
      return d.getMonth() === i;
    });
    const ca = projetsMonth.reduce((sum, p) => sum + (p.budget_estime || 0), 0);
    const nb = projetsMonth.length;
    return { mois: m, ca: ca, projets: nb };
  });

  const progressionData = MOIS.slice(0, new Date().getMonth() + 1).map((m, i) => ({
    mois: m,
    total: projets.filter(p => {
      if (!p.created_at) return false;
      return new Date(p.created_at).getMonth() <= i;
    }).length,
    termines: projets.filter(p => {
      if (!p.created_at) return false;
      return new Date(p.created_at).getMonth() <= i && p.statut === "termine";
    }).length,
  }));

  const alertes = [];
  if (stats?.factures_impayees > 0)
    alertes.push({ type:"danger", msg:`${stats.factures_impayees} facture(s) impayée(s) en attente`, icon:"⚠️" });
  if (projets.filter(p=>p.statut==="en_attente").length > 0)
    alertes.push({ type:"warning", msg:`${projets.filter(p=>p.statut==="en_attente").length} projet(s) en attente de démarrage`, icon:"🕐" });
  if (stats?.en_cours > 5)
    alertes.push({ type:"info", msg:`${stats.en_cours} projets en cours — charge de travail élevée`, icon:"📋" });
  if (alertes.length === 0)
    alertes.push({ type:"success", msg:"Tout va bien — aucune alerte en cours", icon:"✅" });

  const ALERTE_COLORS = {
    danger:  { bg:"#FEF2F2", border:"#FECACA", text:"#991B1B" },
    warning: { bg:"#FFFBEB", border:"#FDE68A", text:"#92400E" },
    info:    { bg:"#EFF6FF", border:"#BFDBFE", text:"#1E40AF" },
    success: { bg:"#F0FDF4", border:"#BBF7D0", text:"#166534" },
  };

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, color:"#1e293b" }}>Rapports & Statistiques</h1>
        <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:14 }}>
          Vue d'ensemble — {new Date().toLocaleDateString("fr-FR", { year:"numeric", month:"long" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
        <StatCard label="Total projets"      value={stats?.total_projets||0}  icon="📋" color="#1e293b" sub="tous statuts"/>
        <StatCard label="Projets en cours"   value={stats?.en_cours||0}       icon="🔄" color="#3B82F6" sub="actifs"/>
        <StatCard label="Clients"            value={stats?.nb_clients||0}     icon="👥" color="#10B981" sub="enregistrés"/>
        <StatCard label="CA total estimé"   value={stats?.ca_formatted||"0 MAD"} icon="💰" color="#8B5CF6" sub="budget"/>
      </div>

      {/* Alertes intelligentes */}
      <div style={{ background:"white", borderRadius:12, padding:18, border:"1px solid #e2e8f0", marginBottom:20 }}>
        <h3 style={{ margin:"0 0 12px", fontSize:15, color:"#1e293b" }}>Alertes intelligentes</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {alertes.map((a, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
              background:ALERTE_COLORS[a.type].bg, border:`1px solid ${ALERTE_COLORS[a.type].border}`,
              borderRadius:8, color:ALERTE_COLORS[a.type].text, fontSize:13 }}>
              <span style={{ fontSize:16 }}>{a.icon}</span>
              {a.msg}
            </div>
          ))}
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>

        {/* CA mensuel */}
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, color:"#1e293b" }}>Budget estimé par mois (MAD)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={caData} margin={{ top:0, right:10, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="mois" tick={{ fontSize:11 }} tickLine={false}/>
              <YAxis tick={{ fontSize:11 }} tickLine={false} axisLine={false}
                tickFormatter={v => v > 0 ? `${(v/1000).toFixed(0)}k` : "0"}/>
              <Tooltip formatter={(v) => [`${v.toLocaleString()} MAD`, "Budget"]}/>
              <Bar dataKey="ca" fill="#1e293b" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Statut projets */}
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, color:"#1e293b" }}>Répartition par statut</h3>
          {statutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statutData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false}>
                  {statutData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                </Pie>
                <Tooltip/>
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize:12 }}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:220, display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:13 }}>
              Aucun projet pour le moment
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>

        {/* Progression projets */}
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, color:"#1e293b" }}>Évolution des projets</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={progressionData} margin={{ top:0, right:10, left:0, bottom:0 }}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gTermine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="mois" tick={{ fontSize:11 }} tickLine={false}/>
              <YAxis tick={{ fontSize:11 }} tickLine={false} axisLine={false}/>
              <Tooltip/>
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize:12 }}/>
              <Area type="monotone" dataKey="total" name="Total" stroke="#3B82F6" fill="url(#gTotal)" strokeWidth={2}/>
              <Area type="monotone" dataKey="termines" name="Terminés" stroke="#10B981" fill="url(#gTermine)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Types de biens */}
        <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, color:"#1e293b" }}>Types de projets</h3>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData} layout="vertical" margin={{ top:0, right:10, left:20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize:11 }} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize:12 }} tickLine={false} axisLine={false} width={80}/>
                <Tooltip/>
                <Bar dataKey="value" name="Projets" radius={[0,4,4,0]}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:220, display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:13 }}>
              Aucun projet pour le moment
            </div>
          )}
        </div>
      </div>

      {/* Tableau récap */}
      <div style={{ background:"white", borderRadius:12, padding:20, border:"1px solid #e2e8f0" }}>
        <h3 style={{ margin:"0 0 16px", fontSize:14, color:"#1e293b" }}>Récapitulatif projets</h3>
        {projets.length === 0 ? (
          <div style={{ textAlign:"center", padding:20, color:"#94a3b8", fontSize:13 }}>Aucun projet</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:"2px solid #f1f5f9" }}>
                {["Projet","Client","Type","Surface","Budget","Statut","Progression"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"8px 6px", color:"#64748b", fontWeight:500, fontSize:12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projets.slice(0,10).map((p, i) => (
                <tr key={p.id} style={{ borderBottom:"1px solid #f8f9fa", background: i%2===0?"white":"#fafafa" }}>
                  <td style={{ padding:"8px 6px", fontWeight:500 }}>{p.titre}</td>
                  <td style={{ padding:"8px 6px", color:"#64748b" }}>{p.client?.nom || "—"}</td>
                  <td style={{ padding:"8px 6px", color:"#64748b", textTransform:"capitalize" }}>{p.type_bien || "—"}</td>
                  <td style={{ padding:"8px 6px", color:"#64748b" }}>{p.surface ? `${p.surface}m²` : "—"}</td>
                  <td style={{ padding:"8px 6px", color:"#64748b" }}>{p.budget_estime ? `${p.budget_estime.toLocaleString()} MAD` : "—"}</td>
                  <td style={{ padding:"8px 6px" }}>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10,
                      background: p.statut==="termine"?"#F0FDF4":p.statut==="en_cours"?"#EFF6FF":p.statut==="annule"?"#FEF2F2":"#FFFBEB",
                      color: p.statut==="termine"?"#166534":p.statut==="en_cours"?"#1D4ED8":p.statut==="annule"?"#991B1B":"#B45309" }}>
                      {p.statut?.replace("_"," ")}
                    </span>
                  </td>
                  <td style={{ padding:"8px 6px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ flex:1, height:4, background:"#f1f5f9", borderRadius:2, minWidth:60 }}>
                        <div style={{ width:`${p.progression||0}%`, height:4, background:"#1e293b", borderRadius:2 }}/>
                      </div>
                      <span style={{ fontSize:11, color:"#64748b", minWidth:28 }}>{p.progression||0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}