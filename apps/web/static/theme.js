// Pre-paint theme restore; loaded blocking from app.html so light-dark()
// resolves before first paint. Keep dependency-free and tiny.
;(() => {
  document.documentElement.dataset.theme = 'dark'
  try {
    const theme = localStorage.getItem('theme')
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme
    }
  } catch {
    // storage unavailable (private mode / disabled): keep the default dark club theme
  }
})()
