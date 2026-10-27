const learning=require('./learning.cjs');
module.exports=function applyLibraryChange(db,seeds,actor,b){
 if(!['manager','admin'].includes(actor.role))throw Error('Managers and administrators manage the content list.');
 const all=learning.items(db,seeds),shared=all.filter(s=>s.scope!=='personal');
 if(!Array.isArray(b.ids)||!b.ids.length||new Set(b.ids).size!==b.ids.length||b.ids.some(id=>typeof id!=='string'))throw Error('Select one or more different shared learning items.');
 const selected=b.ids.map(id=>shared.find(s=>s.id===id));if(selected.some(s=>!s))throw Error('The selection contains an unavailable or personal item. Refresh and select shared content.');
 if(b.action==='order'){
  if(b.ids.length!==shared.length||shared.some(s=>!b.ids.includes(s.id)))throw Error('The content list changed. Refresh before saving the full order.');
  if(b.renumber!==undefined&&typeof b.renumber!=='boolean')throw Error('Invalid renumber option.');
  const numbers=shared.map(s=>s.number).sort((a,b)=>a-b);if(numbers.some(n=>!Number.isSafeInteger(n)))throw Error('Item numbers are unavailable. Refresh the page.');
  db.contentOrder=[...b.ids];if(b.renumber)b.ids.forEach((id,i)=>db.itemNumbers[id]=numbers[i]);
  return `Reordered ${shared.length} shared learning items${b.renumber?' and reassigned item numbers to match the order':''}`;
 }
 if(!['topics','archive','restore'].includes(b.action))throw Error('Choose a content-list action.');
 let topics;if(b.action==='topics'){
  if(!['replace','add','remove'].includes(b.mode))throw Error('Choose replace, add or remove topics.');
  topics=learning.validTopics(b.topics);
  if(selected.some(s=>s.archived))throw Error('Restore archived items before changing their topics.');
 }
 const at=new Date().toISOString();
 // Prepare and validate every item before changing anything in the database.
 const changes=selected.map(s=>{
  let assigned=s.topics;
  if(b.action==='topics'){
   if(b.mode==='replace')assigned=topics;
   if(b.mode==='add')assigned=learning.validTopics([...s.topics,...topics]);
   if(b.mode==='remove'){assigned=s.topics.filter(t=>!topics.some(n=>n.toLowerCase()===t.toLowerCase()));if(!assigned.length)throw Error(`#${s.number} ${s.title} would have no topics. Keep at least one topic.`);assigned=learning.validTopics(assigned);}
  }
  return{...s,topics:assigned,category:assigned[0],scope:'shared',owner:s.owner||actor.username,archived:b.action==='archive'?true:b.action==='restore'?false:!!s.archived,updatedBy:actor.name,updatedAt:at};
 });
 db.content=[...(db.content||[]).filter(c=>!b.ids.includes(c.id)),...changes];
 const refs=selected.map(s=>'#'+s.number).join(', ');
 return b.action==='topics'?`Bulk ${b.mode} topics for ${refs}: ${topics.join(', ')}`:`${b.action==='archive'?'Archived':'Restored'} shared learning items ${refs}; learning records retained`;
};
