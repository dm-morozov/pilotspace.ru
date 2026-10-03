const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const database = require('./questions.json');

// Minimal DOM adapter: exercise the actual app event handlers without a browser dependency.
function boot(data = database, storage = new Map(), size = 'custom', search = '') {
    class Element {
        constructor(tag = 'div') {
            this.tag = tag; this.children = []; this.value = ''; this.textContent = '';
            this.disabled = false; this.hidden = false; this.dataset = {}; this.style = {};
            this.listeners = {}; this.attributes = {}; this.classes = new Set();
            this.classList = {add: x => this.classes.add(x), toggle: (x, yes) => yes ? this.classes.add(x) : this.classes.delete(x)};
        }
        append(...items) { this.children.push(...items); }
        add(item) { this.append(item); }
        replaceChildren(...items) { this.children = items; if (this.tag === 'select') this.value = items[0]?.value || ''; }
        get options() { return this.children; }
        setAttribute(key, value) { this.attributes[key] = value; }
        addEventListener(event, listener) { this.listeners[event] = listener; }
        click() { if (!this.disabled) this.listeners.click?.(); }
        change(value) { this.value = value; this.listeners.change?.(); }
    }
    const elements = {};
    const html = fs.readFileSync(__dirname+'/index.html', 'utf8');
    for (const match of html.matchAll(/<([a-z0-9]+)[^>]*\bid="([^"]+)"/g)) elements[match[2]] = new Element(match[1]);
    elements['section-select'].value = 'all';
    const context = {windowQuestions: data, Math, Set, URLSearchParams, location: {search},
        localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
        Option: class extends Element { constructor(text, value) { super('option'); this.textContent=text; this.value=value; } },
        document: {getElementById: id => elements[id], createElement: tag => new Element(tag),
            createTextNode: text => ({textContent:text}), addEventListener: (_, fn) => fn()}};
    vm.runInNewContext(fs.readFileSync(__dirname+'/lesson-guides.js', 'utf8'), context);
    vm.runInNewContext(fs.readFileSync(__dirname+'/app.js', 'utf8'), context);
    // Existing scoring tests use the full, ordered range explicitly.
    if (size !== '20') elements[`size-${size}`].click();
    return elements;
}

test('section links select their topic without starting or replacing a session', () => {
    const q=database.find(q=>q.section_id==='3.7');
    const ui=boot(database,new Map(),'custom','?section=3.7');
    assert.equal(ui['section-select'].value,q.section);
    assert.ok(ui['start-screen'].classes.has('active'));
    ui['btn-start'].click();
    assert.equal(ui['question-section'].textContent,q.section);
    assert.equal(boot(database,new Map(),'custom','?section=unknown')['section-select'].value,'all');
});

test('single-answer scoring locks repeated clicks and resets on restart', () => {
    const q = database[0], ui = boot([q]);
    ui['btn-start'].click();
    assert.equal(ui['btn-next'].disabled, true);
    ui['options-container'].children.find(b=>b.dataset.letter===q.correct_answers[0]).click();
    assert.equal(Number(ui.score.textContent), 1);
    ui['options-container'].children[0].click();
    assert.equal(Number(ui.score.textContent), 1);
    ui['btn-next'].click();
    assert.equal(ui['final-score-total'].textContent, 1);
    ui['btn-restart'].click(); ui['btn-start'].click();
    assert.equal(Number(ui.score.textContent), 0);
    assert.equal(ui['btn-next'].disabled, true);
});

test('brand returns home without losing an answered training session', () => {
    const q=database[0], ui=boot([q]);
    ui['btn-start'].click();
    ui['options-container'].children.find(b=>b.dataset.letter===q.correct_answers[0]).click();
    ui['brand-home'].click();
    assert.ok(ui['start-screen'].classes.has('active'));
    assert.equal(ui['btn-resume'].hidden,false);
    ui['btn-resume'].click();
    assert.equal(Number(ui.score.textContent),1);
    assert.equal(ui['btn-next'].disabled,false);
});

