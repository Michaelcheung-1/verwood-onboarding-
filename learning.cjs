function topicsOf(item){return [...new Set((Array.isArray(item.topics)&&item.topics.length?item.topics:[item.category||'My learning']).map(t=>String(t).trim()).filter(Boolean))];}
function validTopics(value){
 if(!Array.isArray(value)||!value.length||value.length>20||value.some(t=>typeof t!=='string'||!t.trim()||t.trim().length>80))throw Error('Choose 1–20 topics, each up to 80 characters.');
 const seen=new Set();return value.map(t=>t.trim()).filter(t=>{const key=t.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}
function normalise(item){const topics=topicsOf(item);return{...item,topics,category:topics[0],type:item.type||'skill'};}
function items(db,seeds){return[...seeds.map(s=>{const override=db.content?.find(c=>c.id===s.id);return normalise({...s,...override,topics:override?(override.topics||[override.category||s.category]):s.topics});}),...(db.content||[]).filter(c=>!seeds.some(s=>s.id===c.id)).map(normalise)].map(s=>({...s,number:db.itemNumbers?.[s.id]}));}
function ensureNumbers(db,seeds){
 let changed=false;if(!db.itemNumbers){db.itemNumbers={};changed=true;}
 const used=new Set(Object.values(db.itemNumbers));let next=Math.max(0,...used)+1;
 for(const item of [...seeds,...(db.content||[])]){if(!Object.hasOwn(db.itemNumbers,item.id)){while(used.has(next))next++;db.itemNumbers[item.id]=next;used.add(next++);changed=true;}}
 return changed;
}
function complete(item,record){return item.type==='checklist'?record?.done===true:!!record?.steps?.some(s=>s.step===3);}
function progress(list,records){const topics=[...new Set(list.flatMap(topicsOf))];return topics.map(name=>{const assigned=list.filter(s=>topicsOf(s).includes(name)),done=assigned.filter(s=>complete(s,records[s.id])).length,started=assigned.filter(s=>!complete(s,records[s.id])&&(records[s.id]?.steps?.length||records[s.id]?.done===true)).length;return{name,total:assigned.length,done,started,percent:assigned.length?Math.round(done/assigned.length*100):0};});}
function upgrade(db,seeds){
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
 return ensureNumbers(db,seeds)||changed;
}
function validateExtras(db){
 if(db.topics!==undefined&&(!Array.isArray(db.topics)||db.topics.length>200||db.topics.some(t=>typeof t!=='string'||!t.trim()||t.length>80)))throw Error('Invalid topic catalogue.');
 for(const c of db.content||[]){if(c.topics!==undefined)validTopics(c.topics);if(c.type!==undefined&&!['skill','checklist'].includes(c.type))throw Error('Invalid learning item type.');}
 if(db.itemNumbers!==undefined){if(!db.itemNumbers||typeof db.itemNumbers!=='object'||Array.isArray(db.itemNumbers))throw Error('Invalid item numbers.');const used=new Set();for(const[id,n]of Object.entries(db.itemNumbers)){if(!/^(custom-[a-f0-9-]+|new-[a-z0-9-]+|[0-9]+)$/.test(id)||!Number.isSafeInteger(n)||n<1||used.has(n))throw Error('Invalid or duplicate item number.');used.add(n);}}
}
module.exports={topicsOf,validTopics,normalise,items,complete,progress,upgrade,ensureNumbers,validateExtras};
