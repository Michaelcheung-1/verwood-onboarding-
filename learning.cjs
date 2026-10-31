function topicsOf(item){return [...new Set((Array.isArray(item.topics)&&item.topics.length?item.topics:[item.category||'My learning']).map(t=>String(t).trim()).filter(Boolean))];}
function validTopics(value){
 if(!Array.isArray(value)||!value.length||value.length>20||value.some(t=>typeof t!=='string'||!t.trim()||t.trim().length>80))throw Error('Choose 1–20 topics, each up to 80 characters.');
 const seen=new Set();return value.map(t=>t.trim()).filter(t=>{const key=t.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}
function normalise(item){const topics=topicsOf(item);return{...item,topics,category:topics[0],type:item.type||'skill'};}
function items(db,seeds){const order=new Map((db.contentOrder||[]).map((id,i)=>[id,i]));return[...seeds.map(s=>{const override=db.content?.find(c=>c.id===s.id);return normalise({...s,...override,topics:override?(override.topics||[override.category||s.category]):s.topics});}),...(db.content||[]).filter(c=>!seeds.some(s=>s.id===c.id)).map(normalise)].map(s=>({...s,number:db.itemNumbers?.[s.id]})).sort((a,b)=>(a.scope==='personal'?1:0)-(b.scope==='personal'?1:0)||(order.get(a.id)??1e9)-(order.get(b.id)??1e9)||(a.number||0)-(b.number||0)).map((s,i)=>({...s,order:i+1}));}
function ensureNumbers(db,seeds){
 let changed=false;if(!db.itemNumbers){db.itemNumbers={};changed=true;}
 const used=new Set(Object.values(db.itemNumbers));let next=Math.max(0,...used)+1;
 for(const item of [...seeds,...(db.content||[])]){if(!Object.hasOwn(db.itemNumbers,item.id)){while(used.has(next))next++;db.itemNumbers[item.id]=next;used.add(next++);changed=true;}}
 return changed;
}
function complete(item,record){return item.type==='checklist'?record?.done===true:!!record?.steps?.some(s=>s.step===3);}
function progress(list,records){const topics=[...new Set(list.flatMap(topicsOf))];return topics.map(name=>{const assigned=list.filter(s=>topicsOf(s).includes(name)),done=assigned.filter(s=>complete(s,records[s.id])).length,started=assigned.filter(s=>!complete(s,records[s.id])&&(records[s.id]?.steps?.length||records[s.id]?.done===true)).length;return{name,total:assigned.length,done,started,startedTotal:done+started,percent:assigned.length?Math.round(done/assigned.length*100):0};});}
function applyOrderDefaults(db,seeds,defaults){
 if(!defaults||db.appliedOrderDefaults===defaults.version)return false;
 const all=items(db,seeds),shared=all.filter(s=>s.scope!=='personal'),requested=defaults.contentOrder.filter(id=>shared.some(s=>s.id===id));
 const available=requested.map(id=>db.itemNumbers[id]).sort((a,b)=>a-b);if(available.some(n=>!Number.isSafeInteger(n)))throw Error('Cannot apply curriculum numbering.');
 requested.forEach((id,i)=>db.itemNumbers[id]=available[i]);db.contentOrder=[...requested,...shared.filter(s=>!requested.includes(s.id)).map(s=>s.id)];db.appliedOrderDefaults=defaults.version;return true;
}
function applyCurriculumUpdate(db,seeds){
 const update=require('./curriculum-update.json');if(db.curriculumUpdate>=update.version)return false;
 const admin=db.accounts?.find(a=>a.role==='admin'&&!a.disabled)||db.accounts?.[0];
 for(const[id,fields]of Object.entries(update.patches)){
  const previous=(db.content||[]).find(c=>c.id===id),seed=seeds.find(s=>s.id===id);
  if(previous)Object.assign(previous,fields);
  else if(seed&&admin){db.content=db.content||[];db.content.push({...seed,...fields,scope:'shared',owner:admin.username});}
 }
 ensureNumbers(db,seeds);
 const shared=items(db,seeds).filter(s=>s.scope!=='personal'),ids=[...update.order.filter(id=>shared.some(s=>s.id===id)),...shared.filter(s=>!update.order.includes(s.id)).map(s=>s.id)];
 const numbers=shared.map(s=>s.number).sort((a,b)=>a-b);ids.forEach((id,i)=>db.itemNumbers[id]=numbers[i]);db.contentOrder=ids;
 db.curriculumUpdate=update.version;return true;
}
function upgrade(db,seeds,defaults){
 let changed=false;
 if(!(db.curriculumVersion>=3)){
  for(const c of db.content||[]){c.topics=topicsOf(c);c.type=c.type||seeds.find(s=>s.id===c.id)?.type||'skill';if(c.id==='1'){c.topics=[...new Set([...c.topics,'Pharmacy X'])];if(!/understand the pharmacy x dashboard/i.test(c.text))c.text+=' Understand the Pharmacy X dashboard and how it relates to the dispensing workflow.';}}
  changed=true;
 }
 if(!(db.curriculumVersion>=4)){
  const sop='new-pharmsmart-sop';const override=db.content?.find(c=>c.id===sop);if(override)override.type='checklist';
  for(const rs of Object.values(db.records||{})){const record=rs[sop],done=record?.steps?.find(s=>s.step===3);if(record&&record.done===undefined&&done){record.done=true;record.actor=done.actor;record.at=done.at;}}
  const consent=seeds.find(s=>s.id==='new-account-sharing-consent'),accounts=items(db,seeds).filter(s=>s.id.startsWith('new-account-')&&s.id!=='new-account-sharing-consent');
  if(consent&&accounts.length&&!db.content?.some(c=>c.id===consent.id)){
   const common=accounts[0].topics.filter(t=>accounts.every(s=>s.topics.includes(t))),topics=common.length?common:accounts[0].topics;
   if(JSON.stringify(topics)!==JSON.stringify(consent.topics)){const owner=db.accounts?.find(a=>a.role==='admin'&&!a.disabled)||db.accounts?.[0];if(owner){db.content=db.content||[];db.content.push({...consent,topics,category:topics[0],scope:'shared',owner:owner.username});}}
  }
  const active=items(db,seeds).filter(s=>!s.archived),assigned=new Set(active.flatMap(topicsOf));if(db.topics)db.topics=db.topics.filter(t=>assigned.has(t));
  db.curriculumVersion=4;changed=true;
 }
 if(ensureNumbers(db,seeds))changed=true;if(applyOrderDefaults(db,seeds,defaults))changed=true;if(applyCurriculumUpdate(db,seeds))changed=true;return changed;
}
function validateExtras(db){
 if(db.curriculumUpdate!==undefined&&(!Number.isSafeInteger(db.curriculumUpdate)||db.curriculumUpdate<1))throw Error('Invalid curriculum update marker.');
 if(db.appliedOrderDefaults!==undefined&&(typeof db.appliedOrderDefaults!=='string'||db.appliedOrderDefaults.length>100))throw Error('Invalid numbering update marker.');
 if(db.contentOrder!==undefined&&(!Array.isArray(db.contentOrder)||new Set(db.contentOrder).size!==db.contentOrder.length||db.contentOrder.some(id=>typeof id!=='string'||!/^(custom-[a-f0-9-]+|new-[a-z0-9-]+|[0-9]+)$/.test(id))))throw Error('Invalid content order.');
 if(db.topics!==undefined&&(!Array.isArray(db.topics)||db.topics.length>200||db.topics.some(t=>typeof t!=='string'||!t.trim()||t.length>80)))throw Error('Invalid topic catalogue.');
 for(const c of db.content||[]){if(c.topics!==undefined)validTopics(c.topics);if(c.type!==undefined&&!['skill','checklist','understanding'].includes(c.type))throw Error('Invalid learning item type.');}
 if(db.itemNumbers!==undefined){if(!db.itemNumbers||typeof db.itemNumbers!=='object'||Array.isArray(db.itemNumbers))throw Error('Invalid item numbers.');const used=new Set();for(const[id,n]of Object.entries(db.itemNumbers)){if(!/^(custom-[a-f0-9-]+|new-[a-z0-9-]+|[0-9]+)$/.test(id)||!Number.isSafeInteger(n)||n<1||used.has(n))throw Error('Invalid or duplicate item number.');used.add(n);}}
}
module.exports={topicsOf,validTopics,normalise,items,complete,progress,upgrade,ensureNumbers,applyOrderDefaults,validateExtras};