test('completion review separates current errors and shows complete correct answer sets', () => {
    const q1=database[0], q2=database.find(q=>q.uid==='3.12:4'), ui=boot([q1,q2]);
    ui['btn-start'].click();
    ui['options-container'].children.find(b=>b.dataset.letter===q1.correct_answers[0]).click();
    ui['btn-next'].click();
    ui['options-container'].children.find(b=>b.dataset.letter==='A').click();
    ui['btn-check'].click(); ui['btn-next'].click();
    assert.equal(ui['review-list'].children.length,1);
    const body=ui['review-list'].children[0].children[1];
    const answers=body.children.filter(el=>el.className==='review-answer').map(el=>el.textContent);
    assert.deepEqual(answers,q2.correct_answers.map(letter=>`${letter}. ${q2.options[letter]}`));
    ui['review-all'].click();
    assert.equal(ui['review-list'].children.length,2);
    ui['review-errors'].click();
    assert.equal(ui['review-list'].children.length,1);
});

test('perfect completion offers an empty error state and all questions', () => {
    const q=database[0], ui=boot([q]); ui['btn-start'].click();
    ui['options-container'].children.find(b=>b.dataset.letter===q.correct_answers[0]).click();
    ui['btn-next'].click();
    assert.equal(ui['review-empty'].hidden,false);
    assert.equal(ui['review-list'].children.length,0);
    ui['review-all'].click();
    assert.equal(ui['review-empty'].hidden,true);
    assert.equal(ui['review-list'].children.length,1);
});

test('multiple answers require the complete set and reject extra choices', () => {
    const q = database.find(q=>q.uid==='3.12:4');
    for (const [choice, expected] of [[['A'],0], [['A','D'],1], [['A','B','D'],0]]) {
        const ui=boot([q]); ui['btn-start'].click();
        for(const letter of choice) ui['options-container'].children.find(b=>b.dataset.letter===letter).click();
        assert.equal(Number(ui.score.textContent),0);
        assert.equal(ui['btn-next'].disabled,true);
        ui['btn-check'].click();
        assert.equal(Number(ui.score.textContent), expected);
        ui['btn-check'].click();
        assert.equal(Number(ui.score.textContent), expected);
    }
});

test('deselecting the only multi-answer choice disables submission', () => {
    const ui = boot([database.find(q=>q.uid==='3.12:4')]);
    ui['btn-start'].click();
    ui['options-container'].children[0].click(); ui['options-container'].children[0].click();
    assert.equal(ui['btn-check'].disabled, true);
});

test('all reviewed questions enter training and review selector is absent', () => {
    const ui=boot();
    assert.equal(ui['total-questions'].textContent,2854);
    assert.equal(ui['mode-select'],undefined);
    const data=database.filter(q=>q.status==='needs_review');
    assert.equal(data.length,0);
    assert.equal(database.find(q=>q.uid==='3.4.4:G:3').correct_answers[0],'A');
    assert.equal(database.find(q=>q.uid==='3.5.1:22').correct_answers[0],'B');
});

test('revised PES and climb answers are scored by the corrected key', () => {
    for (const [uid, correct, wrong] of [['3.4.4:G:3', 'A', 'C'], ['3.5.1:22', 'B', 'A']]) {
        const q=database.find(item=>item.uid===uid);
        for (const [choice, expected] of [[correct,1],[wrong,0]]) {
            const ui=boot([q]); ui['btn-start'].click();
            ui['options-container'].children.find(button=>button.dataset.letter===choice).click();
            assert.equal(Number(ui.score.textContent),expected,`${uid}: ${choice}`);
        }
    }
});

test('section and subsystem filters and source illustrations remain usable', () => {
    const q=database.find(q=>q.uid==='3.4.2:U:13'), ui=boot();
    ui['section-select'].change(q.section); ui['subsection-select'].change(q.subsection);
    ui['btn-start'].click();
    assert.match(ui['question-section'].textContent,/Airbus 319\/320\/321.*Engines/);
    for(let i=1;i<13;i++) {
        ui['options-container'].children[0].click(); ui['btn-next'].click();
    }
    assert.ok(ui['question-text'].textContent.startsWith('13.'));
    assert.equal(ui['question-images'].children.length,1);
    assert.equal(ui['question-images'].children[0].src,q.images[0].src);
    assert.ok(ui['question-source'].children[0].href.endsWith('#page=216'));
});

test('literal option text is not interpreted as HTML', () => {
    const q={...database[0],options:{A:'<img src=x> & < 100',B:'True'}};
    const ui=boot([q]); ui['btn-start'].click();
    assert.equal(ui['options-container'].children[0].children[1].textContent,'<img src=x> & < 100');
});

