<template>
  <div class="max-w-4xl mx-auto">
    <!-- Formulaire de recherche -->
    <div class="search-panel">
      <div class="mb-7">
        <h1 class="search-heading">Rechercher les DPE les plus récents autour d’une adresse</h1>
        <p class="search-description">Choisissez une adresse et un périmètre pour explorer les diagnostics disponibles.</p>
      </div>
      
      <form @submit.prevent="searchRecentDPE" class="space-y-6">
        <!-- Adresse -->
        <div>
          <label for="nearby-address" class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">

            Adresse de recherche
          </label>
          <input
            v-model="searchCriteria.address" id="nearby-address"
            type="text"
            placeholder="Ex: 15 rue de la Paix, 75002 Paris"
            class="w-full px-4 py-3 text-base bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-400 dark:placeholder-gray-300 text-gray-800 dark:text-gray-100"
            required
          />
        </div>

        <!-- Période et périmètre -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Période -->
          <div>
            <label for="nearby-monthsBack" class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">

              DPE des derniers
            </label>
            <select
              v-model="searchCriteria.monthsBack" id="nearby-monthsBack"
              class="w-full px-4 py-3 text-base bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-gray-800 dark:text-gray-100"
            >
              <option value="1">1 mois</option>
              <option value="3">3 mois</option>
              <option value="6">6 mois</option>
              <option value="12">1 an</option>
              <option value="24">2 ans</option>
              <option value="48">4 ans</option>
            </select>
          </div>

          <!-- Rayon -->
          <div>
            <label for="nearby-radius" class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">

              Rayon de recherche
            </label>
            <select
              v-model="searchCriteria.radius" id="nearby-radius"
              class="w-full px-4 py-3 text-base bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-gray-800 dark:text-gray-100"
            >
              <option value="0.1">100 m</option>
              <option value="0.5">500 m</option>
              <option value="1">1 km</option>
              <option value="3">3 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="15">15 km</option>
              <option value="20">20 km</option>
              <option value="30">30 km</option>
            </select>
          </div>
        </div>

        <details
          class="nearby-filter-disclosure"
          :open="optionalFiltersOpen"
          @toggle="optionalFiltersOpen = $event.target.open"
        >
          <summary class="nearby-filter-summary">
            <span class="font-medium">Filtres facultatifs</span>
            <span v-if="activeOptionalFilters.length"> ({{ activeOptionalFilters.length }} actif{{ activeOptionalFilters.length > 1 ? 's' : '' }})</span>
            <span class="nearby-filter-description">
              {{ activeOptionalFilters.join(' · ') || 'Surface, type de bien, énergie, GES' }}
            </span>
            <span v-if="hasNumericErrors" class="field-error">Un filtre est à corriger.</span>
          </summary>
          <div class="nearby-filter-fields space-y-6">
            <!-- Surface (optionnel) -->
            <div>
              <label for="nearby-surface" class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">

                Surface (optionnel)
              </label>
              <div class="relative">
                <input
                  v-model="searchCriteria.surface" id="nearby-surface"
                  :aria-invalid="!!numericErrors.surface"
                  :aria-describedby="numericErrors.surface ? 'nearby-surface-error' : undefined"
                  type="text"
                  placeholder="Ex: 100"
                  @input="validateSurfaceInput"
                  class="w-full px-4 py-3 pr-12 text-base bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-gray-800 dark:text-gray-100 no-spinners"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                  m²
                </span>
              </div>
              <p v-if="numericErrors.surface" id="nearby-surface-error" class="field-error">{{ numericErrors.surface }}</p>
              <!-- Property type selector -->
              <div class="mt-2">
                <div class="flex gap-1">
                  <button
                    type="button"
                    @click="selectPropertyType('maison')"
                    :aria-pressed="searchCriteria.typeBien === 'maison'"
                    :class="[
                      'property-option border transition-colors',
                      searchCriteria.typeBien === 'maison'
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
                    :aria-pressed="searchCriteria.typeBien === 'appartement'"
                    :class="[
                      'property-option border transition-colors',
                      searchCriteria.typeBien === 'appartement'
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

            <!-- Consommation et GES (optionnel) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Consommation énergétique -->
              <div>
                <label for="nearby-consommation" class="block text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">
                  Consommation (optionnel)
                </label>
                <div class="relative">
                  <input
                    v-model="searchCriteria.consommation" id="nearby-consommation"
                    :aria-invalid="!!numericErrors.consommation"
                    :aria-describedby="numericErrors.consommation ? 'nearby-consommation-error' : undefined"
                    type="text"
                    placeholder="ex : 250"
                    @input="validateConsommationInput"
                    :disabled="selectedEnergyClasses.length > 0"
                    class="w-full px-4 py-3 pr-24 text-base bg-gray-50/60 dark:bg-gray-900/30 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-500/60 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100 no-spinners disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                    kWh/m²/an
                  </span>
                </div>
                <p v-if="numericErrors.consommation" id="nearby-consommation-error" class="field-error">{{ numericErrors.consommation }}</p>
                <div class="mt-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Classe indiquée dans l’annonce</p>
                  <div class="class-options">
                    <button
                      v-for="classe in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                      :key="'energy-' + classe"
                      type="button"
                      @click="toggleEnergyClasse(classe)"
                      :aria-label="`Classe énergétique ${classe}`"
                      :aria-pressed="selectedEnergyClasses.includes(classe)"
                      :class="[
                        'class-option border transition-colors',
                        selectedEnergyClasses.includes(classe)
                          ? getClasseColor(classe) + ' shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      ]"
                    >
                      {{ classe }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- GES -->
              <div>
                <label for="nearby-ges" class="block text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">
                  GES (optionnel)
                </label>
                <div class="relative">
                  <input
                    v-model="searchCriteria.ges" id="nearby-ges"
                    :aria-invalid="!!numericErrors.ges"
                    :aria-describedby="numericErrors.ges ? 'nearby-ges-error' : undefined"
                    type="text"
                    placeholder="ex : 58"
                    @input="validateGESInput"
                    :disabled="selectedGESClasses.length > 0"
                    class="w-full px-4 py-3 pr-28 text-base bg-gray-50/60 dark:bg-gray-900/30 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-500/60 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100 no-spinners disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                    kgCO₂/m²/an
                  </span>
                </div>
                <p v-if="numericErrors.ges" id="nearby-ges-error" class="field-error">{{ numericErrors.ges }}</p>
                <div class="mt-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Classe indiquée dans l’annonce</p>
                  <div class="class-options">
                    <button
                      v-for="classe in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                      :key="'ges-' + classe"
                      type="button"
                      @click="toggleGESClasse(classe)"
                      :aria-label="`Classe GES ${classe}`"
                      :aria-pressed="selectedGESClasses.includes(classe)"
                      :class="[
                        'class-option border transition-colors',
                        selectedGESClasses.includes(classe)
                          ? getGESClassColor(classe) + ' shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      ]"
                    >
                      {{ classe }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- Bouton de recherche -->
        <button
          type="submit"
          :disabled="loading || !searchCriteria.address || hasNumericErrors"
          class="btn-primary w-full sm:w-auto sm:min-w-[240px] flex items-center justify-center"
        >
          <Loader v-if="loading" class="w-5 h-5 mr-2 animate-spin" />
          {{ loading ? 'Recherche en cours...' : 'Rechercher' }}
        </button>
      </form>
      
      <!-- Error message display -->
      <div v-if="errorMessage" role="alert" class="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
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
    </div>
  </div>
</template>

<script>
import { Loader } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import * as recentDPEService from '../../../services/recent-dpe.service'
import { useRecherches } from '../../../stores/useRecherches.js'
import { numericSearchInputError, parseNumericSearchInput } from '../../../utils/numericSearchInput.js'
import { geocodeAddress } from '../../../utils/utilsGeo.js'

export default {
  name: 'RechercheDPERecente',
  components: {
    Loader
  },
  emits: ['search-results', 'search-started', 'search-error'],
  setup(_props, { emit }) {
    const recherchesStore = useRecherches()
    const loading = ref(false)
    let requestId = 0
    const errorMessage = ref(null)
    const searchCriteria = ref({
      address: '',
      monthsBack: 1,
      radius: 0.5,
      surface: null,
      typeBien: null,
      consommation: null,
      ges: null
    })
    const numericErrors = computed(() => ({
      surface: numericSearchInputError(searchCriteria.value.surface),
      consommation: numericSearchInputError(searchCriteria.value.consommation),
      ges: numericSearchInputError(searchCriteria.value.ges)
    }))
    const hasNumericErrors = computed(() => Object.values(numericErrors.value).some(Boolean))
    const selectedClasses = ref([]) // Keep for backward compatibility
    const selectedEnergyClasses = ref([])
    const selectedGESClasses = ref([])
    const optionalFiltersOpen = ref(false)
    const activeOptionalFilters = computed(() => {
      const filters = []
      const hasValue = value => value != null && String(value).trim() !== ''
      const criteria = searchCriteria.value
      if (hasValue(criteria.surface)) filters.push(`Surface : ${criteria.surface} m²`)
      if (criteria.typeBien) filters.push(criteria.typeBien === 'maison' ? 'Maison' : 'Appartement')
      if (selectedEnergyClasses.value.length) {
        filters.push(`Énergie : ${selectedEnergyClasses.value.join(', ')}`)
      } else if (hasValue(criteria.consommation)) {
        filters.push(`Consommation : ${criteria.consommation} kWh/m²/an`)
      }
      if (selectedGESClasses.value.length) {
        filters.push(`GES : ${selectedGESClasses.value.join(', ')}`)
      } else if (hasValue(criteria.ges)) {
        filters.push(`GES : ${criteria.ges} kgCO₂/m²/an`)
      }
      return filters
    })
    watch(activeOptionalFilters, filters => {
      // Reveal restored/edited criteria without closing controls while the user clears them.
      if (filters.length) optionalFiltersOpen.value = true
    })

    const toggleClasse = classe => {
      const index = selectedClasses.value.indexOf(classe)
      if (index > -1) {
        selectedClasses.value.splice(index, 1)
      } else {
        selectedClasses.value.push(classe)
      }
    }

    const toggleEnergyClasse = classe => {
      const index = selectedEnergyClasses.value.indexOf(classe)
      if (index > -1) {
        selectedEnergyClasses.value.splice(index, 1)
      } else {
        selectedEnergyClasses.value.push(classe)
      }
      // Effacer la valeur de consommation lors de la sélection de classes
      if (selectedEnergyClasses.value.length > 0) {
        searchCriteria.value.consommation = null
      }
    }

    const toggleGESClasse = classe => {
      const index = selectedGESClasses.value.indexOf(classe)
      if (index > -1) {
        selectedGESClasses.value.splice(index, 1)
      } else {
        selectedGESClasses.value.push(classe)
      }
      // Effacer la valeur GES lors de la sélection de classes
      if (selectedGESClasses.value.length > 0) {
        searchCriteria.value.ges = null
      }
    }

    const getClasseColor = classe => {
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
    }

    const getGESClassColor = classe => {
      // Use same colors as energy classes
      return getClasseColor(classe)
    }

    const cancelSearch = () => {
      requestId++
      loading.value = false
    }
    onBeforeUnmount(cancelSearch)

    const searchRecentDPE = async () => {
      if (loading.value || hasNumericErrors.value) return
      const currentRequest = ++requestId
      const submittedCriteria = {
        ...searchCriteria.value,
        surface: parseNumericSearchInput(searchCriteria.value.surface).value,
        consommation: parseNumericSearchInput(searchCriteria.value.consommation).value,
        ges: parseNumericSearchInput(searchCriteria.value.ges).value,
        energyClasses: [...selectedEnergyClasses.value],
        gesClasses: [...selectedGESClasses.value]
      }
      loading.value = true
      errorMessage.value = null

      try {
        // D'abord géocoder l'adresse pour obtenir les coordonnées
        const geoData = await geocodeAddress(submittedCriteria.address)
        if (currentRequest !== requestId) return
        if (
          !Number.isFinite(geoData?.lat) ||
          !Number.isFinite(geoData?.lon) ||
          Math.abs(geoData.lat) > 90 ||
          Math.abs(geoData.lon) > 180
        ) {
          errorMessage.value = 'Adresse introuvable. Vérifiez la rue, la ville ou le code postal, puis réessayez.'
          emit('search-error', new Error(errorMessage.value))
          return
        }

        // Émettre un événement pour démarrer l'animation avec les coordonnées
        emit('search-started', {
          ...submittedCriteria,
          coordinates: { lat: geoData.lat, lon: geoData.lon }
        })

        // Maintenant récupérer les vrais résultats DPE
        const results = await recentDPEService.searchRecentDPE(submittedCriteria)
        if (currentRequest !== requestId) return

        // Ajouter le code postal du géocodage s'il est disponible
        if (results?.searchMetadata?.postalCode) {
          results.postalCode = results.searchMetadata.postalCode
        }

        // Passer à la fois les critères de recherche et les résultats
        emit('search-results', submittedCriteria, results)

        // Sauvegarder la recherche dans l'historique si des résultats ont été trouvés
        if (results && results.totalFound > 0) {
          saveToHistory(submittedCriteria, results.totalFound)
        }
      } catch (error) {
        if (currentRequest !== requestId) return
        // Store error message for display
        errorMessage.value = 'La recherche n’a pas pu aboutir. Veuillez réessayer dans quelques instants.'
        emit('search-error', error)
      } finally {
        if (currentRequest === requestId) loading.value = false
      }
    }

    const saveToHistory = (criteria, resultCount) => {
      const searchData = {
        address: criteria.address,
        coordinates: criteria.coordinates,
        monthsBack: criteria.monthsBack,
        radius: criteria.radius,
        surface: criteria.surface,
        consommation: criteria.consommation,
        ges: criteria.ges,
        typeBien: criteria.typeBien || null,
        energyClasses: criteria.energyClasses || [],
        gesClasses: criteria.gesClasses || []
      }

      const results = { results: { length: resultCount } }
      recherchesStore.saveRecentDPESearch(searchData, results)
    }

    const relaunchSearch = savedSearch => {
      // Remplir le formulaire avec les valeurs sauvegardées
      searchCriteria.value.address = savedSearch.address
      searchCriteria.value.monthsBack = savedSearch.monthsBack
      searchCriteria.value.radius = savedSearch.radius
      searchCriteria.value.surface = savedSearch.surface
      searchCriteria.value.consommation = savedSearch.consommation ?? null
      searchCriteria.value.ges = savedSearch.ges ?? null
      searchCriteria.value.typeBien = savedSearch.typeBien || null
      selectedEnergyClasses.value = savedSearch.energyClasses || []
      selectedGESClasses.value = savedSearch.gesClasses || []
      optionalFiltersOpen.value = activeOptionalFilters.value.length > 0

      // Lancer automatiquement la recherche
      return searchRecentDPE()
    }

    const resetLoading = () => {
      loading.value = false
    }

    const selectPropertyType = type => {
      if (searchCriteria.value.typeBien === type) {
        searchCriteria.value.typeBien = null
      } else {
        searchCriteria.value.typeBien = type
      }
    }

    // Do not strip punctuation or units: preserve what was typed/pasted.
    const validateSurfaceInput = event => {
      searchCriteria.value.surface = event.target.value
    }

    const validateConsommationInput = event => {
      searchCriteria.value.consommation = event.target.value
    }

    const validateGESInput = event => {
      searchCriteria.value.ges = event.target.value
    }

    return {
      loading,
      errorMessage,
      numericErrors,
      hasNumericErrors,
      optionalFiltersOpen,
      activeOptionalFilters,
      searchCriteria,
      selectedClasses,
      selectedEnergyClasses,
      selectedGESClasses,
      toggleClasse,
      toggleEnergyClasse,
      toggleGESClasse,
      getClasseColor,
      getGESClassColor,
      searchRecentDPE,
      relaunchSearch,
      resetLoading,
      cancelSearch,
      selectPropertyType,
      validateSurfaceInput,
      validateConsommationInput,
      validateGESInput
    }
  }
}
</script>

<style>
.nearby-filter-disclosure {
  border-top: 1px solid #e5e7eb;
}

.dark .nearby-filter-disclosure {
  border-color: #374151;
}

.nearby-filter-summary {
  min-height: 44px;
  padding: 12px 4px;
  cursor: pointer;
}

.nearby-filter-description {
  display: block;
  margin-top: 4px;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
  color: #4b5563;
}

.dark .nearby-filter-description {
  color: #d1d5db;
}

.nearby-filter-fields {
  padding-top: 12px;
}

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

/* Only apply dark styles when the website itself is in dark mode */
.dark select {
  color-scheme: dark;
}

.dark select option {
  background-color: rgb(31 41 55); /* gray-800 */
  color: rgb(229 231 235); /* gray-200 */
}
</style>
