"""Regression and whole-document checks; run after extract_questions.py."""
import json
from collections import defaultdict
import unittest
from pdf_import import BASE, DEFAULT_PDF, parse, read_pages, split_line


class ImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = read_pages(DEFAULT_PDF)
        cls.questions, cls.keys, cls.issues = parse(cls.pages)
        cls.by_id = {q['uid']: q for q in cls.questions}

    def test_entire_pdf_and_numbering(self):
        self.assertEqual(len(self.pages), 480)
        self.assertEqual(self.issues, [])
        self.assertEqual(len(self.questions), 2854)
        self.assertEqual(set(self.by_id), set(self.keys))
        groups = defaultdict(list)
        for q in self.questions:
            groups[q['uid'].rsplit(':', 1)[0]].append(q['id'])
        self.assertEqual(len(groups), 95)
        for key, ids in groups.items():
            self.assertEqual(ids, list(range(1, max(ids)+1)), key)

    def test_no_boilerplate_or_empty_options(self):
        for q in self.questions:
            self.assertTrue(q['question'], q['uid'])
            self.assertGreaterEqual(len(q['options']), 2, q['uid'])
            text = q['question'] + ' '.join(q['options'].values())
            self.assertNotRegex(text, r'MF\.FLT3|Издание 2|Страница 3-|Перечень вопросов|Список литературы|Тестовые вопросы контроля')
            self.assertTrue(all(q['options'].values()), q['uid'])

    def test_every_scored_answer_has_evidence(self):
        review = []
        for q in self.questions:
            if q['status'] == 'needs_review':
                review.append(q['uid'])
                self.assertEqual(q['correct_answers'], [])
                self.assertTrue(q['review_reason'])
            else:
                self.assertEqual(q['correct_answers'], self.keys[q['uid']]['answers'])
                self.assertTrue(set(q['correct_answers']) <= q['options'].keys())
                if q['uid'] != '3.4.4:Q:7':
                    self.assertEqual(q['correct_answers'], q['highlighted_answers'], q['uid'])
        self.assertEqual(len(review), 14)

    def test_reported_flexible_takeoff_regression(self):
        for uid in ['3.5.2:32', '3.5.3:33']:
            q = self.by_id[uid]
            self.assertEqual(q['question'], 'Flexible takeoff is not permitted on contaminated runways.')
            expected = {'A': 'True', 'B': 'False'} if uid == '3.5.2:32' else {'A': 'True.', 'B': 'False.'}
            self.assertEqual(q['options'], expected)
            self.assertEqual(q['correct_answers'], ['A'])

    def test_multiselect_and_wrapped_keys(self):
        expected = {4: 'AD', 10: 'ACDEFG', 11: 'ABC', 38: 'ABCDEFG', 65: 'AB', 68: 'ABF'}
        for number, answers in expected.items():
            self.assertEqual(self.by_id[f'3.12:{number}']['correct_answers'], list(answers))
        self.assertEqual(sum(len(q['correct_answers']) > 1 for q in self.questions), 17)

    def test_missing_labels_duplicates_and_inline_options(self):
        self.assertEqual(len(self.by_id['3.4.1:I:8']['options']), 4)
        self.assertEqual(self.by_id['3.4.1:I:8']['options']['A'], 'The Fuel Metering Unit')
        self.assertEqual(self.by_id['3.4.2:E:8']['options'], {'A': 'AC BUS', 'B': 'DC BUS', 'C': 'AC and DC BUSs'})
        self.assertEqual(self.by_id['3.4.2:I:9']['status'], 'needs_review')
        self.assertEqual(len(self.by_id['3.4.2:G:10']['options']), 3)
        self.assertEqual(len(self.by_id['3.4.2:U:17']['options']), 3)
        self.assertIn('0.45qt/h)', self.by_id['3.4.2:U:17']['options']['A'])
        self.assertEqual(len(self.by_id['3.11:31']['options']), 3)
        self.assertTrue(self.by_id['3.11:31']['options']['A'].endswith('Attachment C.'))

    def test_export_matches_fresh_parse_and_images_exist(self):
        exported = json.loads((BASE/'questions.json').read_text(encoding='utf8'))
        js = (BASE/'questions.js').read_text(encoding='utf8')
        self.assertEqual(json.loads(js.removeprefix('const windowQuestions = ').strip().removesuffix(';')), exported)
        self.assertEqual(len(exported), len(self.questions))
        for q in exported:
            fresh = self.by_id[q['uid']]
            for key in ['question', 'options', 'section', 'subsection', 'correct_answers', 'status']:
                self.assertEqual(q[key], fresh[key], (q['uid'], key))
            for img in q.get('images', []):
                self.assertTrue((BASE/img['src']).is_file(), img['src'])
        self.assertEqual(sum(len(q.get('images', [])) for q in exported), 60)

    def test_inline_split_preserves_units_and_continuations(self):
        def parts(text):
            return [p['text'].strip() for p in split_line({'text': text, 'bbox': [0,0,100,10]})]
        self.assertEqual(parts('B. answer C. next'), ['B. answer', 'C. next'])
        self.assertEqual(parts('A. Annex 6 and Attachment C. '), ['A. Annex 6 and Attachment C.'])
        self.assertEqual(parts('B. B. answer'), ['B. B. answer'])
        self.assertEqual(parts('A. temperature 10 C. '), ['A. temperature 10 C.'])

if __name__ == '__main__':
    unittest.main()