test('missing data produces a visible error instead of a reference error', () => {
    const ui=boot([]);
    assert.match(ui['loading-screen'].textContent,/Ошибка загрузки базы/);
});

const choose = (ui, letter) => ui['options-container'].children.find(b => b.dataset.letter === letter).click();
test('short practice samples unique verified questions within section and subsystem', () => {
    const target = database.find(q => q.uid === '3.4.2:U:13');
    for (const size of ['10', '20', '50']) {
        const storage = new Map(), ui = boot(database, storage, size);
        ui['section-select'].change(target.section); ui['subsection-select'].change(target.subsection);
        ui['btn-start'].click();
        const session = JSON.parse(storage.get('chle-progress-v1')).saved;
        const pool = database.filter(q => q.section === target.section && q.subsection === target.subsection && q.status === 'verified');
        assert.equal(session.ids.length, Math.min(Number(size), pool.length));
        assert.equal(new Set(session.ids).size, session.ids.length);
        assert.ok(session.ids.every(id => pool.some(q => q.uid === id)));
        const resumed = boot(database, storage); resumed['btn-resume'].click();
        assert.ok(resumed['question-text'].textContent.includes(database.find(q => q.uid === session.ids[0]).question));
        assert.equal(JSON.parse(storage.get('chle-progress-v1')).saved.ids.join(','), session.ids.join(','));
    }
});

test('short practice handles small and empty pools and preserves custom ranges', () => {
    const ui = boot(database.slice(0, 3), new Map(), '20');
    assert.ok(ui['practice-summary'].textContent.includes('меньше'));
    ui['btn-start'].click(); assert.equal(ui['current-question-num'].textContent, 'Вопрос 1 из 3');
    ui['btn-home'].click(); ui['section-select'].change('missing');
    assert.equal(ui['btn-start'].disabled, true);
    const storage = new Map(), custom = boot(database, storage);
    custom['range-select'].change('50-100'); custom['btn-start'].click();
    const expected = database.filter(q => q.status === 'verified').slice(50, 100).map(q => q.uid);
    assert.equal(JSON.parse(storage.get('chle-progress-v1')).saved.ids.join(','), expected.join(','));
    custom['btn-home'].click(); custom['size-10'].click();
    assert.equal(custom['range-group'].hidden, true);
    custom['btn-start'].click();
    assert.equal(JSON.parse(storage.get('chle-progress-v1')).saved.ids.length, 10);
});
test('reload restores an answered question without awarding a second point', () => {
    const data = database.slice(0, 2), storage = new Map();
    let ui = boot(data, storage); ui['btn-start'].click(); choose(ui, data[0].correct_answers[0]);
    ui = boot(data, storage);
    assert.equal(ui['resume-panel'].hidden, false);
    ui['btn-resume'].click();
    assert.equal(Number(ui.score.textContent), 1);
    assert.ok(ui['options-container'].children.every(b => b.disabled));
    ui['btn-check'].click(); assert.equal(Number(ui.score.textContent), 1);
    ui['btn-next'].click();
    ui = boot(data, storage); ui['btn-resume'].click();
    assert.ok(ui['question-text'].textContent.startsWith(`${data[1].id}.`));
    assert.equal(ui['btn-next'].disabled, true);
    assert.equal(Number(ui.score.textContent), 1);
});

test('unfinished multi-selection survives reload and is graded only on submission', () => {
    const q = database.find(q => q.uid === '3.12:4'), storage = new Map();
    let ui = boot([q], storage); ui['btn-start'].click(); choose(ui, 'A');
    ui = boot([q], storage); ui['btn-resume'].click();
    assert.equal(ui['options-container'].children.find(b => b.dataset.letter === 'A').attributes['aria-pressed'], 'true');
    assert.equal(Number(ui.score.textContent), 0);
    choose(ui, 'D'); ui['btn-check'].click();
    assert.equal(Number(ui.score.textContent), 1);
});

test('mistakes persist, repeat independently of filters, and disappear after correct retry', () => {
    const q = database[0], storage = new Map();
    let ui = boot([q], storage); ui['btn-start'].click();
    choose(ui, Object.keys(q.options).find(l => !q.correct_answers.includes(l)));
    ui['btn-next'].click();
    assert.equal(JSON.parse(storage.get('chle-progress-v1')).saved, null);
    ui = boot([q], storage);
    assert.equal(ui['mistake-count'].textContent, 1);
    assert.equal(ui['mistake-list'].children.length, 1);
    ui['section-select'].change('nonexistent');
    ui['btn-mistakes'].click(); choose(ui, q.correct_answers[0]); ui['btn-next'].click();
    ui = boot([q], storage);
    assert.equal(ui['mistake-count'].textContent, 0);
    assert.equal(ui['resume-panel'].hidden, true);
});

