import React from "react";
import { DEFAULT_CLUB, PITCHES } from "../lib/constants.js";

function PitchStats({history,club=DEFAULT_CLUB}){
  if(!history.length)return <div style={{fontSize:12,color:"#aaa"}}>No history yet.</div>;
  const usage={};PITCHES.forEach(p=>usage[p.id]=0);
  history.forEach(w=>w.scheduled.forEach(g=>{if(g.pitchId)usage[g.pitchId]=(usage[g.pitchId]||0)+1;}));
  const max=Math.max(...Object.values(usage),1);
  return(
    <div>
      {PITCHES.filter(p=>usage[p.id]>0).map(p=>(
        <div key={p.id} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
            <span><strong>{p.label}</strong> {p.desc}</span><span style={{color:"#888"}}>{usage[p.id]} games</span>
          </div>
          <div style={{height:12,background:"#f0f0f0",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:((usage[p.id]/max)*100)+"%",background:club.primary,borderRadius:4}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PitchStats;