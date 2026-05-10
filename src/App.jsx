import { useState, useEffect, useCallback, useRef } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const api = async (path, method = "GET", body = null) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: method === "POST" ? "return=representation" : "return=minimal" },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
};

// Semantic color tokens — never raw hex in components
const tokens = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  surface2: "#F1F5F9",
  border: "#E2E8F0",
  border2: "#CBD5E1",
  text: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  primary: "#2563EB",
  primaryHover: "#1D4ED8",
  radius: "10px",
  radiusSm: "6px",
  radiusLg: "14px",
};

const STATUS = {
  novo:             { label: "Novo",          dot: "#3B5BDB", bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3", headerBg: "#E0E7FF" },
  mensagem_enviada: { label: "Msg Enviada",   dot: "#D97706", bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", headerBg: "#FEF3C7" },
  respondeu:        { label: "Respondeu",     dot: "#0284C7", bg: "#F0F9FF", border: "#BAE6FD", text: "#075985", headerBg: "#E0F2FE" },
  call_agendada:    { label: "Call Agendada", dot: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", text: "#5B21B6", headerBg: "#EDE9FE" },
  call_realizada:   { label: "Call Realizada",dot: "#0D9488", bg: "#F0FDFA", border: "#99F6E4", text: "#0F766E", headerBg: "#CCFBF1" },
  fechado:          { label: "Fechado",       dot: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D", headerBg: "#DCFCE7" },
  perdido:          { label: "Perdido",       dot: "#DC2626", bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C", headerBg: "#FEE2E2" },
  arquivado:        { label: "Arquivado",     dot: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", text: "#475569", headerBg: "#F1F5F9" },
};

const QUAL = {
  alta:       { label: "Alta",       color: "#15803D", bg: "#DCFCE7", border: "#86EFAC" },
  media_alta: { label: "Média-Alta", color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" },
  media:      { label: "Média",      color: "#B45309", bg: "#FEF3C7", border: "#FCD34D" },
  baixa:      { label: "Baixa",      color: "#B91C1C", bg: "#FEE2E2", border: "#FCA5A5" },
};

const FUNIL = ["novo","mensagem_enviada","respondeu","call_agendada","call_realizada","fechado"];

const G = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;width:100%;overflow-x:hidden}
body{background:#F8FAFC;color:#0F172A;font-family:'Inter',sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:2px}
input,textarea,select{font-family:'Inter',sans-serif;font-size:13px;background:#fff;border:1.5px solid #E2E8F0;color:#0F172A;border-radius:8px;outline:none;transition:border-color .15s,box-shadow .15s;min-height:44px;padding:0 12px}
input:focus,textarea:focus,select:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
textarea{min-height:80px;padding:10px 12px;resize:vertical}
button{font-family:'Inter',sans-serif;cursor:pointer;border:none;transition:all .15s;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500}
button:focus-visible{outline:2px solid #2563EB;outline-offset:2px}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
.card{animation:fadeUp .2s ease}
.panel{animation:slideIn .2s ease}
.drag-over-col{outline:2px dashed #2563EB;outline-offset:-2px;border-radius:10px;background:rgba(37,99,235,.04)!important}
.card-dragging{opacity:.35;transform:scale(.97)}
`;

export default function CRM() {
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState(null);
  const [view,setView]=useState("kanban");
  const [fq,setFq]=useState("todos");
  const [busca,setBusca]=useState("");
  const [hist,setHist]=useState([]);
  const [msg,setMsg]=useState("");
  const [tipo,setTipo]=useState("mensagem_whatsapp");
  const [mnovo,setMnovo]=useState(false);
  const [nlead,setNlead]=useState({nome:"",whatsapp:"",instagram:"",qualificacao:"media",status:"novo"});
  const [salv,setSalv]=useState(false);
  const [err,setErr]=useState(null);
  const dragId=useRef(null);

  const fetchLeads=useCallback(async()=>{
    try{setLoading(true);setErr(null);const d=await api("leads?order=created_at.desc&select=*");setLeads(d||[]);}
    catch(e){setErr(e.message);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{fetchLeads();},[fetchLeads]);

  const fetchHist=async(id)=>{const d=await api(`historico_contatos?lead_id=eq.${id}&order=created_at.desc`);setHist(d||[]);};
  const abrir=async(l)=>{setSel(l);await fetchHist(l.id);};
  const upd=async(id,k,v)=>{
    await api(`leads?id=eq.${id}`,"PATCH",{[k]:v});
    setLeads(p=>p.map(l=>l.id===id?{...l,[k]:v}:l));
    if(sel?.id===id)setSel(p=>({...p,[k]:v}));
  };
  const addHist=async()=>{
    if(!msg.trim()||salv)return;setSalv(true);
    try{await api("historico_contatos","POST",{lead_id:sel.id,tipo,conteudo:msg});await fetchHist(sel.id);setMsg("");}
    finally{setSalv(false);}
  };
  const criar=async()=>{
    if(!nlead.nome.trim()||salv)return;setSalv(true);
    try{await api("leads","POST",nlead);await fetchLeads();setMnovo(false);setNlead({nome:"",whatsapp:"",instagram:"",qualificacao:"media",status:"novo"});}
    finally{setSalv(false);}
  };

  // Drag and drop
  const onDragStart=(e,lead)=>{
    dragId.current=lead.id;
    e.dataTransfer.effectAllowed="move";
    setTimeout(()=>e.target.classList.add("card-dragging"),0);
  };
  const onDragEnd=(e)=>{e.target.classList.remove("card-dragging");};
  const onDragOver=(e,el)=>{e.preventDefault();e.dataTransfer.dropEffect="move";el.classList.add("drag-over-col");};
  const onDragLeave=(e,el)=>{if(!el.contains(e.relatedTarget))el.classList.remove("drag-over-col");};
  const onDrop=async(e,status,el)=>{
    e.preventDefault();el.classList.remove("drag-over-col");
    const id=dragId.current;dragId.current=null;
    if(!id)return;
    const lead=leads.find(l=>l.id===id);
    if(!lead||lead.status===status)return;
    await upd(id,"status",status);
  };

  const lf=leads.filter(l=>(fq==="todos"||l.qualificacao===fq)&&(!busca||l.nome?.toLowerCase().includes(busca.toLowerCase())||l.whatsapp?.includes(busca)));
  const la=lf.filter(l=>l.status!=="arquivado"&&l.status!=="perdido");
  const ps=s=>la.filter(l=>l.status===s);
  const st={total:leads.length,alta:leads.filter(l=>l.qualificacao==="alta").length,calls:leads.filter(l=>["call_agendada","call_realizada"].includes(l.status)).length,fechados:leads.filter(l=>l.status==="fechado").length};

  const Badge=({q})=>q&&QUAL[q]?<span aria-label={`Qualificação: ${QUAL[q].label}`} style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:QUAL[q].bg,color:QUAL[q].color,border:`1px solid ${QUAL[q].border}`,whiteSpace:"nowrap",flexShrink:0,letterSpacing:"0.02em"}}>{QUAL[q].label}</span>:null;

  return(<>
    <style>{G}</style>
    <div style={{width:"100vw",minHeight:"100vh",display:"flex",flexDirection:"column",background:tokens.bg}}>

      {/* Header — sticky, 52px, blur */}
      <header role="banner" style={{borderBottom:`1px solid ${tokens.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,background:"rgba(248,250,252,0.95)",backdropFilter:"blur(12px)",zIndex:40,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:15,fontWeight:700,color:tokens.text,letterSpacing:"-0.015em"}}>FIT Global English</span>
          <span aria-hidden style={{width:1,height:14,background:tokens.border2,display:"inline-block"}}/>
          <span style={{fontSize:10,color:tokens.textTertiary,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>CRM</span>
        </div>
        <nav aria-label="Visualização" style={{display:"flex",gap:4,alignItems:"center"}}>
          {["kanban","lista"].map(v=>(
            <button key={v} onClick={()=>setView(v)} aria-pressed={view===v} style={{padding:"0 16px",height:36,borderRadius:tokens.radiusSm,fontSize:12,fontWeight:600,background:view===v?tokens.surface:"transparent",color:view===v?tokens.text:tokens.textTertiary,border:view===v:`1px solid ${tokens.border2}`:"1px solid transparent",boxShadow:view===v?"0 1px 3px rgba(0,0,0,0.08)":"none",minHeight:36}}>
              {v==="kanban"?"Kanban":"Lista"}
            </button>
          ))}
          <button onClick={()=>setMnovo(true)} aria-label="Adicionar novo lead" style={{padding:"0 18px",height:36,borderRadius:tokens.radiusSm,fontWeight:700,background:tokens.primary,color:"#fff",marginLeft:8,boxShadow:"0 1px 4px rgba(37,99,235,0.35)",minHeight:36}}>
            + Lead
          </button>
        </nav>
      </header>

      {/* Stats — 4 colunas, números grandes */}
      <div role="region" aria-label="Métricas" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:`1px solid ${tokens.border}`,background:tokens.surface,flexShrink:0}}>
        {[
          {l:"Total",v:st.total,s:"leads",a:"#2563EB"},
          {l:"Alta qualidade",v:st.alta,s:"leads",a:"#16A34A"},
          {l:"Calls",v:st.calls,s:"agendadas",a:"#7C3AED"},
          {l:"Fechados",v:st.fechados,s:"alunos",a:"#D97706"},
        ].map((s,i)=>(
          <div key={i} style={{padding:"16px 24px",borderRight:i<3?`1px solid ${tokens.border}`:"none"}}>
            <div style={{fontSize:10,color:tokens.textTertiary,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:4}}>{s.l}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:5}}>
              <span style={{fontSize:28,fontWeight:700,color:s.a,lineHeight:1,letterSpacing:"-0.03em",fontVariantNumeric:"tabular-nums"}}>{s.v}</span>
              <span style={{fontSize:12,color:tokens.textTertiary,fontWeight:400}}>{s.s}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div role="search" style={{display:"flex",gap:8,padding:"10px 24px",alignItems:"center",borderBottom:`1px solid ${tokens.border}`,background:tokens.surface,flexShrink:0,flexWrap:"wrap"}}>
        <label htmlFor="busca" style={{display:"none"}}>Buscar leads</label>
        <input id="busca" type="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome ou WhatsApp..." style={{flex:1,minWidth:200,maxWidth:300,height:36,minHeight:36}}/>
        <div role="group" aria-label="Filtrar por qualificação" style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["todos","alta","media_alta","media","baixa"].map(q=>(
            <button key={q} onClick={()=>setFq(q)} aria-pressed={fq===q} style={{padding:"0 12px",height:32,minHeight:32,borderRadius:20,fontSize:12,fontWeight:600,background:fq===q?(QUAL[q]?.bg||"#DBEAFE"):"transparent",color:fq===q?(QUAL[q]?.color||tokens.primary):tokens.textTertiary,border:fq===q:`1px solid ${QUAL[q]?.border||"#93C5FD"}`:"1px solid transparent"}}>
              {q==="todos"?"Todos":QUAL[q]?.label}
            </button>
          ))}
        </div>
        <button onClick={fetchLeads} aria-label="Atualizar leads" style={{width:36,height:36,minHeight:36,borderRadius:tokens.radiusSm,background:tokens.surface2,color:tokens.textTertiary,border:`1px solid ${tokens.border}`,fontSize:15,padding:0}}>↻</button>
      </div>

      {err&&<div role="alert" style={{padding:"8px 24px",fontSize:12,color:"#B91C1C",background:"#FEF2F2",borderBottom:"1px solid #FECACA",fontWeight:500}}>{err}</div>}

      {loading&&(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${tokens.border2}`,borderTopColor:tokens.primary,animation:"spin 0.8s linear infinite"}}/>
            <span style={{fontSize:12,color:tokens.textTertiary}}>Carregando leads...</span>
          </div>
        </div>
      )}

      {/* Kanban */}
      {!loading&&view==="kanban"&&(
        <main style={{flex:1,display:"flex",overflowX:"auto",padding:"16px 24px",gap:10,alignItems:"flex-start"}}>
          {FUNIL.map(status=>{
            const col=ps(status);const s=STATUS[status];
            return(
              <section key={status} aria-label={`Coluna: ${s.label}`}
                style={{flex:"1 1 0",minWidth:190,display:"flex",flexDirection:"column"}}
                ref={el=>{
                  if(!el)return;
                  el.ondragover=e=>onDragOver(e,el);
                  el.ondragleave=e=>onDragLeave(e,el);
                  el.ondrop=e=>onDrop(e,status,el);
                }}>
                {/* Column header */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,padding:"6px 8px",borderRadius:tokens.radiusSm,background:s.headerBg}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div aria-hidden style={{width:7,height:7,borderRadius:"50%",background:s.dot,flexShrink:0}}/>
                    <span style={{fontSize:11,fontWeight:700,color:s.text,letterSpacing:"0.04em",textTransform:"uppercase"}}>{s.label}</span>
                  </div>
                  <span aria-label={`${col.length} leads`} style={{fontSize:11,color:s.text,background:"rgba(255,255,255,0.7)",padding:"0 7px",borderRadius:10,fontWeight:700,lineHeight:"20px"}}>{col.length}</span>
                </div>
                {/* Cards */}
                <div style={{display:"flex",flexDirection:"column",gap:6,minHeight:60,borderRadius:tokens.radius,padding:2,transition:"background .15s"}}>
                  {col.map(lead=>(
                    <article key={lead.id} className="card"
                      draggable
                      onDragStart={e=>onDragStart(e,lead)}
                      onDragEnd={onDragEnd}
                      onClick={()=>abrir(lead)}
                      tabIndex={0}
                      onKeyDown={e=>e.key==="Enter"&&abrir(lead)}
                      aria-label={`Lead: ${lead.nome}, qualificação ${QUAL[lead.qualificacao]?.label||""}`}
                      style={{background:s.bg,border:`1.5px solid ${s.border}`,borderRadius:tokens.radius,padding:"11px 13px",cursor:"grab",transition:"box-shadow .15s, transform .15s",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:5}}>
                        <span style={{fontSize:13,fontWeight:700,color:tokens.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>{lead.nome||"—"}</span>
                        <Badge q={lead.qualificacao}/>
                      </div>
                      {lead.profissao&&<div style={{fontSize:11,color:s.text,marginBottom:2,fontWeight:600}}>{lead.profissao}</div>}
                      {lead.whatsapp&&<div style={{fontSize:11,color:tokens.textTertiary}}>{lead.whatsapp}</div>}
                      {lead.pais&&lead.pais!=="brasil"&&<div style={{fontSize:10,color:tokens.primary,marginTop:5,fontWeight:700}}>🌍 {lead.pais}</div>}
                    </article>
                  ))}
                  {col.length===0&&<div aria-label="Coluna vazia" style={{fontSize:12,color:tokens.border2,textAlign:"center",padding:"20px 0",border:`1px dashed ${tokens.border}`,borderRadius:tokens.radius,background:"rgba(255,255,255,0.5)"}}>—</div>}
                </div>
              </section>
            );
          })}
        </main>
      )}

      {/* Lista */}
      {!loading&&view==="lista"&&(
        <main style={{flex:1,padding:"16px 24px",overflowY:"auto"}}>
          <div role="table" aria-label="Lista de leads" style={{border:`1px solid ${tokens.border}`,borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",background:tokens.surface}}>
            <div role="row" style={{display:"grid",gridTemplateColumns:"2fr 1fr 100px 140px 1fr",padding:"9px 18px",borderBottom:`1px solid ${tokens.border}`,background:tokens.surface2}}>
              {["Nome","Profissão","Qualidade","Status","WhatsApp"].map(h=><span key={h} role="columnheader" style={{fontSize:10,fontWeight:700,color:tokens.textTertiary,textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</span>)}
            </div>
            {lf.map((lead,i)=>(
              <div key={lead.id} role="row" className="card" onClick={()=>abrir(lead)} tabIndex={0} onKeyDown={e=>e.key==="Enter"&&abrir(lead)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 100px 140px 1fr",padding:"11px 18px",borderBottom:i<lf.length-1:`1px solid ${tokens.border}`:"none",cursor:"pointer",alignItems:"center",background:tokens.surface,transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=tokens.surface2} onMouseLeave={e=>e.currentTarget.style.background=tokens.surface}>
                <span style={{fontSize:13,fontWeight:700,color:tokens.text}}>{lead.nome}</span>
                <span style={{fontSize:12,color:tokens.textSecondary}}>{lead.profissao||"—"}</span>
                <Badge q={lead.qualificacao}/>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div aria-hidden style={{width:6,height:6,borderRadius:"50%",background:STATUS[lead.status]?.dot,flexShrink:0}}/>
                  <span style={{fontSize:12,color:tokens.textSecondary}}>{STATUS[lead.status]?.label}</span>
                </div>
                <span style={{fontSize:12,color:tokens.textTertiary}}>{lead.whatsapp||"—"}</span>
              </div>
            ))}
            {lf.length===0&&<div style={{padding:40,textAlign:"center",color:tokens.textTertiary,fontSize:13}}>Nenhum lead encontrado</div>}
          </div>
        </main>
      )}

      {/* Painel 45vw */}
      {sel&&(
        <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",justifyContent:"flex-end"}} onClick={()=>setSel(null)}>
          <div aria-hidden style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.25)",backdropFilter:"blur(3px)"}}/>
          <aside className="panel" role="complementary" aria-label={`Detalhes: ${sel.nome}`} onClick={e=>e.stopPropagation()} style={{width:"45vw",minWidth:420,height:"100%",overflowY:"auto",background:tokens.surface,borderLeft:`1px solid ${tokens.border}`,position:"relative",zIndex:1,boxShadow:"-12px 0 48px rgba(0,0,0,0.1)"}}>
            <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${tokens.border}`,position:"sticky",top:0,background:tokens.surface,zIndex:2}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:700,color:tokens.text,marginBottom:3,letterSpacing:"-0.015em",lineHeight:1.3}}>{sel.nome}</h2>
                  <p style={{fontSize:12,color:tokens.textTertiary,margin:0}}>{sel.profissao||"Profissão não informada"}{sel.pais&&sel.pais!=="brasil"?` · ${sel.pais}`:""}</p>
                </div>
                <button onClick={()=>setSel(null)} aria-label="Fechar painel" style={{background:tokens.surface2,border:`1px solid ${tokens.border}`,color:tokens.textSecondary,width:32,height:32,minHeight:32,borderRadius:8,fontSize:14,padding:0,flexShrink:0}}>✕</button>
              </div>
            </div>
            <div style={{padding:24,display:"flex",flexDirection:"column",gap:20}}>

              <fieldset style={{border:"none",padding:0}}>
                <legend style={{fontSize:10,fontWeight:700,color:tokens.textTertiary,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Qualificação</legend>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {Object.entries(QUAL).map(([k,v])=>(
                    <button key={k} onClick={()=>upd(sel.id,"qualificacao",k)} aria-pressed={sel.qualificacao===k} style={{padding:"0 14px",height:32,minHeight:32,borderRadius:20,fontSize:12,fontWeight:700,background:sel.qualificacao===k?v.bg:"transparent",color:sel.qualificacao===k?v.color:tokens.textTertiary,border:sel.qualificacao===k:`1.5px solid ${v.border}`:`1px solid ${tokens.border}`}}>{v.label}</button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="status-select" style={{display:"block",fontSize:10,fontWeight:700,color:tokens.textTertiary,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Status no funil</label>
                <select id="status-select" value={sel.status} onChange={e=>upd(sel.id,"status",e.target.value)} style={{width:"100%",height:44}}>
                  {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div style={{background:tokens.surface2,borderRadius:tokens.radius,padding:16,border:`1px solid ${tokens.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:tokens.textTertiary,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Dados do formulário</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  {[["WhatsApp",sel.whatsapp],["Instagram",sel.instagram],["Objetivo",sel.objetivo],["Nível",sel.nivel?.replace("nivel_","Nível ")],["País",sel.pais],["Investir",sel.disposto_investir],["Dias",sel.dias_disponiveis?.join(", ")],["Horários",sel.horarios_disponiveis?.join(", ")]].filter(([,v])=>v).map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontSize:10,color:tokens.textTertiary,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                      <div style={{fontSize:13,color:tokens.text,fontWeight:500}}>{v}</div>
                    </div>
                  ))}
                </div>
                {[["Bloqueio",sel.bloqueio],["Por que aprender",sel.motivo_aprender],["O que mudaria",sel.o_que_mudaria],["Chamou atenção",sel.chamou_atencao],["Info extra",sel.info_adicional]].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${tokens.border}`}}>
                    <div style={{fontSize:10,color:tokens.textTertiary,fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                    <div style={{fontSize:13,color:tokens.textSecondary,lineHeight:1.6}}>{v}</div>
                  </div>
                ))}
              </div>

              <div>
                <label htmlFor="obs" style={{display:"block",fontSize:10,fontWeight:700,color:tokens.textTertiary,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Observações</label>
                <textarea id="obs" defaultValue={sel.observacoes_qualificacao||""} onBlur={e=>upd(sel.id,"observacoes_qualificacao",e.target.value)} placeholder="Anotações sobre esse lead..."/>
              </div>

              <div>
                <div style={{fontSize:10,fontWeight:700,color:tokens.textTertiary,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Histórico de contato</div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  <label htmlFor="tipo-hist" style={{display:"none"}}>Tipo</label>
                  <select id="tipo-hist" value={tipo} onChange={e=>setTipo(e.target.value)} style={{height:40,minHeight:40,padding:"0 10px",flexShrink:0,width:"auto"}}>
                    <option value="mensagem_whatsapp">WhatsApp</option>
                    <option value="resposta_lead">Resposta</option>
                    <option value="call">Call</option>
                    <option value="anotacao">Nota</option>
                  </select>
                  <label htmlFor="msg-hist" style={{display:"none"}}>Mensagem</label>
                  <input id="msg-hist" value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Registrar contato..." onKeyDown={e=>e.key==="Enter"&&addHist()} style={{flex:1,height:40,minHeight:40}}/>
                  <button onClick={addHist} disabled={salv||!msg.trim()} aria-label="Adicionar registro" style={{width:40,height:40,minHeight:40,borderRadius:tokens.radiusSm,background:tokens.primary,color:"#fff",fontSize:18,padding:0,opacity:salv||!msg.trim()?0.5:1,flexShrink:0}}>+</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:260,overflowY:"auto"}}>
                  {hist.map(h=>(
                    <div key={h.id} style={{padding:"10px 12px",background:tokens.surface2,borderRadius:8,border:`1px solid ${tokens.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:10,color:tokens.primary,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h.tipo?.replace(/_/g," ")}</span>
                        <time style={{fontSize:10,color:tokens.textTertiary}}>{new Date(h.created_at).toLocaleDateString("pt-BR")}</time>
                      </div>
                      <p style={{fontSize:13,color:tokens.textSecondary,lineHeight:1.5,margin:0}}>{h.conteudo}</p>
                    </div>
                  ))}
                  {hist.length===0&&<div style={{fontSize:12,color:tokens.textTertiary,textAlign:"center",padding:16}}>Nenhum contato registrado</div>}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Modal novo lead */}
      {mnovo&&(
        <div role="dialog" aria-modal="true" aria-label="Novo lead" style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.45)",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={()=>setMnovo(false)}>
          <div className="card" onClick={e=>e.stopPropagation()} style={{background:tokens.surface,border:`1px solid ${tokens.border}`,borderRadius:tokens.radiusLg,padding:28,width:400,boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:20,color:tokens.text,letterSpacing:"-0.01em"}}>Novo Lead</h3>
            {[["Nome completo","nome","text"],["WhatsApp","whatsapp","tel"],["Instagram","instagram","text"]].map(([label,field,type])=>(
              <div key={field} style={{marginBottom:14}}>
                <label htmlFor={`new-${field}`} style={{display:"block",fontSize:11,color:tokens.textSecondary,marginBottom:5,fontWeight:600}}>{label}</label>
                <input id={`new-${field}`} type={type} value={nlead[field]} onChange={e=>setNlead(p=>({...p,[field]:e.target.value}))} style={{width:"100%",height:44}}/>
              </div>
            ))}
            <div style={{marginBottom:20}}>
              <label htmlFor="new-qual" style={{display:"block",fontSize:11,color:tokens.textSecondary,marginBottom:5,fontWeight:600}}>Qualificação</label>
              <select id="new-qual" value={nlead.qualificacao} onChange={e=>setNlead(p=>({...p,qualificacao:e.target.value}))} style={{width:"100%",height:44}}>
                {Object.entries(QUAL).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setMnovo(false)} style={{padding:"0 18px",height:40,minHeight:40,borderRadius:tokens.radiusSm,background:"transparent",border:`1px solid ${tokens.border}`,color:tokens.textSecondary,fontWeight:500}}>Cancelar</button>
              <button onClick={criar} disabled={salv||!nlead.nome.trim()} style={{padding:"0 22px",height:40,minHeight:40,borderRadius:tokens.radiusSm,background:tokens.primary,color:"#fff",fontWeight:700,opacity:salv||!nlead.nome.trim()?0.5:1}}>Criar lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </>);
}