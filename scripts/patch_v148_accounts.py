from pathlib import Path
import re, subprocess

p=Path('index.html')
s=p.read_text()

def once(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'Missing anchor: {label}')
    s=s.replace(old,new,1)

once('Golf Recon v14.7 Beta','Golf Recon v14.8 Beta','title version')
once('<span>v14.7 Beta</span>','<span>v14.8 Beta</span>','header version')

# Account lifecycle UI.
once('''        <label>Email
          <input id="authEmail" type="email" autocomplete="email" required placeholder="you@example.com" />
        </label>
        <label>Password
          <input id="authPassword" type="password" autocomplete="current-password" minlength="6" required placeholder="6+ characters" />
        </label>
        <button id="authSubmit" class="button primary auth-submit" type="submit">Sign in</button>''','''        <label id="emailWrap">Email
          <input id="authEmail" type="email" autocomplete="email" required placeholder="you@example.com" />
        </label>
        <label id="passwordWrap">Password
          <input id="authPassword" type="password" autocomplete="current-password" minlength="8" required placeholder="8+ characters" />
        </label>
        <label id="confirmPasswordWrap" style="display:none">Confirm password
          <input id="authPasswordConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="Repeat password" />
        </label>
        <button id="authSubmit" class="button primary auth-submit" type="submit">Sign in</button>''','auth form fields')

once('''      <button id="authModeToggle" class="auth-link" type="button">New to Golf Recon? Create account</button>
      <div class="auth-foot">Beta accounts keep each golfer's rounds and stats separate.</div>''','''      <button id="forgotPasswordBtn" class="auth-link auth-link-secondary" type="button">Forgot password?</button>
      <button id="authModeToggle" class="auth-link" type="button">New to Golf Recon? Create account</button>
      <div class="auth-foot">Each Golf Recon account has its own private rounds, stats and game keys.</div>''','auth links')

# Small auth-only styling.
once('''.auth-submit{width:100%;margin-top:4px}.auth-link{display:block;width:100%;border:0;background:none;color:var(--accent);font:inherit;font-size:12px;font-weight:850;margin-top:16px;cursor:pointer}
.auth-foot''','''.auth-submit{width:100%;margin-top:4px}.auth-link{display:block;width:100%;border:0;background:none;color:var(--accent);font:inherit;font-size:12px;font-weight:850;margin-top:16px;cursor:pointer}.auth-link-secondary{color:var(--muted);margin-top:10px;font-size:11px}
.auth-foot''','auth styling')

# Add a user-key alongside the session key.
once("const AUTH_STORAGE_KEY='golfreconAuthSessionV1';\nlet authSession=null;", "const AUTH_STORAGE_KEY='golfreconAuthSessionV1';\nconst AUTH_USER_KEY='golfreconAuthUserV1';\nlet authSession=null;", 'auth user storage key')

# Replace auth/session helper block with hardened lifecycle support.
start=s.index('function saveAuthSession(session){')
end=s.index('async function callImportFunction(payload,retry=true){', start)
new_helpers=r'''function jwtSubject(token){
  try{
    const part=String(token||'').split('.')[1];
    if(!part)return null;
    const pad=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');
    return JSON.parse(atob(pad))?.sub||null;
  }catch{return null}
}
function sessionUserId(session){return session?.user?.id||jwtSubject(session?.access_token)||null}
function resetUserScopedData(){
  db.player={id:null,name:'Golfer',username:'',handicap:null};
  db.swingThoughts={driver:[],irons:[],chipping:[],putting:[]};
  db.courses=[];db.rounds=[];db.puttingDetails=[];db.clubStats=[];
  state.pregameChats={};state.chatBusy=false;state.selectedRoundId=null;
  pendingImport=null;pendingBackfill=null;
}
function saveAuthSession(session){
  authSession=session||null;
  try{
    if(session){
      const nextUser=sessionUserId(session),prevUser=localStorage.getItem(AUTH_USER_KEY);
      if(nextUser&&prevUser&&prevUser!==nextUser)resetUserScopedData();
      localStorage.setItem(AUTH_STORAGE_KEY,JSON.stringify(session));
      if(nextUser)localStorage.setItem(AUTH_USER_KEY,nextUser);
    }else{
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }catch{}
}
function loadAuthSession(){
  try{return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)||"null")}catch{return null}
}
function authRedirectUrl(){
  if(location.hostname==='golfrecon.app'||location.hostname==='www.golfrecon.app')return 'https://golfrecon.app/';
  return location.origin+location.pathname;
}
async function authFetch(path,{method='POST',body=null,token=null}={}){
  const headers={'apikey':SUPABASE_PUBLISHABLE_KEY};
  if(body!==null)headers['Content-Type']='application/json';
  if(token)headers['Authorization']=`Bearer ${token}`;
  const res=await fetch(`${SUPABASE_URL}/auth/v1/${path}`,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.msg||data.error_description||data.message||data.error||`Authentication failed (${res.status})`);
  return data;
}
async function authRequest(path,body,token=null){return authFetch(path,{method:'POST',body:body||{},token})}
async function refreshAuthSession(){
  if(!authSession?.refresh_token)throw new Error('Please sign in again.');
  const data=await authRequest('token?grant_type=refresh_token',{refresh_token:authSession.refresh_token});
  saveAuthSession(data);
  return data;
}
async function ensureAuthSession(){
  if(!authSession)authSession=loadAuthSession();
  if(!authSession?.access_token)return null;
  const exp=Number(authSession.expires_at||0);
  if(exp && Date.now()/1000 > exp-60){
    try{await refreshAuthSession()}catch{saveAuthSession(null);return null}
  }
  return authSession;
}
function authCallbackFromUrl(){
  const raw=location.hash.startsWith('#')?location.hash.slice(1):'';
  if(!raw)return null;
  const q=new URLSearchParams(raw);
  if(q.get('error')){
    const message=q.get('error_description')||q.get('error')||'Authentication link failed.';
    history.replaceState(null,'',location.pathname+location.search);
    return {error:message};
  }
  const access_token=q.get('access_token'),refresh_token=q.get('refresh_token');
  if(!access_token)return null;
  const expiresIn=Number(q.get('expires_in')||3600);
  const session={access_token,refresh_token:refresh_token||null,expires_in:expiresIn,expires_at:Math.floor(Date.now()/1000)+expiresIn,token_type:q.get('token_type')||'bearer'};
  const type=q.get('type')||'';
  history.replaceState(null,'',location.pathname+location.search);
  return {session,type};
}
'''
s=s[:start]+new_helpers+s[end:]

