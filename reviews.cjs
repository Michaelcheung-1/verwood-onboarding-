const fields=['concern','actions','support','deadline'];
function validate(value){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid review fields');const result={};for(const key of fields){if(typeof value[key]!=='string'||value[key].length>5000)throw Error('Enter each review field using up to 5000 characters');result[key]=value[key].trim();}return result;}
function importBundle(db,b){
 if(b?.format!=='verwood-private-review-import-v1')throw Error('Choose a private review import file');
 const a=b.account;if(!a||!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(a.username)||typeof a.name!=='string'||!a.name.trim()||a.name.length>80||a.role!=='staff'||!/^[a-f0-9]{64}$/.test(a.salt)||!/^[a-f0-9]{128}$/.test(a.hash))throw Error('Invalid staff account');
 if(db.accounts.some(u=>u.username===a.username))throw Error('This username already exists. No account or review was changed.');
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>50)throw Error('Invalid review items');
 const ids=new Set();const records={};const items=b.items.map(c=>{
  if(!c||!/^custom-[a-f0-9-]+$/.test(c.id)||ids.has(c.id)||(db.content||[]).some(s=>s.id===c.id)||typeof c.title!=='string'||!c.title.trim()||c.title.length>160||typeof c.text!=='string'||!c.text.trim()||c.text.length>10000)throw Error('Invalid or duplicate review item');ids.add(c.id);
  records[c.id]={steps:[],review:{...validate(c.review),actor:'Imported review document',at:new Date().toISOString()}};
  return{id:c.id,title:c.title.trim(),text:c.text.trim(),category:'Performance review',topics:['Performance review'],type:'review',scope:'personal',owner:a.username,archived:false};
 });
 // Validate the complete import before changing any account, content or record.
 if(db.records[a.username])throw Error('A record already exists for this username');
 db.accounts.push({username:a.username,name:a.name.trim(),role:'staff',salt:a.salt,hash:a.hash,disabled:false});db.content=[...(db.content||[]),...items];db.records[a.username]=records;return a.username;
}
module.exports={validate,importBundle};
