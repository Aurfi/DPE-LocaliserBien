<template>
  <div class="max-w-4xl mx-auto">
    <!-- Formulaire de recherche DPE -->
    <div class="search-panel p-4 sm:p-8">
      <div class="mb-5 sm:mb-7">
        <h1 class="search-heading">Retrouver un bien grâce à son DPE</h1>
        <p class="search-description">Recopiez les critères de l’annonce.</p>
      </div>
      <form @submit.prevent="handleSubmit" class="space-y-5 sm:space-y-6" novalidate>
        <!-- Responsive grid: one field per line on mobile, flex on larger screens -->
        <div class="grid grid-cols-1 sm:grid-cols-2 items-start gap-5 sm:gap-6">
          <!-- Code postal ou commune (en premier) -->
          <div class="min-w-0">
            <label for="search-commune" class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              Commune
            </label>
            <input 
              v-model="formData.commune"
                id="search-commune"
                :aria-invalid="!!communeError"
                :aria-describedby="communeError ? 'search-commune-error' : undefined"
              type="text" 
              placeholder="ex : 13080 ou Lyon"
              @blur="touchedFields.commune = true"
              :class="[
                'w-full px-4 py-3 text-base bg-gray-50 dark:bg-gray-900/50 border rounded-2xl focus:ring-2 transition-all placeholder-gray-500 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100',
                communeError
                  ? 'border-red-500 dark:border-red-400 focus:ring-red-500/20 focus:border-red-500 dark:focus:border-red-400'
                  : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400'
              ]"
            />
            <p v-if="communeError" id="search-commune-error" class="field-error">{{ communeError === true ? 'Indiquez une commune ou un code postal.' : communeError }}</p>
          </div>

          <!-- Surface (en deuxième) -->
          <div class="min-w-0">
            <label for="search-surface" class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              Surface
            </label>
            <div class="relative">
              <input 
                v-model="formData.surface"
                id="search-surface"
                :aria-invalid="!!surfaceError"
                :aria-describedby="surfaceError ? 'search-surface-error' : undefined"
                type="text" 
                placeholder="ex : 100"
                @input="validateSurfaceInput"
                @blur="touchedFields.surface = true"
                :class="[
                  'w-full px-4 py-3 pr-12 text-base bg-gray-50 dark:bg-gray-900/50 border rounded-2xl focus:ring-2 transition-all placeholder-gray-500 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100 no-spinners',
                  surfaceError
                    ? 'border-red-500 dark:border-red-400 focus:ring-red-500/20 focus:border-red-500 dark:focus:border-red-400'
                    : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400'
                ]"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                m²
              </span>
            </div>
            <p v-if="surfaceError" id="search-surface-error" class="field-error">{{ surfaceError === true ? 'Indiquez la surface.' : surfaceError }}</p>
            <!-- Property type selector -->
            <div class="mt-2">
              <div class="flex gap-1">
                <button
                  type="button"

                  @click="selectPropertyType('maison')"
                  aria-label="Rechercher une maison"
                  :aria-pressed="formData.typeBien === 'maison'"
                  :class="[
                    'property-option border transition-colors',
                    formData.typeBien === 'maison'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  ]"
                  title="Maison"
                >
                  Maison
                </button>
                <button
                  type="button"

                  @click="selectPropertyType('appartement')"
                  aria-label="Rechercher un appartement"
                  :aria-pressed="formData.typeBien === 'appartement'"
                  :class="[
                    'property-option border transition-colors',
                    formData.typeBien === 'appartement'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  ]"
                  title="Appartement"
                >
                  Appartement
                </button>
              </div>
            </div>
          </div>

          <!-- Consommation énergétique (en troisième) -->
          <div class="min-w-0">
            <label for="search-consommation" class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              Consommation énergétique
            </label>
            <div class="relative">
              <input 
                v-model="formData.consommation"
                id="search-consommation"
                :aria-invalid="!!consommationError"
                :aria-describedby="consommationError ? 'search-consommation-error' : undefined"
                type="text" 
                :placeholder="selectedEnergyClass ? '' : 'ex : 250'"
                @input="validateConsommationInput"
                @blur="touchedFields.consommation = true"
                :disabled="selectedEnergyClass !== null"
                :class="[
                  'w-full px-4 py-3 pr-24 text-base bg-gray-50 dark:bg-gray-900/50 border rounded-2xl focus:ring-2 transition-all placeholder-gray-500 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100 no-spinners disabled:opacity-50 disabled:cursor-not-allowed',
                  consommationError
                    ? 'border-red-500 dark:border-red-400 focus:ring-red-500/20 focus:border-red-500 dark:focus:border-red-400'
                    : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400'
                ]"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                kWh/m²/an
              </span>
            </div>
            <p v-if="consommationError" id="search-consommation-error" class="field-error">{{ consommationError === true ? 'Indiquez une consommation ou choisissez une classe.' : consommationError }}</p>
            <!-- Sélection par classe énergétique -->
            <div class="mt-2">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Classe indiquée dans l’annonce</p>
              <div class="class-options">
                <button
                  v-for="classe in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                  :key="'energy-' + classe"
                  type="button"

                  @click="selectEnergyClass(classe)"
                  :aria-label="`Classe énergétique ${classe}`"
                  :aria-pressed="selectedEnergyClass === classe"
                  :class="[
                    'class-option border transition-colors',
                    selectedEnergyClass === classe
                      ? getEnergyClassColor(classe) + ' shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  ]"
                >
                  {{ classe }}
                </button>
              </div>
              <div v-if="selectedEnergyClass" class="flex items-center gap-1 mt-1">
                <AlertCircle class="w-3 h-3 text-amber-500" />
                <span class="text-xs text-amber-600 dark:text-amber-400">La recherche par classe est moins précise</span>
              </div>
            </div>
          </div>

          <!-- GES optionnel (en quatrième) -->
          <div class="min-w-0">
            <label for="search-ges" class="block text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">
              GES <span class="text-xs text-gray-400">(optionnel)</span>
            </label>
            <div class="relative">
              <input 
                v-model="formData.ges"
                id="search-ges"
                :aria-invalid="!!gesError"
                :aria-describedby="gesError ? 'search-ges-error' : undefined"
                type="text" 
                :placeholder="selectedGESClass ? '' : 'ex : 58'"
                @input="validateGESInput"
                @blur="touchedFields.ges = true"
                :disabled="selectedGESClass !== null"
                class="w-full px-4 py-3 pr-28 text-base bg-gray-50/60 dark:bg-gray-900/30 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-400 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100 no-spinners disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                kgCO₂/m²/an
              </span>
            </div>
            <p v-if="gesError" id="search-ges-error" class="field-error">{{ gesError }}</p>
            <!-- Sélection par classe GES -->
            <div class="mt-2">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Classe indiquée dans l’annonce</p>
              <div class="class-options">
                <button
                  v-for="classe in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                  :key="'ges-' + classe"
                  type="button"

                  @click="selectGESClass(classe)"
                  :aria-label="`Classe GES ${classe}`"
                  :aria-pressed="selectedGESClass === classe"
                  :class="[
                    'class-option border transition-colors',
                    selectedGESClass === classe
                      ? getGESClassColor(classe) + ' shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  ]"
                >
                  {{ classe }}
                </button>
              </div>
              <div v-if="selectedGESClass" class="flex items-center gap-1 mt-1">
                <AlertCircle class="w-3 h-3 text-amber-500" />
                <span class="text-xs text-amber-600 dark:text-amber-400">La recherche par classe est moins précise</span>
              </div>
            </div>
          </div>

        </div>
        
        <!-- Bouton de recherche -->
        <div class="mt-6">
          <button 
            type="submit"
            :disabled="isLoading || (isPartiallyFilled && !isFormValid)"
            class="btn-primary w-full sm:w-auto sm:min-w-[240px] flex items-center justify-center"
          >
            <span v-if="!isLoading" class="flex items-center">
              <span>{{ isPartiallyFilled ? 'Localiser' : 'Localiser un exemple' }}</span>
            </span>
            <span v-else class="flex items-center">
              <Loader2 class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
              Recherche en cours...
            </span>
          </button>
        </div>
        
        <p class="text-sm text-gray-500 dark:text-gray-400"><router-link to="/informations" class="quiet-link underline">Où trouver ces informations dans l’annonce ?</router-link></p>

        <!-- Error message display -->
        <div v-if="errorMessage" class="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700 dark:text-red-300">{{ errorMessage }}</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<style>
