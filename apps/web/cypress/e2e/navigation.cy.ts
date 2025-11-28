describe('Navigation', () => {
  it('should load the home page', () => {
    cy.visit('/')
    cy.get('body').should('be.visible')
  })

  it('should navigate to the map page', () => {
    cy.visit('/map')
    cy.waitForMapLoad()
    cy.url().should('include', '/map')
  })

  it('should navigate to the report page', () => {
    cy.visit('/report')
    cy.get('body').should('be.visible')
    cy.url().should('include', '/report')
  })

  it('should navigate to the help page', () => {
    cy.visit('/help')
    cy.get('body').should('be.visible')
    cy.url().should('include', '/help')
  })

  it('should navigate to the routes page', () => {
    cy.visit('/routes')
    cy.get('body').should('be.visible')
    cy.url().should('include', '/routes')
  })
})

describe('Map Page', () => {
  beforeEach(() => {
    cy.visit('/map')
  })

  it('should display the map canvas', () => {
    cy.waitForMapLoad()
    cy.get('.maplibregl-canvas').should('exist')
  })

  it('should have map controls visible', () => {
    cy.waitForMapLoad()
    // Check for common map elements
    cy.get('.maplibregl-ctrl-group').should('exist')
  })

  it('should handle map interactions', () => {
    cy.waitForMapLoad()
    // The map should be interactive
    cy.get('.maplibregl-canvas')
      .should('be.visible')
      .trigger('wheel', { deltaY: -500 })
  })
})

describe('Mobile Responsiveness', () => {
  beforeEach(() => {
    // Set viewport to mobile size
    cy.viewport('iphone-x')
  })

  it('should display mobile controls on map page', () => {
    cy.visit('/map')
    cy.waitForMapLoad()
    // Mobile controls should be visible
    cy.get('button').should('be.visible')
  })

  it('should show mobile navigation', () => {
    cy.visit('/')
    // Check mobile-friendly elements exist
    cy.get('body').should('be.visible')
  })
})

describe('Dark Mode', () => {
  it('should toggle dark mode', () => {
    cy.visit('/')

    // Check if dark mode toggle exists
    cy.get('body').then(($body) => {
      // Look for dark mode toggle button or similar control
      const darkModeToggle = $body.find('[aria-label*="dark"], [aria-label*="theme"], button:contains("theme")')

      if (darkModeToggle.length > 0) {
        cy.wrap(darkModeToggle).first().click()
        // Check if dark class is applied
        cy.get('html').should(($html) => {
          const hasDarkClass = $html.hasClass('dark')
          const hasDarkStyle = $html.attr('style')?.includes('dark')
          expect(hasDarkClass || hasDarkStyle !== undefined).to.be.true
        })
      }
    })
  })
})

describe('Accessibility', () => {
  it('should have proper heading structure on home page', () => {
    cy.visit('/')
    // At least one heading should exist
    cy.get('h1, h2, h3').should('exist')
  })

  it('should have accessible buttons', () => {
    cy.visit('/')
    // Buttons should have accessible names
    cy.get('button').each(($btn) => {
      const hasAriaLabel = $btn.attr('aria-label')
      const hasText = $btn.text().trim().length > 0
      const hasAriaLabelledBy = $btn.attr('aria-labelledby')

      expect(hasAriaLabel || hasText || hasAriaLabelledBy).to.be.true
    })
  })
})
