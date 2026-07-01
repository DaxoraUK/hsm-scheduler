import React from "react";
import { AM, BL, DEFAULT_CLUB, G, PITCHES, TE } from "../lib/constants.js";
import { cleanName, t2s } from "../lib/scheduler.js";

function Timeline({games,club=DEFAULT_CLUB,pitchList=PITCHES}){const primary=club.primary||G;
  if(!games.length)return null;
  const active=games.filter(g=>g.status!=="postponed");
  if(!active.length)return <div style={{fontSize:12,color:"#aaa"}}>No active fixtures.</div>;
  const minT=Math.min(...active.map(g=>g.koMins||0).filter(v=>!isNaN(v)));
  const maxT=Math.max(...active.map(g=>g.endMins||0).filter(v=>!isNaN(v)));
  const range=maxT-minT||120;
  const pids=[...new Set(active.map(g=>g.pitchId))].sort((a,b)=>String(a||"").localeCompare(String(b||""),undefined,{numeric:true}));
  return(
    <div style={{overflowX:"auto"}}>
      <div style={{minWidth:560}}>
        <div style={{position:"relative",marginLeft:90,marginBottom:6,height:16}}>
          {Array.from({length:Math.ceil(range/60)+1},(_,i)=>{
            const pct=(i*60/range)*100;
            if(pct>100)return null;
            return <div key={i} style={{position:"absolute",left:pct+"%",fontSize:10,color:"#888",transform:"translateX(-50%)"}}>{t2s(minT+i*60)}</div>;
          })}
        </div>
        {pids.map(pid=>{
          const pitch=pitchList.find(p=>p.id===pid);
          return(
            <div key={String(pid)} style={{display:"flex",alignItems:"center",marginBottom:5}}>
              <div style={{width:90,fontSize:10,fontWeight:700,color:primary,flexShrink:0}}>{pitch?.label}<br/><span style={{fontWeight:400,color:"#888"}}>{pitch?.desc}</span></div>
              <div style={{flex:1,position:"relative",height:30,background:"#f0f0f0",borderRadius:4}}>
                {active.filter(g=>g.pitchId===pid).map((g,i)=>{
                  const left=((g.koMins-minT)/range)*100;
                  const width=((g.endMins-g.koMins)/range)*100;
                  const bg=g.fixedKO?BL:g.usingAstro?TE:g.usingFallback?"#795548":g.usingAlt?AM:primary;
                  return(
                    <div key={i} title={g.koTime+" "+cleanName(g.homeTeam)+" vs "+g.awayTeam}
                      style={{position:"absolute",left:left+"%",width:width+"%",height:"100%",background:bg,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                      <span style={{color:"#fff",fontSize:9,fontWeight:700,whiteSpace:"nowrap",padding:"0 4px",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {g.koTime} {cleanName(g.homeTeam,club.name).substring(0,16)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div style={{display:"flex",gap:16,marginTop:8,fontSize:10,color:"#666"}}>
          {[[club.primary,"Default"],[AM,"Alt"],[BL,"2pm KO"],[TE,"Astro"],["#795548","Fallback"]].map(([c,l])=>(
            <span key={l}><span style={{display:"inline-block",width:10,height:10,background:c,borderRadius:2,marginRight:4}}/>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Timeline;