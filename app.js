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
  let practiceSize = '20'
  const shortPractice = () => practiceSize !== 'custom'

  function updatePracticeSize() {
    const total = filteredQuestions().length
    $('range-group').hidden = shortPractice()
    $('shuffle-group').hidden = shortPractice()
    for (const size of ['10', '20', '50', 'custom']) {
      $(`size-${size}`).setAttribute('aria-pressed', String(practiceSize === size))
    }
    let count = total
    if (shortPractice()) count = Math.min(Number(practiceSize), total)
    else if ($('range-select').value !== 'all') {
      const [start, end] = $('range-select').value.split('-').map(Number)
      count = end - start
    }
    $('practice-summary').textContent = total === 0
      ? 'В этой теме нет доступных вопросов. Выберите другой раздел.'
      : shortPractice()
        ? `${count} из ${total} вопросов выбранной темы — случайная подборка без повторов.${total < Number(practiceSize) ? ' В теме меньше вопросов, поэтому включим все.' : ''}`
        : `${count} вопросов выбранной темы. Порядок можно изменить переключателем ниже.`
    $('btn-start').disabled = total === 0
    $('btn-start').textContent = `Начать · ${count} вопр.`
  }
  const storageKey = 'chle-progress-v1'
  const byId = new Map(allQuestions.map(q => [q.uid, q]))
  let saved = null, mistakes = new Set(), results = []
  // A changed question bank must never silently reuse old answers or scores.
  let revision = 2166136261
  for (const char of JSON.stringify(allQuestions)) {
    revision = Math.imul(revision ^ char.charCodeAt(0), 16777619) >>> 0
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, revision, saved, mistakes: [...mistakes] }))
    } catch {
      $('storage-notice').textContent = 'Браузер не разрешил сохранение. Можно продолжать тренировку, но после закрытия страницы прогресс может потеряться.'
    }
  }
  function validSession(s) {
    if (!s || s.mode !== 'quiz' || !Array.isArray(s.ids) || !s.ids.length ||
        new Set(s.ids).size !== s.ids.length || !s.ids.every(id => byId.has(id) && byId.get(id).status === 'verified') ||
        !Number.isInteger(s.index) || s.index < 0 || s.index >= s.ids.length ||
        !Array.isArray(s.results) || s.results.length !== s.ids.length ||
        !s.results.every((r, i) => (r === null || typeof r === 'boolean') && (i > s.index ? r === null : true)) ||
        !Array.isArray(s.selected) || new Set(s.selected).size !== s.selected.length ||
        !s.selected.every(letter => Object.hasOwn(byId.get(s.ids[s.index]).options, letter))) return false
    const q = byId.get(s.ids[s.index])
    if (s.results.slice(0, s.index).some(r => r === null)) return false
    if (s.results[s.index] === null) return q.correct_answers.length > 1 || s.selected.length === 0
    const correct = s.selected.length === q.correct_answers.length && q.correct_answers.every(l => s.selected.includes(l))
    return s.selected.length > 0 && s.results[s.index] === correct
  }
  function saveSession() {
    saved = { ids: questions.map(q => q.uid), index, results: [...results], selected: [...selected], mode: 'quiz' }
    persist()
  }
  let pendingImport = null, importRequest = 0
  function clearImport() {
    pendingImport = null
    $('import-preview').hidden = true
  }
  $('btn-export-progress').addEventListener('click', () => {
    const data = { app: 'PilotSpace', version: 1, revision, saved, mistakes: [...mistakes] }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `pilotspace-progress-${new Date().toISOString().slice(0, 10)}.json`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    $('transfer-status').textContent = 'Файл подготовлен для скачивания. Храните его, чтобы восстановить прогресс.'
  })
  $('btn-import-progress').addEventListener('click', () => $('progress-file').click())
  $('progress-file').addEventListener('change', async () => {
    const request = ++importRequest
    clearImport()
    $('transfer-status').textContent = ''
    const file = $('progress-file').files[0]
    $('progress-file').value = ''
    if (!file) return
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Файл слишком большой. Выберите сохранение PilotSpace размером до 2 МБ.')
      const data = JSON.parse(await file.text())
      if (request !== importRequest) return
      if (!data || data.app !== 'PilotSpace' || data.version !== 1) throw new Error('Это не поддерживаемое сохранение PilotSpace.')
      if (data.revision !== revision) throw new Error('Сохранение создано для другой версии базы вопросов. Перенос отменён, чтобы не смешать ответы.')
      if ((data.saved !== null && !validSession(data.saved)) || !Array.isArray(data.mistakes) ||
          data.mistakes.length > byId.size || new Set(data.mistakes).size !== data.mistakes.length ||
          !data.mistakes.every(id => byId.get(id)?.status === 'verified')) throw new Error('Данные сохранения повреждены. Текущий прогресс не изменён.')
      pendingImport = { version: 1, revision, saved: data.saved, mistakes: data.mistakes }
      $('import-summary').textContent = `В файле: ${data.saved ? `тренировка, вопрос ${data.saved.index + 1} из ${data.saved.ids.length}` : 'нет незавершённой тренировки'}; вопросов на повторение: ${data.mistakes.length}.`
      $('import-preview').hidden = false
    } catch (error) {
      if (request === importRequest) $('transfer-status').textContent = error instanceof SyntaxError ? 'Не удалось прочитать JSON. Выберите файл сохранения PilotSpace.' : error.message
    }
  })
  $('btn-cancel-import').addEventListener('click', () => { ++importRequest; clearImport(); $('transfer-status').textContent = 'Загрузка отменена. Ваш прогресс сохранён.' })
  $('btn-confirm-import').addEventListener('click', () => {
    if (!pendingImport) return
    try {
      // Write first: a storage failure must leave the current in-memory session intact.
      localStorage.setItem(storageKey, JSON.stringify(pendingImport))
    } catch {
      $('transfer-status').textContent = 'Браузер не разрешил сохранить файл. Текущий прогресс не изменён.'
      return
    }
    saved = pendingImport.saved
    mistakes = new Set(pendingImport.mistakes)
    clearImport()
    refreshProgress()
    $('transfer-status').textContent = 'Прогресс восстановлен. Можно продолжить тренировку или повторить ошибки.'
  })
  function refreshProgress() {
    $('resume-panel').hidden = !saved
    $('resume-description').textContent = saved ? `Тренировка · вопрос ${saved.index + 1} из ${saved.ids.length} · отвечено: ${saved.results.filter(r => r !== null).length}` : ''
    $('replace-notice').hidden = !saved
    $('mistake-count').textContent = mistakes.size
    $('btn-mistakes').disabled = mistakes.size === 0
    $('mistake-list').replaceChildren()
    for (const id of mistakes) {
      const q = byId.get(id), item = document.createElement('li')
      const title = document.createElement('strong'), section = document.createElement('span')
      title.textContent = `${q.id}. ${q.question}`
      section.textContent = [q.section, q.subsection].filter(Boolean).join(' · ')
      item.append(title, section)
      $('mistake-list').append(item)
    }
    $('mistake-empty').hidden = mistakes.size > 0
  }
  const switchScreen = (name) => {
    screens.forEach((s) =>
      $(`${s}-screen`).classList.toggle('active', s === name),
    )
    $('support-section').hidden = !['start', 'result'].includes(name)
    if (name === 'start') refreshProgress()
  }

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
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const state = JSON.parse(raw)
      if (state.version === 1 && state.revision === revision) {
        mistakes = new Set(Array.isArray(state.mistakes) ? state.mistakes.filter(id => byId.get(id)?.status === 'verified') : [])
        if (validSession(state.saved)) saved = state.saved
        else if (state.saved) $('storage-notice').textContent = 'Сохранённая тренировка повреждена. Начните новую; список ошибок сохранён.'
      } else $('storage-notice').textContent = 'База вопросов обновилась. Старый прогресс сброшен, чтобы ответы соответствовали новой базе.'
    }
  } catch {
    $('storage-notice').textContent = 'Не удалось прочитать сохранение. Новую тренировку можно начать как обычно.'
  }
  for (const section of new Set(allQuestions.map((q) => q.section))) {
    $('section-select').add(new Option(section, section))
  }
  if (typeof location !== 'undefined') {
    const requestedSection = new URLSearchParams(location.search).get('section')
    const match = allQuestions.find(q => q.section_id === requestedSection)
    if (match) $('section-select').value = match.section
  }

  function filteredQuestions() {
    return allQuestions.filter(
      (q) =>
        q.status === 'verified' &&
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
    updatePracticeSize()
  }

  function updateSubsections() {
    const section = $('section-select').value
    $('selected-section-caption').textContent = section === 'all' ? '' : section
    const matching = allQuestions.filter(
      (q) =>
        (section === 'all' || q.section === section) &&
        q.status === 'verified',
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

  function startQuiz(onlyMistakes = false) {
    questions = onlyMistakes ? [...mistakes].map(id => byId.get(id)) : filteredQuestions()
    const range = $('range-select').value
    if (!onlyMistakes && !shortPractice() && range !== 'all') {
      const [start, end] = range.split('-').map(Number)
      questions = questions.slice(start, end)
    }
    if (!questions.length) return
    if ((!onlyMistakes && shortPractice()) || $('random-checkbox').checked) {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[questions[i], questions[j]] = [questions[j], questions[i]]
      }
    }
    if (!onlyMistakes && shortPractice()) questions = questions.slice(0, Number(practiceSize))
    index = score = 0
    results = questions.map(() => null)
    $('score').textContent = '0'
    switchScreen('quiz')
    loadQuestion()
    saveSession()
  }

  function resumeQuiz() {
    if (!saved) return
    const session = saved
    questions = session.ids.map(id => byId.get(id))
    index = session.index
    results = [...session.results]
    score = results.filter(r => r === true).length
    updateSubsections()
    $('score').textContent = score
    switchScreen('quiz')
    loadQuestion()
    selected = new Set(session.selected)
    if (results[index] !== null) {
      answered = true
      renderAnswer(results[index])
    } else {
      for (const button of $('options-container').children) {
        button.classList.toggle('selected', selected.has(button.dataset.letter))
        button.setAttribute('aria-pressed', String(selected.has(button.dataset.letter)))
      }
      $('btn-check').disabled = selected.size === 0
    }
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
    $('source-details').open = false
    $('current-question-num').textContent =
      `Вопрос ${index + 1} из ${questions.length}`
    $('progress-bar-fill').style.width = `${(index / questions.length) * 100}%`
    $('question-section').textContent = [q.section, q.subsection]
      .filter(Boolean)
      .join(' · ')
    $('question-text').textContent = `${q.id}. ${q.question}`
    const report = `Здравствуйте, Дмитрий!\n\nХочу сообщить об ошибке в PilotSpace.\nВопрос: ${q.uid}\nРаздел: ${q.section}\nСтраницы PDF: ${q.source_pages.join(', ')}\n${q.question.slice(0, 600)}\n\nЧто нужно исправить:\n`
    $('report-question').href = `mailto:dem.morozov@gmail.com?subject=${encodeURIComponent(`PilotSpace: вопрос ${q.uid}`)}&body=${encodeURIComponent(report)}`
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
    $('answer-help').textContent = q.correct_answers.length > 1
        ? 'Выберите все правильные варианты, затем нажмите «Проверить ответ».'
        : 'Выберите один правильный вариант.'
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
      button.addEventListener('click', () => choose(letter))
      $('options-container').append(button)
    }
    $('btn-check').hidden = q.correct_answers.length === 1
    $('btn-check').disabled = true
    $('btn-next').disabled = true
    $('btn-next').textContent =
      index === questions.length - 1
        ? 'Завершить'
        : 'Далее'
    $('question-text').focus?.({ preventScroll: true })
    $('quiz-screen').scrollIntoView?.({ block: 'start' })
  }

  function choose(letter) {
    if (answered) return
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
    saveSession()
  }

  function checkAnswer() {
    if (answered || !selected.size) return
    answered = true
    const correct = questions[index].correct_answers
    const success =
      selected.size === correct.length &&
      correct.every((letter) => selected.has(letter))
    if (success) $('score').textContent = ++score
    results[index] = success
    if (success) mistakes.delete(questions[index].uid)
    else mistakes.add(questions[index].uid)
    renderAnswer(success)
    saveSession()
  }

  function renderAnswer(success) {
    const correct = questions[index].correct_answers
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

  function renderSessionReview(onlyErrors = true) {
    const errorCount = results.filter(result => result === false).length
    $('review-errors').textContent = `Ошибки · ${errorCount}`
    $('review-all').textContent = `Все · ${questions.length}`
    $('review-errors').setAttribute('aria-pressed', String(onlyErrors))
    $('review-all').setAttribute('aria-pressed', String(!onlyErrors))
    $('review-count').textContent = onlyErrors ? `Ошибок в этой попытке: ${errorCount}` : `Вопросов в этой попытке: ${questions.length}`
    $('review-empty').hidden = !onlyErrors || errorCount > 0
    $('review-list').replaceChildren()
    questions.forEach((q, position) => {
      if (onlyErrors && results[position] !== false) return
      const item = document.createElement('details')
      item.className = 'review-item'
      const summary = document.createElement('summary')
      const status = document.createElement('span')
      status.className = results[position] ? 'review-status is-correct' : 'review-status is-wrong'
      status.textContent = results[position] ? 'Верно' : 'Ошибка'
      const title = document.createElement('span')
      title.textContent = `${position + 1}. ${q.question}`
      summary.append(status, title)
      const body = document.createElement('div')
      body.className = 'review-body'
      const section = document.createElement('p')
      section.className = 'review-section'
      section.textContent = [q.section, q.subsection].filter(Boolean).join(' · ')
      const label = document.createElement('p')
      label.className = 'review-answer-label'
      label.textContent = q.correct_answers.length > 1 ? 'Правильные ответы' : 'Правильный ответ'
      body.append(section, label)
      for (const letter of q.correct_answers) {
        const answer = document.createElement('p')
        answer.className = 'review-answer'
        answer.textContent = `${letter}. ${q.options[letter]}`
        body.append(answer)
      }
      if (q.source_note) {
        const note = document.createElement('p')
        note.className = 'source-note'
        note.textContent = q.source_note
        body.append(note)
      }
      body.append(sourceLink(`Открыть вопрос в PDF · стр. ${q.source_pages[0]}`, q.source_pages[0]))
      item.append(summary, body)
      $('review-list').append(item)
    })
  }

  function nextQuestion() {
    if (!answered) return
    index++
    if (index < questions.length) {
      loadQuestion()
      saveSession()
      return
    }
    saved = null
    persist()
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
    renderSessionReview()
    $('btn-result-mistakes').hidden = mistakes.size === 0
    $('result-mistakes-count').textContent = mistakes.size ? `В списке на повторение: ${mistakes.size}. Правильный ответ при следующей попытке уберёт вопрос из списка.` : 'Все ошибки отработаны. Можно переходить к новой тренировке.'
  }

  $('section-select').addEventListener('change', updateSubsections)
  $('subsection-select').addEventListener('change', updateRanges)
  $('range-select').addEventListener('change', updatePracticeSize)
  for (const size of ['10', '20', '50', 'custom']) {
    $(`size-${size}`).addEventListener('click', () => {
      practiceSize = size
      updatePracticeSize()
    })
  }
  $('btn-start').addEventListener('click', () => startQuiz())
  $('btn-resume').addEventListener('click', resumeQuiz)
  $('btn-mistakes').addEventListener('click', () => startQuiz(true))
  $('btn-result-mistakes').addEventListener('click', () => startQuiz(true))
  $('btn-check').addEventListener('click', checkAnswer)
  $('btn-next').addEventListener('click', nextQuestion)
  $('btn-restart').addEventListener('click', () => switchScreen('start'))
  $('btn-home').addEventListener('click', () => switchScreen('start'))
  $('brand-home').addEventListener('click', (event) => {
    if (event?.ctrlKey || event?.metaKey || event?.shiftKey || event?.altKey) return
    event?.preventDefault()
    switchScreen('start')
    $('start-screen').scrollIntoView?.({ block: 'start' })
  })
  $('review-errors').addEventListener('click', () => renderSessionReview(true))
  $('review-all').addEventListener('click', () => renderSessionReview(false))
  updateSubsections()
  switchScreen('start')
})
