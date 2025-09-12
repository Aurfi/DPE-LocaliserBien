<template>
  <div class="max-w-4xl mx-auto">
    <!-- Formulaire de recherche DPE -->
    <div class="bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 mb-8 transition-all duration-500 border border-gray-100/50 dark:border-gray-700/50">
      <div class="text-center mb-6">
        <p class="text-lg text-gray-800 dark:text-gray-200 font-medium">Localiser un bien immobilier grâce aux données de son DPE</p>
      </div>
      <form @submit.prevent="handleSubmit" class="space-y-6" novalidate>
        <!-- Responsive grid: one field per line on mobile, flex on larger screens -->
        <div class="grid grid-cols-1 md:flex md:flex-wrap items-start gap-4 lg:gap-6">
          <!-- Code postal ou commune (en premier) -->
          <div class="w-full md:flex-1 md:min-w-[180px]">
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              Commune
            </label>
            <input 
              v-model="formData.commune"
              type="text" 
              placeholder="ex : 13080 ou Lyon"
              class="w-full px-4 py-3 text-base bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-500 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100"
            />
          </div>

          <!-- Surface (en deuxième) -->
          <div class="w-full md:flex-1 md:min-w-[120px]">
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              Surface
            </label>
            <input 
              v-model="formData.surface"
              type="text" 
              placeholder="ex : 100m²"
              @input="validateSurfaceInput"
              class="w-full px-4 py-3 text-base bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-500 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100 no-spinners"
            />
            <!-- Property type selector -->
            <div class="mt-1">
              <div class="flex gap-1">
                <button
                  type="button"
                  tabindex="-1"
                  @click="selectPropertyType('maison')"
                  :class="[
                    'w-6 h-6 text-xs rounded font-semibold transition-all flex items-center justify-center',
                    formData.typeBien === 'maison'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  ]"
                  title="Maison"
                >
                  <Home class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  tabindex="-1"
                  @click="selectPropertyType('appartement')"
                  :class="[
                    'w-6 h-6 text-xs rounded font-semibold transition-all flex items-center justify-center',
                    formData.typeBien === 'appartement'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  ]"
                  title="Appartement"
                >
                  <Building2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Consommation énergétique (en troisième) -->
          <div class="w-full md:flex-1 md:min-w-[140px]">
            <label class="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-2">
              Consommation primaire
            </label>
            <input 
              v-model="formData.consommation"
              type="text" 
              :placeholder="selectedEnergyClass ? '' : 'ex : 250 kWh/m²/an'"
              @input="validateConsommationInput"
              :disabled="selectedEnergyClass !== null"
              class="w-full px-4 py-3 text-base bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-500 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100 no-spinners disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <!-- Sélection par classe énergétique -->
            <div class="mt-1">
              <div class="flex gap-1 flex-wrap">
                <button
                  v-for="classe in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                  :key="'energy-' + classe"
                  type="button"
                  tabindex="-1"
                  @click="selectEnergyClass(classe)"
                  :class="[
                    'px-1.5 py-0.5 text-xs rounded font-semibold transition-all',
                    selectedEnergyClass === classe || getEnergyClassFromValue(formData.consommation) === classe
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
          <div class="w-full md:flex-1 md:min-w-[140px]">
            <label class="block text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">
              GES kg CO₂/m²/an <span class="text-xs opacity-60">(optionnel)</span>
            </label>
            <input 
              v-model="formData.ges"
              type="text" 
              :placeholder="selectedGESClass ? '' : 'ex : 58'"
              @input="validateGESInput"
              :disabled="selectedGESClass !== null"
              class="w-full px-4 py-3 text-base bg-gray-50/60 dark:bg-gray-900/30 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all placeholder-gray-500/60 dark:placeholder-gray-300 text-gray-900 dark:text-gray-100 no-spinners disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <!-- Sélection par classe GES -->
            <div class="mt-1">
              <div class="flex gap-1 flex-wrap">
                <button
                  v-for="classe in ['A', 'B', 'C', 'D', 'E', 'F', 'G']"
                  :key="'ges-' + classe"
                  type="button"
                  tabindex="-1"
                  @click="selectGESClass(classe)"
                  :class="[
                    'px-1.5 py-0.5 text-xs rounded font-semibold transition-all',
                    selectedGESClass === classe || getGESClassFromValue(formData.ges) === classe
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
            :disabled="isPartiallyFilled && !isFormValid"
            class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 px-8 rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
          >
            <span v-if="!isLoading" class="flex items-center">
              <Search class="w-5 h-5 mr-2" />
              <span class="text-lg">Localiser</span>
            </span>
            <span v-else class="flex items-center">
              <Loader2 class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
              Recherche en cours...
            </span>
          </button>
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
import { AlertCircle, Building2, Home, Loader2, MapPin, Search } from 'lucide-vue-next'

