const fs=require('node:fs'),path=require('node:path');
const {relocateCloneCache}=require('./prepare-build.cjs');
const root=fs.realpathSync(process.cwd());
if(process.platform==='linux'&&root.startsWith('/dev/shm/repo/'))relocateCloneCache(root,'/tmp');
const output=path.join(root,'release-output');
if(fs.existsSync(output))throw Error('Release output already exists; refusing to overwrite it.');
fs.mkdirSync(output);let retained=0,externalOriginals=0,bytes=0;
function copy(dir,rel=''){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.name.startsWith('.')||['release-output','node_modules'].includes(entry.name))continue;
  const from=path.join(dir,entry.name),next=path.join(rel,entry.name),to=path.join(output,next);
  if(entry.isSymbolicLink())throw Error('Unexpected source symlink: '+next);
  if(entry.isDirectory()){fs.mkdirSync(to);copy(from,next);continue;}
  if(next.replaceAll('\\','/').startsWith('assets/')&&entry.name.endsWith('.png')){
   const equivalent=from.slice(0,-4)+'.lossless-v2.webp';
   if(!fs.existsSync(equivalent))throw Error('No verified lossless display image for '+next);
   externalOriginals++;continue;
  }
  try{fs.linkSync(from,to)}catch(e){if(!['EXDEV','EPERM','ENOTSUP'].includes(e.code))throw e;fs.copyFileSync(from,to)}
  retained++;bytes+=fs.statSync(from).size;
 }
}
copy(root);
console.log(JSON.stringify({output:'release-output',files:retained,bytes,originalPNGServedByExistingOSS:externalOriginals,sourceFilesRetained:true}));
