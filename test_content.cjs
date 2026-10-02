const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const bank=require('./questions.json'),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('study pages preserve every question, complete correct answers, images and correction notes',()=>{
 const files=fs.readdirSync('sections').filter(f=>f.endsWith('-study.html')), seen=new Set();assert.equal(files.length,22);
 for(const file of files){const html=fs.readFileSync('sections/'+file,'utf8');for(const match of html.matchAll(/<details class="study-card" id="q-([^"]+)">([\s\S]*?)<\/details>/g)){
 const q=bank.find(q=>q.uid===match[1]),card=match[2];assert(q);assert(!seen.has(q.uid));seen.add(q.uid);assert(card.includes(escape(q.question)));
 const letters=[...card.matchAll(/<li><strong>([A-Z])\.<\/strong> ([\s\S]*?)<\/li>/g)];assert.deepEqual(letters.map(m=>m[1]),q.correct_answers);for(const m of letters)assert.equal(m[2],escape(q.options[m[1]]));
 for(const image of q.images||[])assert(card.includes('../'+image.src));if(q.source_note)assert(card.includes(escape(q.source_note)));
 }}assert.equal(seen.size,bank.length);
});
test('sitemap lists unique real pages and all new pages are in offline bundle',()=>{
 const urls=[...fs.readFileSync('sitemap.xml','utf8').matchAll(/<loc>https:\/\/pilotspace\.ru\/([^<]*)<\/loc>/g)].map(m=>m[1]||'index.html');assert.equal(new Set(urls).size,urls.length);assert.equal(urls.length,50);
 const worker=fs.readFileSync('sw.js','utf8');for(const file of urls){assert(fs.existsSync(file),file);assert(worker.includes('"url":"'+file+'"'),file);}
});