test('old review sessions cannot be resumed or imported as scored training', async () => {
    const {q,data}=exportedFixture(), storage=new Map();
    const legacy={...data,saved:{...data.saved,mode:'review'}};
    storage.set('chle-progress-v1',JSON.stringify(legacy));
    const ui=boot([q],storage);
    assert.equal(ui['resume-panel'].hidden,true);
    await importFile(ui,legacy);
    assert.equal(ui['import-preview'].hidden,true);
});

test('invalid and outdated saves do not break the app or apply to changed questions', () => {
    const q = database[0], storage = new Map([['chle-progress-v1', '{broken']]);
    let ui = boot([q], storage); assert.equal(ui['resume-panel'].hidden, true);
    ui['btn-start'].click();
    const state = JSON.parse(storage.get('chle-progress-v1'));
    state.saved.index = 400;
    storage.set('chle-progress-v1', JSON.stringify(state));
    ui = boot([q], storage); assert.equal(ui['resume-panel'].hidden, true);
    ui['btn-start'].click();
    ui = boot([{...q, question: q.question + ' Updated'}], storage);
    assert.equal(ui['resume-panel'].hidden, true);
    assert.ok(ui['storage-notice'].textContent.includes('обновилась'));
});

test('blocked storage still allows completing a quiz and reports the limitation', () => {
    const q = database[0];
    const ui = boot([q], {get() {throw Error('blocked')}, set() {throw Error('quota')}});
    ui['btn-start'].click(); choose(ui, q.correct_answers[0]); ui['btn-next'].click();
    assert.equal(Number(ui['final-score-value'].textContent), 1);
    assert.ok(ui['storage-notice'].textContent.includes('не разрешил'));
});

async function importFile(ui, data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    ui['progress-file'].files = [{size: text.length, text: async () => text}];
    await ui['progress-file'].listeners.change();
}
function exportedFixture() {
    const storage = new Map(), q = database[0], ui = boot([q], storage);
    ui['btn-start'].click();
    ui['options-container'].children.find(b => b.dataset.letter !== q.correct_answers[0]).click();
    return {q, data: {app: 'PilotSpace', ...JSON.parse(storage.get('chle-progress-v1'))}};
}
test('import previews without mutation, cancels, then restores a session and mistakes', async () => {
    const {q,data} = exportedFixture(), storage = new Map(), ui = boot([q],storage);
    await importFile(ui,data);
    assert.equal(ui['import-preview'].hidden,false);
    assert.equal(storage.size,0);
    ui['btn-cancel-import'].click();
    ui['btn-confirm-import'].click();
    assert.equal(storage.size,0);
    await importFile(ui,data);
    ui['btn-confirm-import'].click();
    assert.equal(ui['mistake-count'].textContent,1);
    ui['btn-resume'].click();
    assert.equal(ui['answer-feedback'].textContent.startsWith('Неверно.'),true);
    assert.equal(Number(ui.score.textContent),0);
});
test('invalid imports never replace current progress', async () => {
    const {q,data} = exportedFixture(), storage = new Map(), ui = boot([q],storage);
    ui['btn-start'].click();
    const before=storage.get('chle-progress-v1');
    for(const invalid of ['{', null, {...data,revision:0}, {...data,mistakes:['unknown']}, {...data,saved:{...data.saved,index:99}}]) {
        await importFile(ui, invalid);
        assert.equal(ui['import-preview'].hidden,true);
        ui['btn-confirm-import'].click();
        assert.equal(storage.get('chle-progress-v1'),before);
    }
});
test('storage failure during import preserves the live session', async () => {
    const {q,data} = exportedFixture(), storage = new Map(), ui = boot([q],storage);
    ui['btn-start'].click();
    storage.set=()=>{throw new Error('blocked')};
    await importFile(ui,data); ui['btn-confirm-import'].click();
    assert.match(ui['transfer-status'].textContent,/не разрешил/);
    ui['btn-resume'].click();
    assert.equal(ui['btn-next'].disabled,true);
    assert.equal(ui['mistake-count'].textContent,0);
});
test('question report includes its stable id and PDF pages', () => {
    const q=database[0], ui=boot([q]); ui['btn-start'].click();
    const report=decodeURIComponent(ui['report-question'].href);
    assert.ok(report.includes(q.uid));
    assert.ok(report.includes('Страницы PDF: '+q.source_pages.join(', ')));
});


