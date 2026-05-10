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

const STATUS = {
  novo:             { label: "Novo",          dot: "#3B5BDB", bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3" },
  mensagem_enviada: { label: "Msg Enviada",   dot: "#D97706", bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  respondeu:        { label: "Respondeu",     dot: "#0284C7", bg: "#F0F9FF", border: "#BAE6FD", text: "#075985" },
  call_agendada:    { label: "Call Agendada", dot: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", text: "#5B21B6" },
  call_realizada:   { label: "Call Realizada",dot: "#0D9488", bg: "#F0FDFA", border: "#99F6E4", text: "#0F766E" },
  fechado:          { label: "Fechado",       dot: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  perdido:          { label: "Perdido",       dot: "#DC2626", bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
  arquivado:        { label: "Arquivado",     dot: "#94A3B8", bg: "#F8FAFC", border: "#E2E8F0", text: "#64748B" },
};

const QUAL = {
  alta:       { label: "Alta",       color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  media_alta: { label: "Média-Alta", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  media:      { label: "Média",      color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  baixa:      { label: "Baixa",      color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

const FUNIL = ["novo","mensagem_enviada","respondeu","call_agendada","call_realizada","fechado"];

const G = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;width:100%;overflow-x:hidden}
body{background:#F1F5F9;color:#0F172A;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:2px}
input,textarea,select{font-family:'Inter',sans-serif;background:#fff;border:1px solid #E2E8F0;color:#0F172A;border-radius:8px;outline:none;transition:border-color .2s,box-shadow .2s}
input:focus,textarea:focus,select:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
button{font-family:'Inter',sans-serif;cursor:pointer;border:none;transition:all .15s}
@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes si{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.c{animation:fi .2s ease}
.p{animation:si .18s ease}
.drag-over{outline:2px dashed #2563EB;outline-offset:2px;background:#EFF6FF !important}
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

  const onDragStart=(e,lead)=>{
    dragId.current=lead.id;
    e.dataTransfer.effectAllowed="move";
    e.currentTarget.style.opacity="0.4";
  };
  const onDragEnd=(e)=>{e.currentTarget.style.opacity="1";};
  const onDragOver=(e,el)=>{e.preventDefault();el.classList.add("drag-over");};
  const onDragLeave=(e,el)=>{el.classList.remove("drag-over");};
  const onDrop=async(e,status,el)=>{
    e.preventDefault();
    el.classList.remove("drag-over");
    if(!dragId.current)return;
    const lead=leads.find(l=>l.id===dragId.current);
    if(!lead||lead.status===status)return;
    dragId.current=null;
    await upd(lead.id,"status",status);
  };

  const lf=leads.filter(l=>(fq==="todos"||l.qualificacao===fq)&&(!busca||l.nome?.toLowerCase().includes(busca.toLowerCase())||l.whatsapp?.includes(busca)));
  const la=lf.filter(l=>l.status!=="arquivado"&&l.status!=="perdido");
  const ps=s=>la.filter(l=>l.status===s);
  const st={total:leads.length,alta:leads.filter(l=>l.qualificacao==="alta").length,calls:leads.filter(l=>["call_agendada","call_realizada"].includes(l.status)).length,fechados:leads.filter(l=>l.status==="fechado").length};
  const badge=(q)=>q&&QUAL[q]?<span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:QUAL[q].bg,color:QUAL[q].color,border:`1px solid ${QUAL[q].border}`,whiteSpace:"nowrap",flexShrink:0}}>{QUAL[q].label}</span>:null;

  return(<>
    <style>{G}</style>
    <div style={{width:"100vw",minHeight:"100vh",display:"flex",flexDirection:"column",background:"#F1F5F9",overflowX:"hidden"}}>

      <header style={{borderBottom:"1px solid #E2E8F0",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,background:"rgba(241,245,249,0.97)",backdropFilter:"blur(12px)",zIndex:40,flexShrink:0,width:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:15,fontWeight:700,color:"#0F172A",letterSpacing:"-0.01em"}}>FIT Global English</span>
          <span style={{width:1,height:14,background:"#CBD5E1",display:"inline-block"}}/>
          <span style={{fontSize:11,color:"#94A3B8",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>CRM</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {["kanban","lista"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"5px 14px",borderRadius:6,fontSize:12,fontWeight:500,background:view===v?"#fff":"transparent",color:view===v?"#0F172A":"#94A3B8",border:view===v?"1px solid #E2E8F0":"1px solid transparent",boxShadow:view===v?"0 1px 3px rgba(0,0,0,0.06)":"none"}}>
              {v==="kanban"?"Kanban":"Lista"}
            </button>
          ))}
          <button onClick={()=>setMnovo(true)} style={{padding:"5px 16px",borderRadius:6,fontSize:12,fontWeight:600,background:"#2563EB",color:"#fff",marginLeft:6,boxShadow:"0 1px 4px rgba(37,99,235,0.3)"}}>+ Lead</button>
        </div>
      </header>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:"1px solid #E2E8F0",background:"#fff",flexShrink:0,width:"100%"}}>
        {[{l:"Total",v:st.total,s:"leads",a:"#2563EB"},{l:"Alta qualidade",v:st.alta,s:"leads",a:"#16A34A"},{l:"Calls",v:st.calls,s:"agendadas",a:"#7C3AED"},{l:"Fechados",v:st.fechados,s:"alunos",a:"#D97706"}].map((s,i)=>(
          <div key={i} style={{padding:"18px 24px",borderRight:i<3?"1px solid #E2E8F0":"none"}}>
            <div style={{fontSize:10,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:6}}>{s.l}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:5}}>
              <span style={{fontSize:30,fontWeight:700,color:s.a,lineHeight:1,letterSpacing:"-0.02em"}}>{s.v}</span>
              <span style={{fontSize:12,color:"#94A3B8"}}>{s.s}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:8,padding:"10px 24px",alignItems:"center",borderBottom:"1px solid #E2E8F0",background:"#fff",flexShrink:0,width:"100%",flexWrap:"wrap"}}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome ou WhatsApp..." style={{flex:1,minWidth:200,maxWidth:300,padding:"6px 12px",fontSize:13}}/>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["todos","alta","media_alta","media","baixa"].map(q=>(
            <button key={q} onClick={()=>setFq(q)} style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:500,background:fq===q?(QUAL[q]?.bg||"#EFF6FF"):"transparent",color:fq===q?(QUAL[q]?.color||"#2563EB"):"#94A3B8",border:fq===q?`1px solid ${QUAL[q]?.border||"#BFDBFE"}`:"1px solid transparent"}}>
              {q==="todos"?"Todos":QUAL[q]?.label}
            </button>
          ))}
        </div>
        <button onClick={fetchLeads} style={{padding:"5px 10px",borderRadius:8,background:"#F8FAFC",color:"#94A3B8",fontSize:14,border:"1px solid #E2E8F0"}}>↻</button>
      </div>

      {err&&<div style={{padding:"8px 24px",fontSize:12,color:"#DC2626",background:"#FEF2F2",borderBottom:"1px solid #FECACA"}}>{err}</div>}
      {loading&&<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:13,color:"#94A3B8"}}>Carregando leads...</span></div>}

      {!loading&&view==="kanban"&&(
        <div style={{flex:1,display:"flex",overflowX:"auto",padding:"16px 24px",gap:10,alignItems:"flex-start",width:"100%"}}>
          {FUNIL.map(status=>{
            const col=ps(status);const s=STATUS[status];
            return(
              <div key={status} style={{flex:"1 1 0",minWidth:190,display:"flex",flexDirection:"column"}}
                ref={el=>{
                  if(!el)return;
                  el.ondragover=(e)=>onDragOver(e,el);
                  el.ondragleave=(e)=>onDragLeave(e,el);
                  el.ondrop=(e)=>onDrop(e,status,el);
                }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:s.dot}}/>
                    <span style={{fontSize:11,fontWeight:600,color:"#475569",letterSpacing:"0.04em",textTransform:"uppercase"}}>{s.label}</span>
                  </div>
                  <span style={{fontSize:11,color:"#94A3B8",background:"#F1F5F9",padding:"1px 7px",borderRadius:10,border:"1px solid #E2E8F0",fontWeight:500}}>{col.length}</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,minHeight:60,borderRadius:10,padding:4,transition:"all .2s"}}>
                  {col.map(lead=>(
                    <div key={lead.id} className="c"
                      draggable={true}
                      onDragStart={e=>onDragStart(e,lead)}
                      onDragEnd={onDragEnd}
                      onClick={()=>abrir(lead)}
                      style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:10,padding:"11px 13px",cursor:"grab",transition:"box-shadow .15s",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:4}}>
                        <span style={{fontSize:13,fontWeight:600,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>{lead.nome||"—"}</span>
                        {badge(lead.qualificacao)}
                      </div>
                      {lead.profissao&&<div style={{fontSize:11,color:s.text,marginBottom:2,fontWeight:500}}>{lead.profissao}</div>}
                      {lead.whatsapp&&<div style={{fontSize:11,color:"#94A3B8"}}>{lead.whatsapp}</div>}
                      {lead.pais&&lead.pais!=="brasil"&&<div style={{fontSize:10,color:"#2563EB",marginTop:4,fontWeight:600}}>🌍 {lead.pais}</div>}
                    </div>
                  ))}
                  {col.length===0&&<div style={{fontSize:12,color:"#CBD5E1",textAlign:"center",padding:"16px 0",border:"1px dashed #E2E8F0",borderRadius:10,background:"rgba(255,255,255,0.5)"}}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading&&view==="lista"&&(
        <div style={{flex:1,padding:"16px 24px",overflowY:"auto",width:"100%"}}>
          <div style={{border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",background:"#fff"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 100px 140px 1fr",padding:"9px 18px",borderBottom:"1px solid #E2E8F0",background:"#F8FAFC"}}>
              {["Nome","Profissão","Qualidade","Status","WhatsApp"].map(h=><span key={h} style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</span>)}
            </div>
            {lf.map((lead,i)=>(
              <div key={lead.id} className="c" onClick={()=>abrir(lead)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 100px 140px 1fr",padding:"11px 18px",borderBottom:i<lf.length-1?"1px solid #F1F5F9":"none",cursor:"pointer",alignItems:"center",background:"#fff",transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                <span style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{lead.nome}</span>
                <span style={{fontSize:12,color:"#475569"}}>{lead.profissao||"—"}</span>
                {badge(lead.qualificacao)}
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:STATUS[lead.status]?.dot,flexShrink:0}}/>
                  <span style={{fontSize:12,color:"#475569"}}>{STATUS[lead.status]?.label}</span>
                </div>
                <span style={{fontSize:12,color:"#94A3B8"}}>{lead.whatsapp||"—"}</span>
              </div>
            ))}
            {lf.length===0&&<div style={{padding:40,textAlign:"center",color:"#94A3B8",fontSize:13}}>Nenhum lead encontrado</div>}
          </div>
        </div>
      )}

      {sel&&(
        <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",justifyContent:"flex-end"}} onClick={()=>setSel(null)}>
          <div style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.2)",backdropFilter:"blur(2px)"}}/>
          <div className="p" onClick={e=>e.stopPropagation()} style={{width:"45vw",minWidth:400,height:"100%",overflowY:"auto",background:"#fff",borderLeft:"1px solid #E2E8F0",position:"relative",zIndex:1,boxShadow:"-8px 0 40px rgba(0,0,0,0.1)"}}>
            <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #E2E8F0",position:"sticky",top:0,background:"#fff",zIndex:2}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:3,letterSpacing:"-0.01em"}}>{sel.nome}</h2>
                  <div style={{fontSize:12,color:"#94A3B8"}}>{sel.profissao||"Profissão não informada"}{sel.pais&&sel.pais!=="brasil"?` · ${sel.pais}`:""}</div>
                </div>
                <button onClick={()=>setSel(null)} style={{background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#475569",width:28,height:28,borderRadius:8,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            </div>
            <div style={{padding:24,display:"flex",flexDirection:"column",gap:18}}>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Qualificação</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {Object.entries(QUAL).map(([k,v])=>(
                    <button key={k} onClick={()=>upd(sel.id,"qualificacao",k)} style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:600,background:sel.qualificacao===k?v.bg:"transparent",color:sel.qualificacao===k?v.color:"#94A3B8",border:sel.qualificacao===k?`1px solid ${v.border}`:"1px solid #E2E8F0"}}>{v.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Status no funil</div>
                <select value={sel.status} onChange={e=>upd(sel.id,"status",e.target.value)} style={{width:"100%",padding:"8px 12px",fontSize:13,borderRadius:8}}>
                  {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{background:"#F8FAFC",borderRadius:10,padding:16,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Dados do formulário</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {[["WhatsApp",sel.whatsapp],["Instagram",sel.instagram],["Objetivo",sel.objetivo],["Nível",sel.nivel?.replace("nivel_","Nível ")],["País",sel.pais],["Investir",sel.disposto_investir],["Dias",sel.dias_disponiveis?.join(", ")],["Horários",sel.horarios_disponiveis?.join(", ")]].filter(([,v])=>v).map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                      <div style={{fontSize:12,color:"#0F172A",fontWeight:500}}>{v}</div>
                    </div>
                  ))}
                </div>
                {[["Bloqueio",sel.bloqueio],["Por que aprender",sel.motivo_aprender],["O que mudaria",sel.o_que_mudaria],["Chamou atenção",sel.chamou_atencao],["Info extra",sel.info_adicional]].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} style={{marginTop:12,paddingTop:12,borderTop:"1px solid #E2E8F0"}}>
                    <div style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                    <div style={{fontSize:12,color:"#475569",lineHeight:1.6}}>{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Observações</div>
                <textarea defaultValue={sel.observacoes_qualificacao||""} onBlur={e=>upd(sel.id,"observacoes_qualificacao",e.target.value)} placeholder="Anotações sobre esse lead..." style={{width:"100%",padding:"10px 12px",fontSize:13,borderRadius:8,resize:"vertical",minHeight:72,lineHeight:1.6}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Histórico de contato</div>
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  <select value={tipo} onChange={e=>setTipo(e.target.value)} style={{padding:"6px 10px",fontSize:12,borderRadius:8,flexShrink:0}}>
                    <option value="mensagem_whatsapp">WhatsApp</option>
                    <option value="resposta_lead">Resposta</option>
                    <option value="call">Call</option>
                    <option value="anotacao">Nota</option>
                  </select>
                  <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Registrar contato..." onKeyDown={e=>e.key==="Enter"&&addHist()} style={{flex:1,padding:"6px 10px",fontSize:13,borderRadius:8}}/>
                  <button onClick={addHist} disabled={salv} style={{padding:"6px 14px",borderRadius:8,background:"#2563EB",color:"#fff",fontSize:13,fontWeight:600,opacity:salv?0.6:1}}>+</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:240,overflowY:"auto"}}>
                  {hist.map(h=>(
                    <div key={h.id} style={{padding:"9px 12px",background:"#F8FAFC",borderRadius:8,border:"1px solid #E2E8F0"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:10,color:"#2563EB",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h.tipo?.replace(/_/g," ")}</span>
                        <span style={{fontSize:10,color:"#94A3B8"}}>{new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div style={{fontSize:12,color:"#475569",lineHeight:1.5}}>{h.conteudo}</div>
                    </div>
                  ))}
                  {hist.length===0&&<div style={{fontSize:12,color:"#94A3B8",textAlign:"center",padding:14}}>Nenhum contato registrado</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mnovo&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.4)",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={()=>setMnovo(false)}>
          <div className="c" onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:28,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:20,color:"#0F172A",letterSpacing:"-0.01em"}}>Novo Lead</h3>
            {[["Nome completo","nome"],["WhatsApp","whatsapp"],["Instagram","instagram"]].map(([label,field])=>(
              <div key={field} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#64748B",marginBottom:5,fontWeight:500}}>{label}</div>
                <input value={nlead[field]} onChange={e=>setNlead(p=>({...p,[field]:e.target.value}))} style={{width:"100%",padding:"8px 12px",fontSize:13,borderRadius:8}}/>
              </div>
            ))}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:"#64748B",marginBottom:5,fontWeight:500}}>Qualificação</div>
              <select value={nlead.qualificacao} onChange={e=>setNlead(p=>({...p,qualificacao:e.target.value}))} style={{width:"100%",padding:"8px 12px",fontSize:13,borderRadius:8}}>
                {Object.entries(QUAL).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setMnovo(false)} style={{padding:"7px 16px",borderRadius:8,background:"transparent",border:"1px solid #E2E8F0",color:"#475569",fontSize:13,fontWeight:500}}>Cancelar</button>
              <button onClick={criar} disabled={salv||!nlead.nome.trim()} style={{padding:"7px 20px",borderRadius:8,background:"#2563EB",color:"#fff",fontSize:13,fontWeight:600,opacity:salv?0.6:1}}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>);
}