export default {
  name: 'DPESearchForm',
  components: {
    Search,
    Loader2,
    MapPin,
    AlertCircle,
    Home,
    Building2
  },
  emits: ['search'],
  data() {
    return {
      // États de chargement
      isLoading: false,

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
      selectedGESClass: null
    }
  },
  computed: {
    isFormValid() {
      // Analyser les valeurs numériques pour validation
      const surfaceValue = this.parseNumericValue(this.formData.surface)
      const consommationValue = this.parseNumericValue(this.formData.consommation)

      return (
        (this.formData.consommation || this.selectedEnergyClass) &&
        (!consommationValue ||
          consommationValue >= 10 ||
          this.formData.consommation?.includes('<') ||
          this.formData.consommation?.includes('>')) &&
        this.formData.commune &&
        this.formData.commune.length >= 2 &&
        this.formData.surface &&
        (surfaceValue >= 10 || this.formData.surface?.includes('<') || this.formData.surface?.includes('>'))
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

      // Si aucun champ n'est rempli, utiliser les valeurs d'exemple
      if (!this.isPartiallyFilled) {
        this.formData = {
          commune: '13080',
          surface: 368,
          consommation: 300,
          ges: 58
        }
      }

      // Vérifier si le formulaire est valide (avec les données personnalisées ou d'exemple)
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
        B: 'bg-green-400 text-white',
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
        B: 'bg-green-400 text-white',
        C: 'bg-yellow-400 text-gray-800',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-500 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-purple-600 text-white'
      }
      return colors[classe]
    },

    // Déterminer la classe énergétique à partir de la valeur
    getEnergyClassFromValue(value) {
      if (!value || this.selectedEnergyClass) return null
      if (value <= 50) return 'A'
      if (value <= 90) return 'B'
      if (value <= 150) return 'C'
      if (value <= 230) return 'D'
      if (value <= 330) return 'E'
      if (value <= 450) return 'F'
      return 'G'
    },

    // Déterminer la classe GES à partir de la valeur
    getGESClassFromValue(value) {
      if (!value || this.selectedGESClass) return null
      if (value <= 6) return 'A'
      if (value <= 11) return 'B'
      if (value <= 30) return 'C'
      if (value <= 50) return 'D'
      if (value <= 70) return 'E'
      if (value <= 100) return 'F'
      return 'G'
    },

    // Sélection du type de bien
    selectPropertyType(type) {
      if (this.formData.typeBien === type) {
        this.formData.typeBien = null // Désélectionner si déjà sélectionné
      } else {
        this.formData.typeBien = type
      }
    },

    // Méthodes de validation pour les champs de saisie
    validateSurfaceInput(event) {
      const value = event.target.value
      // Autoriser les nombres et les opérateurs < >
      const cleaned = value.replace(/[^0-9<>]/g, '')
      this.formData.surface = cleaned
      event.target.value = cleaned
    },

    validateConsommationInput(event) {
      const value = event.target.value
      // Autoriser les nombres et les opérateurs < >
      const cleaned = value.replace(/[^0-9<>]/g, '')
      this.formData.consommation = cleaned
      event.target.value = cleaned
    },

    validateGESInput(event) {
      const value = event.target.value
      // Autoriser les nombres et les opérateurs < >
      const cleaned = value.replace(/[^0-9<>]/g, '')
      this.formData.ges = cleaned
      event.target.value = cleaned
    },

    // Analyser les valeurs numériques à partir de chaînes avec des opérateurs
    parseNumericValue(value) {
      if (!value) return null
      // Si c'est déjà un nombre, le retourner
      if (typeof value === 'number') return value
      // Si ça contient < ou >, retourner la chaîne telle quelle pour que le service la gère
      if (typeof value === 'string' && (value.includes('<') || value.includes('>'))) {
        return value // Le service devra gérer les opérateurs
      }
      // Sinon analyser comme un nombre
      const parsed = parseInt(value, 10)
      return Number.isNaN(parsed) ? null : parsed
    }
  }
}
</script>

<style scoped>
.form-group {
  @apply relative;
}

/* Animation pour les champs focus */
.form-group input:focus + .absolute {
  @apply text-green-600;
}

/* Style pour les exemples */
button:hover .text-green-600 {
  @apply text-green-700;
}
</style>