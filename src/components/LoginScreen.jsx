import React, { useState } from "react";
import { G } from "../lib/constants.js";
import { Auth, getSupaKey, isSupaConfigured } from "../lib/supabase.js";

function LoginScreen(props) {
  var onLogin = props.onLogin;
  var supaConfigured = props.supaConfigured;
  var modeState = useState("signin");
  var mode = modeState[0]; var setMode = modeState[1];
  var emailState = useState(""); var email = emailState[0]; var setEmail = emailState[1];
  var passState = useState(""); var password = passState[0]; var setPassword = passState[1];
  var nameState = useState(""); var displayName = nameState[0]; var setDisplayName = nameState[1];
  var loadState = useState(false); var loading = loadState[0]; var setLoading = loadState[1];
  var errState = useState(""); var error = errState[0]; var setError = errState[1];
  var msgState = useState(""); var msg = msgState[0]; var setMsg = msgState[1];
  var keyState = useState(function(){ return getSupaKey()||""; }); var keyInput = keyState[0]; var setKeyInput = keyState[1];
  var keySetState = useState(function(){ return isSupaConfigured(); }); var keySet = keySetState[0]; var setKeySet = keySetState[1];

  function saveKey() {
    var k = keyInput.trim();
    if (k.length < 20) { setError("Key too short - paste the full anon key."); return; }
    try { localStorage.setItem("hsm_supa_key", k); } catch(e) {}
    setKeySet(true);
    setError("");
  }

  function submit() {
    setError(""); setMsg("");
    if (!keySet) { setError("Connect to Supabase first."); return; }
    if (!email.trim()) { setError("Enter your email."); return; }
    if (mode !== "reset" && !password) { setError("Enter your password."); return; }
    if (mode === "signup" && password.length < 6) { setError("Password must be 6+ characters."); return; }
    setLoading(true);
    if (mode === "reset") {
      Auth.resetPassword(email.trim()).then(function(res) {
        setLoading(false);
        if (res && res.error) { setError(res.error); return; }
        setMsg("Reset email sent! Check your inbox.");
      });
      return;
    }
    var authCall = mode === "signup"
      ? Auth.signUp(email.trim(), password, displayName.trim())
      : Auth.signIn(email.trim(), password);
    authCall.then(function(res) {
      setLoading(false);
      if (!res || res.error) { setError(res ? res.error : "Something went wrong."); return; }
      if (mode === "signup" && !res.access_token) {
        setMsg("Account created! Check email to confirm, then sign in.");
        setMode("signin");
        return;
      }
      if (res.access_token) {
        Auth.saveSession(res);
        onLogin(res);
      } else {
        setError("Unexpected response - try again.");
      }
    });
  }

  var inp = { border:"1.5px solid #e5e7eb", borderRadius:8, padding:"10px 14px", fontSize:13, width:"100%", boxSizing:"border-box", background:"#fafafa", marginBottom:12, display:"block" };
  var btn = { background:G, color:"#fff", border:"none", borderRadius:50, padding:"12px 0", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%", marginBottom:12, opacity:loading?0.7:1 };
  var lbl = { fontSize:11, fontWeight:600, color:"#555", marginBottom:4, display:"block" };
  var err = { background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#922B21", marginBottom:12 };
  var ok = { background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#166534", marginBottom:12 };
  var lnk = { background:"none", border:"none", color:G, cursor:"pointer", fontSize:12, textDecoration:"underline" };

  return (
    <div style={{minHeight:"100vh",background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:16,boxShadow:"0 8px 40px rgba(0,0,0,0.1)",width:"100%",maxWidth:440,overflow:"hidden"}}>

        <div style={{background:"#f8f9fa",padding:"36px 32px 28px",textAlign:"center",borderBottom:"1px solid #e8e8e8"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:14}}>
            <div style={{width:54,height:54,border:"3px solid #C0392B",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"#1D2D44",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:900}}>GC</div>
            </div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:24,fontWeight:900,color:"#1D2D44",lineHeight:1,letterSpacing:1}}>GROUND</div>
              <div style={{fontSize:24,fontWeight:900,color:"#C0392B",lineHeight:1,letterSpacing:1}}>CONTROL</div>
              <div style={{fontSize:8,fontWeight:600,color:"#999",letterSpacing:3,marginTop:3}}>MATCHDAY PLATFORM</div>
            </div>
          </div>
        </div>

        <div style={{padding:"28px 32px"}}>

          {!keySet ? (
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#333",marginBottom:8}}>First-time setup</div>
              <div style={{fontSize:12,color:"#666",marginBottom:14}}>Paste your Supabase anon key. Find it in Supabase, Settings, API, anon/public.</div>
              {error && <div style={err}>{error}</div>}
              <label style={lbl}>Supabase Anon Key</label>
              <input style={{...inp,fontFamily:"monospace",fontSize:10}} type="password" placeholder="eyJ..." value={keyInput} onChange={function(e){setKeyInput(e.target.value);}}/>
              <button style={btn} onClick={saveKey}>Connect to Supabase</button>
              <div style={{fontSize:11,color:"#aaa",textAlign:"center"}}>Key stored locally on this device only</div>
            </div>
          ) : (
            <div>
              <div style={{display:"flex",gap:0,marginBottom:20,background:"#f0f0f0",borderRadius:8,overflow:"hidden"}}>
                {[["signin","Sign In"],["signup","Create Account"]].map(function(item) {
                  return (
                    <button key={item[0]} onClick={function(){setMode(item[0]);setError("");setMsg("");}}
                      style={{flex:1,padding:"8px 0",fontSize:12,fontWeight:mode===item[0]?700:400,background:mode===item[0]?G:"transparent",color:mode===item[0]?"#fff":"#666",border:"none",cursor:"pointer"}}>
                      {item[1]}
                    </button>
                  );
                })}
              </div>

              {error && <div style={err}>{error}</div>}
              {msg && <div style={ok}>{msg}</div>}

              {mode === "reset" ? (
                <div>
                  <label style={lbl}>Email address</label>
                  <input style={inp} type="email" placeholder="your@email.com" value={email} onChange={function(e){setEmail(e.target.value);}}/>
                  <button style={btn} onClick={submit} disabled={loading}>{loading?"Sending...":"Send Reset Email"}</button>
                  <div style={{textAlign:"center"}}>
                    <button onClick={function(){setMode("signin");setError("");setMsg("");}} style={lnk}>Back to sign in</button>
                  </div>
                </div>
              ) : (
                <div>
                  {mode === "signup" && (
                    <div>
                      <label style={lbl}>Your Name</label>
                      <input style={inp} type="text" placeholder="e.g. Andy Smith" value={displayName} onChange={function(e){setDisplayName(e.target.value);}}/>
                    </div>
                  )}
                  <label style={lbl}>Email address</label>
                  <input style={inp} type="email" placeholder="your@email.com" value={email} onChange={function(e){setEmail(e.target.value);}}/>
                  <label style={lbl}>Password</label>
                  <input style={inp} type="password" placeholder={mode==="signup"?"At least 6 characters":"Your password"} value={password} onChange={function(e){setPassword(e.target.value);}}/>
                  <button style={btn} onClick={submit} disabled={loading}>
                    {loading?(mode==="signup"?"Creating account...":"Signing in..."):(mode==="signup"?"Create Account":"Sign In")}
                  </button>
                  {mode === "signin" && (
                    <div style={{textAlign:"center"}}>
                      <button onClick={function(){setMode("reset");setError("");setMsg("");}} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>Forgot password?</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{padding:"20px 32px 28px",textAlign:"center",background:"#f8f9fa",borderTop:"1px solid #e8e8e8"}}>
          <div style={{fontSize:9,color:"#aaa",marginBottom:10,letterSpacing:3,fontFamily:"Arial,sans-serif"}}>POWERED BY</div>
          <div style={{fontFamily:"Arial,Helvetica,sans-serif",fontWeight:800,fontSize:32,letterSpacing:1,display:"inline-block"}}>
            <span style={{color:"#1B2A41"}}>DA</span><span style={{color:"#16BDCA"}}>X</span><span style={{color:"#1B2A41"}}>ORA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;