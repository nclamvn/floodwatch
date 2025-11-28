// Cypress E2E Support File

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Hide fetch/XHR requests from command log
const app = window.top
if (app && !app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style')
  style.setAttribute('data-hide-command-log-request', '')
  style.innerHTML = '.command-name-request, .command-name-xhr { display: none }'
  app.document.head.appendChild(style)
}

// Global before each
beforeEach(() => {
  // Suppress uncaught exceptions from the app
  cy.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from failing the test
    console.log('Uncaught exception:', err.message)
    return false
  })
})
