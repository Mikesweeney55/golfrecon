/**
 * Lightweight checks for roster invite-email helpers (mirrors edge-function rules).
 */
function text(v){return String(v??'').trim()}
function normEmail(v){
  const s=text(v).toLowerCase();
  if(!s||!s.includes('@')||s.length>254)return '';
  return s;
}
function keyFor(v,fallback){const s=text(v);return s||fallback}
function rosterEmailsFromSnapshot(snapshot){
  const out={};
  for(const m of (Array.isArray(snapshot?.members)?snapshot.members:[])){
    const id=keyFor(m?.id,'');
    const email=normEmail(m?.email);
    if(id&&email)out[id]=email;
  }
  return out;
}

const failures=[];
const passes=[];
function assert(cond,label){if(cond)passes.push(label);else failures.push(label)}

assert(normEmail(' Ryan@Golf.com ')==='ryan@golf.com','normalize email');
assert(normEmail('not-an-email')==='','reject non-email');
assert(normEmail('')==='','empty email');

const map=rosterEmailsFromSnapshot({
  members:[
    {id:'sully',name:'Ryan',email:'Ryan@x.com'},
    {id:'steve',name:'Steve',email:'  '},
    {id:'chuck',name:'Chuck',email:'chuck@x.com'},
    {id:'',name:'bad',email:'x@y.com'}
  ]
});
assert(map.sully==='ryan@x.com'&&map.chuck==='chuck@x.com'&&!map.steve,'snapshot email map');
assert(Object.keys(map).length===2,'skips blank ids/emails');

const vals=Object.values(map);
assert(new Set(vals).size===vals.length,'unique emails ok');

const dup=rosterEmailsFromSnapshot({
  members:[{id:'a',email:'same@x.com'},{id:'b',email:'same@x.com'}]
});
assert(Object.values(dup).length===2&&new Set(Object.values(dup)).size===1,'duplicate detection input');

const summary={ok:failures.length===0,passed:passes.length,failed:failures.length,failures,passes};
console.log(JSON.stringify(summary,null,2));
if(failures.length){
  console.error('FAILED:',failures.join('; '));
  process.exit(1);
}
console.log(`All ${passes.length} roster-email checks passed.`);
