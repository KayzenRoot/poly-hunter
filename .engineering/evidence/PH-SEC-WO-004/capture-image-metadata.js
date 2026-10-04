const fs=require('node:fs');
const crypto=require('node:crypto');
const paths={
  packageLock:'/workspace/package-lock.json',
  nestedEsbuild:'/workspace/node_modules/@esbuild-kit/core-utils/node_modules/@esbuild/linux-x64/bin/esbuild',
  topEsbuild:'/workspace/node_modules/@esbuild/linux-x64/bin/esbuild',
  nativeTsc:'/workspace/node_modules/@typescript/typescript-linux-x64/lib/tsc'
};
const out={capturedAtUtc:new Date().toISOString(),containerImage:'polyhunter-dev:local',metadata:{}};
for(const [key,path] of Object.entries(paths)){
 const s=fs.statSync(path); const b=fs.readFileSync(path);
 out.metadata[key]={path,sizeBytes:s.size,mode:'0o'+(s.mode&0o7777).toString(8),uid:s.uid,gid:s.gid,mtimeUtc:s.mtime.toISOString(),sha256:crypto.createHash('sha256').update(b).digest('hex')};
 if(path.endsWith('/esbuild')||path.endsWith('/tsc')){
  out.metadata[key].elf={magic:b.subarray(0,4).toString('hex'),class:b[4],endianness:b[5],machine:b.readUInt16LE(18),architecture:b.readUInt16LE(18)===62?'x86_64':'other'};
 }
}
console.log(JSON.stringify(out,null,2));
