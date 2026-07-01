// styles.js
// Shared style object (S) and table-header style helper (thC).
// hdrStyle stays in App because it depends on live club colours.

import { G, AU, WH } from "./constants.js";

export const S={
  app:{fontFamily:"system-ui,Arial,sans-serif",background:"#F1F5F9",minHeight:"100vh"},
  hdr:{background:G,color:WH,padding:"14px 20px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"},
  crest:{width:44,height:44,borderRadius:"50%",background:AU,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,color:G,flexShrink:0},
  body:{padding:"20px 24px",maxWidth:1140,margin:"0 auto"},
  card:{background:WH,borderRadius:12,border:"none",marginBottom:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.07)"},
  ch:(bg)=>({background:bg||G,color:"#fff",padding:"9px 14px",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:8}),
  cb:{padding:20},
  row:{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"},
  lbl:{fontSize:11,fontWeight:600,color:"#555",marginBottom:3,display:"block"},
  inp:{border:"1.5px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:12,width:"100%",boxSizing:"border-box",background:"#fafafa",transition:"border-color 0.15s"},
  sel:{border:"1.5px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:12,width:"100%",background:"#fafafa",transition:"border-color 0.15s"},
  btn:(bg=G,fg=WH)=>({background:bg,color:fg,border:"none",borderRadius:50,padding:"9px 20px",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6,boxShadow:"0 1px 3px rgba(0,0,0,0.12)"}),
  tbtn:(a)=>({background:a?G:"#eee",color:a?WH:"#333",border:"none",borderRadius:4,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:a?700:400}),
  table:{width:"100%",borderCollapse:"collapse",fontSize:12},
  th:{background:G,color:WH,padding:"7px 10px",textAlign:"left",fontWeight:600,fontSize:11},
  td:(alt)=>({padding:"7px 8px",borderBottom:"1px solid #eee",verticalAlign:"middle",background:alt?"#f9f9f9":WH}),
  badge:(bg,fg=WH)=>({background:bg,color:fg,borderRadius:3,padding:"2px 7px",fontSize:10,fontWeight:700,display:"inline-block",whiteSpace:"nowrap",marginBottom:2}),
  warn:{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"12px 16px",fontSize:12,marginBottom:12},
  err:{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",fontSize:12,marginBottom:12},
  ok:{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"12px 16px",fontSize:12,marginBottom:12},
  iinp:{border:"1.5px solid #e5e7eb",borderRadius:6,padding:"5px 8px",fontSize:11,width:"100%",boxSizing:"border-box",background:"#fafafa"},
  isel:{border:"1px solid #ddd",borderRadius:3,padding:"3px 5px",fontSize:11,background:WH,width:"100%"},
  pgrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8},
  pcard:(a)=>({borderRadius:6,padding:"8px 10px",border:"2px solid "+(a?AU:"#ddd"),background:a?"#FFF8E7":"#fafafa"}),
};

export const thC=(primary)=>({background:primary||G,color:WH,padding:"7px 10px",textAlign:"left",fontWeight:600,fontSize:11});