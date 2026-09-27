const fs=require('node:fs'), path=require('node:path');
const root=__dirname, bank=require('./questions.json');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugs=['air-law','flight-rules','aviation-safety','airbus-a330-fcom','airbus-a320-fcom','boeing-757-fcom','boeing-767-fcom','aerodynamics','airbus-a330-aerodynamics','airbus-a320-aerodynamics','boeing-aerodynamics','airbus-a330-navigation','airbus-a320-navigation','boeing-navigation','meteorology','radio-communication','airbus-a330-emergency-equipment','airbus-a320-emergency-equipment','boeing-emergency-equipment','rvsm','etops','crm'];
const groups=[...new Set(bank.map(q=>q.section_id))].map((id,i)=>{
  const questions=bank.filter(q=>q.section_id===id && q.status==='verified');
  return {id,slug:slugs[i],questions,title:questions[0].section.replace(/^[\d.]+\s*/, '').replace('Перечень вопросов ', '')};
});
if(groups.length!==slugs.length) throw new Error('Review section URLs before rebuilding');
const base=fs.readFileSync(path.join(root,'index.html'),'utf8');
const header=base.match(/<header class="app-header">[\s\S]*?<\/header>/)[0].replace('id="brand-home"','').replaceAll('href="index.html"','href="../index.html"').replaceAll('src="favicon.svg','src="../favicon.svg');
function page(title,description,url,body){return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} — PilotSpace</title>
<meta name="description" content="${escape(description)}"><link rel="canonical" href="https://pilotspace.ru/${url}">
<meta property="og:title" content="${escape(title)} — PilotSpace"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="https://pilotspace.ru/${url}"><meta property="og:type" content="website">
<meta property="og:image" content="https://pilotspace.ru/social/pilotspace-share-v1.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="PilotSpace — тренажёр ЧЛЭ для пилотов. Бесплатно, без регистрации, с офлайн-тренировками.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://pilotspace.ru/social/pilotspace-share-v1.png">
<meta name="twitter:image:alt" content="PilotSpace — тренажёр ЧЛЭ для пилотов. Бесплатно, без регистрации, с офлайн-тренировками.">
<meta property="og:site_name" content="PilotSpace"><meta property="og:locale" content="ru_RU">
<meta name="twitter:title" content="${escape(title)} — PilotSpace"><meta name="twitter:description" content="${escape(description)}">
<link rel="icon" href="../favicon.svg" type="image/svg+xml"><link rel="manifest" href="../site.webmanifest"><link rel="apple-touch-icon" href="../icons/icon-180-v2.png"><script src="../theme.js?v=1"></script><link rel="stylesheet" href="../styles.css?v=16"></head>
<body><div id="app">${header}<main class="section-page">${body}</main><footer class="app-footer"><a href="../index.html">К тренировкам</a> · <a href="../updates.html">Обновления</a><p>Дмитрий Морозов · PilotSpace</p></footer></div></body></html>\n`;}
const outputs={};
for(const group of groups){
 const {questions,title,id,slug}=group;
 const subs=[...new Set(questions.map(q=>q.subsection).filter(Boolean))];
 const examples=questions.filter(q=>!q.images?.length).slice(0,5);
 const description=`${title}: ${questions.length} вопросов для подготовки ЧЛЭ. Примеры вопросов, короткие тренировки и повторение ошибок в PilotSpace.`;
 outputs[`sections/${slug}.html`]=page(title,description,`sections/${slug}.html`,
 `<nav aria-label="Навигация"><a href="../index.html">Главная</a> / <a href="index.html">Разделы подготовки</a></nav>
 <header class="section-intro"><span class="eyebrow">Раздел ${escape(id)} · ${questions.length} вопросов</span><h1>${escape(title)}</h1><p>${escape(description)}</p><a class="btn primary section-start" href="../index.html?section=${encodeURIComponent(id)}">Выбрать тренировку →</a></header>
 ${subs.length?`<section><h2>Системы и подразделы</h2><ul class="section-topics">${subs.map(sub=>`<li>${escape(sub)} <span>· ${questions.filter(q=>q.subsection===sub).length} вопросов</span></li>`).join('')}</ul></section>`:''}
 <section><h2>Примеры вопросов</h2><p>Несколько вопросов из этого раздела. Выбор ответа и проверка доступны в тренировке.</p><ol class="section-examples">${examples.map(q=>`<li><h3>${escape(q.question)}</h3><ul>${Object.entries(q.options).map(([letter,text])=>`<li><strong>${escape(letter)}.</strong> ${escape(text)}</li>`).join('')}</ul></li>`).join('')}</ol></section>
 <section><h2>Как заниматься</h2><p>Выберите 10, 20 или 50 вопросов либо свой диапазон. Прогресс сохраняется в браузере, а неверные ответы попадают в повторение. Для занятий без сети заранее скачайте пакет на главной странице.</p><p>Материалы перенесены из тестового PDF ЧЛЭ. Это тренажёр для самостоятельной подготовки, а не официальный экзамен или замена действующим руководствам.</p></section>
 <nav class="section-related" aria-label="Другие разделы"><h2>Другие темы подготовки</h2>${groups.filter(g=>g.id!==id).map(g=>`<a href="${g.slug}.html">${escape(g.title)}</a>`).join('')}</nav>`);
}
outputs['sections/index.html']=page('Разделы подготовки ЧЛЭ','Каталог тестов ЧЛЭ: Airbus, Boeing, аэродинамика, навигация, метеорология, CRM и правила полётов. Выберите тему подготовки.','sections/index.html',
 `<nav><a href="../index.html">← К тренировкам</a></nav><header class="section-intro"><span class="eyebrow">Выберите свою тему</span><h1>Разделы подготовки ЧЛЭ</h1><p>Посмотрите состав раздела и примеры вопросов, затем переходите к тренировке. Все ${bank.length} вопросов доступны бесплатно.</p></header><div class="section-grid">${groups.map(g=>`<a class="section-tile" href="${g.slug}.html"><span class="eyebrow">Раздел ${g.id} · ${g.questions.length} вопросов</span><h2>${escape(g.title)}</h2><span>Посмотреть раздел →</span></a>`).join('')}</div>`);
outputs['sitemap.xml']='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+['','updates.html',...Object.keys(outputs)].map(url=>`  <url><loc>https://pilotspace.ru/${url}</loc></url>`).join('\n')+'\n</urlset>\n';
for(const [file,content] of Object.entries(outputs)){
 const target=path.join(root,file);
 if(process.argv.includes('--check')) {if(!fs.existsSync(target)||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==content)throw new Error(`Rebuild ${file}`);}
 else {fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
}
console.log(`Generated catalog and ${groups.length} section pages`);