/* Hide number input spinners */
.no-spinners::-webkit-outer-spin-button,
.no-spinners::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.no-spinners[type=number] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>

<script>
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { numericSearchInputError, parseNumericSearchInput } from '../../../utils/numericSearchInput.js'

export default {
  name: 'DPESearchForm',
  components: {
    Loader2,
    AlertCircle
  },
  emits: ['search'],
  data() {
    return {
      // États de chargement
      isLoading: false,
      errorMessage: null,

      // Données
      formData: {
        consommation: null,
        commune: '',
        ges: null,
        surface: null,
        energyClass: null,
        gesClass: null,
        typeBien: null
      },

      // Classes sélectionnées
      selectedEnergyClass: null,
      selectedGESClass: null,

      // Track which fields have been touched
      touchedFields: {
        commune: false,
        surface: false,
        consommation: false,
        ges: false
      }
    }
  },
  computed: {
    numericErrors() {
      return {
        surface: numericSearchInputError(this.formData.surface, {
          requiredMessage: 'Indiquez la surface.',
          minimum: 10,
          minimumMessage: 'Minimum 10 m²'
        }),
        consommation: this.selectedEnergyClass
          ? null
          : numericSearchInputError(this.formData.consommation, {
              requiredMessage: 'Indiquez une consommation ou choisissez une classe.',
              minimum: 10,
              minimumMessage: 'Minimum 10 kWh/m²/an'
            }),
        ges: this.selectedGESClass ? null : numericSearchInputError(this.formData.ges)
      }
    },

    isFormValid() {
      return Boolean(
        this.formData.commune &&
          this.formData.commune.trim().length >= 2 &&
          !Object.values(this.numericErrors).some(Boolean)
      )
    },

    isPartiallyFilled() {
      // Vérifie si au moins un champ a été modifié
      return (
        this.formData.commune !== '' ||
        this.formData.surface !== null ||
        this.formData.consommation !== null ||
        this.formData.ges !== null ||
        this.selectedEnergyClass !== null ||
        this.selectedGESClass !== null
      )
    },

    // Validation errors for each field
    communeError() {
      if (!this.touchedFields.commune) return null
      if (!this.formData.commune) return true
      if (this.formData.commune.length < 2) return 'Minimum 2 caractères'
      return null
    },

    surfaceError() {
      if (!this.touchedFields.surface && !parseNumericSearchInput(this.formData.surface).error) return null
      return this.numericErrors.surface
    },

    consommationError() {
      if (!this.touchedFields.consommation && !parseNumericSearchInput(this.formData.consommation).error) return null
      return this.numericErrors.consommation
    },

    gesError() {
      return this.numericErrors.ges
    }
  },
  watch: {
    // Effacer la classe sélectionnée quand l'utilisateur tape une valeur
    'formData.consommation': function (newVal) {
      if (newVal && this.selectedEnergyClass) {
        this.selectedEnergyClass = null
        this.formData.energyClass = null
      }
    },
    'formData.ges': function (newVal) {
      if (newVal && this.selectedGESClass) {
        this.selectedGESClass = null
        this.formData.gesClass = null
      }
    }
  },
  methods: {
    // Gestion du formulaire
    handleSubmit() {
      if (this.isLoading) return

      // Clear any previous error
      this.errorMessage = null

      // Si aucun champ n'est rempli, utiliser les valeurs d'exemple
      if (!this.isPartiallyFilled) {
        this.formData = {
          commune: '13080',
          surface: 368,
          consommation: 300,
          ges: 58
        }
      }

      // Also guard programmatic submits, not only the disabled submit button.
      this.touchedFields = { commune: true, surface: true, consommation: true, ges: true }
      if (!this.isFormValid) return

      this.isLoading = true

      const searchData = {
        consommationEnergie: this.parseNumericValue(this.formData.consommation),
        energyClass: this.formData.energyClass || null,
        commune: this.formData.commune.trim(),
        emissionGES: this.parseNumericValue(this.formData.ges),
        gesClass: this.formData.gesClass || null,
        surfaceHabitable: this.parseNumericValue(this.formData.surface),
        typeBien: this.formData.typeBien || null,
        maxResults: 5
      }

      this.$emit('search', searchData)
    },

    // Réinitialiser le chargement
    resetLoading() {
      this.isLoading = false
    },

    // Sélection de classe énergétique
    selectEnergyClass(classe) {
      if (this.selectedEnergyClass === classe) {
        this.selectedEnergyClass = null
        this.formData.consommation = null
        this.formData.energyClass = null
      } else {
        this.selectedEnergyClass = classe
        // Définir comme un marqueur spécial qui sera géré par le service de recherche
        this.formData.consommation = null // Sera géré par le service avec une plage
        this.formData.energyClass = classe
      }
    },

    // Sélection de classe GES
    selectGESClass(classe) {
      if (this.selectedGESClass === classe) {
        this.selectedGESClass = null
        this.formData.ges = null
        this.formData.gesClass = null
      } else {
        this.selectedGESClass = classe
        // Définir comme un marqueur spécial qui sera géré par le service de recherche
        this.formData.ges = null // Sera géré par le service avec une plage
        this.formData.gesClass = classe
      }
    },

    // Couleurs pour les classes énergétiques
    getEnergyClassColor(classe) {
      const colors = {
        A: 'bg-green-500 text-white',
        B: 'bg-green-600 text-white',
        C: 'bg-yellow-400 text-gray-800',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-500 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-purple-600 text-white'
      }
      return colors[classe]
    },

    // Couleurs pour les classes GES
    getGESClassColor(classe) {
      const colors = {
        A: 'bg-green-500 text-white',
        B: 'bg-green-600 text-white',
        C: 'bg-yellow-400 text-gray-800',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-500 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-purple-600 text-white'
      }
      return colors[classe]
    },

    // Sélection du type de bien
    selectPropertyType(type) {
      if (this.formData.typeBien === type) {
        this.formData.typeBien = null // Désélectionner si déjà sélectionné
      } else {
        this.formData.typeBien = type
      }
    },

    // Keep the raw input visible. Validation explains unsupported values.
    validateSurfaceInput(event) {
      this.formData.surface = event.target.value
    },

    validateConsommationInput(event) {
      this.formData.consommation = event.target.value
    },

    validateGESInput(event) {
      this.formData.ges = event.target.value
    },

    parseNumericValue(value) {
      return parseNumericSearchInput(value).value
    }
  }
}
</script>

<style scoped>
.form-group {
    position: relative
}

/* Animation pour les champs focus */
.form-group input:focus + .absolute {
    --tw-text-opacity: 1;
    color: rgb(22 163 74 / var(--tw-text-opacity, 1))
}
button:hover .form-group input:focus + .absolute {
    --tw-text-opacity: 1;
    color: rgb(21 128 61 / var(--tw-text-opacity, 1))
}

/* Style pour les exemples */
button:hover .text-green-600 {
    --tw-text-opacity: 1;
    color: rgb(21 128 61 / var(--tw-text-opacity, 1))
}
</style>
