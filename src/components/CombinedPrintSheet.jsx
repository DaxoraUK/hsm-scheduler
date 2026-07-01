import React from "react";
import { DEFAULT_CLUB, PITCHES, PU, RE } from "../lib/constants.js";
import { cleanName } from "../lib/scheduler.js";

function CombinedPrintSheet({satGames,sunGames,sunScheduled,satDateLabel,sunDateLabel,useAstro,refWarnings,startHour,startMin,endHour,endMin,club=DEFAULT_CLUB}){
  const satActive=satGames.filter(g=>g.status!=="postponed");
  const satPostponed=satGames.filter(g=>g.status==="postponed");
  const sunActive=sunGames.filter(g=>g.status!=="postponed");
  const sh=String(startHour).padStart(2,"0")+":"+String(startMin).padStart(2,"0");
  const eh=String(endHour).padStart(2,"0")+":"+String(endMin).padStart(2,"0");
  const tableHdr={background:club.primary,color:"#fff"};
  const thStyle={padding:"6px 8px",textAlign:"left",fontWeight:600,fontSize:11};
  const cols=["KO","HSM Team","Opposition","Pitch","Format","Referee / Contact"];
  const renderRow=(f,i)=>{
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
        <td style={{padding:"6px 8px",color:refCol}}>{ref}</td>
      </tr>
    );
  };
  return(
    <div id="combined-print" style={{padding:"20px 24px",fontFamily:"Arial,sans-serif",fontSize:12}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"3px solid "+club.primary,paddingBottom:10,marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:club.primary}}>{club.name}</div>
          <div style={{fontSize:13,color:"#555"}}>Matchday Schedule</div>
        </div>
        <div style={{textAlign:"right",fontSize:11,color:"#888"}}>
          <div>{club.venue}</div>
          <div>Printed {new Date().toLocaleDateString("en-GB")}</div>
        </div>
      </div>

      {/* Saturday section */}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:700,color:club.primary}}>Saturday - {satDateLabel}</div>
          <div style={{fontSize:11,color:"#888"}}>{satActive.length} fixture{satActive.length!==1?"s":""}{useAstro?" - Astro active":""}</div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:8}}>
          <thead><tr style={tableHdr}>{cols.map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>{satActive.map((f,i)=>renderRow(f,i))}</tbody>
        </table>
        {satPostponed.length>0&&(
          <div style={{padding:"6px 10px",background:"#fff8e1",border:"1px solid #ffe082",borderRadius:4,fontSize:11,marginBottom:6}}>
            Postponed: {satPostponed.map(f=>cleanName(f.homeTeam,club.name)+" vs "+f.awayTeam).join(", ")}
          </div>
        )}
        {refWarnings>0&&(
          <div style={{padding:"6px 10px",background:"#fdecea",border:"1px solid #f5c6cb",borderRadius:4,fontSize:11,color:RE}}>
            {refWarnings} fixture{refWarnings>1?"s":""} without confirmed referee
          </div>
        )}
        <div style={{fontSize:10,color:"#aaa",marginTop:6}}>Max 3 concurrent (ex 3v3) - Youth KO {sh}-{eh} - Adults 14:00</div>
      </div>

      {/* Divider */}
      <div style={{borderTop:"2px dashed #ccc",marginBottom:20}}/>

      {/* Sunday section */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:700,color:club.primary}}>Sunday - {sunDateLabel}</div>
          {!sunScheduled&&(
            <div style={{fontSize:11,fontWeight:700,color:RE,background:"#fdecea",border:"1px solid #f5c6cb",borderRadius:4,padding:"4px 10px"}}>
              WARNING - Sunday fixtures not yet scheduled
            </div>
          )}
          {sunScheduled&&<div style={{fontSize:11,color:"#888"}}>{sunActive.length} fixture{sunActive.length!==1?"s":""}</div>}
        </div>
        {sunActive.length>0?(
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={tableHdr}>{cols.map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>{sunActive.map((f,i)=>renderRow(f,i))}</tbody>
          </table>
        ):(
          <div style={{padding:"12px",background:"#f5f5f5",borderRadius:4,fontSize:12,color:"#888",textAlign:"center"}}>
            {sunScheduled?"No Sunday fixtures this week.":"Sunday schedule not yet run - please schedule Sunday fixtures before printing."}
          </div>
        )}
      </div>
    </div>
  );
}

export default CombinedPrintSheet;