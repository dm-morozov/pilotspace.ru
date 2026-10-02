const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/analytics.js','utf8');
function boot(hostname='pilotspace.ru',online=true,pathname='/') {
 const scripts=[],listeners={},calls=[];
 const context={location:{hostname,protocol:'https:',pathname,href:`https://${hostname}${pathname}`},navigator:{onLine:online},document:{scripts,referrer:'',head:{append:s=>scripts.push(s)},createElement:()=>({})},addEventListener:(name,fn)=>listeners[name]=fn,ym:(...args)=>calls.push(args)};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return {context,scripts,listeners,calls};
}
test('analytics excludes local previews and offline sessions',()=>{
 for(const [host,online] of [['localhost',true],['127.0.0.1',true],['pilotspace.ru',false]]){
  const state=boot(host,online);assert.equal(state.calls.length,0);assert.equal(state.scripts.length,0);
 }
});
test('public analytics loads once with the supplied counter and Webvisor',()=>{
 const state=boot();vm.runInContext(source,state.context);
 assert.equal(state.scripts.length,1);assert.equal(state.scripts[0].async,true);
 assert.equal(state.calls.length,1);assert.equal(state.calls[0][0],113331527);assert.equal(state.calls[0][2].webvisor,true);
});
test('download completion requires a pending download and verified ready state',()=>{
 const {context,listeners,calls}=boot();const ready=listeners['pilotspace-offline-ready'];
 ready({detail:true});assert.equal(calls.length,1);
 context.pilotspaceAnalytics('offline_download_start');ready({detail:false});assert.equal(calls.length,2);
 ready({detail:true});ready({detail:true});assert.equal(calls.length,3);assert.equal(calls[2][2],'offline_download_complete');
});
test('lesson events and allowed goals contain no answer or progress parameters',()=>{
 const {context,calls}=boot('pilotspace.ru',true,'/lessons/metar.html');
 assert.equal(calls[1][2],'lesson_open');context.pilotspaceAnalytics('unknown');assert.equal(calls.length,2);
 context.pilotspaceAnalytics('training_complete');assert.equal(calls[2].length,3);
 context.navigator.onLine=false;context.pilotspaceAnalytics('training_start');assert.equal(calls.length,3);
 context.navigator.onLine=true;context.ym=()=>{throw new Error('blocked');};assert.doesNotThrow(()=>context.pilotspaceAnalytics('training_start'));
});
test('every sitemap page includes the shared analytics script once',()=>{
 const urls=[...fs.readFileSync(__dirname+'/sitemap.xml','utf8').matchAll(/<loc>https:\/\/pilotspace.ru\/(.*?)<\/loc>/g)];
 assert.equal(urls.length,53);
 for(const [,path] of urls){const html=fs.readFileSync(__dirname+'/'+(path||'index.html'),'utf8');assert.equal([...html.matchAll(/src="(?:\.\.\/)?analytics\.js\?v=1"/g)].length,1,path);}
});