test('history survives reload and reviewing it preserves an unfinished session', () => {
    const q=database[0], storage=new Map(); let ui=boot([q],storage);
    ui['btn-start'].click(); choose(ui,q.correct_answers[0]); ui['btn-next'].click();
    ui['btn-next'].click();
    assert.equal(JSON.parse(storage.get('chle-progress-v1')).history.length,1);
    ui=boot([q],storage); assert.equal(ui['history-list'].children.length,1);
    ui['btn-start'].click(); ui['btn-home'].click();
    const before=storage.get('chle-progress-v1');
    ui['history-list'].children[0].children[0].click();
    assert.equal(Number(ui['final-score-value'].textContent),1);
    ui['review-all'].click(); assert.equal(ui['review-list'].children.length,1);
    assert.equal(storage.get('chle-progress-v1'),before);
    ui['btn-restart'].click(); ui['btn-resume'].click(); assert.equal(ui['btn-next'].disabled,true);
});
test('history retains twenty attempts and imports atomically; corrupt history is rejected', async () => {
    const q=database[0], storage=new Map(), ui=boot([q],storage);
    for(let i=0;i<22;i++){ui['btn-start'].click();choose(ui,q.correct_answers[0]);ui['btn-next'].click();ui['btn-restart'].click();}
    const data={app:'PilotSpace',...JSON.parse(storage.get('chle-progress-v1'))};
    assert.equal(data.history.length,20);
    const targetStorage=new Map(), target=boot([q],targetStorage);
    await importFile(target,data); assert.equal(targetStorage.size,0);
    target['btn-confirm-import'].click();assert.equal(target['history-list'].children.length,20);
    const before=targetStorage.get('chle-progress-v1');
    await importFile(target,{...data,history:[{...data.history[0],results:[null]}]});
    assert(target['import-preview'].hidden); assert.equal(targetStorage.get('chle-progress-v1'),before);
});

test('topic search chooses the section without starting or replacing a saved attempt', () => {
 const storage=new Map(), ui=boot(database,storage); ui['btn-start'].click(); ui['btn-home'].click(); const before=storage.get('chle-progress-v1');
 ui['topic-search'].value='А320'; ui['topic-search'].listeners.input();
 assert(ui['topic-search-results'].children.length>0);
 const first=ui['topic-search-results'].children[0].children[0]; const title=first.children[0].textContent;
 first.click(); assert.equal(ui['section-select'].value,title); assert.equal(storage.get('chle-progress-v1'),before); assert(ui['start-screen'].classes.has('active')); assert(ui['topic-search-results'].hidden);
 ui['topic-search'].value='несуществующая тема'; ui['topic-search'].listeners.input(); assert.equal(ui['topic-search-results'].children.length,0); assert.match(ui['topic-search-status'].textContent,/Ничего не найдено/);
 ui['topic-search-clear'].click(); assert.equal(ui['topic-search'].value,''); assert(ui['topic-search-results'].hidden);
});

test('favorites survive reload and train independently without changing an active question', () => {
 const q=database[0], other=database.find(q=>q.section!==database[0].section), storage=new Map(); let ui=boot([q,other],storage);
 ui['btn-start'].click(); const text=ui['question-text'].textContent; ui['btn-favorite'].click(); assert.equal(ui['question-text'].textContent,text); assert.equal(ui['btn-next'].disabled,true); assert.equal(ui['btn-favorite'].attributes['aria-pressed'],'true');
 ui=boot([q,other],storage); assert.equal(ui['favorite-count'].textContent,1); ui['section-select'].change(other.section); ui['btn-favorites'].click(); assert.match(ui['question-text'].textContent,new RegExp(q.question.slice(0,10).replace(/[.*+?^$()|[\]\\]/g,'\\$&'))); ui['btn-favorite'].click(); ui['btn-home'].click(); assert.equal(ui['favorite-count'].textContent,0); assert(ui['btn-favorites'].disabled);
});
test('favorite import validates ids and supports older files without favorites', async () => {
 const {q,data}=exportedFixture(), storage=new Map(), ui=boot([q],storage);
 await importFile(ui,{...data,favorites:[q.uid]}); ui['btn-confirm-import'].click(); assert.equal(ui['favorite-count'].textContent,1);
 const before=storage.get('chle-progress-v1'); await importFile(ui,{...data,favorites:['unknown']}); assert(ui['import-preview'].hidden); assert.equal(storage.get('chle-progress-v1'),before);
 delete data.favorites; await importFile(ui,data); ui['btn-confirm-import'].click(); assert.equal(ui['favorite-count'].textContent,0);
});

