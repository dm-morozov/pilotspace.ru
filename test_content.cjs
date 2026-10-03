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
 const urls=[...fs.readFileSync('sitemap.xml','utf8').matchAll(/<loc>https:\/\/pilotspace\.ru\/([^<]*)<\/loc>/g)].map(m=>m[1]||'index.html');assert.equal(new Set(urls).size,urls.length);assert.equal(urls.length,53);
 const worker=fs.readFileSync('sw.js','utf8');for(const file of urls){assert(fs.existsSync(file),file);assert(worker.includes('"url":"'+file+'"'),file);}
});

test('lesson self-checks use bank keys and sources; reading pages do not run quiz scripts',()=>{
 const lessons=require('./learning_content.cjs');for(const lesson of lessons){const html=fs.readFileSync('lessons/'+lesson.slug+'.html','utf8');assert.equal([...html.matchAll(/data-question=/g)].length,3);assert(!/src="[^"]*app\.js/.test(html));for(const uid of lesson.checks){const q=bank.find(q=>q.uid===uid);assert(q);const card=html.match(new RegExp('data-question="'+uid+'">([\\s\\S]*?)</details>'))[1];for(const letter of q.correct_answers)assert(card.includes('<strong>'+letter+'.</strong> '+escape(q.options[letter])));}for(const source of lesson.sources)assert(html.includes(escape(source.url)));}
 const hub=fs.readFileSync('learn.html','utf8');assert.equal([...hub.matchAll(/class="catalog-group"/g)].length,4);assert.equal([...hub.matchAll(/class="section-tile"/g)].length,22);assert.equal([...hub.matchAll(/class="lesson-tile"/g)].length,3);
});

 test('all self-check explanations and related lessons are available as static HTML',()=>{
 for(const lesson of require('./learning_content.cjs')){
 const html=fs.readFileSync('lessons/'+lesson.slug+'.html','utf8');
 for(const uid of lesson.checks)assert(html.includes(escape(lesson.explanations[uid])),uid);
 for(const [question,answer] of lesson.faq){assert(html.includes(escape(question)));assert(html.includes(escape(answer)));}
 for(const slug of lesson.related)assert(html.includes('href="'+slug+'.html"'));
 }assert(!fs.readFileSync('sitemap.xml','utf8').includes('lesson-guides.js'));
 });
