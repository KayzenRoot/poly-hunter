const fs=require('node:fs');
const out={capturedAtUtc:new Date().toISOString(),processes:[],listeningSockets:[]};
for(const entry of fs.readdirSync('/proc')){
 if(!/^\d+$/.test(entry))continue;
 try{
  const dir='/proc/'+entry, cmd=fs.readFileSync(dir+'/cmdline');
  const cmdline=cmd.toString().split('\0').filter(Boolean).join(' ');
  if(!cmdline)continue;
  const status=fs.readFileSync(dir+'/status','utf8');
  const one=(name)=>{const m=status.match(new RegExp('^'+name+':\\s*(.+)$','m'));return m?m[1].trim():null};
  const name=one('Name'), uid=one('Uid'), caps=one('CapEff'), ppid=one('PPid');
  if(/node|nodemon|next|esbuild|\/tsc(?:\s|$)/i.test(name+' '+cmdline))out.processes.push({pid:Number(entry),ppid,uid,capEff:caps,name,cmdline});
 }catch{}
}
for(const file of ['/proc/net/tcp','/proc/net/tcp6']){
 try{
  const lines=fs.readFileSync(file,'utf8').trim().split('\n').slice(1);
  for(const line of lines){const c=line.trim().split(/\s+/);if(c[3]==='0A')out.listeningSockets.push({family:file.endsWith('tcp6')?'tcp6':'tcp',localAddressHex:c[1],localPortHex:c[1].split(':')[1],uid:c[7],inode:c[9]});}
 }catch{}
}
console.log(JSON.stringify(out,null,2));
