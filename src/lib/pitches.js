// pitches.js
// Pitch data helpers: sorting and migrating older pitch records to the
// current shape (inferring innerOf / format / independent / astroOnly).
// Depends on nothing - operates purely on the pitch objects passed in.

export const sortPitches=(arr)=>[...arr].sort((a,b)=>(a.id||"").localeCompare(b.id||"",undefined,{numeric:true}));

export const migratePitch=(p)=>{
  const out={...p};
  if(out.innerOf===undefined){
    // Infer from desc like "9v9 (inside P1)"
    const m=(out.desc||"").match(/inside\s+(\w+)/i);
    out.innerOf=m?m[1]:null;
  }
  if(out.format===undefined){
    const d=(out.desc||"").toLowerCase();
    if(d.indexOf("3v3")>=0)out.format="3v3";
    else if(d.indexOf("5v5")>=0)out.format="5v5";
    else if(d.indexOf("7v7")>=0)out.format="7v7";
    else if(d.indexOf("9v9")>=0)out.format="9v9";
    else if(d.indexOf("youth")>=0)out.format="11v11-youth";
    else if(d.indexOf("small")>=0)out.format="11v11-small";
    else if(d.indexOf("11v11")>=0)out.format="11v11";
    else out.format="";
  }
  if(out.independent===undefined)out.independent=(out.id==="3v3"||out.id==="AST");
  if(out.astroOnly===undefined){
    out.astroOnly=(out.id==="AST"||/astro|3g|astroturf|station park/i.test((out.label||"")+" "+(out.desc||"")));
  }
  return out;
};

export const migratePitches=(arr)=>arr.map(migratePitch);