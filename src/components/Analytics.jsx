import React from "react";
import { AM, AVG_CARS, DEFAULT_CLUB, PITCHES, RE } from "../lib/constants.js";
import { cleanName } from "../lib/scheduler.js";
import { S } from "../lib/styles.js";

function Analytics({history,club=DEFAULT_CLUB}){
  const A_OK=club.primary;
  const A_WARN="#E67E22";
  const A_OVER="#922B21";
  if(!history.length) return <div style={{fontSize:12,color:"#aaa"}}>No saved weeks yet. Save a few weeks to see analytics.</div>;

  // Peak time analysis
  const timeCounts={};
  history.forEach(w=>[...(w.scheduled||[]),...(w.postponedGames||[])].forEach(g=>{
    if(g.koTime&&g.status!=="postponed") timeCounts[g.koTime]=(timeCounts[g.koTime]||0)+1;
  }));
  const timeEntries=Object.entries(timeCounts).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxTime=Math.max(...timeEntries.map(e=>e[1]),1);

  // Postponement rate by team
  const teamTotal={},teamPostponed={};
  history.forEach(w=>{
    (w.scheduled||[]).forEach(g=>{
      const t=cleanName(g.homeTeam);
      teamTotal[t]=(teamTotal[t]||0)+1;
    });
    (w.postponedGames||[]).forEach(g=>{
      const t=cleanName(g.homeTeam);
      teamTotal[t]=(teamTotal[t]||0)+1;
      teamPostponed[t]=(teamPostponed[t]||0)+1;
    });
  });
  const teamEntries=Object.entries(teamTotal).map(([t,total])=>({team:t,total,postponed:teamPostponed[t]||0,rate:Math.round(((teamPostponed[t]||0)/total)*100)})).sort((a,b)=>b.rate-a.rate);

  // Postponement rate by pitch
  const pitchTotal={},pitchPostponed={};
  history.forEach(w=>{
    (w.scheduled||[]).forEach(g=>{if(g.pitchId){pitchTotal[g.pitchId]=(pitchTotal[g.pitchId]||0)+1;}});
    (w.postponedGames||[]).forEach(g=>{if(g.pitchId){pitchTotal[g.pitchId]=(pitchTotal[g.pitchId]||0)+1;pitchPostponed[g.pitchId]=(pitchPostponed[g.pitchId]||0)+1;}});
  });

  // Home fixture density
  const densityEntries=history.map(w=>({label:w.dateLabel,count:(w.scheduled||[]).length+(w.postponedGames||[]).length,sun:(w.sunScheduled||[]).length})).reverse();
  const maxDensity=Math.max(...densityEntries.map(e=>e.count+e.sun),1);

  // Car park utilisation over season
  const carparkEntries=history.map(w=>{
    let peak=0;
    const allGames=[...(w.scheduled||[]),...(w.sunScheduled||[])];
    const times=[...new Set(allGames.map(g=>g.koMins))].sort((a,b)=>a-b);
    times.forEach(t=>{
      const cars=allGames.filter(g=>g.koMins<=t&&g.endMins>t).reduce((s,g)=>s+((club.avgCars&&club.avgCars[g.cfg?.format])||AVG_CARS[g.cfg?.format]||8),0);
      if(cars>peak)peak=cars;
    });
    return{label:w.dateLabel,peak,capacity:w.carParkSpaces||club.carParkSpaces||57};
  }).reverse();
  const maxCars=Math.max(...carparkEntries.map(e=>e.peak),...carparkEntries.map(e=>e.capacity));

  // Pitch rotation - games per pitch per week heatmap
  const pitchIds=[...new Set(history.flatMap(w=>(w.scheduled||[]).map(g=>g.pitchId)))].filter(Boolean);
  const weeks=history.slice().reverse();

  const BAR_H=120;
  const sectionStyle={marginBottom:28};
  const sectionHdr={fontSize:13,fontWeight:700,color:club.primary,marginBottom:10,paddingBottom:6,borderBottom:"2px solid "+club.secondary};

  return(
    <div>
      {/* Peak time analysis */}
      <div style={sectionStyle}>
        <div style={sectionHdr}>Peak KO Time Analysis</div>
        {timeEntries.length===0?<div style={{fontSize:12,color:"#aaa"}}>No data yet.</div>:(
          <div>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:BAR_H,marginBottom:4}}>
              {timeEntries.map(([time,count],i)=>{
                const h=Math.round((count/maxTime)*BAR_H);
                const pct=Math.round((count/history.length)*100);
                return(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,height:"100%",justifyContent:"flex-end"}}>
                    <div style={{fontSize:9,color:club.primary,fontWeight:700}}>{count}</div>
                    <div style={{width:"100%",height:h,background:count===maxTime?club.secondary:club.primary,borderRadius:"3px 3px 0 0",minHeight:2}} title={time+": "+count+" games ("+pct+"% of weeks)"}/>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:6}}>
              {timeEntries.map(([time],i)=><div key={i} style={{flex:1,fontSize:8,color:"#888",textAlign:"center"}}>{time}</div>)}
            </div>
            <div style={{fontSize:11,color:"#888",marginTop:6}}>
              Busiest slot: <strong style={{color:club.primary}}>{timeEntries.reduce((a,b)=>b[1]>a[1]?b:a,timeEntries[0])?.[0]||"-"}</strong> with {Math.max(...timeEntries.map(e=>e[1]))} games across {history.length} weeks.
            </div>
          </div>
        )}
      </div>

      {/* Postponement rate by team */}
      <div style={sectionStyle}>
        <div style={sectionHdr}>Postponement Rate by Team</div>
        {teamEntries.filter(t=>t.postponed>0).length===0?(
          <div style={{fontSize:12,color:"#aaa"}}>No postponements recorded yet.</div>
        ):(
          <table style={S.table}>
            <thead><tr>{["Team","Total","Postponed","Rate"].map((h,i)=><th key={i} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {teamEntries.filter(t=>t.postponed>0).map((t,i)=>(
                <tr key={i}>
                  <td style={S.td(i%2)}><strong>{t.team}</strong></td>
                  <td style={S.td(i%2)}>{t.total}</td>
                  <td style={S.td(i%2)}>{t.postponed}</td>
                  <td style={S.td(i%2)}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:60,height:8,background:"#eee",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:t.rate+"%",background:(t.rate>30)?RE:(t.rate>15)?AM:club.primary,borderRadius:4}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:(t.rate>30)?RE:(t.rate>15)?AM:club.primary}}>{t.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Postponement rate by pitch */}
      <div style={sectionStyle}>
        <div style={sectionHdr}>Postponement Rate by Pitch</div>
        {Object.keys(pitchPostponed).length===0?(
          <div style={{fontSize:12,color:"#aaa"}}>No postponements recorded yet.</div>
        ):(
          <table style={S.table}>
            <thead><tr>{["Pitch","Total","Postponed","Rate"].map((h,i)=><th key={i} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {PITCHES.filter(p=>pitchTotal[p.id]).map((p,i)=>{
                const total=pitchTotal[p.id]||0;
                const post=pitchPostponed[p.id]||0;
                const rate=Math.round((post/total)*100);
                return(
                  <tr key={i}>
                    <td style={S.td(i%2)}><strong>{p.label}</strong> <span style={{fontSize:10,color:"#888"}}>{p.desc}</span></td>
                    <td style={S.td(i%2)}>{total}</td>
                    <td style={S.td(i%2)}>{post}</td>
                    <td style={S.td(i%2)}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:60,height:8,background:"#eee",borderRadius:4,overflow:"hidden"}}>
                          <div style={{height:"100%",width:rate+"%",background:(rate>30)?RE:(rate>15)?AM:club.primary,borderRadius:4}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:(rate>30)?RE:(rate>15)?AM:club.primary}}>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Home fixture density */}
      <div style={sectionStyle}>
        <div style={sectionHdr}>Home Fixture Density by Week</div>
        {densityEntries.length===0?<div style={{fontSize:12,color:"#aaa"}}>No data yet.</div>:(
          <div>
            <div style={{display:"flex",alignItems:"flex-end",gap:4,height:BAR_H,marginBottom:4}}>
              {densityEntries.map((w,i)=>{
                const satH=Math.round((w.count/maxDensity)*BAR_H);
                const sunH=Math.round((w.sun/maxDensity)*BAR_H);
                return(
                  <div key={i} title={w.label+": "+w.count+" Sat, "+w.sun+" Sun"} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:0,height:"100%",justifyContent:"flex-end"}}>
                    <div style={{fontSize:8,color:"#888"}}>{w.count+w.sun}</div>
                    <div style={{width:"100%",height:sunH,background:club.secondary,borderRadius:0,minHeight:w.sun>0?2:0}}/>
                    <div style={{width:"100%",height:satH,background:club.primary,borderRadius:"3px 3px 0 0",minHeight:w.count>0?2:0}}/>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:4,marginBottom:6}}>
              {densityEntries.map((w,i)=><div key={i} style={{flex:1,fontSize:7,color:"#aaa",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.label.split(" ").slice(1,3).join(" ")}</div>)}
            </div>
            <div style={{display:"flex",gap:16,fontSize:10,color:"#666"}}>
              <span><span style={{display:"inline-block",width:10,height:10,background:club.primary,borderRadius:2,marginRight:4}}/>Saturday</span>
              <span><span style={{display:"inline-block",width:10,height:10,background:club.secondary,borderRadius:2,marginRight:4}}/>Sunday</span>
            </div>
          </div>
        )}
      </div>

      {/* Car park utilisation over season */}
      <div style={sectionStyle}>
        <div style={sectionHdr}>Car Park Peak Utilisation Over Season</div>
        {carparkEntries.length===0?<div style={{fontSize:12,color:"#aaa"}}>No data yet.</div>:(
          <div>
            <div style={{position:"relative",height:BAR_H+16,marginBottom:4}}>
              <div style={{position:"absolute",top:Math.round((1-(club.carParkSpaces||57)/maxCars)*BAR_H),left:0,right:0,borderTop:"2px dashed #922B21",zIndex:2}}>
                <span style={{position:"absolute",right:0,top:-14,fontSize:9,color:"#922B21",fontWeight:700,background:"#fff",padding:"0 3px"}}>{(club.carParkSpaces||57)} capacity</span>
              </div>
              <div style={{display:"flex",alignItems:"flex-end",gap:4,height:BAR_H,position:"relative",zIndex:1}}>
                {carparkEntries.map((w,i)=>{
                  const h=Math.round((w.peak/maxCars)*BAR_H);
                  const col=w.peak>(w.capacity||(club.carParkSpaces||57))?A_OVER:w.peak>(w.capacity||(club.carParkSpaces||57))*0.85?A_WARN:A_OK;
                  return(
                    <div key={i} title={w.label+": peak ~"+w.peak+" cars"} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,height:"100%",justifyContent:"flex-end"}}>
                      <div style={{fontSize:8,color:col,fontWeight:700}}>{w.peak}</div>
                      <div style={{width:"100%",height:h,background:col,borderRadius:"3px 3px 0 0",minHeight:2}}/>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",gap:4}}>
              {carparkEntries.map((w,i)=><div key={i} style={{flex:1,fontSize:7,color:"#aaa",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.label.split(" ").slice(1,3).join(" ")}</div>)}
            </div>
            <div style={{fontSize:11,color:"#888",marginTop:6}}>
              Weeks over capacity: <strong style={{color:A_OVER}}>{carparkEntries.filter(w=>w.peak>(w.capacity||(club.carParkSpaces||57))).length}</strong> of {carparkEntries.length}.
              Season peak: <strong style={{color:A_OK}}>{Math.max(...carparkEntries.map(w=>w.peak))} cars</strong>.
            </div>
          </div>
        )}
      </div>

      {/* Pitch rotation heatmap */}
      <div style={sectionStyle}>
        <div style={sectionHdr}>Pitch Rotation Heatmap</div>
        {pitchIds.length===0?<div style={{fontSize:12,color:"#aaa"}}>No data yet.</div>:(
          <div style={{overflowX:"auto"}}>
            <table style={{...S.table,fontSize:11}}>
              <thead>
                <tr>
                  <th style={{...S.th,width:90}}>Pitch</th>
                  {weeks.map((w,i)=><th key={i} style={{...S.th,fontSize:9,padding:"4px 6px",textAlign:"center"}}>{w.dateLabel.split(" ").slice(1,3).join(" ")}</th>)}
                  <th style={S.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {PITCHES.filter(p=>pitchIds.includes(p.id)).map((p,i)=>{
                  const counts=weeks.map(w=>(w.scheduled||[]).filter(g=>g.pitchId===p.id).length);
                  const total=counts.reduce((a,b)=>a+b,0);
                  const maxCount=Math.max(...counts,1);
                  return(
                    <tr key={i}>
                      <td style={S.td(i%2)}><strong>{p.label}</strong><br/><span style={{fontSize:9,color:"#888"}}>{p.desc}</span></td>
                      {counts.map((c,j)=>{
                        const intensity=c/maxCount;
                        const bg=c===0?"#f5f5f5":club.primary+(Math.round((0.15+intensity*0.85)*255).toString(16).padStart(2,"0"));
                        return <td key={j} style={{...S.td(i%2),textAlign:"center",background:bg,color:(intensity>0.5)?"#fff":"#333",fontWeight:700,fontSize:11,padding:"6px 4px"}}>{c||""}</td>;
                      })}
                      <td style={{...S.td(i%2),fontWeight:700,color:club.primary}}>{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{fontSize:10,color:"#888",marginTop:6}}>Darker green = more games that week. Helps identify pitches that need recovery time.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;