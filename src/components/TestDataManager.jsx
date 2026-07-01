import React, { useState } from "react";
import { RE, TEST_SAT, TEST_SUN, WH } from "../lib/constants.js";
import { S } from "../lib/styles.js";

function TestDataManager(props){
  var testSat=props.testSat, setTestSat=props.setTestSat;
  var testSun=props.testSun, setTestSun=props.setTestSun;
  var club=props.club, onSave=props.onSave, cfgList=props.cfgList||[];
  var dayState=useState("sat"); var day=dayState[0]; var setDay=dayState[1];
  var savedState=useState(""); var saved=savedState[0]; var setSaved=savedState[1];

  var list=day==="sat"?testSat:testSun;
  var setList=day==="sat"?setTestSat:setTestSun;

  function blank(){return {homeTeam:"",awayTeam:"",league:"",isCup:false,status:"active",referee:"",refPhone:"",refStatus:"TBC"};}

  function update(i,field,val){
    var copy=list.slice();
    copy[i]=Object.assign({},copy[i]);
    copy[i][field]=val;
    setList(copy);
  }
  function add(){ setList(list.concat([blank()])); }
  function remove(i){ setList(list.filter(function(_,j){return j!==i;})); }
  function save(){
    onSave(day);
    setSaved(day);
    setTimeout(function(){setSaved("");},2500);
  }

  var inp={border:"1px solid #ddd",borderRadius:4,padding:"5px 8px",fontSize:12,width:"100%",boxSizing:"border-box"};
  var lbl={fontSize:10,fontWeight:600,color:"#888",marginBottom:2,display:"block"};

  return (
    <div style={S.card} className="np">
      <div style={Object.assign({background:club.primary,color:WH,padding:"10px 14px",fontWeight:600,fontSize:13},{display:"flex",justifyContent:"space-between",alignItems:"center"})}>
        <span>Test Data Manager</span>
        <span style={{fontSize:11,fontWeight:400}}>{list.length} fixtures</span>
      </div>
      <div style={S.cb}>
        <div style={{fontSize:12,color:"#666",marginBottom:12}}>
          Add the fixtures you want to use when running a test schedule. These replace the built-in demo data and are saved to your account.
        </div>

        <div style={{display:"flex",gap:0,marginBottom:16,background:"#f0f0f0",borderRadius:8,overflow:"hidden",maxWidth:300}}>
          <button onClick={function(){setDay("sat");}} style={{flex:1,padding:"8px 0",fontSize:12,fontWeight:day==="sat"?700:400,background:day==="sat"?club.primary:"transparent",color:day==="sat"?"#fff":"#666",border:"none",cursor:"pointer"}}>Saturday ({testSat.length})</button>
          <button onClick={function(){setDay("sun");}} style={{flex:1,padding:"8px 0",fontSize:12,fontWeight:day==="sun"?700:400,background:day==="sun"?club.primary:"transparent",color:day==="sun"?"#fff":"#666",border:"none",cursor:"pointer"}}>Sunday ({testSun.length})</button>
        </div>

        {list.map(function(fx,i){
          return (
            <div key={i} style={{border:"1px solid #eee",borderRadius:6,padding:10,marginBottom:8,background:"#fafafa"}}>
              <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{flex:"1 1 180px"}}>
                  <label style={lbl}>Home Team</label>
                  <select style={inp} value={fx.homeTeam} onChange={function(e){update(i,"homeTeam",e.target.value);}}>
                    <option value="">Select team...</option>
                    {cfgList.map(function(t){
                      var full=club.name+" "+t.name;
                      return <option key={t.name} value={full}>{t.name}</option>;
                    })}
                  </select>
                </div>
                <div style={{flex:"1 1 180px"}}>
                  <label style={lbl}>Opposition</label>
                  <input style={inp} value={fx.awayTeam} onChange={function(e){update(i,"awayTeam",e.target.value);}} placeholder="e.g. Bolton Wanderers U12"/>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:"0 0 120px"}}>
                  <label style={lbl}>League</label>
                  <input style={inp} value={fx.league} onChange={function(e){update(i,"league",e.target.value);}} placeholder="BBDFL"/>
                </div>
                <label style={{fontSize:12,display:"flex",alignItems:"center",gap:5,cursor:"pointer",paddingBottom:6}}>
                  <input type="checkbox" checked={fx.isCup} onChange={function(e){update(i,"isCup",e.target.checked);}}/>
                  Cup game
                </label>
                <button onClick={function(){remove(i);}} style={{marginLeft:"auto",background:"#FEF2F2",color:RE,border:"1px solid #FECACA",borderRadius:4,padding:"6px 12px",fontSize:11,cursor:"pointer",fontWeight:600}}>Remove</button>
              </div>
            </div>
          );
        })}

        {list.length===0&&<div style={{fontSize:12,color:"#aaa",textAlign:"center",padding:16}}>No test fixtures yet. Click Add Fixture to start.</div>}

        <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          <button onClick={add} style={Object.assign({},S.btn(club.primary))}>+ Add Fixture</button>
          <button onClick={save} style={Object.assign({},S.btn(club.secondary))}>{saved===day?"Saved":"Save "+(day==="sat"?"Saturday":"Sunday")+" Test Data"}</button>
          <button onClick={function(){setList(day==="sat"?TEST_SAT:TEST_SUN);}} style={Object.assign({},S.btn(RE))}>Reset to Demo Data</button>
        </div>
      </div>
    </div>
  );
}

export default TestDataManager;