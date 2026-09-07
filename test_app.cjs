const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const database = require('./questions.json');

// Minimal DOM adapter: exercise the actual app event handlers without a browser dependency.
function boot(data = database) {
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
        Option: class extends Element { constructor(text, value) { super('option'); this.textContent=text; this.value=value; } },
        document: {getElementById: id => elements[id], createElement: tag => new Element(tag),
            createTextNode: text => ({textContent:text}), addEventListener: (_, fn) => fn()}};
    vm.runInNewContext(fs.readFileSync(__dirname+'/app.js', 'utf8'), context);
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
