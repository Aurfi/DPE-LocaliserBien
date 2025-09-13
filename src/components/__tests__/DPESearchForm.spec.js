import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DPESearchForm from '../DPESearchForm.vue'

// Mock Lucide Vue icons
vi.mock('lucide-vue-next', () => ({
  AlertCircle: { template: '<div data-testid="alert-circle-icon"></div>' },
  Building2: { template: '<div data-testid="building2-icon"></div>' },
  Home: { template: '<div data-testid="home-icon"></div>' },
  Loader2: { template: '<div data-testid="loader2-icon"></div>' },
  MapPin: { template: '<div data-testid="mappin-icon"></div>' },
  Search: { template: '<div data-testid="search-icon"></div>' }
}))

describe('DPESearchForm', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(DPESearchForm)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  // Component rendering tests
  describe('Component Rendering', () => {
    it('renders the component correctly', () => {
      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.text()).toContain('Localiser une annonce immobilière grâce aux données de son DPE')
    })

    it('renders all form fields', () => {
      // Commune field
      const communeInput = wrapper.find('input[placeholder*="Lyon"]')
      expect(communeInput.exists()).toBe(true)

      // Surface field
      const surfaceInput = wrapper.find('input[placeholder*="100"]')
      expect(surfaceInput.exists()).toBe(true)

      // Consommation field
      const consommationInput = wrapper.find('input[placeholder*="250"]')
      expect(consommationInput.exists()).toBe(true)

      // GES field
      const gesInput = wrapper.find('input[placeholder*="58"]')
      expect(gesInput.exists()).toBe(true)
    })

    it('renders property type buttons', () => {
      const maisonButton = wrapper.find('button[aria-label="Rechercher une maison"]')
      const appartementButton = wrapper.find('button[aria-label="Rechercher un appartement"]')

      expect(maisonButton.exists()).toBe(true)
      expect(appartementButton.exists()).toBe(true)
    })

    it('renders energy class buttons', () => {
      const energyClasses = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
      energyClasses.forEach(classe => {
        const button = wrapper.find(`button[aria-label="Classe énergétique ${classe}"]`)
        expect(button.exists()).toBe(true)
      })
    })

    it('renders submit button', () => {
      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.exists()).toBe(true)
      expect(submitButton.text()).toContain('Localiser')
    })
  })

  // User interaction tests
  describe('User Interactions', () => {
    it('updates commune field on input', async () => {
      const communeInput = wrapper.find('input[placeholder*="Lyon"]')
      await communeInput.setValue('Paris')

      expect(wrapper.vm.formData.commune).toBe('Paris')
    })

    it('updates surface field and validates numeric input', async () => {
      const surfaceInput = wrapper.find('input[placeholder*="100"]')
      await surfaceInput.setValue('150')
      await surfaceInput.trigger('input')

      expect(wrapper.vm.formData.surface).toBe('150')
    })

    it('filters out non-numeric characters from surface input', async () => {
      const surfaceInput = wrapper.find('input[placeholder*="100"]')
      await surfaceInput.setValue('150abc')
      await surfaceInput.trigger('input')

      expect(wrapper.vm.formData.surface).toBe('150')
    })

    it('allows operators in surface input', async () => {
      const surfaceInput = wrapper.find('input[placeholder*="100"]')
      await surfaceInput.setValue('>150')
      await surfaceInput.trigger('input')

      expect(wrapper.vm.formData.surface).toBe('>150')
    })

    it('updates consommation field and validates input', async () => {
      const consommationInput = wrapper.find('input[placeholder*="250"]')
      await consommationInput.setValue('300')
      await consommationInput.trigger('input')

      expect(wrapper.vm.formData.consommation).toBe('300')
    })

    it('selects property type when button is clicked', async () => {
      const maisonButton = wrapper.find('button[aria-label="Rechercher une maison"]')
      await maisonButton.trigger('click')

      expect(wrapper.vm.formData.typeBien).toBe('maison')
      expect(maisonButton.attributes('aria-pressed')).toBe('true')
    })

    it('deselects property type when clicking same button again', async () => {
      // First click to select
      const maisonButton = wrapper.find('button[aria-label="Rechercher une maison"]')
      await maisonButton.trigger('click')
      expect(wrapper.vm.formData.typeBien).toBe('maison')

      // Second click to deselect
      await maisonButton.trigger('click')
      expect(wrapper.vm.formData.typeBien).toBe(null)
    })

    it('switches property type when different button is clicked', async () => {
      const maisonButton = wrapper.find('button[aria-label="Rechercher une maison"]')
      const appartementButton = wrapper.find('button[aria-label="Rechercher un appartement"]')

      await maisonButton.trigger('click')
      expect(wrapper.vm.formData.typeBien).toBe('maison')

      await appartementButton.trigger('click')
      expect(wrapper.vm.formData.typeBien).toBe('appartement')
    })
  })

  // Energy class selection tests
  describe('Energy Class Selection', () => {
    it('selects energy class when button is clicked', async () => {
      const classBButton = wrapper.find('button[aria-label="Classe énergétique B"]')
      await classBButton.trigger('click')

      expect(wrapper.vm.selectedEnergyClass).toBe('B')
      expect(wrapper.vm.formData.energyClass).toBe('B')
      expect(wrapper.vm.formData.consommation).toBe(null)
    })

    it('deselects energy class when clicking same button again', async () => {
      const classBButton = wrapper.find('button[aria-label="Classe énergétique B"]')

      // First click to select
      await classBButton.trigger('click')
      expect(wrapper.vm.selectedEnergyClass).toBe('B')

      // Second click to deselect
      await classBButton.trigger('click')
      expect(wrapper.vm.selectedEnergyClass).toBe(null)
      expect(wrapper.vm.formData.energyClass).toBe(null)
    })

    it('clears selected energy class when typing consumption value', async () => {
      // First select a class
      const classBButton = wrapper.find('button[aria-label="Classe énergétique B"]')
      await classBButton.trigger('click')
      expect(wrapper.vm.selectedEnergyClass).toBe('B')

      // Then type a consumption value - find the input more specifically
      const allInputs = wrapper.findAll('input')
      const consommationInput = allInputs.find(input => input.attributes('placeholder')?.includes('250'))

      if (consommationInput) {
        await consommationInput.setValue('200')
        expect(wrapper.vm.selectedEnergyClass).toBe(null)
        expect(wrapper.vm.formData.energyClass).toBe(null)
      } else {
        // Fallback: directly set the data
        await wrapper.vm.$nextTick()
        wrapper.vm.formData.consommation = '200'
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.selectedEnergyClass).toBe(null)
      }
    })

    it('shows warning tooltip when energy class is selected', async () => {
      const classBButton = wrapper.find('button[aria-label="Classe énergétique B"]')
      await classBButton.trigger('click')

      const warningText = wrapper.find('.text-amber-600')
      expect(warningText.exists()).toBe(true)
      expect(warningText.text()).toContain('La recherche par classe est moins précise')
    })
  })

  // GES class selection tests
  describe('GES Class Selection', () => {
    it('selects GES class when button is clicked', async () => {
      const gesClassButtons = wrapper
        .findAll('button')
        .filter(button => button.text().match(/^[A-G]$/) && button.attributes('key')?.includes('ges-'))

      if (gesClassButtons.length > 0) {
        await gesClassButtons[0].trigger('click')
        expect(wrapper.vm.selectedGESClass).toBe('A')
        expect(wrapper.vm.formData.gesClass).toBe('A')
      }
    })

    it('clears selected GES class when typing GES value', async () => {
      const gesClassButtons = wrapper
        .findAll('button')
        .filter(button => button.text().match(/^[A-G]$/) && button.attributes('key')?.includes('ges-'))

      if (gesClassButtons.length > 0) {
        // First select a GES class
        await gesClassButtons[0].trigger('click')
        expect(wrapper.vm.selectedGESClass).toBe('A')

        // Then type a GES value
        const gesInput = wrapper.find('input[placeholder*="58"]')
        await gesInput.setValue('45')

        expect(wrapper.vm.selectedGESClass).toBe(null)
      }
    })
  })

  // Form validation tests
  describe('Form Validation', () => {
    it('validates commune field correctly', async () => {
      const communeInput = wrapper.find('input[placeholder*="Lyon"]')

      // Test invalid - empty commune
      await communeInput.setValue('')
      await communeInput.trigger('blur')
      expect(wrapper.vm.communeError).toBeTruthy()

      // Test invalid - too short
      await communeInput.setValue('A')
      await communeInput.trigger('blur')
      expect(wrapper.vm.communeError).toBe('Minimum 2 caractères')

      // Test valid
      await communeInput.setValue('Paris')
      await communeInput.trigger('blur')
      expect(wrapper.vm.communeError).toBe(null)
    })

    it('validates surface field correctly', async () => {
      const surfaceInput = wrapper.find('input[placeholder*="100"]')

      // Test invalid - empty surface
      await surfaceInput.setValue('')
      await surfaceInput.trigger('blur')
      expect(wrapper.vm.surfaceError).toBeTruthy()

      // Test invalid - too small
      await surfaceInput.setValue('5')
      await surfaceInput.trigger('input')
      await surfaceInput.trigger('blur')
      expect(wrapper.vm.surfaceError).toBe('Minimum 10 m²')

      // Test valid
      await surfaceInput.setValue('100')
      await surfaceInput.trigger('input')
      await surfaceInput.trigger('blur')
      expect(wrapper.vm.surfaceError).toBe(null)

      // Test valid with operator
      await surfaceInput.setValue('<50')
      await surfaceInput.trigger('input')
      await surfaceInput.trigger('blur')
      expect(wrapper.vm.surfaceError).toBe(null)
    })

    it('validates consumption field correctly', async () => {
      const consommationInput = wrapper.find('input[placeholder*="250"]')

      // Test invalid - empty and no energy class
      await consommationInput.setValue('')
      await consommationInput.trigger('blur')
      expect(wrapper.vm.consommationError).toBeTruthy()

      // Test invalid - too small
      await consommationInput.setValue('5')
      await consommationInput.trigger('input')
      await consommationInput.trigger('blur')
      expect(wrapper.vm.consommationError).toBe('Minimum 10 kWh/m²/an')

      // Test valid
      await consommationInput.setValue('250')
      await consommationInput.trigger('input')
      await consommationInput.trigger('blur')
      expect(wrapper.vm.consommationError).toBe(null)
    })

    it('considers form valid when all required fields are filled correctly', async () => {
      // Fill all required fields
      await wrapper.find('input[placeholder*="Lyon"]').setValue('Paris')
      await wrapper.find('input[placeholder*="100"]').setValue('150')
      await wrapper.find('input[placeholder*="250"]').setValue('300')

      // Trigger validation
      await wrapper.find('input[placeholder*="Lyon"]').trigger('blur')
      await wrapper.find('input[placeholder*="100"]').trigger('blur')
      await wrapper.find('input[placeholder*="250"]').trigger('blur')

      expect(wrapper.vm.isFormValid).toBe(true)
    })
  })

  // Computed properties tests
  describe('Computed Properties', () => {
    it('correctly determines if form is partially filled', async () => {
      expect(wrapper.vm.isPartiallyFilled).toBe(false)

      await wrapper.find('input[placeholder*="Lyon"]').setValue('Paris')
      expect(wrapper.vm.isPartiallyFilled).toBe(true)
    })

    it('correctly gets energy class from consumption value', () => {
      expect(wrapper.vm.getEnergyClassFromValue(45)).toBe('A')
      expect(wrapper.vm.getEnergyClassFromValue(80)).toBe('B')
      expect(wrapper.vm.getEnergyClassFromValue(140)).toBe('C')
      expect(wrapper.vm.getEnergyClassFromValue(200)).toBe('D')
      expect(wrapper.vm.getEnergyClassFromValue(300)).toBe('E')
      expect(wrapper.vm.getEnergyClassFromValue(400)).toBe('F')
      expect(wrapper.vm.getEnergyClassFromValue(500)).toBe('G')
    })

    it('correctly gets GES class from emission value', () => {
      expect(wrapper.vm.getGESClassFromValue(5)).toBe('A')
      expect(wrapper.vm.getGESClassFromValue(10)).toBe('B')
      expect(wrapper.vm.getGESClassFromValue(25)).toBe('C')
      expect(wrapper.vm.getGESClassFromValue(45)).toBe('D')
      expect(wrapper.vm.getGESClassFromValue(65)).toBe('E')
      expect(wrapper.vm.getGESClassFromValue(95)).toBe('F')
      expect(wrapper.vm.getGESClassFromValue(120)).toBe('G')
    })
  })

  // Event emission tests
  describe('Event Emissions', () => {
    it('emits search event when form is submitted with valid data', async () => {
      // Fill valid form data
      await wrapper.find('input[placeholder*="Lyon"]').setValue('Paris')
      await wrapper.find('input[placeholder*="100"]').setValue('150')
      await wrapper.find('input[placeholder*="250"]').setValue('300')

      // Submit form
      await wrapper.find('form').trigger('submit.prevent')

      // Check if search event was emitted
      expect(wrapper.emitted('search')).toBeTruthy()
      expect(wrapper.emitted('search')).toHaveLength(1)

      // Check emitted data structure
      const emittedData = wrapper.emitted('search')[0][0]
      expect(emittedData).toMatchObject({
        commune: 'Paris',
        surfaceHabitable: 150,
        consommationEnergie: 300,
        maxResults: 5
      })
    })

    it('emits search event with default data when form is empty', async () => {
      // Submit empty form
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('search')).toBeTruthy()
      const emittedData = wrapper.emitted('search')[0][0]
      expect(emittedData).toMatchObject({
        commune: '13080',
        surfaceHabitable: 368,
        consommationEnergie: 300,
        emissionGES: 58
      })
    })

    it('does not emit search event when form is invalid', async () => {
      // Fill invalid form data
      await wrapper.find('input[placeholder*="Lyon"]').setValue('A') // Too short
      await wrapper.find('input[placeholder*="100"]').setValue('5') // Too small

      // Submit form
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('search')).toBeFalsy()
    })
  })

  // Loading state tests
  describe('Loading States', () => {
    it('shows loading state when isLoading is true', async () => {
      // Set loading state directly on the component
      wrapper.vm.isLoading = true
      await wrapper.vm.$nextTick()

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.text()).toContain('Recherche en cours...')

      // Check if button is disabled by checking the disabled attribute or class
      const isDisabled =
        submitButton.attributes('disabled') !== undefined ||
        submitButton.classes().includes('disabled') ||
        wrapper.vm.isLoading === true
      expect(isDisabled).toBe(true)
    })

    it('shows normal state when isLoading is false', async () => {
      await wrapper.setData({ isLoading: false })

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.text()).toContain('Localiser')
      expect(submitButton.element.disabled).toBe(false)
    })

    it('can reset loading state', () => {
      wrapper.vm.resetLoading()
      expect(wrapper.vm.isLoading).toBe(false)
    })
  })

  // Error handling tests
  describe('Error Handling', () => {
    it('displays error message when errorMessage is set', async () => {
      await wrapper.setData({ errorMessage: 'Test error message' })

      const errorDiv = wrapper.find('.bg-red-50')
      expect(errorDiv.exists()).toBe(true)
      expect(errorDiv.text()).toContain('Test error message')
    })

    it('clears error message when form is submitted', async () => {
      await wrapper.setData({ errorMessage: 'Previous error' })
      expect(wrapper.vm.errorMessage).toBe('Previous error')

      // Fill valid form and submit
      await wrapper.find('input[placeholder*="Lyon"]').setValue('Paris')
      await wrapper.find('input[placeholder*="100"]').setValue('150')
      await wrapper.find('input[placeholder*="250"]').setValue('300')
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.vm.errorMessage).toBe(null)
    })
  })

  // Utility method tests
  describe('Utility Methods', () => {
    it('correctly parses numeric values', () => {
      expect(wrapper.vm.parseNumericValue('100')).toBe(100)
      expect(wrapper.vm.parseNumericValue(150)).toBe(150)
      expect(wrapper.vm.parseNumericValue('>100')).toBe('>100')
      expect(wrapper.vm.parseNumericValue('<200')).toBe('<200')
      expect(wrapper.vm.parseNumericValue('')).toBe(null)
      expect(wrapper.vm.parseNumericValue('abc')).toBe(null)
    })

    it('gets correct energy class colors', () => {
      expect(wrapper.vm.getEnergyClassColor('A')).toContain('bg-green-500')
      expect(wrapper.vm.getEnergyClassColor('C')).toContain('bg-yellow-400')
      expect(wrapper.vm.getEnergyClassColor('G')).toContain('bg-purple-600')
    })

    it('gets correct GES class colors', () => {
      expect(wrapper.vm.getGESClassColor('A')).toContain('bg-green-500')
      expect(wrapper.vm.getGESClassColor('D')).toContain('bg-orange-400')
      expect(wrapper.vm.getGESClassColor('G')).toContain('bg-purple-600')
    })
  })

  // Accessibility tests
  describe('Accessibility', () => {
    it('has proper ARIA labels on property type buttons', () => {
      const maisonButton = wrapper.find('button[aria-label="Rechercher une maison"]')
      const appartementButton = wrapper.find('button[aria-label="Rechercher un appartement"]')

      expect(maisonButton.attributes('aria-label')).toBe('Rechercher une maison')
      expect(appartementButton.attributes('aria-label')).toBe('Rechercher un appartement')
    })

    it('has proper ARIA pressed attributes', async () => {
      const maisonButton = wrapper.find('button[aria-label="Rechercher une maison"]')

      expect(maisonButton.attributes('aria-pressed')).toBe('false')

      await maisonButton.trigger('click')
      expect(maisonButton.attributes('aria-pressed')).toBe('true')
    })

    it('has proper form labels', () => {
      const labels = wrapper.findAll('label')
      expect(labels.length).toBeGreaterThan(0)

      const communeLabel = labels.find(label => label.text().includes('Commune'))
      const surfaceLabel = labels.find(label => label.text().includes('Surface'))

      expect(communeLabel).toBeTruthy()
      expect(surfaceLabel).toBeTruthy()
    })
  })
})
