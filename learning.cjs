function topicsOf(item){return [...new Set((Array.isArray(item.topics)&&item.topics.length?item.topics:[item.category||'My learning']).map(t=>String(t).trim()).filter(Boolean))];}
function validTopics(value){
 if(!Array.isArray(value)||!value.length||value.length>20||value.some(t=>typeof t!=='string'||!t.trim()||t.trim().length>80))throw Error('Choose 1–20 topics, each up to 80 characters.');
 const seen=new Set();return value.map(t=>t.trim()).filter(t=>{const key=t.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}
function normalise(item){const topics=topicsOf(item);return{...item,topics,category:topics[0],type:item.type||'skill'};}
function items(db,seeds){return[...seeds.map(s=>{const override=db.content?.find(c=>c.id===s.id);return normalise({...s,...override,topics:override?(override.topics||[override.category||s.category]):s.topics});}),...(db.content||[]).filter(c=>!seeds.some(s=>s.id===c.id)).map(normalise)];}
function complete(item,record){return item.type==='checklist'?record?.done===true:!!record?.steps?.some(s=>s.step===3);}
function progress(list,records){const topics=[...new Set(list.flatMap(topicsOf))];return topics.map(name=>{const assigned=list.filter(s=>topicsOf(s).includes(name)),done=assigned.filter(s=>complete(s,records[s.id])).length,started=assigned.filter(s=>!complete(s,records[s.id])&&(records[s.id]?.steps?.length||records[s.id]?.done===true)).length;return{name,total:assigned.length,done,started,percent:assigned.length?Math.round(done/assigned.length*100):0};});}
function upgrade(db,seeds){
 if(db.curriculumVersion>=3)return false;
 for(const c of db.content||[]){c.topics=topicsOf(c);c.type=c.type||seeds.find(s=>s.id===c.id)?.type||'skill';if(c.id==='1'){c.topics=[...new Set([...c.topics,'Pharmacy X'])];if(!/understand the pharmacy x dashboard/i.test(c.text))c.text+=' Understand the Pharmacy X dashboard and how it relates to the dispensing workflow.';}}
 db.curriculumVersion=3;return true;
}
function validateExtras(db){
 if(db.topics!==undefined&&(!Array.isArray(db.topics)||db.topics.length>200||db.topics.some(t=>typeof t!=='string'||!t.trim()||t.length>80)))throw Error('Invalid topic catalogue.');
 for(const c of db.content||[]){if(c.topics!==undefined)validTopics(c.topics);if(c.type!==undefined&&!['skill','checklist'].includes(c.type))throw Error('Invalid learning item type.');}
}
module.exports={topicsOf,validTopics,normalise,items,complete,progress,upgrade,validateExtras};
