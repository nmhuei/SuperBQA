// Dark mode only; loaded blocking from app.html so light-dark()
// resolves to dark before first paint. Keep dependency-free and tiny.
;(() => {
  document.documentElement.dataset.theme = 'dark'
  try {
    localStorage.setItem('theme', 'dark')
  } catch {
    // storage unavailable
  }
})()