# Replace showAuth + initializeAuth with reset/password-aware behavior.
start=s.index("function showAuth(mode='signin',message='',kind=''){")
end=s.index('async function bootstrapGolfRecon(){', start)
new_ui=r'''function showAuth(mode='signin',message='',kind=''){
  authMode=mode;
  document.getElementById('authGate').style.display='grid';
  document.getElementById('appShell').style.display='none';
  const signup=mode==='signup',recovery=mode==='recovery';
  document.getElementById('usernameWrap').style.display=signup?'grid':'none';
  document.getElementById('emailWrap').style.display=recovery?'none':'grid';
  document.getElementById('confirmPasswordWrap').style.display=(signup||recovery)?'grid':'none';
  document.getElementById('forgotPasswordBtn').style.display=mode==='signin'?'block':'none';
  document.getElementById('authTitle').textContent=recovery?'Choose a new password':signup?'Create your Golf Recon account':'Sign in';
  document.getElementById('authSubtitle').textContent=recovery?'Set a new password for your account.':signup?'Pick a username for Platoons, events and leaderboards.':'Your golf memory, game plan and round history.';
  document.getElementById('authSubmit').textContent=recovery?'Update password':signup?'Create account':'Sign in';
  document.getElementById('authModeToggle').textContent=recovery?'Back to sign in':signup?'Already have an account? Sign in':'New to Golf Recon? Create account';
  document.getElementById('authPassword').setAttribute('autocomplete',(signup||recovery)?'new-password':'current-password');
  document.getElementById('authEmail').required=!recovery;
  document.getElementById('authPasswordConfirm').required=signup||recovery;
  const msg=document.getElementById('authMessage');
  msg.textContent=message;msg.className=`auth-message ${kind||''}`;
}
function showGolfRecon(){
  document.getElementById('authGate').style.display='none';
  document.getElementById('appShell').style.display='';
}
async function initializeAuth(){
  const callback=authCallbackFromUrl();
  if(callback?.error){showAuth('signin',callback.error,'error');return;}
  if(callback?.session){
    saveAuthSession(callback.session);
    if(callback.type==='recovery'){
      showAuth('recovery','Password reset link verified.','ok');
      return;
    }
    showGolfRecon();
    await bootstrapGolfRecon();
    return;
  }
  authSession=loadAuthSession();
  const session=await ensureAuthSession();
  if(!session){showAuth('signin');return;}
  showGolfRecon();
  await bootstrapGolfRecon();
}

'''
s=s[:start]+new_ui+s[end:]

