import React, { useState } from "react";
import { DEFAULT_CLUB, RE } from "../lib/constants.js";
import { S } from "../lib/styles.js";

function RefManager({refs,setRefs,club=DEFAULT_CLUB}){
  const [form,setForm]=useState({name:"",phone:""});
  const add=()=>{if(!form.name.trim())return;setRefs(p=>[...p,{id:Date.now(),...form}]);setForm({name:"",phone:""});};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,marginBottom:10,alignItems:"end"}}>
        <div><label style={S.lbl}>Name</label><input style={S.inp} placeholder="Referee name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
        <div><label style={S.lbl}>Mobile</label><input style={S.inp} placeholder="07xxx xxxxxx" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/></div>
        <button style={S.btn(club.primary)} onClick={add}>+ Add</button>
      </div>
      {refs.length===0?<div style={{fontSize:12,color:"#aaa"}}>No referees saved yet.</div>:(
        <table style={S.table}>
          <thead><tr><th style={S.th}>Name</th><th style={S.th}>Mobile</th><th style={S.th}></th></tr></thead>
          <tbody>{refs.map((r,i)=>(
            <tr key={r.id}>
              <td style={S.td(i%2)}>{r.name}</td>
              <td style={S.td(i%2)}>{r.phone||"-"}</td>
              <td style={S.td(i%2)}><button onClick={()=>setRefs(p=>p.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",color:RE,cursor:"pointer",fontSize:13}}>x</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

export default RefManager;