const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const database = require('./questions.json');

// Minimal DOM adapter: exercise the actual app event handlers without a browser dependency.
function boot(data = database, storage = new Map(), size = 'custom') {
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
    elements['mode-select'].value = 'quiz';
    elements['section-select'].value = 'all';
    const context = {windowQuestions: data, Math, Set,
        localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
        Option: class extends Element { constructor(text, value) { super('option'); this.textContent=text; this.value=value; } },
        document: {getElementById: id => elements[id], createElement: tag => new Element(tag),
            createTextNode: text => ({textContent:text}), addEventListener: (_, fn) => fn()}};
    vm.runInNewContext(fs.readFileSync(__dirname+'/app.js', 'utf8'), context);
    // Existing scoring tests use the full, ordered range explicitly.
    if (size !== '20') elements[`size-${size}`].click();
    return elements;
}

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

test('source ambiguities are excluded from quizzes and never scored in review', () => {
    const ui=boot();
    assert.equal(ui['total-questions'].textContent,2840);
    assert.equal(ui['review-count'].textContent,14);
    ui['mode-select'].change('review'); ui['btn-start'].click();
    assert.equal(ui['current-question-num'].textContent,'Вопрос 1 из 14');
    assert.equal(ui['btn-check'].hidden,true);
    assert.equal(ui['score-badge'].hidden,true);
    assert.ok(ui['options-container'].children.every(b=>b.disabled));
    for(let i=0;i<14;i++) ui['btn-next'].click();
    assert.ok(ui['start-screen'].classes.has('active'));
    assert.equal(Number(ui.score.textContent),0);
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

test('review mode resumes without scoring or adding ambiguous questions to mistakes', () => {
    const data = database.filter(q => q.status === 'needs_review').slice(0, 2), storage = new Map();
    let ui = boot(data, storage); ui['mode-select'].change('review'); ui['btn-start'].click(); ui['btn-next'].click();
    ui = boot(data, storage); ui['btn-resume'].click();
    assert.equal(ui['score-badge'].hidden, true);
    assert.ok(ui['question-text'].textContent.startsWith(`${data[1].id}.`));
    ui['btn-next'].click();
    assert.equal(ui['mistake-count'].textContent, 0);
    assert.equal(ui['resume-panel'].hidden, true);
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