# Replace auth event handlers.
start=s.index("document.getElementById('authModeToggle').onclick=()=>{")
end=s.index("const editDlg=document.getElementById('editRoundDialog');", start)
new_handlers=r'''document.getElementById('authModeToggle').onclick=()=>{
  showAuth(authMode==='signin'?'signup':'signin');
};
document.getElementById('forgotPasswordBtn').onclick=async()=>{
  const email=document.getElementById('authEmail').value.trim().toLowerCase();
  if(!email){showAuth('signin','Enter your email above, then tap Forgot password again.','error');return;}
  const btn=document.getElementById('forgotPasswordBtn');
  try{
    btn.disabled=true;btn.textContent='Sending…';
    await authRequest(`recover?redirect_to=${encodeURIComponent(authRedirectUrl())}`,{email});
    showAuth('signin','Password reset email sent. Open the link on this device to choose a new password.','ok');
  }catch(err){showAuth('signin',err.message,'error')}
  finally{btn.disabled=false;btn.textContent='Forgot password?'}
};
document.getElementById('authForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=document.getElementById('authEmail').value.trim().toLowerCase();
  const password=document.getElementById('authPassword').value;
  const confirmPassword=document.getElementById('authPasswordConfirm').value;
  const username=document.getElementById('authUsername').value.trim();
  const btn=document.getElementById('authSubmit');
  const msg=document.getElementById('authMessage');
  try{
    btn.disabled=true;
    btn.textContent=authMode==='recovery'?'Updating…':authMode==='signup'?'Creating…':'Signing in…';
    msg.className='auth-message';msg.textContent='';
    if((authMode==='signup'||authMode==='recovery')&&password!==confirmPassword)throw new Error('Passwords do not match.');
    if(password.length<8)throw new Error('Password must be at least 8 characters.');
    if(authMode==='recovery'){
      const session=await ensureAuthSession();
      if(!session?.access_token)throw new Error('This password reset link has expired. Request a new one.');
      await authFetch('user',{method:'PUT',body:{password},token:session.access_token});
      try{await authRequest('logout',{},session.access_token)}catch{}
      resetUserScopedData();saveAuthSession(null);
      document.getElementById('authPassword').value='';document.getElementById('authPasswordConfirm').value='';
      showAuth('signin','Password updated. Sign in with your new password.','ok');
    }else if(authMode==='signup'){
      if(!/^[A-Za-z0-9_.-]{2,24}$/.test(username))throw new Error('Username must be 2–24 letters, numbers, dots, dashes or underscores.');
      const data=await authRequest(`signup?redirect_to=${encodeURIComponent(authRedirectUrl())}`,{email,password,data:{username,display_name:username}});
      if(data.access_token){
        saveAuthSession(data);showGolfRecon();await bootstrapGolfRecon();
      }else{
        showAuth('signin','Account created. Check your email to confirm the account, then sign in.','ok');
      }
    }else{
      const data=await authRequest('token?grant_type=password',{email,password});
      saveAuthSession(data);showGolfRecon();await bootstrapGolfRecon();
    }
  }catch(err){
    showAuth(authMode,err.message,'error');
  }finally{
    btn.disabled=false;
    btn.textContent=authMode==='recovery'?'Update password':authMode==='signup'?'Create account':'Sign in';
  }
});
document.getElementById('logoutBtn').onclick=async()=>{
  try{
    if(authSession?.access_token)await authRequest('logout',{},authSession.access_token);
  }catch{}
  resetUserScopedData();
  saveAuthSession(null);
  showAuth('signin','Signed out.','ok');
};

'''
s=s[:start]+new_handlers+s[end:]

# Guard brand-new accounts with an empty course catalog instead of crashing Pregame.
once("function render(){\n destroyCoursePreviewMap();", "function render(){\n destroyCoursePreviewMap();\n if(!db.courses.length){\n   app.innerHTML=`<div class=\"card bootstrap-card\"><div class=\"eyebrow\">WELCOME TO GOLF RECON</div><h2 style=\"margin:8px 0 6px\">Your account is ready.</h2><div class=\"muted\">Import your first round to start building your golf memory.</div><button class=\"button primary\" style=\"margin-top:16px\" type=\"button\" onclick=\"document.getElementById('importBtn').click()\">Import First Round</button></div>`;\n   return;\n }", 'empty account render guard')

# Guardrails.
required=[
    'Forgot password?',
    'authPasswordConfirm',
    "authFetch('user',{method:'PUT'",
    'resetUserScopedData()',
    "recover?redirect_to=",
    'Golf Recon v14.8 Beta',
    '<span>v14.8 Beta</span>'
]
for token in required:
    if token not in s: raise SystemExit(f'Missing required v14.8 token: {token}')

p.write_text(s)
# JS syntax validation.
scripts=re.findall(r'<script>(.*?)</script>',s,re.S)
Path('/tmp/golfrecon-v148.js').write_text('\n'.join(scripts))
r=subprocess.run(['node','--check','/tmp/golfrecon-v148.js'],capture_output=True,text=True)
if r.returncode:
    print(r.stderr)
    raise SystemExit('Frontend JavaScript syntax check failed')
print('v14.8 account lifecycle patch passed: signup confirm, forgot/reset password, callback handling, cross-account cleanup, empty-account guard, JS syntax.')
