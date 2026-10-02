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
const footer=base.match(/<div class="footer-bottom">[\s\S]*?<p class="footer-note">[\s\S]*?<\/p><\/div>/)[0].replaceAll('href="','href="../');
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
<link rel="icon" href="../favicon.svg" type="image/svg+xml"><link rel="manifest" href="../site.webmanifest"><link rel="apple-touch-icon" href="../icons/icon-180-v2.png"><script src="../theme.js?v=1"></script><link rel="stylesheet" href="../styles.css?v=27"></head>
<body><div id="app">${header}<main class="section-page">${body}</main><footer class="app-footer">${footer}</footer></div></body></html>\n`;}
const descriptions = {
 '3.1': 'Воздушный кодекс Республики Узбекистан, полномочия авиационной администрации, экипаж и использование воздушного пространства.',
 '3.2': 'Определения и правила выполнения полётов: аэродромы, взлёт и посадка, визуальные полёты, условия и ограничения.',
 '3.3': 'Классификация авиационных событий, происшествий и инцидентов, вопросы безопасности полётов.',
 '3.4.1': 'Системы Airbus A330: электроснабжение, топливо, гидравлика, управление полётом, двигатели, APU и другие подразделы AFM/FCOM.',
 '3.4.2': 'Системы семейства Airbus A319/A320/A321: автопилот, электроснабжение, топливо, гидравлика, двигатели и другие подразделы AFM/FCOM.',
 '3.4.3': 'Системы Boeing 757: кондиционирование и герметизация, автоматическое управление, электроснабжение, топливо, гидравлика и двигатели.',
 '3.4.4': 'Системы Boeing 767: кондиционирование и герметизация, автоматическое управление, электроснабжение, топливо, гидравлика и двигатели.',
 '3.5.1': 'Практическая аэродинамика: геометрия крыла, угол атаки, аэродинамические силы и режимы полёта.',
 '3.5.2': 'Вопросы практической аэродинамики и характеристик полёта Airbus A330 из базы ЧЛЭ.',
 '3.5.3': 'Вопросы практической аэродинамики и характеристик полёта Airbus A319/A320/A321 из базы ЧЛЭ.',
 '3.5.4': 'Вопросы практической аэродинамики и характеристик полёта Boeing 757/767 из базы ЧЛЭ.',
 '3.6.1': 'Воздушная навигация для Airbus A330: навигационные определения и вопросы подготовки по типу.',
 '3.6.2': 'Воздушная навигация для Airbus A319/A320/A321: высота аэродрома, altitude, course, track и heading.',
 '3.6.3': 'Воздушная навигация для Boeing 757/767: навигационные определения и вопросы подготовки по типу.',
 '3.7': 'Авиационная метеорология: давление, сводки METAR и SPECI, прогноз TREND, ветер и видимость.',
 '3.8': 'Правила ведения радиосвязи: радиотелефонная фразеология, передача сообщений, аварийная частота и отказ связи.',
 '3.9.1': 'Вопросы о бортовых аварийно-спасательных средствах Airbus A330 из базы ЧЛЭ.',
 '3.9.2': 'Вопросы о бортовых аварийно-спасательных средствах Airbus A320/321 из базы ЧЛЭ.',
 '3.9.3': 'Вопросы о бортовых аварийно-спасательных средствах Boeing 757/767 из базы ЧЛЭ.',
 '3.10': 'Полёты в воздушном пространстве RVSM: сокращённое вертикальное эшелонирование и вопросы выполнения полётов.',
 '3.11': 'EDTO (ETOPS): вопросы планирования полёта и выбора запасных аэродромов.',
 '3.12': 'CRM: предполётный брифинг, взаимодействие экипажа, лидерство, перегрузка и управление ошибками.'
};
const lessons=require('./learning_content.cjs');
const outputs={};
for(const group of groups){
 const {questions,title,id,slug}=group;
 const subs=[...new Set(questions.map(q=>q.subsection).filter(Boolean))];
 const examples=questions.filter(q=>!q.images?.length).slice(0,5);
 const description=`${title}: ${questions.length} вопросов. ${descriptions[id]} Бесплатная подготовка ЧЛЭ в PilotSpace.`;
 outputs[`sections/${slug}.html`]=page(title,description,`sections/${slug}.html`,
 `<nav aria-label="Навигация"><a href="../index.html">Главная</a> / <a href="index.html">Разделы подготовки</a></nav>
 <header class="section-intro"><span class="eyebrow">Раздел ${escape(id)} · ${questions.length} вопросов</span><h1>${escape(title)}</h1><p>${escape(descriptions[id])}</p><nav class="content-actions" aria-label="Режим подготовки"><a class="btn secondary" href="${slug}-study.html">Изучить вопросы и ответы</a><a class="btn primary section-start" href="../index.html?section=${encodeURIComponent(id)}">Выбрать тренировку →</a></nav></header>
 ${subs.length?`<section><h2>Системы и подразделы</h2><ul class="section-topics">${subs.map(sub=>`<li>${escape(sub)} <span>· ${questions.filter(q=>q.subsection===sub).length} вопросов</span></li>`).join('')}</ul></section>`:''}
 <section><h2>Примеры вопросов</h2><p>Несколько вопросов из этого раздела. Выбор ответа и проверка доступны в тренировке.</p><ol class="section-examples">${examples.map(q=>`<li><h3>${escape(q.question)}</h3><ul>${Object.entries(q.options).map(([letter,text])=>`<li><strong>${escape(letter)}.</strong> ${escape(text)}</li>`).join('')}</ul></li>`).join('')}</ol></section>
 <section><h2>Как заниматься</h2><p>Выберите 10, 20 или 50 вопросов либо свой диапазон. Прогресс сохраняется в браузере, а неверные ответы попадают в повторение. Для занятий без сети заранее скачайте пакет на главной странице.</p><p>Материалы перенесены из тестового PDF ЧЛЭ. Это тренажёр для самостоятельной подготовки, а не официальный экзамен или замена действующим руководствам.</p></section>
 <nav class="section-related" aria-label="Другие разделы"><h2>Другие темы подготовки</h2>${groups.filter(g=>g.id!==id).map(g=>`<a href="${g.slug}.html">${escape(g.title)}</a>`).join('')}</nav>`);

 const pdf = encodeURIComponent('НОВЫЕ_Тестовые_вопросы_ЧЛЭ_ПОЛНОСТЬЮ_ВЫДЕЛЕНЫ.pdf');
 const topicGroups = subs.length ? subs : [null];
 outputs['sections/'+slug+'-study.html']=page('Вопросы и ответы: '+title, 'Изучение без оценки: '+questions.length+' вопросов. '+descriptions[id], 'sections/'+slug+'-study.html',
 '<nav aria-label="Навигация"><a href="../learn.html">Изучение по темам</a> / <a href="'+slug+'.html">Обзор раздела</a></nav>'+
 '<header class="section-intro"><span class="eyebrow">Изучение без оценки · '+questions.length+' вопросов</span><h1>'+escape(title)+': вопросы и ответы</h1><p>'+escape(descriptions[id])+'</p><p>Сначала попробуйте ответить самостоятельно, затем раскройте вопрос и сравните ответ с ключом базы. Здесь нет счёта, результаты чтения не меняют прогресс тренировок.</p><a class="btn primary" href="../index.html?section='+encodeURIComponent(id)+'">Проверить себя в тренировке →</a></header>'+
 '<p class="content-note">Ответы приведены по тестовой базе MY FREIGHTER с задокументированными исправлениями. Это материал для повторения, а не самостоятельное руководство по эксплуатации. Правовые вопросы включают нормы Узбекистана. <a href="../about.html#source">Об источнике</a>. Ссылки на полный PDF требуют интернета.</p>'+
 (subs.length?'<nav class="study-topics" aria-label="Перейти к системе">'+subs.map((sub,i)=>'<a href="#topic-'+i+'">'+escape(sub)+'</a>').join('')+'</nav>':'')+
 topicGroups.map((sub,i)=>'<section id="topic-'+i+'"><h2>'+escape(sub||'Вопросы раздела')+'</h2><div class="study-list">'+questions.filter(q=>q.subsection===sub || (!sub && !q.subsection)).map(q=>
 '<details class="study-card" id="q-'+escape(q.uid)+'"><summary><span class="study-number">'+q.id+'</span><span>'+escape(q.question)+'</span></summary><div class="study-answer">'+
 (q.images||[]).map(img=>'<img loading="lazy" src="../'+escape(img.src)+'" alt="'+escape(img.alt)+'">').join('')+
 '<span class="eyebrow">Ответ по ключу базы'+(q.correct_answers.length>1?' · несколько вариантов':'')+'</span><ul>'+q.correct_answers.map(letter=>'<li><strong>'+escape(letter)+'.</strong> '+escape(q.options[letter])+'</li>').join('')+'</ul>'+
 (q.source_note?'<p>'+escape(q.source_note)+'</p>':'')+
 '<a class="study-source" href="../'+pdf+'#page='+q.source_pages[0]+'">Источник: PDF, стр. '+q.source_pages.join(', ')+' ↗</a></div></details>').join('')+'</div></section>').join(''));
}
outputs['sections/index.html']=page('Разделы подготовки ЧЛЭ','Каталог тестов ЧЛЭ: Airbus, Boeing, аэродинамика, навигация, метеорология, CRM и правила полётов. Выберите тему подготовки.','sections/index.html',
 `<nav><a href="../index.html">← К тренировкам</a></nav><header class="section-intro"><span class="eyebrow">Выберите свою тему</span><h1>Разделы подготовки ЧЛЭ</h1><p>Посмотрите состав раздела и примеры вопросов, затем переходите к тренировке. Все ${bank.length} вопросов доступны бесплатно.</p></header><div class="section-grid">${groups.map(g=>`<a class="section-tile" href="${g.slug}.html"><span class="eyebrow">Раздел ${g.id} · ${g.questions.length} вопросов</span><h2>${escape(g.title)}</h2><span>Посмотреть раздел →</span></a>`).join('')}</div>`);

function rootPage(title,description,url,body) { return page(title,description,url,body).replaceAll('../',''); }
outputs['about.html']=rootPage('Тренажёр для пилотов: кому и для чего нужен PilotSpace','Подготовка членов лётных экипажей к проверке теоретических знаний. Airbus A330, A319/320/321, Boeing 757/767 и общие авиационные дисциплины.','about.html',
 '<nav aria-label="Навигация"><a href="index.html">← К тренировкам</a> · <a href="learn.html">Изучение по темам</a></nav><header class="section-intro"><span class="eyebrow">Знакомство с PilotSpace</span><h1>Теоретическая подготовка пилотов — по темам и в своём темпе</h1><p>PilotSpace — бесплатный тренажёр для членов лётных экипажей (ЧЛЭ). Он помогает повторять теоретические вопросы перед проверкой знаний, находить пробелы и возвращаться к сложным темам.</p><div class="content-actions"><a class="btn primary" href="index.html">Начать тренировку</a><a class="btn secondary" href="learn.html">Сначала изучить материал</a></div></header>'+
 '<section><h2>Для кого этот тренажёр</h2><p>Для пилотов Airbus A330, семейства A319/A320/A321 и Boeing 757/767, которые хотят повторить системы своего самолёта и общие авиационные дисциплины. Студентам и интересующимся авиацией можно использовать вопросы для знакомства с темами; для изучения с нуля понадобятся учебники и обучение с преподавателем.</p><p>База взята из тестовых вопросов контроля знаний членов лётных экипажей ООО «MY FREIGHTER». Раздел воздушного права содержит вопросы по законодательству Республики Узбекистан. Состав и ответы вашего экзамена могут отличаться: сверяйте программу подготовки своей авиакомпании.</p></section>'+
 '<section><h2>Какие знания можно повторить</h2><div class="section-grid">'+[
 ['airbus-a320-fcom','Системы Airbus и Boeing','Электроснабжение, топливо, гидравлика, автоматическое управление, двигатели, APU, герметизация и другие системы. Отдельные разделы для каждого типа.'],
 ['aerodynamics','Аэродинамика и навигация','Геометрия крыла, угол атаки, силы в полёте, навигационные определения и вопросы по типу самолёта.'],
 ['meteorology','Метеорология и радиосвязь','METAR, SPECI, TREND, давление, ветер и видимость; фразеология и правила передачи сообщений.'],
 ['flight-rules','Правила и безопасность полётов','Правила выполнения полётов, авиационные события, воздушное право, RVSM и EDTO (ETOPS).'],
 ['crm','Работа экипажа и CRM','Брифинг, взаимодействие и лидерство, человеческие возможности, перегрузка и управление ошибками.'],
 ['airbus-a320-emergency-equipment','Аварийно-спасательные средства','Отдельные подборки вопросов о бортовом аварийно-спасательном оборудовании Airbus и Boeing.']
 ].map(([slug,title,text])=>'<a class="section-tile" href="sections/'+slug+'.html"><h3>'+title+'</h3><p>'+text+'</p><span>Посмотреть вопросы →</span></a>').join('')+'</div><p>В базе '+bank.length+' вопросов и '+groups.length+' раздела. Часть вопросов на русском, часть на английском, как в исходном документе. <a href="sections/index.html">Полный каталог разделов</a>.</p></section>'+
 '<section><h2>Как это помогает готовиться</h2><ol class="learning-steps"><li><strong>Повторите одну тему.</strong> Откройте систему самолёта или дисциплину и прочитайте вопросы с ответами без оценки.</li><li><strong>Проверьте себя.</strong> Пройдите короткую тренировку на 10, 20 или 50 вопросов либо выберите свой диапазон.</li><li><strong>Разберите ошибки.</strong> После завершения откройте разбор и повторите неверные ответы этой попытки. Сложные вопросы можно отметить звёздочкой.</li><li><strong>Продолжите позже.</strong> Незавершённая тренировка, избранное и последние 20 результатов сохраняются в вашем браузере.</li></ol></section>'+
 '<section><h2>Можно ли заниматься без интернета</h2><p>Да. Заранее скачайте офлайн-пакет на главной странице. Вопросы, изображения, изучение по темам и тренировки будут доступны в том же браузере без сети. PilotSpace можно установить на главный экран телефона. Регистрация и подписка не нужны.</p><p>Прогресс хранится на устройстве; автоматической синхронизации пока нет. Его можно перенести через файл. <a href="help.html">Инструкции по установке и сохранению</a>.</p></section>'+
 '<section id="source"><h2>На каких материалах основана база</h2><p>Источник — «Тестовые вопросы контроля знаний членов лётных экипажей ООО MY FREIGHTER», редакция 22.04.2026. Вопросы, ответы и иллюстрации перенесены из PDF; выявленные расхождения и исправления записаны в отчёте проекта.</p><p>Проверка переноса по PDF не означает независимую экспертизу каждого технического утверждения. PilotSpace — самостоятельный проект, не официальный экзамен MY FREIGHTER, Airbus, Boeing или авиационных властей. Для практической работы используйте актуальные руководства и процедуры своей авиакомпании.</p></section>'+
 '<section><h2>Кто развивает проект</h2><p>Меня зовут Дмитрий Морозов. Я один развиваю PilotSpace в свободное время, чтобы повторять материал было удобнее с телефона и компьютера. Тренажёр остаётся бесплатным. Сообщения об ошибках, пожелания и добровольная поддержка помогают выбирать следующие улучшения.</p><div class="content-actions"><a href="https://t.me/dem2014">Написать в Telegram ↗</a><a href="mailto:dem.morozov@gmail.com">Написать на почту</a><a href="index.html#support-section">Поддержать проект</a><a href="updates.html">История обновлений</a></div></section>');
const catalogGroups=[
 {title:'Общие дисциплины',text:'Правила, аэродинамика, метеорология, радиосвязь и CRM',ids:['3.1','3.2','3.3','3.5.1','3.7','3.8','3.10','3.11','3.12']},
 {title:'Airbus A330',text:'Системы, аэродинамика, навигация и аварийно-спасательные средства',ids:['3.4.1','3.5.2','3.6.1','3.9.1']},
 {title:'Airbus A319 / A320 / A321',text:'Системы, аэродинамика, навигация и аварийно-спасательные средства',ids:['3.4.2','3.5.3','3.6.2','3.9.2']},
 {title:'Boeing 757 / 767',text:'Два раздела систем и общие темы для семейства',ids:['3.4.3','3.4.4','3.5.4','3.6.3','3.9.3']}
];
outputs['learn.html']=rootPage('Уроки и вопросы для теоретической подготовки пилотов','Короткие уроки по METAR и навигации, затем вопросы для самопроверки. Все 22 раздела Airbus, Boeing и общих дисциплин бесплатно и офлайн.','learn.html',
 '<nav aria-label="Навигация"><a href="index.html">← К тренировкам</a> · <a href="about.html">О тренажёре</a></nav><header class="section-intro"><span class="eyebrow">Понять → повторить → проверить себя</span><h1>Изучение по темам</h1><p>Короткие объяснения и вопросы для повторения. Выберите урок или раскройте подборку по своему типу самолёта.</p><nav class="learning-nav" aria-label="Разделы изучения"><a href="#lessons">Короткие уроки</a><a href="#question-bank">База вопросов</a></nav></header>'+
 '<section id="lessons"><div class="catalog-heading"><h2>Короткие уроки</h2><span>2 материала</span></div><p>Основные понятия, учебный пример и три вопроса для самопроверки. Источники указаны в конце каждого урока.</p><div class="lesson-grid">'+lessons.map(l=>'<a class="lesson-tile" href="lessons/'+l.slug+'.html"><span class="eyebrow">'+escape(l.eyebrow)+'</span><h3>'+escape(l.title)+'</h3><p>'+escape(l.description)+'</p><span class="lesson-action">Открыть урок →</span></a>').join('')+'</div></section>'+
 '<section id="question-bank"><div class="catalog-heading"><h2>Вопросы с ответами</h2><span>'+groups.length+' раздела · '+bank.length+' вопроса</span></div><p>Раскройте нужную подборку. Чтение и самопроверка не меняют прогресс тренировок.</p><div class="catalog-groups">'+catalogGroups.map(category=>'<details class="catalog-group"><summary><span><strong>'+escape(category.title)+'</strong><small>'+escape(category.text)+'</small></span><span class="count-chip">'+category.ids.length+'</span></summary><div class="section-grid">'+groups.filter(g=>category.ids.includes(g.id)).map(g=>'<a class="section-tile" href="sections/'+g.slug+'-study.html"><span class="eyebrow">'+g.questions.length+' вопросов</span><h3>'+escape(g.title)+'</h3><span>Изучить вопросы и ответы →</span></a>').join('')+'</div></details>').join('')+'</div><details class="learning-source-note"><summary>Об источнике базы</summary><p>Вопросы взяты из базы ЧЛЭ MY FREIGHTER. Правовые вопросы включают законодательство Узбекистана. <a href="about.html#source">Подробнее об источнике и назначении</a>.</p></details></section>');
for (const lesson of lessons) {
 const related = lesson.slug==='metar' ? '<a href="../index.html?section=3.7">Тренировка по метеорологии →</a>' : '<a href="../index.html?section=3.6.1">Airbus A330</a><a href="../index.html?section=3.6.2">Airbus A319/320/321</a><a href="../index.html?section=3.6.3">Boeing 757/767</a>';
 outputs['lessons/'+lesson.slug+'.html']=page(lesson.title,lesson.description,'lessons/'+lesson.slug+'.html',
 '<nav aria-label="Навигация"><a href="../learn.html">← К изучению</a> / '+escape(lesson.eyebrow)+'</nav><article class="lesson-page"><header class="section-intro"><span class="eyebrow">'+escape(lesson.eyebrow)+' · короткий урок</span><h1>'+escape(lesson.title)+'</h1><p>'+escape(lesson.description)+'</p><nav class="lesson-outline" aria-label="Содержание урока"><a href="#basics">Понятия</a><a href="#example">Пример</a><a href="#self-check">Самопроверка</a></nav></header>'+lesson.body+
 '<section id="self-check"><h2>Проверьте себя</h2><p>Ответьте самостоятельно и раскройте карточку. Здесь вопросы из базы ЧЛЭ, без счёта и изменения сохранённой тренировки.</p><div class="study-list">'+lesson.checks.map(uid=>{
 const q=bank.find(q=>q.uid===uid);if(!q)throw Error('Unknown lesson question '+uid);
 return '<details class="study-card" data-question="'+escape(uid)+'"><summary><span>'+escape(q.question)+'</span></summary><div class="study-answer"><ul>'+q.correct_answers.map(letter=>'<li><strong>'+letter+'.</strong> '+escape(q.options[letter])+'</li>').join('')+'</ul><a class="study-source" href="../sections/'+lesson.study+'-study.html#q-'+escape(uid)+'">Вопрос в базе →</a></div></details>';
 }).join('')+'</div></section><section class="lesson-next"><h2>Закрепить в тренировке</h2><p>Выберите раздел для проверки знаний. Переход откроет настройки; новая попытка начнётся только после вашего нажатия.</p><div class="content-actions">'+related+'</div><a class="study-source" href="../learn.html">← Вернуться к другим темам</a></section>'+
 '<section class="lesson-sources"><h2>Источники и проверка</h2><ul>'+lesson.sources.map(source=>'<li><a href="'+escape(source.url)+'">'+escape(source.title)+' ↗</a></li>').join('')+'</ul><p>Материал подготовил Дмитрий Морозов. Сверено с указанными источниками 2 октября 2026. Это краткое повторение понятий; практические действия определяются актуальными руководствами и процедурами вашей авиакомпании. Текст и самопроверка доступны офлайн, внешние источники — при подключении к интернету.</p><a href="mailto:dem.morozov@gmail.com?subject='+encodeURIComponent('PilotSpace: замечание к уроку '+lesson.title)+'">Предложить уточнение к уроку ↗</a></section></article>');
}
outputs['sitemap.xml']='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+['','updates.html','help.html',...Object.keys(outputs)].map(url=>`  <url><loc>https://pilotspace.ru/${url}</loc></url>`).join('\n')+'\n</urlset>\n';
for(const [file,content] of Object.entries(outputs)){
 const target=path.join(root,file);
 if(process.argv.includes('--check')) {if(!fs.existsSync(target)||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==content)throw new Error(`Rebuild ${file}`);}
 else {fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
}
console.log(`Generated catalog and ${groups.length} section pages`);
