import React from "react";
import { DEFAULT_CLUB, PITCHES, PU, RE } from "../lib/constants.js";
import { cleanName } from "../lib/scheduler.js";

function SatPrintSheet({games,dateLabel,useAstro,refWarnings,startHour,startMin,endHour,endMin,club=DEFAULT_CLUB}){
  const active=games.filter(g=>g.status!=="postponed");
  const postponed=games.filter(g=>g.status==="postponed");
  const sh=String(startHour).padStart(2,"0")+":"+String(startMin).padStart(2,"0");
  const eh=String(endHour).padStart(2,"0")+":"+String(endMin).padStart(2,"0");
  return(
    <div id="sat-print" style={{padding:"20px 24px",fontFamily:"Arial,sans-serif",fontSize:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"3px solid "+club.primary,paddingBottom:10,marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:club.primary}}>{club.name}</div>
          <div style={{fontSize:13,color:"#555"}}>Saturday Schedule - {dateLabel}</div>
        </div>
        <div style={{textAlign:"right",fontSize:11,color:"#888"}}>
          <div>{active.length} fixture{active.length!==1?"s":""}{useAstro?" - Astro active":""}</div>
          <div>{club.venue}</div>
        </div>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:16}}>
        <thead>
          <tr style={{background:club.primary,color:"#fff"}}>
            {["KO","HSM Team","Opposition","Pitch","Format","Referee / Contact"].map(h=>(
              <th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((f,i)=>{
            const ref=f.referee?(f.referee+(f.refPhone?" - "+f.refPhone:"")):(f.refStatus==="TBC"?"TBC":"Awaiting");
            const refCol=!f.referee?"#c0392b":"#000";
            return(
              <tr key={i} style={{background:i%2===0?"#fff":"#f5f5f5"}}>
                <td style={{padding:"6px 8px",fontWeight:700,color:club.primary,whiteSpace:"nowrap"}}>
                  {f.koTime}{f.isCup&&<span style={{marginLeft:4,fontSize:9,background:PU,color:"#fff",borderRadius:2,padding:"1px 4px"}}>CUP</span>}
                </td>
                <td style={{padding:"6px 8px",fontWeight:600}}>{cleanName(f.homeTeam,club.name)}</td>
                <td style={{padding:"6px 8px"}}>{f.awayTeam}</td>
                <td style={{padding:"6px 8px"}}>{PITCHES.find(p=>p.id===f.pitchId)?.label||f.pitchId}</td>
                <td style={{padding:"6px 8px"}}>{f.cfg?.format||"-"}</td>
                <td style={{padding:"6px 8px",color:refCol,fontWeight:ref==="TBC"||ref==="Awaiting"?700:400}}>{ref}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {postponed.length>0&&(
        <div style={{marginBottom:12,padding:"8px 10px",background:"#fff8e1",border:"1px solid #ffe082",borderRadius:4}}>
          <strong>Postponed:</strong> {postponed.map(f=>cleanName(f.homeTeam,club.name)+" vs "+f.awayTeam).join(", ")}
        </div>
      )}
      {refWarnings>0&&(
        <div style={{marginBottom:12,padding:"8px 10px",background:"#fdecea",border:"1px solid #f5c6cb",borderRadius:4,color:RE}}>
          {refWarnings} fixture{refWarnings>1?"s":""} without confirmed referee - chase before Friday
        </div>
      )}
      <div style={{marginTop:8,fontSize:10,color:"#aaa",borderTop:"1px solid #eee",paddingTop:8,display:"flex",justifyContent:"space-between"}}>
        <span>Max 3 concurrent (ex 3v3) - Youth {sh}-{eh} - Adults 14:00</span>
        <span>Printed {new Date().toLocaleDateString("en-GB")}</span>
      </div>
    </div>
  );
}

export default SatPrintSheet;