document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id)
  const allQuestions =
    typeof windowQuestions !== 'undefined' ? windowQuestions : []
  const screens = ['loading', 'start', 'quiz', 'result']
  let questions = [],
    index = 0,
    score = 0,
    answered = false,
    selected = new Set()
  const reviewMode = () => $('mode-select').value === 'review'
  const switchScreen = (name) =>
    screens.forEach((s) =>
      $(`${s}-screen`).classList.toggle('active', s === name),
    )

  if (
    !allQuestions.length ||
    !allQuestions.every((q) => Array.isArray(q.correct_answers) && q.status)
  ) {
    $('loading-screen').textContent =
      'Ошибка загрузки базы. Проверьте questions.js и обновите страницу.'
    return
  }
  $('total-questions').textContent = allQuestions.filter(
    (q) => q.status === 'verified',
  ).length
  $('review-count').textContent = allQuestions.filter(
    (q) => q.status === 'needs_review',
  ).length
  for (const section of new Set(allQuestions.map((q) => q.section))) {
    $('section-select').add(new Option(section, section))
  }

  function filteredQuestions() {
    return allQuestions.filter(
      (q) =>
        q.status === (reviewMode() ? 'needs_review' : 'verified') &&
        ($('section-select').value === 'all' ||
          q.section === $('section-select').value) &&
        ($('subsection-select').value === 'all' ||
          q.subsection === $('subsection-select').value),
    )
  }

  function updateRanges() {
    const total = filteredQuestions().length
    $('range-select').replaceChildren(
      new Option(`Все вопросы (${total})`, 'all'),
    )
    for (let start = 0; start < total; start += 50) {
      const end = Math.min(start + 50, total)
      $('range-select').add(
        new Option(`Вопросы ${start + 1}–${end}`, `${start}-${end}`),
      )
    }
    $('btn-start').disabled = total === 0
    $('btn-start').textContent = reviewMode()
      ? 'Посмотреть спорные вопросы'
      : 'Начать тест'
  }

  function updateSubsections() {
    const section = $('section-select').value
    const matching = allQuestions.filter(
      (q) =>
        (section === 'all' || q.section === section) &&
        q.status === (reviewMode() ? 'needs_review' : 'verified'),
    )
    $('subsection-select').replaceChildren(new Option('Все подразделы', 'all'))
    for (const sub of new Set(
      matching.map((q) => q.subsection).filter(Boolean),
    )) {
      $('subsection-select').add(new Option(sub, sub))
    }
    $('subsection-group').hidden =
      !$('subsection-select').options.length ||
      $('subsection-select').options.length === 1
    updateRanges()
  }

  function startQuiz() {
    questions = filteredQuestions()
    const range = $('range-select').value
    if (range !== 'all') {
      const [start, end] = range.split('-').map(Number)
      questions = questions.slice(start, end)
    }
    if (!questions.length) return
    if ($('random-checkbox').checked) {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[questions[i], questions[j]] = [questions[j], questions[i]]
      }
    }
    index = score = 0
    $('score').textContent = '0'
    $('score-badge').hidden = reviewMode()
    switchScreen('quiz')
    loadQuestion()
  }

  function sourceLink(label, page) {
    const link = document.createElement('a')
    link.textContent = label
    link.href =
      encodeURIComponent('НОВЫЕ_Тестовые_вопросы_ЧЛЭ_ПОЛНОСТЬЮ_ВЫДЕЛЕНЫ.pdf') +
      `#page=${page}`
    link.target = '_blank'
    link.rel = 'noopener'
    return link
  }

  function loadQuestion() {
    const q = questions[index]
    answered = false
    selected = new Set()
    $('current-question-num').textContent =
      `Вопрос ${index + 1} из ${questions.length}`
    $('progress-bar-fill').style.width = `${(index / questions.length) * 100}%`
    $('question-section').textContent = [q.section, q.subsection]
      .filter(Boolean)
      .join(' · ')
    $('question-text').textContent = `${q.id}. ${q.question}`
    $('question-source').replaceChildren(
      sourceLink(
        `PDF: стр. ${q.source_pages.join(', ')} (${q.source_printed_pages.join(', ')})`,
        q.source_pages[0],
      ),
      document.createTextNode(' · '),
      sourceLink('Таблица ответов', q.answer_source_page),
    )
    $('question-images').replaceChildren()
    for (const picture of q.images || []) {
      const image = document.createElement('img')
      image.src = picture.src
      image.alt = picture.alt
      $('question-images').append(image)
    }
    $('question-note').textContent = q.source_note || ''
    $('answer-feedback').textContent = ''
    $('answer-help').textContent = reviewMode()
      ? 'Просмотр без оценки: ответ требует проверки по источнику.'
      : q.correct_answers.length > 1
        ? 'Выберите все правильные варианты, затем нажмите «Проверить ответ».'
        : 'Выберите один правильный вариант.'
    $('review-details').hidden = !reviewMode()
    $('review-details').textContent = reviewMode()
      ? `${q.review_reason} Таблица PDF: ${q.table_answers.join(', ')}. Выделены варианты приложения: ${q.highlighted_answers.join(', ') || 'нет'}. Исходные буквы: ${Object.entries(
          q.source_option_labels,
        )
          .map(([label, original]) => `${label} → ${original || 'без буквы'}`)
          .join('; ')}.`
      : ''
    $('options-container').replaceChildren()
    for (const [letter, text] of Object.entries(q.options)) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'option'
      button.dataset.letter = letter
      button.setAttribute('aria-pressed', 'false')
      const label = document.createElement('span')
      label.className = 'letter'
      label.textContent = `${letter}.`
      const content = document.createElement('span')
      content.className = 'text'
      content.textContent = text
      button.append(label, content)
      button.disabled = reviewMode()
      button.addEventListener('click', () => choose(letter))
      $('options-container').append(button)
    }
    $('btn-check').hidden = reviewMode() || q.correct_answers.length === 1
    $('btn-check').disabled = true
    $('btn-next').disabled = !reviewMode()
    $('btn-next').textContent =
      index === questions.length - 1
        ? reviewMode()
          ? 'Закрыть просмотр'
          : 'Завершить'
        : 'Далее'
  }

  function choose(letter) {
    if (answered || reviewMode()) return
    const q = questions[index]
    if (q.correct_answers.length === 1) {
      selected = new Set([letter])
      checkAnswer()
      return
    }
    if (selected.has(letter)) selected.delete(letter)
    else selected.add(letter)
    for (const button of $('options-container').children) {
      const active = selected.has(button.dataset.letter)
      button.classList.toggle('selected', active)
      button.setAttribute('aria-pressed', String(active))
    }
    $('btn-check').disabled = selected.size === 0
  }

  function checkAnswer() {
    if (answered || !selected.size || reviewMode()) return
    answered = true
    const correct = questions[index].correct_answers
    const success =
      selected.size === correct.length &&
      correct.every((letter) => selected.has(letter))
    if (success) $('score').textContent = ++score
    for (const button of $('options-container').children) {
      const letter = button.dataset.letter
      button.classList.add('answered')
      button.disabled = true
      button.classList.toggle('selected', selected.has(letter))
      button.setAttribute('aria-pressed', String(selected.has(letter)))
      button.classList.toggle('correct', correct.includes(letter))
      button.classList.toggle(
        'wrong',
        selected.has(letter) && !correct.includes(letter),
      )
    }
    $('answer-feedback').textContent = success
      ? 'Верно.'
      : `Неверно. Правильный ответ: ${correct.join(', ')}.`
    $('btn-check').disabled = true
    $('btn-next').disabled = false
  }

  function nextQuestion() {
    if (!answered && !reviewMode()) return
    index++
    if (index < questions.length) return loadQuestion()
    if (reviewMode()) return switchScreen('start')
    $('progress-bar-fill').style.width = '100%'
    $('final-score-value').textContent = score
    $('final-score-total').textContent = questions.length
    const ratio = score / questions.length
    $('result-message').textContent =
      ratio < 0.5
        ? 'Нужно еще потренироваться.'
        : ratio < 0.8
          ? 'Хороший результат, но есть куда расти.'
          : 'Отличный результат!'
    switchScreen('result')
  }

  $('section-select').addEventListener('change', updateSubsections)
  $('mode-select').addEventListener('change', updateSubsections)
  $('subsection-select').addEventListener('change', updateRanges)
  $('btn-start').addEventListener('click', startQuiz)
  $('btn-check').addEventListener('click', checkAnswer)
  $('btn-next').addEventListener('click', nextQuestion)
  $('btn-restart').addEventListener('click', () => switchScreen('start'))
  $('btn-home').addEventListener('click', () => switchScreen('start'))
  updateSubsections()
  switchScreen('start')
})
