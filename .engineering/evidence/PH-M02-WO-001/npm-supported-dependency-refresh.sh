set -eu
root=/usr/local/lib/node_modules/npm/node_modules
node - <<'NODE'
const root='/usr/local/lib/node_modules/npm/node_modules';
for (const name of ['brace-expansion','undici','http-cache-semantics','tar','ip-address']) console.log(name+'='+require(root+'/'+name+'/package.json').version);
for (const pair of [['minimatch','brace-expansion'],['node-gyp','undici'],['make-fetch-happen','http-cache-semantics']]) {
 const parent=pair[0], dep=pair[1];
 const dir=require('path').dirname(require.resolve(parent+'/package.json',{paths:[root]}));
 console.log(parent+'->'+dep+'='+require(root+'/'+dep+'/package.json').version+'; path='+require.resolve(dep+'/package.json',{paths:[dir]}));
}
NODE
npm --version
cd /workspace
npm run --workspace @polyhunter/web
