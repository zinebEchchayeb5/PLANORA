import { useRef, useEffect, useState, useCallback } from "react";

const SCALE = 50;

const ROOM_STYLES = {
  living:   {fill:"#FFF5E8", wall:"#2A2018", hatch:"#E8C898"},
  kitchen:  {fill:"#F0FAEF", wall:"#1A2818", hatch:"#98CC88"},
  bedroom:  {fill:"#F2EFF8", wall:"#1A1830", hatch:"#9898D8"},
  bathroom: {fill:"#EBF8FB", wall:"#183028", hatch:"#78B8C8"},
  corridor: {fill:"#F5F5F2", wall:"#303030", hatch:"#C8C8C0"},
  garage:   {fill:"#EEEEE8", wall:"#282818", hatch:"#B8B8A0"},
  dressing: {fill:"#FBF0F8", wall:"#301828", hatch:"#C888B8"},
  default:  {fill:"#FAFAFA", wall:"#303030", hatch:"#CCCCCC"},
};

function draw2DPlan(ctx, plan, W, H, zoom, pan) {
  if (!plan?.rooms) return;
  const { rooms, doors, windows, furniture, jardins, piscine, terrasse, terrain } = plan;
  const S = SCALE * zoom;
  const tx = x => pan.x + x * S;
  const ty = y => pan.y + y * S;
  const ts = s => s * S;
  const WT = Math.max(4, ts(0.20));

  ctx.fillStyle = "#F5F3EE"; ctx.fillRect(0, 0, W, H);

  // Grille
  ctx.strokeStyle = "#E5E2D8"; ctx.lineWidth = 0.4;
  for (let x = pan.x % S; x < W; x += S) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = pan.y % S; y < H; y += S) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Terrain
  if (terrain) {
    ctx.save(); ctx.fillStyle="#EDE8DF"; ctx.strokeStyle="#9B8B6B";
    ctx.lineWidth=1.5; ctx.setLineDash([8,4]);
    ctx.fillRect(tx(terrain.x),ty(terrain.y),ts(terrain.w),ts(terrain.h));
    ctx.strokeRect(tx(terrain.x),ty(terrain.y),ts(terrain.w),ts(terrain.h));
    ctx.setLineDash([]);
    ctx.fillStyle="#7B6B4B"; ctx.font=`bold ${Math.max(9,10*zoom)}px Arial`;
    ctx.textAlign="center";
    ctx.fillText(`Terrain: ${terrain.w.toFixed(1)}m × ${terrain.h.toFixed(1)}m`, tx(terrain.x+terrain.w/2), ty(terrain.y)-6);
    ctx.restore();
  }

  // Jardins, terrasse, piscine (inchangé)
  (jardins||[]).forEach(j => {
    ctx.save(); ctx.fillStyle="#C8E8B0";
    ctx.fillRect(tx(j.x),ty(j.y),ts(j.w),ts(j.h));
    ctx.beginPath(); ctx.rect(tx(j.x),ty(j.y),ts(j.w),ts(j.h)); ctx.clip();
    ctx.strokeStyle="#88BB66"; ctx.lineWidth=0.5; ctx.globalAlpha=0.4;
    for (let i=0; i<ts(j.w)+ts(j.h); i+=6) { ctx.beginPath(); ctx.moveTo(tx(j.x)+i,ty(j.y)); ctx.lineTo(tx(j.x),ty(j.y)+i); ctx.stroke(); }
    ctx.globalAlpha=1; ctx.restore();
    ctx.strokeStyle="#5A9A3A"; ctx.lineWidth=1; ctx.strokeRect(tx(j.x),ty(j.y),ts(j.w),ts(j.h));
    ctx.fillStyle="#2A6A0A"; ctx.font=`${Math.max(8,9*zoom)}px Arial`;
    ctx.textAlign="center"; ctx.fillText(j.name, tx(j.x+j.w/2), ty(j.y+j.h/2));
  });
  if (terrasse) {
    ctx.save(); ctx.fillStyle="#F0E8D0";
    ctx.fillRect(tx(terrasse.x),ty(terrasse.y),ts(terrasse.w),ts(terrasse.h));
    ctx.strokeStyle="#C09040"; ctx.lineWidth=1; ctx.setLineDash([4,3]);
    ctx.strokeRect(tx(terrasse.x),ty(terrasse.y),ts(terrasse.w),ts(terrasse.h));
    ctx.setLineDash([]); ctx.restore();
    ctx.fillStyle="#805020"; ctx.font=`${Math.max(8,9*zoom)}px Arial`;
    ctx.textAlign="center"; ctx.fillText("Terrasse", tx(terrasse.x+terrasse.w/2), ty(terrasse.y+terrasse.h/2));
  }
  if (piscine) {
    ctx.save(); ctx.fillStyle="#90CCE8";
    ctx.beginPath(); ctx.roundRect(tx(piscine.x),ty(piscine.y),ts(piscine.w),ts(piscine.h),8);
    ctx.fill(); ctx.strokeStyle="#1870A8"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="#0050A0"; ctx.font=`${Math.max(8,9*zoom)}px Arial`;
    ctx.textAlign="center"; ctx.fillText("Piscine", tx(piscine.x+piscine.w/2), ty(piscine.y+piscine.h/2));
    ctx.restore();
  }

  const wallHatch = (wx,wy,ww,wh) => {
    ctx.save(); ctx.fillStyle="#B0A898"; ctx.fillRect(wx,wy,ww,wh);
    ctx.beginPath(); ctx.rect(wx,wy,ww,wh); ctx.clip();
    ctx.strokeStyle="#888070"; ctx.lineWidth=0.6;
    const step=Math.max(3,WT*0.35);
    for (let i=-Math.max(ww,wh); i<Math.max(ww,wh)*2; i+=step) { ctx.beginPath(); ctx.moveTo(wx+i,wy); ctx.lineTo(wx+i+wh,wy+wh); ctx.stroke(); }
    ctx.restore();
  };

  // Pièces
  rooms.forEach(room => {
    const x=tx(room.x), y=ty(room.y), w=ts(room.w), h=ts(room.h);
    const st=ROOM_STYLES[room.type]||ROOM_STYLES.default;
    ctx.fillStyle=st.fill; ctx.fillRect(x,y,w,h);
    ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
    ctx.strokeStyle=st.hatch; ctx.lineWidth=0.3; ctx.globalAlpha=0.2;
    for (let i=-Math.max(w,h); i<Math.max(w,h)*2; i+=7) { ctx.beginPath(); ctx.moveTo(x+i,y); ctx.lineTo(x+i+h,y+h); ctx.stroke(); }
    ctx.globalAlpha=1; ctx.restore();
    wallHatch(x,y,w,WT); wallHatch(x,y+h-WT,w,WT);
    wallHatch(x,y,WT,h); wallHatch(x+w-WT,y,WT,h);
    ctx.strokeStyle=st.wall; ctx.lineWidth=Math.max(1,WT*0.15); ctx.strokeRect(x,y,w,h);
    const cx2=x+w/2, cy2=y+h/2, fs=Math.max(8,Math.min(13,w/7*zoom));
    ctx.fillStyle="#1A1A1A"; ctx.font=`bold ${fs}px Arial`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(room.name, cx2, cy2-fs*0.7);
    ctx.fillStyle="#555"; ctx.font=`${Math.max(7,fs*0.85)}px Arial`;
    ctx.fillText(`${(room.w*room.h).toFixed(1)} m²`, cx2, cy2+fs*0.5);
    if (zoom>0.4) {
      ctx.strokeStyle="#777"; ctx.fillStyle="#444"; ctx.lineWidth=0.6;
      ctx.font=`${Math.max(6,8*zoom)}px Arial`; ctx.textAlign="center"; ctx.textBaseline="middle";
      const coteY=y-14*zoom;
      ctx.beginPath(); ctx.moveTo(x+WT,coteY); ctx.lineTo(x+w-WT,coteY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+WT,coteY-3); ctx.lineTo(x+WT,coteY+3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+w-WT,coteY-3); ctx.lineTo(x+w-WT,coteY+3); ctx.stroke();
      ctx.fillText(`${room.w.toFixed(2)}m`, cx2, coteY-6*zoom);
      const coteX=x-14*zoom;
      ctx.beginPath(); ctx.moveTo(coteX,y+WT); ctx.lineTo(coteX,y+h-WT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(coteX-3,y+WT); ctx.lineTo(coteX+3,y+WT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(coteX-3,y+h-WT); ctx.lineTo(coteX+3,y+h-WT); ctx.stroke();
      ctx.save(); ctx.translate(coteX-6*zoom,y+h/2); ctx.rotate(-Math.PI/2);
      ctx.fillText(`${room.h.toFixed(2)}m`,0,0); ctx.restore();
    }
  });

  // Fenêtres
  (windows||[]).forEach((win,idx) => {
    const wx=tx(win.x), wy=ty(win.y), ww=ts(win.w||1.2);
    const isV=win.wall==="left"||win.wall==="right";
    ctx.save(); ctx.fillStyle="#F5F3EE";
    if (!isV) ctx.fillRect(wx,wy-WT*0.5,ww,WT); else ctx.fillRect(wx-WT*0.5,wy,WT,ww);
    ctx.strokeStyle="#4080BB"; ctx.lineWidth=Math.max(1,zoom*1.2); ctx.fillStyle="#C8E4F8";
    if (!isV) {
      ctx.fillRect(wx,wy-3,ww,6);
      for (let i=0;i<3;i++) { ctx.beginPath(); ctx.moveTo(wx,wy-2+i*2); ctx.lineTo(wx+ww,wy-2+i*2); ctx.stroke(); }
      ctx.strokeStyle="#2060A0"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(wx,wy-4); ctx.lineTo(wx,wy+4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx+ww,wy-4); ctx.lineTo(wx+ww,wy+4); ctx.stroke();
    } else {
      ctx.fillRect(wx-3,wy,6,ww);
      for (let i=0;i<3;i++) { ctx.beginPath(); ctx.moveTo(wx-2+i*2,wy); ctx.lineTo(wx-2+i*2,wy+ww); ctx.stroke(); }
      ctx.strokeStyle="#2060A0"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(wx-4,wy); ctx.lineTo(wx+4,wy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx-4,wy+ww); ctx.lineTo(wx+4,wy+ww); ctx.stroke();
    }
    const tag = win.tag || `F${idx+1}`;
    const tagX = !isV ? wx+ww/2 : wx;
    const tagY = !isV ? wy-14*zoom : wy+ww/2;
    ctx.fillStyle="#1060A0"; ctx.font=`bold ${Math.max(7,8*zoom)}px Arial`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillStyle="white";
    ctx.fillRect(tagX-8,tagY-7,16,14);
    ctx.strokeStyle="#1060A0"; ctx.lineWidth=0.7; ctx.strokeRect(tagX-8,tagY-7,16,14);
    ctx.fillStyle="#1060A0";
    ctx.fillText(tag, tagX, tagY);
    ctx.restore();
  });

  // Portes
  (doors||[]).forEach((door,idx) => {
    const dx=tx(door.x), dy=ty(door.y), dw=ts(door.w||0.9);
    const isV=door.orientation==="v";
    ctx.save(); ctx.fillStyle="#F5F3EE";
    if (!isV) ctx.fillRect(dx,dy-WT*0.5,dw,WT); else ctx.fillRect(dx-WT*0.5,dy,WT,dw);
    const isMain=door.type==="principale";
    const isGarage=door.type==="garage";
    ctx.strokeStyle=isMain?"#A05010":isGarage?"#606060":"#334466";
    ctx.lineWidth=Math.max(1.5,zoom*1.5);
    ctx.beginPath();
    if (!isV) { ctx.moveTo(dx,dy); ctx.lineTo(dx+dw,dy); }
    else { ctx.moveTo(dx,dy); ctx.lineTo(dx,dy+dw); }
    ctx.stroke();
    ctx.lineWidth=Math.max(0.8,zoom); ctx.setLineDash([3,2]); ctx.globalAlpha=0.6;
    ctx.beginPath();
    if (!isV) ctx.arc(dx,dy,dw,0,Math.PI/2); else ctx.arc(dx,dy,dw,0,Math.PI/2);
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
    const tag = door.tag || (isMain?"P0":`P${idx+1}`);
    const tagX = !isV ? dx+dw*0.6 : dx+12;
    const tagY = !isV ? dy+14*zoom : dy+dw*0.6;
    ctx.fillStyle="white";
    ctx.beginPath(); ctx.arc(tagX,tagY,8,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=isMain?"#A05010":"#334466"; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=isMain?"#A05010":"#334466";
    ctx.font=`bold ${Math.max(6,7*zoom)}px Arial`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(tag, tagX, tagY);
    ctx.restore();
  });

  // Mobilier
  if (zoom>0.5 && furniture) {
    furniture.forEach(f => {
      const fx=tx(f.x),fy=ty(f.y),fw=ts(f.w),fh=ts(f.h);
      ctx.save(); ctx.fillStyle=f.color||"#D0C8B8"; ctx.globalAlpha=0.75;
      ctx.fillRect(fx,fy,fw,fh); ctx.globalAlpha=1;
      ctx.strokeStyle="#888"; ctx.lineWidth=0.7; ctx.strokeRect(fx,fy,fw,fh);
      if (fw>18&&fh>12) {
        ctx.fillStyle="#555"; ctx.font=`${Math.max(6,7*zoom)}px Arial`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(f.name, fx+fw/2, fy+fh/2);
      }
      ctx.restore();
    });
  }

  // Boussole
  const nx=W-50,ny=50,nr=22;
  ctx.save(); ctx.beginPath(); ctx.arc(nx,ny,nr,0,Math.PI*2);
  ctx.fillStyle="white"; ctx.fill(); ctx.strokeStyle="#555"; ctx.lineWidth=1.2; ctx.stroke();
  ctx.fillStyle="#CC2222"; ctx.beginPath();
  ctx.moveTo(nx,ny-nr+4); ctx.lineTo(nx+5,ny+4); ctx.lineTo(nx,ny+2); ctx.lineTo(nx-5,ny+4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle="#333"; ctx.font="bold 11px Arial"; ctx.textAlign="center"; ctx.fillText("N",nx,ny-nr-3);
  ctx.font="8px Arial"; ctx.fillStyle="#666";
  ctx.fillText("S",nx,ny+nr+8); ctx.fillText("E",nx+nr+8,ny+3); ctx.fillText("O",nx-nr-8,ny+3);
  ctx.restore();

  // Cartouche
  const cW=220,cH=72,cX=W-cW-12,cY=H-cH-12;
  ctx.save(); ctx.fillStyle="white"; ctx.strokeStyle="#444"; ctx.lineWidth=1.5;
  ctx.fillRect(cX,cY,cW,cH); ctx.strokeRect(cX,cY,cW,cH);
  ctx.fillStyle="#1e293b"; ctx.fillRect(cX,cY,cW,20);
  ctx.fillStyle="white"; ctx.font="bold 10px Arial"; ctx.textAlign="center";
  ctx.fillText("PLANORA — Plan Architectural", cX+cW/2, cY+14);
  ctx.lineWidth=0.6; ctx.strokeStyle="#888";
  [20,36,54].forEach(dy2 => { ctx.beginPath(); ctx.moveTo(cX,cY+dy2); ctx.lineTo(cX+cW,cY+dy2); ctx.stroke(); });
  ctx.beginPath(); ctx.moveTo(cX+110,cY+20); ctx.lineTo(cX+110,cY+cH); ctx.stroke();
  ctx.fillStyle="#333"; ctx.font="9px Arial"; ctx.textAlign="left";
  ctx.fillText(`Type: ${plan.context?.type_bien||"—"}`, cX+5, cY+30);
  ctx.fillText(`Style: ${plan.style||"—"}`, cX+115, cY+30);
  ctx.fillText(`Surface: ${plan.total_surface}m²`, cX+5, cY+46);
  ctx.fillText(`Échelle: 1:100`, cX+115, cY+46);
  ctx.fillText(`H.pl: ${plan.ceiling_height||2.8}m`, cX+5, cY+64);
  ctx.fillText(new Date().toLocaleDateString("fr-FR"), cX+115, cY+64);
  ctx.restore();

  // Légende
  const lgd=[{color:"#FFF5E8",label:"Séjour"},{color:"#F0FAEF",label:"Cuisine"},
    {color:"#F2EFF8",label:"Chambre"},{color:"#EBF8FB",label:"SDB"},{color:"#F5F5F2",label:"Couloir"}];
  ctx.font="8px Arial"; ctx.textAlign="left";
  lgd.forEach((l,i) => {
    ctx.fillStyle=l.color; ctx.strokeStyle="#999"; ctx.lineWidth=0.5;
    ctx.fillRect(12,H-14-(lgd.length-i)*16,11,11); ctx.strokeRect(12,H-14-(lgd.length-i)*16,11,11);
    ctx.fillStyle="#333"; ctx.fillText(l.label, 27, H-14-(lgd.length-i)*16+9);
  });
}

export default function PlanRenderer({ plan, cost }) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:80, y:100});
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({x:0, y:0});

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return;
    draw2DPlan(canvas.getContext("2d"), plan, canvas.width, canvas.height, zoom, pan);
  }, [plan, zoom, pan]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!plan) return null;

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(4, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  return (
    <div style={{background:"white", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden"}}>
      <div style={{display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:"#1e293b", flexWrap:"wrap"}}>
        <span style={{color:"white", fontWeight:600, fontSize:12, flex:1}}>
          {plan.context?.type_bien} · {plan.total_surface}m² · {plan.style} · H={plan.ceiling_height||2.8}m
        </span>
        <div style={{display:"flex", gap:3}}>
          <button onClick={() => setZoom(z => Math.min(z*1.25, 4))} style={{padding:"4px 8px", background:"#475569", color:"white", border:"none", borderRadius:6, cursor:"pointer"}}>＋</button>
          <button onClick={() => setZoom(z => Math.max(z*0.8, 0.3))} style={{padding:"4px 8px", background:"#475569", color:"white", border:"none", borderRadius:6, cursor:"pointer"}}>－</button>
          <button onClick={() => { setZoom(1); setPan({x:80, y:100}); }} style={{padding:"4px 8px", background:"#475569", color:"white", border:"none", borderRadius:6, cursor:"pointer"}}>⊙</button>
          <span style={{color:"#94a3b8", fontSize:11, alignSelf:"center", marginLeft:3}}>{Math.round(zoom*100)}%</span>
        </div>
      </div>

      <div
        style={{overflow:"hidden", cursor:dragging ? "grabbing" : "grab"}}
        onMouseDown={e => { setDragging(true); setLastPos({x:e.clientX, y:e.clientY}); }}
        onMouseUp={() => setDragging(false)}
        onMouseMove={e => {
          if (!dragging) return;
          setPan(p => ({ x: p.x + (e.clientX - lastPos.x), y: p.y + (e.clientY - lastPos.y) }));
          setLastPos({x:e.clientX, y:e.clientY});
        }}
        onMouseLeave={() => setDragging(false)}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} width={940} height={660} style={{display:"block", maxWidth:"100%", userSelect:"none"}} />
      </div>

      <div style={{display:"flex", gap:12, padding:"8px 16px", background:"#f8fafc", borderTop:"1px solid #e2e8f0", fontSize:12, color:"#64748b", flexWrap:"wrap", alignItems:"center"}}>
        <span>📐 {plan.rooms?.length || 0} pièces</span>
        <span>🚪 {plan.doors?.length || 0} portes</span>
        <span>🪟 {plan.windows?.length || 0} fenêtres</span>
        <span>🛋️ {plan.furniture?.length || 0} meubles</span>
        {cost && <span style={{marginLeft:"auto", fontWeight:700, color:"#15803d", fontSize:13}}>💰 {cost.total_cost_formatted}</span>}
      </div>
    </div>
  );
}