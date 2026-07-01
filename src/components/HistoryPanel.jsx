import React from "react";
import { DEFAULT_CLUB, RE } from "../lib/constants.js";
import { S, thC } from "../lib/styles.js";

function HistoryPanel({history,onLoad,onDelete,club=DEFAULT_CLUB}){
  if(!history.length)return <div style={{fontSize:12,color:"#aaa"}}>No saved weeks yet.</div>;
  return(
    <table style={S.table}>
      <thead><tr>{["Date","Sat Fixtures","Sat Postponed","Sun Fixtures","Actions"].map(h=><th key={h} style={thC(club.primary)}>{h}</th>)}</tr></thead>
      <tbody>{history.map((w,i)=>(
        <tr key={w.id}>
          <td style={S.td(i%2)}><strong>{w.dateLabel}</strong><br/><span style={{fontSize:10,color:"#888"}}>{w.savedAt?new Date(w.savedAt).toLocaleDateString("en-GB"):""}</span></td>
          <td style={S.td(i%2)}>{(w.scheduled||[]).length}</td>
          <td style={S.td(i%2)}>{(w.postponedGames||[]).length||w.postponed||0}</td>
          <td style={S.td(i%2)}>{(w.sunScheduled||[]).length>0?(w.sunScheduled||[]).length:<span style={{color:"#aaa"}}>-</span>}</td>
          <td style={S.td(i%2)}>
            <button style={{...S.btn(club.primary),padding:"3px 10px",fontSize:11}} onClick={()=>onLoad(w)}>Load</button>
            <button style={{...S.btn(RE),padding:"3px 10px",fontSize:11,marginLeft:6}} onClick={()=>onDelete(w.id)}>Delete</button>
          </td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export default HistoryPanel;