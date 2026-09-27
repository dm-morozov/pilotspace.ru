document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('support-copy-status')

  for (const button of document.querySelectorAll('[data-copy-target]')) {
    button.addEventListener('click', async () => {
      const input = document.getElementById(button.dataset.copyTarget)
      button.disabled = true
      try {
        await navigator.clipboard.writeText(button.dataset.copyValue || input.value)
        status.textContent = button.dataset.copySuccess
      } catch {
        // Local files and browsers without clipboard permission still allow manual copying.
        input.focus()
        input.select()
        input.setSelectionRange(0, input.value.length)
        status.textContent = 'Номер выделен. Скопируйте его через меню устройства или нажмите Ctrl+C (⌘C на Mac).'
      } finally {
        button.disabled = false
      }
    })
  }
})
