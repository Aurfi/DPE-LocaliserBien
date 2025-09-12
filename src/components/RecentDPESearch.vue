<template>
  <div class="max-w-4xl mx-auto">
    <!-- Formulaire de recherche -->
    <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 transition-all duration-500 border border-white/50 dark:border-gray-700/50">
      <div class="text-center mb-6">
        <p class="text-lg text-gray-800 dark:text-gray-200 font-medium">Rechercher les DPE les plus récents autour d'une adresse</p>
      </div>
      
      <form @submit.prevent="searchRecentDPE" class="space-y-6">
        <!-- Adresse -->
        <div>
          <label class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
            <MapPin class="w-4 h-4 inline mr-1" />
            Adresse de recherche
          </label>
          <input
            v-model="searchCriteria.address"
            type="text"
            placeholder="Ex: 15 rue de la Paix, 75002 Paris"
            class="w-full px-4 py-3 text-base bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-400 dark:placeholder-gray-300 text-gray-800 dark:text-gray-100"
            required
          />
        </div>

        <!-- Options en ligne -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Période -->
          <div>
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              <Calendar class="w-4 h-4 inline mr-1" />
              DPE des derniers
            </label>
            <select
              v-model="searchCriteria.monthsBack"
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
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              <Circle class="w-4 h-4 inline mr-1" />
              Rayon de recherche
            </label>
            <select
              v-model="searchCriteria.radius"
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

          <!-- Surface (optionnel) -->
          <div>
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              <Home class="w-4 h-4 inline mr-1" />
              Surface (optionnel)
            </label>
            <div class="relative">
              <input
                v-model="searchCriteria.surface"
                type="text"
                placeholder="Ex: 100"
                @input="validateSurfaceInput"
                class="w-full px-4 py-3 pr-12 text-base bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all text-gray-800 dark:text-gray-100 no-spinners"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                m²
              </span>
            </div>
            <!-- Property type selector -->
            <div class="mt-1">
              <div class="flex gap-1">
                <button
                  type="button"
                  @click="selectPropertyType('maison')"
                  :class="[
                    'w-6 h-6 text-xs rounded font-semibold transition-all flex items-center justify-center',
                    searchCriteria.typeBien === 'maison'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  ]"
                  title="Maison"
                >
                  <Home class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  @click="selectPropertyType('appartement')"
                  :class="[
                    'w-6 h-6 text-xs rounded font-semibold transition-all flex items-center justify-center',
                    searchCriteria.typeBien === 'appartement'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  ]"
                  title="Appartement"
                >
                  <Building class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Consommation et GES (optionnel) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Consommation énergétique -->
          <div>
            <label class="block text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">
              Consommation (optionnel)
            </label>
            <div class="relative">
              <input
                v-model="searchCriteria.consommation"
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
            <div class="mt-1">
              <div class="flex gap-1">
                <button
                  v-for="classe in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                  :key="'energy-' + classe"
                  type="button"
                  @click="toggleEnergyClasse(classe)"
                  :class="[
                    'w-6 h-6 text-xs rounded font-semibold transition-all flex items-center justify-center',
                    selectedEnergyClasses.includes(classe) || (!selectedEnergyClasses.length && getEnergyClassFromValue(searchCriteria.consommation) === classe)
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
            <label class="block text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">
              GES (optionnel)
            </label>
            <div class="relative">
              <input
                v-model="searchCriteria.ges"
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
            <div class="mt-1">
              <div class="flex gap-1">
                <button
                  v-for="classe in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                  :key="'ges-' + classe"
                  type="button"
                  @click="toggleGESClasse(classe)"
                  :class="[
                    'w-6 h-6 text-xs rounded font-semibold transition-all flex items-center justify-center',
                    selectedGESClasses.includes(classe) || (!selectedGESClasses.length && getGESClassFromValue(searchCriteria.ges) === classe)
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

        <!-- Bouton de recherche -->
        <button
          type="submit"
          :disabled="loading || !searchCriteria.address"
          class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 px-8 rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
        >
          <Search v-if="!loading" class="w-5 h-5 mr-2" />
          <Loader v-else class="w-5 h-5 mr-2 animate-spin" />
          {{ loading ? 'Recherche en cours...' : 'Rechercher' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { Building, Calendar, Circle, Home, Loader, MapPin, Search, Zap } from 'lucide-vue-next'
import { ref } from 'vue'
import * as recentDPEService from '../services/recent-dpe.service'
import { geocodeAddress } from '../services/recent-dpe.service'

export default {
  name: 'RecentDPESearch',
  components: {
    MapPin,
    Calendar,
    Circle,
    Home,
    Building,
    Zap,
    Search,
    Loader
  },
  emits: ['search-results', 'search-started', 'search-error'],
  setup(_props, { emit }) {
    const loading = ref(false)
    const searchCriteria = ref({
      address: '',
      monthsBack: 1,
      radius: 0.5,
      surface: null,
      typeBien: null,
      consommation: null,
      ges: null
    })
    const selectedClasses = ref([]) // Keep for backward compatibility
    const selectedEnergyClasses = ref([])
    const selectedGESClasses = ref([])

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
        B: 'bg-green-400 text-white',
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

    // Calculer la classe énergétique à partir de la valeur de consommation
    const getEnergyClassFromValue = value => {
      if (!value) return null
      // Supprimer les opérateurs si présents
      const numValue = parseInt(value.toString().replace(/[<>]/g, ''), 10)
      if (Number.isNaN(numValue)) return null

      if (numValue <= 50) return 'A'
      if (numValue <= 90) return 'B'
      if (numValue <= 150) return 'C'
      if (numValue <= 230) return 'D'
      if (numValue <= 330) return 'E'
      if (numValue <= 450) return 'F'
      return 'G'
    }

    // Calculer la classe GES à partir de la valeur d'émission
    const getGESClassFromValue = value => {
      if (!value) return null
      // Supprimer les opérateurs si présents
      const numValue = parseInt(value.toString().replace(/[<>]/g, ''), 10)
      if (Number.isNaN(numValue)) return null

      if (numValue <= 5) return 'A'
      if (numValue <= 10) return 'B'
      if (numValue <= 25) return 'C'
      if (numValue <= 45) return 'D'
      if (numValue <= 70) return 'E'
      if (numValue <= 100) return 'F'
      return 'G'
    }

    const searchRecentDPE = async () => {
      loading.value = true

      try {
        // D'abord géocoder l'adresse pour obtenir les coordonnées
        const geoData = await geocodeAddress(searchCriteria.value.address)

        // Émettre un événement pour démarrer l'animation avec les coordonnées
        emit('search-started', {
          ...searchCriteria.value,
          coordinates: { lat: geoData.lat, lon: geoData.lon }
        })

        // Maintenant récupérer les vrais résultats DPE
        const results = await recentDPEService.searchRecentDPE({
          ...searchCriteria.value,
          energyClasses: selectedEnergyClasses.value,
          gesClasses: selectedGESClasses.value
        })

        // Ajouter le code postal du géocodage s'il est disponible
        if (results?.searchMetadata?.postalCode) {
          results.postalCode = results.searchMetadata.postalCode
        }

        // Passer à la fois les critères de recherche et les résultats
        emit('search-results', searchCriteria.value, results)

        // Sauvegarder la recherche dans l'historique si des résultats ont été trouvés
        if (results && results.totalFound > 0) {
          saveToHistory(
            {
              ...searchCriteria.value,
              energyClasses: selectedClasses.value
            },
            results.totalFound
          )
        }
      } catch (error) {
        // Erreur lors de la recherche - gérée silencieusement
        emit('search-error', error)
      } finally {
        loading.value = false
      }
    }

    const saveToHistory = (criteria, resultCount) => {
      try {
        const stored = localStorage.getItem('recent_dpe_searches')
        let searches = stored ? JSON.parse(stored) : []

        const newSearch = {
          address: criteria.address,
          monthsBack: criteria.monthsBack,
          radius: criteria.radius,
          surface: criteria.surface,
          energyClasses: criteria.energyClasses || [],
          gesClasses: criteria.gesClasses || [],
          resultCount: resultCount,
          timestamp: Date.now()
        }

        // Vérifier si une recherche identique existe déjà
        const existingIndex = searches.findIndex(
          s =>
            s.address === newSearch.address &&
            s.monthsBack === newSearch.monthsBack &&
            s.radius === newSearch.radius &&
            s.surface === newSearch.surface &&
            JSON.stringify(s.energyClasses) === JSON.stringify(newSearch.energyClasses) &&
            JSON.stringify(s.gesClasses || []) === JSON.stringify(newSearch.gesClasses)
        )

        if (existingIndex !== -1) {
          // Mettre à jour la recherche existante
          searches[existingIndex] = newSearch
        } else {
          // Ajouter en début de liste
          searches.unshift(newSearch)
        }

        // Limiter à 10 recherches récentes
        searches = searches.slice(0, 10)

        // Sauvegarder
        localStorage.setItem('recent_dpe_searches', JSON.stringify(searches))

        // Déclencher un événement pour mettre à jour le composant d'historique
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'recent_dpe_searches',
            newValue: JSON.stringify(searches)
          })
        )
      } catch (_error) {
        // Erreur lors de la sauvegarde de la recherche - gérée silencieusement
      }
    }

    const relaunchSearch = savedSearch => {
      // Remplir le formulaire avec les valeurs sauvegardées
      searchCriteria.value.address = savedSearch.address
      searchCriteria.value.monthsBack = savedSearch.monthsBack
      searchCriteria.value.radius = savedSearch.radius
      searchCriteria.value.surface = savedSearch.surface
      selectedEnergyClasses.value = savedSearch.energyClasses || []
      selectedGESClasses.value = savedSearch.gesClasses || []

      // Lancer automatiquement la recherche
      searchRecentDPE()
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

    const validateSurfaceInput = event => {
      const value = event.target.value
      // Autoriser les nombres et les opérateurs < >
      const cleaned = value.replace(/[^0-9<>]/g, '')
      searchCriteria.value.surface = cleaned
      event.target.value = cleaned
    }

    const validateConsommationInput = event => {
      const value = event.target.value
      // Autoriser les nombres et les opérateurs < >
      const cleaned = value.replace(/[^0-9<>]/g, '')
      searchCriteria.value.consommation = cleaned
      event.target.value = cleaned
    }

    const validateGESInput = event => {
      const value = event.target.value
      // Autoriser les nombres et les opérateurs < >
      const cleaned = value.replace(/[^0-9<>]/g, '')
      searchCriteria.value.ges = cleaned
      event.target.value = cleaned
    }

    return {
      loading,
      searchCriteria,
      selectedClasses,
      selectedEnergyClasses,
      selectedGESClasses,
      toggleClasse,
      toggleEnergyClasse,
      toggleGESClasse,
      getClasseColor,
      getGESClassColor,
      getEnergyClassFromValue,
      getGESClassFromValue,
      searchRecentDPE,
      relaunchSearch,
      resetLoading,
      selectPropertyType,
      validateSurfaceInput,
      validateConsommationInput,
      validateGESInput
    }
  }
}
</script>

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

/* Only apply dark styles when the website itself is in dark mode */
.dark select {
  color-scheme: dark;
}

.dark select option {
  background-color: rgb(31 41 55); /* gray-800 */
  color: rgb(229 231 235); /* gray-200 */
}
</style>