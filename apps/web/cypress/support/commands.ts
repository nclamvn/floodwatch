/// <reference types="cypress" />

// Custom commands for FloodWatch E2E tests

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Wait for the map to be fully loaded
       */
      waitForMapLoad(): Chainable<void>

      /**
       * Wait for API data to be loaded
       */
      waitForData(): Chainable<void>
    }
  }
}

// Wait for map to fully load
Cypress.Commands.add('waitForMapLoad', () => {
  // Wait for maplibre-gl-js to render
  cy.get('.maplibregl-canvas', { timeout: 15000 }).should('be.visible')
})

// Wait for API data
Cypress.Commands.add('waitForData', () => {
  // Wait for loading indicators to disappear
  cy.get('[data-loading="true"]', { timeout: 10000 }).should('not.exist')
})

export {}
