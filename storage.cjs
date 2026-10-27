const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=()=>{
 const production=process.env.NODE_ENV==='production'||process.env.RENDER==='true';
 const expected='/var/lib/verwood-onboarding';
 if(production&&process.env.NODE_ENV!=='production')throw Error('Set NODE_ENV=production on the online service.');
 if(production&&process.env.DATA_DIR!==expected)throw Error('DATA_DIR must be /var/lib/verwood-onboarding. No source-folder fallback is allowed.');
 const dir=path.resolve(process.env.DATA_DIR||path.join(__dirname,'data'));
 function verifyMount(){
  if(!production)return;
  if(process.platform!=='linux')throw Error('Production requires a Linux persistent disk.');
  if(!fs.existsSync(dir)||fs.realpathSync(dir)!==expected)throw Error('Persistent disk directory missing or redirected.');
  const mounts=fs.readFileSync('/proc/self/mountinfo','utf8').split('\n').map(l=>l.split(' ')[4]);
  if(!mounts.includes(expected))throw Error('Persistent disk is not mounted at /var/lib/verwood-onboarding. Refusing to write to ephemeral storage.');
 }
 verifyMount();if(!production)fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'onboarding.json'),marker=path.join(dir,'.verwood-onboarding-storage.json'),backups=path.join(dir,'backups');
 function atomic(target,value){const tmp=target+'.tmp';const fd=fs.openSync(tmp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,target);if(process.platform==='linux'){const directoryFd=fs.openSync(path.dirname(target),'r');try{fs.fsyncSync(directoryFd);}finally{fs.closeSync(directoryFd);}}}
 let identity=fs.existsSync(marker)?JSON.parse(fs.readFileSync(marker,'utf8')):null;
 if(identity&&identity.app!=='verwood-onboarding')throw Error('Storage marker belongs to another app.');
 if(production&&fs.existsSync(file)&&!identity)throw Error('Database has no onboarding storage marker. Stop and inspect storage; do not initialise.');
 if(identity&&!fs.existsSync(file))throw Error('Previously initialised database is missing. Restore a backup; do not initialise again.');
 const canInitialise=!fs.existsSync(file)&&!identity&&process.env.INITIALISE_STORAGE==='YES';
 if(!fs.existsSync(file)&&!canInitialise)throw Error('Storage is empty. FIRST USE ONLY: set INITIALISE_STORAGE=YES and SETUP_KEY to a private random key, then create your administrator. Existing users must restore storage instead.');
 if(canInitialise&&(!process.env.SETUP_KEY||process.env.SETUP_KEY.length<24))throw Error('First-time setup requires SETUP_KEY of at least 24 characters.');
 const empty=()=>({format:'verwood-onboarding-v1',revision:0,accounts:[],records:{},history:[]});
 const db=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):empty();
 if(db.format!=='verwood-onboarding-v1'||!Array.isArray(db.accounts)||!Array.isArray(db.history)||!db.records||!Number.isInteger(db.revision))throw Error('Invalid database. Restore a validated backup.');
 if(fs.existsSync(file)&&!db.accounts.length)throw Error('Existing database has no administrator. Inspect or restore it; public setup is disabled.');
 function snapshot(label='auto'){
  if(!fs.existsSync(file))return;
  verifyMount();fs.mkdirSync(backups,{recursive:true,mode:0o700});
  const target=path.join(backups,`${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${label}.json`);fs.copyFileSync(file,target);fs.chmodSync(target,0o600);
  if(label==='auto'){const files=fs.readdirSync(backups).filter(n=>n.endsWith('-auto.json')).sort();for(const n of files.slice(0,-30))fs.unlinkSync(path.join(backups,n));}
 }
 function save(value){
  try{
   verifyMount();
   if(!identity){if(!canInitialise||!value.accounts.length)throw Error('Explicit administrator setup required');identity={app:'verwood-onboarding',id:crypto.randomUUID(),createdAt:new Date().toISOString()};atomic(marker,identity);}
   else if(!fs.existsSync(marker)||JSON.parse(fs.readFileSync(marker,'utf8')).id!==identity.id)throw Error('Storage identity changed.');
   snapshot();atomic(file,value);
  }catch(e){console.error('STORAGE WRITE FAILED. Service is stopping to protect records:',e.message);process.exit(1);}
 }
 return{production,dir,file,db,canInitialise,save,snapshot,info:()=>({directory:dir,mounted:production,storageId:identity?.id||null,initialised:!!identity,revision:db.revision})};
};
