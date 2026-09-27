"""Rebuild the quiz from PDF geometry, answer tables and highlights."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import pymupdf

BASE = Path(__file__).resolve().parent
DEFAULT_PDF = BASE / 'НОВЫЕ_Тестовые_вопросы_ЧЛЭ_ПОЛНОСТЬЮ_ВЫДЕЛЕНЫ.pdf'
REVIEWED_SHA256 = '687b82a836b348a4ab1dbd7d90aec93d8b9c1f3ac70da0d23c92649fc75d4402'
LETTERS = str.maketrans({'А': 'A', 'В': 'B', 'С': 'C', 'Д': 'D', 'Е': 'E', 'Ф': 'F', 'Н': 'H'})
HEADING = re.compile(r'^(3(?:\.\d+)+)\.?\s+(.+)')
QUESTION = re.compile(r'^(\d+)\.(?!\d)\s*(.+)')
SUBHEADING = re.compile(r'^\(?([A-ZАВ])\)\s+(.+)')
OPTION = re.compile(r'^([A-HАВСДЕФН])\s*[.)]\s*(.*)')
KEY = re.compile(r'(\d+)\s*\.?\s*[-–]\s*([A-HАВСДЕФН][A-HАВСДЕФН,\s]*)[;.]?')

def clean(text):
    return re.sub(r'\s+', ' ', text).strip()

def read_pages(pdf):
    pages = []
    with pymupdf.open(pdf) as doc:
        for page in doc:
            lines = []
            for block in page.get_text('rawdict')['blocks']:
                for line in block.get('lines', []):
                    chars = [c for s in line['spans'] for c in s['chars']]
                    lines.append({'bbox': line['bbox'], 'text': ''.join(c['c'] for c in chars), 'chars': chars})
            annots = [{'type': a.type, 'vertices': a.vertices} for a in page.annots() or []]
            images = [i for i in page.get_image_info() if i['bbox'][1] >= 60 and i['bbox'][3] < 800]
            pages.append({'page': page.number + 1, 'size': list(page.rect), 'lines': lines, 'annots': annots, 'images': images})
    return pages

def highlighted(line, page):
    # A multiline annotation's bounding box includes unhighlighted lines.
    x0, y0, x1, y1 = line['bbox']
    cy = (y0 + y1) / 2
    for annot in page['annots']:
        if annot['type'][0] != 8:
            continue
        vertices = annot['vertices'] or []
        for i in range(0, len(vertices), 4):
            quad = vertices[i:i+4]
            left, right = min(v[0] for v in quad), max(v[0] for v in quad)
            top, bottom = min(v[1] for v in quad), max(v[1] for v in quad)
            if top <= cy <= bottom and min(x1, right) - max(x0, left) > 1:
                return True
    return False

def split_line(line):
    """Separate inline answer labels using exact PDF character positions."""
    text = line['text']
    cuts = [m.start(1) for m in re.finditer(r'\s+([B-DВСД]\.\s+)(?=\S)', text)]
    # An inline C label can end the line; its text continues on the next.
    tail = re.search(r'\s([BC]\.)\s*$', text)
    if tail and ((re.match(r'\s*A\.', text) and tail[1] == 'B.') or
                 (re.match(r'\s*B\.', text) and tail[1] == 'C.') or cuts):
        cuts.append(tail.start(1))
    # A duplicated label ('B. B. text') is a PDF typo, not two options.
    first = re.match(r'\s*([A-DАВСД])\.\s+\1\.\s+', text)
    if first:
        cuts = []
    cuts = [0] + sorted(set(c for c in cuts if c > len(text)-len(text.lstrip()))) + [len(text)]
    for start, end in zip(cuts, cuts[1:]):
        chars = line.get('chars', [])[start:end]
        box = line['bbox']
        if chars:
            box = [min(c['bbox'][0] for c in chars), min(c['bbox'][1] for c in chars),
                   max(c['bbox'][2] for c in chars), max(c['bbox'][3] for c in chars)]
        yield {'text': text[start:end], 'bbox': box, 'chars': chars}

def parse(pages):
    resolutions = json.loads((BASE/'answer_resolutions.json').read_text(encoding='utf8'))
    if resolutions['pdf_sha256'] != REVIEWED_SHA256:
        raise ValueError('Answer resolutions refer to a different PDF')
    questions, issues, headings, keys = [], [], {}, {}
    section = mode = current = opt = subsection = None
    key_lines = []
    key_section = None

    def finish_question():
        nonlocal current, opt
        if current:
            questions.append(current)
        current, opt = None, None

    def finish_keys():
        nonlocal key_lines
        if not key_lines:
            return
        text = ' '.join(t for t, _ in key_lines)
        matches = list(KEY.finditer(text))
        residue = KEY.sub('', text).strip(' ;.,:')
        if residue:
            issues.append({'type': 'unparsed_key_text', 'section': key_section, 'text': residue})
        for m in matches:
            answers = sorted(set(re.findall('[A-H]', m[2].translate(LETTERS))))
            uid = f'{key_section}{":" + subsection if subsection else ""}:{int(m[1])}'
            if uid in keys:
                issues.append({'type': 'duplicate_key', 'uid': uid})
            offset = 0
            for t, pn in key_lines:
                if offset + len(t) >= m.start():
                    break
                offset += len(t) + 1
            keys[uid] = {'answers': answers, 'page': pn, 'raw': m[0]}
        key_lines = []

    for page in pages:
        if page['page'] < 23:
            continue
        printed = next((clean(l['text']).replace('Страница ', '') for l in page['lines'] if 'Страница ' in l['text']), None)
        lines = [part for line in page['lines'] for part in split_line(line)]
        for line in lines:
            text = clean(line['text'])
            text = re.sub(r'^([A-DАВСД])\.\s+\1\.\s+', r'\1. ', text)
            if not text or line['bbox'][1] < 60 or line['bbox'][1] >= 800:
                continue
            h = HEADING.match(text)
            if h:
                finish_question()
                finish_keys()
                subsection = None
                prefix, title = h.groups()
                if re.fullmatch(r'(Перечень|Список) вопросов', title):
                    section = prefix.rsplit('.', 1)[0]
                    mode = 'questions'
                elif 'правильных ответов' in title:
                    key_section = prefix.rsplit('.', 1)[0]
                    mode = 'keys'
                else:
                    headings[prefix] = text
                    mode = 'heading'
                continue
            sub = SUBHEADING.match(text)
            if sub and (text.startswith('(') or mode == 'keys') and section and section.startswith('3.4.'):
                finish_question()
                finish_keys()
                subsection = sub[1].translate(LETTERS)
                if mode == 'questions':
                    headings[f'{section}:{subsection}'] = text
                continue
            if mode == 'keys':
                key_lines.append((text, page['page']))
                continue
            if mode != 'questions':
                continue
            if page['page'] == 96 and text == '3.':
                continue  # Stray empty number between question 2 and its options.
            if page['page'] == 118 and text == 'E.':
                continue  # Empty extra answer label in the source.
            qm = QUESTION.match(text)
            if page['page'] == 464 and text.startswith('26 According'):
                qm = re.match(r'^(\d+)\s+(.*)', text)
            if qm:
                finish_question()
                current = {'uid': f'{section}{":" + subsection if subsection else ""}:{int(qm[1])}', 'section': headings[section], 'section_id': section,
                           'subsection': headings.get(f'{section}:{subsection}'),
                           'id': int(qm[1]), 'question': qm[2], 'options': {}, 'highlighted_answers': [],
                           'source_option_labels': {},
                           'source_pages': [page['page']], 'source_printed_pages': [printed]}
                current['_start'] = [page['page'], line['bbox'][1]]
                continue
            om = OPTION.match(text)
            if om and current:
                opt = chr(65 + len(current['options']))
                current['source_option_labels'][opt] = om[1].translate(LETTERS)
                current['options'][opt] = om[2]
            elif current:
                if opt:
                    current['options'][opt] = clean(current['options'][opt] + ' ' + text)
                else:
                    current['question'] = clean(current['question'] + ' ' + text)
            else:
                issues.append({'type': 'orphan_text', 'page': page['page'], 'text': text})
            if current:
                if page['page'] not in current['source_pages']:
                    current['source_pages'].append(page['page'])
                    current['source_printed_pages'].append(printed)
                if opt and highlighted(line, page) and opt not in current['highlighted_answers']:
                    current['highlighted_answers'].append(opt)
    finish_question()
    finish_keys()
    repairs = {
        '3.4.2:H:43': ('The function of LAF is achieved through the upward deflection of:',
                       ['two ailerons only, or two ailerons associated to the spoilers 4 and 5', 'two ailerons only', 'spoilers 4 and 5 only'], ['A']),
        '3.4.2:I:9': ('The Fuel Used indication on ECAM is reset:',
                      ['Manually by the pilot', 'Automatically at engine start on the ground', 'Automatically at electric power up of the aircraft'], ['A']),
        '3.4.4:Q:7': ('A maximum start limit line (red) is displayed on the EGT indication when the fuel control switch is moved to CUT OFF.',
                      ['True', 'False'], []),
    }
    for q in questions:
        if q['uid'] in repairs:
            stem, options, highlights = repairs[q['uid']]
            assert q['question'] == clean(stem + ' ' + ' '.join(options)), q['uid']
            assert not q['options'], q['uid']
            q['question'] = stem
            q['options'] = {chr(65+i): text for i, text in enumerate(options)}
            q['source_option_labels'] = {k: None for k in q['options']}
            q['highlighted_answers'] = highlights
            q['source_note'] = 'В PDF отсутствуют буквы вариантов; они восстановлены по порядку строк.'
    seen = set()
    for q in questions:
        uid = q['uid']
        if uid in seen:
            issues.append({'type': 'duplicate_question', 'uid': uid})
        seen.add(uid)
        key = keys.get(uid)
        if not key:
            issues.append({'type': 'missing_key', 'uid': uid})
            continue
        q['correct_answers'] = key['answers']
        q['table_answers'] = key['answers']
        q['answer_source_page'] = key['page']
        q['highlighted_answers'].sort()
        q['status'] = 'verified'
        if q['highlighted_answers'] != q['correct_answers'] and uid != '3.4.4:Q:7':
            q['status'] = 'needs_review'
            q['review_reason'] = 'Выделения PDF и таблица ответов не дают однозначного совпадения.'
        if uid == '3.4.1:C:14':
            q['status'] = 'needs_review'
            q['review_reason'] = 'В таблице указан C, но в PDF варианты A, B, D; выделен D.'
        if uid == '3.5.1:22':
            q['status'] = 'needs_review'
            q['review_reason'] = 'В исходном PDF символы после cos и sin отображаются пустыми квадратами. Полную запись формул восстановить однозначно нельзя.'
        if uid == '3.4.4:G:3':
            q['review_reason'] = 'В PDF повторяется буква A: таблица A, выделено 1/2, первый вариант — 1/4. Для окончательного решения нужна применимая редакция Boeing 767 FCOM, Flight Controls / Pitch Enhancement System; пересказов и карточек недостаточно.'
        if uid in resolutions['entries']:
            resolution = resolutions['entries'][uid]
            expected = (resolution['expected_question'], resolution['expected_options'], resolution['expected_table'], resolution['expected_highlights'])
            actual = (q['question'], q['options'], q['table_answers'], q['highlighted_answers'])
            replacement = resolution.get('replacement_options')
            if (actual != expected or not resolution['answers'] or not set(resolution['answers']) <= q['options'].keys()
                    or (replacement is not None and (set(replacement) != set(q['options'])
                        or not all(isinstance(value, str) and value.strip() for value in replacement.values())))):
                issues.append({'type': 'resolution_mismatch', 'uid': uid})
            else:
                if replacement is not None:
                    q['options'] = replacement.copy()
                q['correct_answers'] = resolution['answers'][:]
                q['status'] = 'verified'
                q.pop('review_reason', None)
                q['answer_resolution'] = {k: resolution[k] for k in ['reason', 'source', 'url']}
                if resolution.get('editorial_note'):
                    q['source_note'] = (q.get('source_note', '') + ' ' + resolution['editorial_note']).strip()
        if uid == '3.4.4:Q:7':
            q['source_note'] += ' Ответ A взят из таблицы: выделение находится на тексте вопроса.'
        if any(original and label != original for label, original in q['source_option_labels'].items()):
            q['source_note'] = (q.get('source_note', '') + ' Буквы вариантов приведены к A, B, C… по порядку; исходные буквы сохранены отдельно.').strip()
        if q['status'] == 'needs_review':
            q['correct_answers'] = []  # Never turn source ambiguity into a scored answer.
        if len(q['options']) < 2 or not q['question'] or any(not t for t in q['options'].values()):
            issues.append({'type': 'incomplete_question', 'uid': uid})
        if not set(key['answers']) <= q['options'].keys():
            issues.append({'type': 'missing_correct_option', 'uid': uid, 'key': key['answers'], 'options': list(q['options'])})
    for uid in keys.keys() - seen:
        issues.append({'type': 'missing_question', 'uid': uid})
    for uid in resolutions['entries'].keys() - seen:
        issues.append({'type': 'resolution_missing_question', 'uid': uid})
    return questions, keys, issues

def attach_images(questions, pages, pdf, write=False):
    """Assign each body image to its containing question, including page continuations."""
    directory = BASE/'images'
    if write:
        directory.mkdir(exist_ok=True)
    with pymupdf.open(pdf) as doc:
        for page in pages:
            for index, info in enumerate(page.get('images', [])):
                bbox = info['bbox']
                before = [q for q in questions if tuple(q['_start']) <= (page['page'], bbox[1]+2)]
                if not before:
                    raise ValueError(f'Unassigned image: page {page["page"]}')
                q = before[-1]
                if page['page'] not in q['source_pages']:
                    q['source_pages'].append(page['page'])
                    printed = next(clean(l['text']).replace('Страница ', '') for l in page['lines'] if 'Страница ' in l['text'])
                    q['source_printed_pages'].append(printed)
                name = f'page-{page["page"]}-{index+1}.png'
                item = {'src': f'images/{name}', 'page': page['page'], 'bbox': bbox,
                        'alt': f'Иллюстрация из PDF, страница {page["page"]}, вопрос {q["id"]}'}
                # Tiny pictures are inline symbols/formulas: show their surrounding
                # question excerpt so their relation to the text remains visible.
                clip = pymupdf.Rect(bbox)
                if clip.width < 35:
                    following = [other['_start'][1] for other in questions if other['_start'][0] == page['page'] and other['_start'][1] > bbox[1]]
                    top = q['_start'][1] if q['_start'][0] == page['page'] else 65
                    clip = pymupdf.Rect(40, top-2, 557, min(following)-3 if following else 800)
                    item['alt'] = f'Фрагмент вопроса с графическими символами, страница PDF {page["page"]}'
                    if any(img.get('excerpt') and img['page'] == page['page'] for img in q.get('images', [])):
                        continue
                    item['excerpt'] = True
                q.setdefault('images', []).append(item)
                if write:
                    doc[page['page']-1].get_pixmap(matrix=pymupdf.Matrix(2,2), clip=clip, annots=False).save(directory/name)
    for q in questions:
        del q['_start']

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', type=Path, default=DEFAULT_PDF)
    parser.add_argument('--dump-layout', type=Path, help='Explicitly save the large character-geometry cache')
    parser.add_argument('--audit-only', action='store_true')
    args = parser.parse_args()
    digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    if digest != REVIEWED_SHA256:
        raise SystemExit('PDF differs from the reviewed source. Recheck source-specific repairs before rebuilding.')
    pages = read_pages(args.pdf)
    if args.dump_layout:
        args.dump_layout.parent.mkdir(parents=True, exist_ok=True)
        args.dump_layout.write_text(json.dumps(pages, ensure_ascii=False), encoding='utf8')
    questions, keys, issues = parse(pages)
    attach_images(questions, pages, args.pdf, write=not args.audit_only and not issues)
    report = {'pdf_sha256': digest, 'pages': len(pages),
              'questions': len(questions), 'answer_keys': len(keys), 'issues': issues,
              'verified': sum(q['status'] == 'verified' for q in questions),
              'needs_review': [q for q in questions if q['status'] == 'needs_review'],
              'images': sum(len(q.get('images', [])) for q in questions)}
    report['sections'] = {section: sum(q['section_id'] == section for q in questions) for section in dict.fromkeys(q['section_id'] for q in questions)}
    (BASE/'audit_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'questions': len(questions), 'keys': len(keys), 'issues': len(issues)}))
    if issues:
        from collections import Counter
        print(Counter(i['type'] for i in issues))
    if not args.audit_only:
        if issues:
            raise SystemExit('Unresolved issues: database was not overwritten. See audit_report.json.')
        data = json.dumps(questions, ensure_ascii=False, indent=2)
        (BASE/'questions.json').write_text(data+'\n', encoding='utf8')
        (BASE/'questions.js').write_text('const windowQuestions = '+data+';\n', encoding='utf8')
        write_review(report, questions)

def write_review(report, questions):
    lines = [
        '# Проверка базы по PDF', '',
        f'Источник: `{DEFAULT_PDF.name}`. Проверены все {report["pages"]} страниц; вопросы находятся на страницах PDF 23–479. Служебные страницы исключены.', '',
        f'Найдено **{len(questions)} вопроса**, **{len(questions)} записи ключей**. **К тренировкам допущено {report["verified"]} вопроса**, **исключено до уточнения: {len(report["needs_review"])}**. Восстановлено {report["images"]} иллюстраций/фрагментов с формулами.', '',
        'Базовая проверка устанавливает соответствие PDF и фиксирует точечные исправления ошибок ключа, а не независимую техническую правильность всей базы. Повторно исследованы все 14 прежних исключений. Для вопроса 3.5.1:22 формулы редакционно восстановлены, а ответ PDF исправлен по уравнениям установившегося набора. Детали и ограничения: QUESTION_REVIEW.md. Публичные копии FCOM не заменяют актуальную документацию авиакомпании.', '',
        f'SHA-256 PDF: `{report["pdf_sha256"]}`', '',
    ]
    if report['needs_review']:
        lines += ['## Вопросы, требующие уточнения у автора документа', '',
            'Буквы в столбце «Выделено» — буквы приложения после восстановления последовательности A, B, C…; исходные буквы приведены в последнем столбце. У этих вопросов нет назначенного правильного ответа в тренажёре.', '',
            '| Идентификатор | Страница PDF / ключ | Таблица | Выделено | Исходные буквы по порядку |',
            '|---|---|---|---|---|']
        for q in report['needs_review']:
            labels = ', '.join(label or 'без буквы' for label in q['source_option_labels'].values())
            lines.append(f'| {q["uid"]} | {", ".join(map(str, q["source_pages"]))} / {q["answer_source_page"]} | {", ".join(q["table_answers"])} | {", ".join(q["highlighted_answers"])} | {labels} |')
        lines += ['', 'Причины:', '']
        lines += [f'- **{q["uid"]}**: {q["review_reason"]}' for q in report['needs_review']]
    else:
        lines += ['## Вопросы на уточнении', '', 'Нет: все 2854 вопроса допущены к тренировкам после проверки и задокументированных исправлений.', '']
    lines += ['', '## Разрешённые расхождения', '', '| Вопрос | Ответ | Обоснование |', '|---|---|---|']
    for q in questions:
        if 'answer_resolution' in q:
            r = q['answer_resolution']
            lines.append(f"| {q['uid']} | {', '.join(q['correct_answers'])} | {r['reason']} Источник: {r['source']} |")
    lines += ['', '## Исправления переноса', '',
        '- Заголовки, подразделы, колонтитулы, номера страниц, ключи и библиография отделены от текста вопросов.',
        '- Идентификатор включает раздел, систему самолёта и исходный номер вопроса. Нумерация внутри систем не смешивается.',
        '- Варианты в одной строке разделены; переносы через страницы сохранены. Дубли букв вроде «B. B.» удалены.',
        '- В 3.4.1/D/2 удалён пустой номер «3.»; в 3.4.1/M/4 удалён пустой вариант «E.»; в 3.11/26 восстановлена отсутствующая точка после номера.',
        '- В 3.4.2/H/43, 3.4.2/I/9 и 3.4.4/Q/7 восстановлены отсутствующие буквы вариантов по порядку текста. Для Q/7 ответ взят из таблицы: выделение находится на вопросе.',
        '- Буквы с пропусками и повторами приведены к последовательности без удаления вариантов; исходные метки хранятся в source_option_labels. Неоднозначные ключи отправлены на проверку.',
        '- Все ответы CRM сохранены, включая несколько букв, переносы в ячейках и кириллические А/В/С.',
        '- Иллюстрации извлечены без аннотаций с правильными ответами. Для встроенных графических символов сохранён фрагмент вопроса.', '',
        '## Полнота по разделам', '', '| Раздел | Вопросов |', '|---|---:|']
    lines += [f'| {section} | {count} |' for section, count in report['sections'].items()]
    lines += ['', '## Воспроизведение', '',
        'Установить зависимости из requirements.txt. Из папки quiz_app:', '',
        '```text', 'python extract_questions.py', 'python -m unittest test_import.py', 'node --test test_app.cjs', '```', '',
        'audit_report.json содержит результаты проверки и полные записи спорных вопросов. Импорт не перезаписывает базу при структурных ошибках или изменении исходного PDF: ручные исправления привязаны к его SHA-256. questions.json и questions.js создаются одним запуском.', '']
    (BASE/'SOURCE_REVIEW.md').write_text('\n'.join(lines), encoding='utf8')

if __name__ == '__main__':
    main()
