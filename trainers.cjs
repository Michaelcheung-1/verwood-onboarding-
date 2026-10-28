module.exports={
 roster:accounts=>accounts.filter(a=>!a.disabled).map(a=>({username:a.username,name:a.name})),
 forStep(accounts,b){
  if(b.step!==1)return{trainer:String(b.trainer||'').trim().slice(0,80)};
  if(b.trainerType==='staff'){
   const staff=accounts.find(a=>a.username===b.trainerUsername&&!a.disabled);
   if(!staff)throw Error('The selected trainer is no longer available. Refresh and choose a staff member or Other.');
   return{trainer:staff.name,trainerType:'staff',trainerUsername:staff.username};
  }
  if(b.trainerType==='other'||(!b.trainerType&&typeof b.trainer==='string')){
   const name=String(b.trainerOther??b.trainer??'').trim();if(!name||name.length>80)throw Error('Enter the trainer name (up to 80 characters).');
   return{trainer:name,trainerType:'other'};
  }
  throw Error('Choose who showed the skill: a staff member or Other.');
 },
 validate(step){
  if(step.trainerType===undefined)return;
  if(!['staff','other'].includes(step.trainerType)||typeof step.trainer!=='string'||!step.trainer.trim()||step.trainer.length>80)throw Error('Invalid trainer details in backup.');
  if(step.trainerType==='staff'&&(typeof step.trainerUsername!=='string'||!/^[a-z0-9][a-z0-9._-]{1,39}$/.test(step.trainerUsername)))throw Error('Invalid staff trainer reference in backup.');
 }
};
