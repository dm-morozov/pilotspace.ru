const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function boot({ios=false, standalone=false, saved=0, blocked=false}={}) {
  const nodes={}, events={}, storage={};
  const el=id=>nodes[id] ||= {hidden:true,textContent:'',handlers:{},addEventListener(k,f){this.handlers[k]=f;},setAttribute(k,v){this[k]=v;}};
  const display={matches:standalone,addEventListener(k,f){this.change=f;}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/install.js','utf8'), {
    document:{getElementById:el},window:{isSecureContext:true,matchMedia:()=>display,addEventListener:(k,f)=>events[k]=f},
    navigator:{userAgent:ios?'iPhone':'Chrome',platform:'',maxTouchPoints:0},location:{protocol:'https:'},
    localStorage:{getItem(){if(blocked)throw Error();return saved;},setItem(k,v){if(blocked)throw Error();storage[k]=v;}},Date
  });
  return {el,events,display,storage};
}
test('first visit offers manual installation without promotion; offline completion reveals it',()=>{
  const b=boot();assert.equal(b.el('install-panel').hidden,false);assert.equal(b.el('install-offer').hidden,true);
  b.events['pilotspace-offline-ready']({detail:true});assert.equal(b.el('install-offer').hidden,false);
  b.events['pilotspace-offline-ready']({detail:false});assert.equal(b.el('install-offer').hidden,true);
});
test('dismissal persists for a week while the manual button remains available',()=>{
  const b=boot();b.events['pilotspace-offline-ready']({detail:true});b.el('btn-dismiss-install').handlers.click();
  assert.equal(b.el('install-offer').hidden,true);assert.equal(b.el('install-panel').hidden,false);
  const saved=Number(b.storage['pilotspace-install-dismissed-until']);assert(saved>Date.now()+6*86400000);
  const reload=boot({saved});reload.events['pilotspace-offline-ready']({detail:true});assert(reload.el('install-offer').hidden);
  const expired=boot({saved:Date.now()-1});expired.events['pilotspace-offline-ready']({detail:true});assert.equal(expired.el('install-offer').hidden,false);
});
test('native install only opens on click and installed apps hide the whole panel',async()=>{
  const b=boot();let prevented=false,called=0;
  b.events.beforeinstallprompt({preventDefault(){prevented=true;},async prompt(){called++;},userChoice:Promise.resolve({outcome:'accepted'})});
  assert(prevented);assert.equal(called,0);await b.el('btn-install').handlers.click();assert.equal(called,1);
  b.events.appinstalled();assert(b.el('install-panel').hidden);
  assert(boot({standalone:true}).el('install-panel').hidden);
});
test('iPhone gets home-screen instructions; blocked storage does not break dismissal',()=>{
  const b=boot({ios:true,blocked:true});b.el('btn-install').handlers.click();assert.equal(b.el('install-help').hidden,false);assert.match(b.el('install-hint').textContent,/Safari/);
  b.events['pilotspace-offline-ready']({detail:true});b.el('btn-dismiss-install').handlers.click();assert(b.el('install-offer').hidden);
});
