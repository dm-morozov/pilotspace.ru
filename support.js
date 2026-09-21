document.addEventListener('DOMContentLoaded', () => {
  const card = document.getElementById('support-card-number')
  const button = document.getElementById('btn-copy-card')
  const status = document.getElementById('support-copy-status')

  button.addEventListener('click', async () => {
    button.disabled = true
    try {
      await navigator.clipboard.writeText(card.value.replace(/\s/g, ''))
      status.textContent = 'Номер карты скопирован. Спасибо за поддержку!'
    } catch {
      // Local files and browsers without clipboard permission still allow manual copying.
      card.focus()
      card.select()
      card.setSelectionRange(0, card.value.length)
      status.textContent = 'Номер выделен. Скопируйте его через меню устройства или нажмите Ctrl+C (⌘C на Mac).'
    } finally {
      button.disabled = false
    }
  })
})