test('reading size syncs both controls and survives reload without changing training',()=>{
 const q=database[0], storage=new Map(); let ui=boot([q],storage); assert.equal(ui.app.dataset.textSize,'normal');
 ui['btn-start'].click(); choose(ui,q.correct_answers[0]); const before=storage.get('chle-progress-v1');
 ui['text-quiz-large'].click(); assert.equal(ui.app.dataset.textSize,'large'); assert.equal(ui['text-settings-large'].attributes['aria-pressed'],'true'); assert.equal(ui['text-quiz-normal'].attributes['aria-pressed'],'false'); assert.equal(storage.get('chle-progress-v1'),before); assert.equal(Number(ui.score.textContent),1);
 ui=boot([q],storage); assert.equal(ui.app.dataset.textSize,'large'); ui['text-settings-compact'].click(); assert.equal(ui['text-quiz-compact'].attributes['aria-pressed'],'true');
 storage.set('pilotspace-text-size','unknown'); assert.equal(boot([q],storage).app.dataset.textSize,'normal');
});
test('blocked preference storage still changes text without interrupting training',()=>{
 const q=database[0], ui=boot([q],{get(){throw Error('blocked')},set(){throw Error('blocked')}}); ui['btn-start'].click(); ui['text-quiz-large'].click(); assert.equal(ui.app.dataset.textSize,'large'); assert.match(ui['text-size-status'].textContent,/не разрешил/);choose(ui,q.correct_answers[0]);ui['btn-next'].click();assert.equal(Number(ui['final-score-value'].textContent),1);
});

test('archived attempt errors repeat even after global mistakes were cleared', () => {
 const q=database[0], other=database[1], storage=new Map(), ui=boot([q,other],storage);
 ui['btn-start'].click(); choose(ui,Object.keys(q.options).find(letter=>!q.correct_answers.includes(letter))); ui['btn-next'].click(); choose(ui,other.correct_answers[0]);ui['btn-next'].click();
 assert.equal(ui['btn-attempt-mistakes'].hidden,false); ui['btn-attempt-mistakes'].click(); assert.equal(ui['question-text'].textContent,q.id+'. '+q.question); choose(ui,q.correct_answers[0]);ui['btn-next'].click();
 assert.equal(ui['btn-attempt-mistakes'].hidden,true); assert.equal(ui['btn-result-mistakes'].hidden,true);
 ui['btn-restart'].click(); ui['history-list'].children[1].children[0].click(); assert.equal(ui['btn-attempt-mistakes'].hidden,false); assert.equal(ui['btn-result-mistakes'].hidden,true);
 ui['btn-attempt-mistakes'].click(); assert.equal(JSON.parse(storage.get('chle-progress-v1')).saved.ids.length,1); assert.equal(ui['question-text'].textContent,q.id+'. '+q.question); assert.equal(JSON.parse(storage.get('chle-progress-v1')).history.length,2);
});

 test('review links only covered questions to their specific lesson and preserves results',()=>{
 const covered=database.find(q=>q.uid==='3.7:12'),other=database[0],ui=boot([covered,other]);ui['btn-start'].click();
 ui['options-container'].children.find(b=>b.dataset.letter!==covered.correct_answers[0]).click();ui['btn-next'].click();
 ui['options-container'].children.find(b=>b.dataset.letter!==other.correct_answers[0]).click();ui['btn-next'].click();
 const first=ui['review-list'].children[0].children[1],second=ui['review-list'].children[1].children[1];
 assert(first.children.some(el=>el.className==='lesson-explanation'));
 const link=first.children.find(el=>el.className==='review-lesson-link');assert.equal(link.href,'lessons/metar.html#self-check');assert.equal(link.target,'_blank');
 assert(!second.children.some(el=>el.className==='review-lesson-link'));assert.equal(ui['final-score-value'].textContent,0);
 });
