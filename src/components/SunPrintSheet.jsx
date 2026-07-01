import React from "react";
import { DEFAULT_CLUB, PITCHES } from "../lib/constants.js";
import { cleanName } from "../lib/scheduler.js";

function SunPrintSheet({games,dateLabel,club=DEFAULT_CLUB}){
  const active=games.filter(g=>g.status!=="postponed");
  if(!active.length)return null;
  return(
    <div id="sun-print" style={{padding:"20px 24px",fontFamily:"Arial,sans-serif",fontSize:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"3px solid "+club.primary,paddingBottom:10,marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:club.primary}}>{club.name}</div>
          <div style={{fontSize:13,color:"#555"}}>Sunday Schedule - {dateLabel}</div>
        </div>
        <div style={{textAlign:"right",fontSize:11,color:"#888"}}><div>{active.length} fixture{active.length!==1?"s":""}</div><div>{club.venue}</div></div>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{background:club.primary,color:"#fff"}}>{["KO","HSM Team","Opposition","Pitch","Format","Referee / Contact"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600}}>{h}</th>)}</tr></thead>
        <tbody>
          {active.map((f,i)=>{
            const ref=f.referee?(f.referee+(f.refPhone?" - "+f.refPhone:"")):(f.refStatus==="TBC"?"TBC":"Awaiting");
            return(
              <tr key={i} style={{background:i%2===0?"#fff":"#f5f5f5"}}>
                <td style={{padding:"6px 8px",fontWeight:700,color:club.primary}}>{f.koTime}</td>
                <td style={{padding:"6px 8px",fontWeight:600}}>{cleanName(f.homeTeam,club.name)}</td>
                <td style={{padding:"6px 8px"}}>{f.awayTeam}</td>
                <td style={{padding:"6px 8px"}}>{PITCHES.find(p=>p.id===f.pitchId)?.label||f.pitchId}</td>
                <td style={{padding:"6px 8px"}}>{f.cfg?.format||"-"}</td>
                <td style={{padding:"6px 8px",color:(!f.referee)?"#c0392b":"#000"}}>{ref}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{marginTop:16,fontSize:10,color:"#aaa",borderTop:"1px solid #eee",paddingTop:8,display:"flex",justifyContent:"space-between"}}>
        <span>{club.name} - Sunday Fixtures</span>
        <span>Printed {new Date().toLocaleDateString("en-GB")}</span>
      </div>
    </div>
  );
}

export default SunPrintSheet;