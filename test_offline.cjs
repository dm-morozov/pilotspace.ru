const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const worker = fs.readFileSync(__dirname+'/sw.js','utf8');
const info = require('./offline-info.json');

test('file opening disables offline download even when browser exposes secure APIs',()=>{
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id)) elements.set(id,{textContent:'',hidden:false,disabled:false});
    return elements.get(id);
  };
  let fetched=false;
  vm.runInNewContext(fs.readFileSync(__dirname+'/offline.js','utf8'),{
    document:{getElementById:element},
    location:{href:'file:///C:/GitHub/quiz_app/index.html',protocol:'file:'},
    window:{isSecureContext:true,caches:{},addEventListener(){}},
    navigator:{onLine:true,serviceWorker:{}}, URL,WeakSet,
    fetch(){fetched=true;throw new Error('must not fetch');}
  });
  assert.equal(element('btn-offline').disabled,true);
  assert.match(element('offline-status').textContent,/Сейчас открыт файл/);
  assert.equal(fetched,false);
});

function boot({fail='', corrupt='', quota=false}={}) {
  const scope='https://example.test/quiz/';
  const handlers={}, stores=new Map(), messages=[], fetched=[];
  let network=true;
  const caches={
    async open(name) {
      if(!stores.has(name)) stores.set(name,new Map());
      const data=stores.get(name);
      return {
        async put(url,response) {if(quota) throw Object.assign(new Error('quota'),{name:'QuotaExceededError'}); data.set(url,response.clone());},
        async match(url) {return data.get(url)?.clone();},
        async keys() {return [...data.keys()].map(url=>({url}));}
      };
    },
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);}
  };
  const context={URL,Response,Uint8Array,TextEncoder,Map,Set,crypto:webcrypto,caches,
    self:{registration:{scope},location:{origin:'https://example.test'},
      clients:{async matchAll(){return [{url:scope,postMessage:data=>messages.push(data)}];}},
      addEventListener:(type,handler)=>{handlers[type]=handler;}},
    fetch:async request=>{
      const url=typeof request==='string'?request:request.url;
      fetched.push(url);
      if(!network) throw new Error('network');
      const file=new URL(url).pathname.slice('/quiz/'.length);
      if(file===fail) return new Response('missing',{status:404});
      return new Response(file===corrupt?'wrong deployment':fs.readFileSync(__dirname+'/'+file));
    }};
  vm.runInNewContext(worker,context);
  return {stores,messages,fetched,setOffline(){network=false;},
    async lifecycle(type){let work; handlers[type]({waitUntil:p=>{work=p;}}); await work;},
    async status(){let work,reply; handlers.message({data:{type:'STATUS'},ports:[{postMessage:data=>{reply=data;}}],waitUntil:p=>{work=p;}}); await work; return reply;},
    async request(relative,{mode='navigate',method='GET'}={}){
      let work;
      handlers.fetch({request:{url:new URL(relative,scope).href,mode,method},respondWith:p=>{work=p;}});
      return work ? await work : undefined;
    }};
}

test('generated bundle matches shipped files and contains every quiz illustration, not the PDF',()=>{
  execFileSync(process.execPath,[__dirname+'/build_offline.cjs','--check']);
  for(const q of require('./questions.json')) for(const picture of q.images||[]) assert.ok(worker.includes(JSON.stringify(picture.src)));
  assert.ok(!worker.includes('"url":"НОВЫЕ_'));
  assert.ok(info.bytes<12*1024*1024);
});

test('complete installation serves the app, images and journal with origin unavailable',async()=>{
  const sw=boot(); await sw.lifecycle('install');
  assert.equal((await sw.status()).complete,true);
  assert.equal(sw.fetched.length,info.files);
  sw.setOffline();
  for(const url of ['./','index.html?source=home','styles.css?v=14','questions.js','updates.html','images/page-346-1.png']) {
    const response=await sw.request(url);
    assert.equal(response.status,200,url);
    assert.ok((await response.arrayBuffer()).byteLength>0,url);
  }
  assert.equal((await (await sw.request('offline-info.json')).json()).version,info.version);
  const pdf=await sw.request('source.pdf');
  assert.equal(pdf.status,503);
  assert.match(await pdf.text(),/Для открытия PDF нужен интернет/);
  assert.equal(await sw.request('https://other.test/index.html'),undefined);
  assert.equal(await sw.request('questions.js',{method:'POST'}),undefined);
});

for(const [name,options] of [['404',{fail:'questions.js'}],['mixed deployment',{corrupt:'questions.js'}],['storage quota',{quota:true}]]) {
  test(`failed install (${name}) preserves previous bundle and cannot report ready`,async()=>{
    const sw=boot(options); sw.stores.set('pilotspace-offline-old',new Map([['old','still works']]));
    await assert.rejects(sw.lifecycle('install'));
    assert.equal(sw.stores.get('pilotspace-offline-old').get('old'),'still works');
    assert.equal((await sw.status()).complete,false);
    assert.ok(sw.messages.some(message=>message.type==='failure'));
  });
}

test('new install retains old cache until safe activation; missing asset invalidates readiness',async()=>{
  const sw=boot(); sw.stores.set('pilotspace-offline-old',new Map()); sw.stores.set('another-app',new Map());
  await sw.lifecycle('install');
  assert.ok(sw.stores.has('pilotspace-offline-old'));
  await sw.lifecycle('activate');
  assert.equal(sw.stores.has('pilotspace-offline-old'),false);
  assert.ok(sw.stores.has('another-app'));
  sw.stores.get('pilotspace-offline-'+info.version).delete('https://example.test/quiz/questions.js');
  assert.equal((await sw.status()).complete,false);
  // The mock deliberately has no skipWaiting() or clients.claim().
});
