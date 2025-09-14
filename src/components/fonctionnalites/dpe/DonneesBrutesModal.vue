<template>
  <div
    v-if="show && dpeData"
    class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10000] p-4 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-700">
      <!-- En-tête -->
      <div class="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 border-b border-gray-200 dark:border-gray-600 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
              Données brutes DPE
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ dpeData.numero_dpe || dpeData.numeroDPE || 'N/A' }}
              <span v-if="isLegacyDPE" class="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                DPE pré-2021
              </span>
            </p>
          </div>
          <button
            @click="$emit('close')"
            class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-white dark:bg-gray-700 rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Barre de recherche -->
      <div class="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Filtrer les champs..."
            class="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          >
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
            {{ filteredFieldCount }}/{{ totalFieldCount }} champs
          </span>
        </div>
      </div>

      <!-- Contenu scrollable -->
      <div class="overflow-y-auto" style="max-height: calc(90vh - 140px);">
        <div class="p-6">
          <!-- Champs importants toujours visibles -->
          <div v-if="!searchQuery && importantFields.length > 0" class="mb-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              Informations principales
            </h4>
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div v-for="field in importantFields" :key="field.key" class="flex justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ field.label }}</span>
                <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ field.value }}</span>
              </div>
            </div>
          </div>

          <!-- Tous les champs groupés -->
          <div v-for="group in groupedFields" :key="group.name" class="mb-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              {{ group.name }}
              <span class="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">({{ group.fields.length }})</span>
            </h4>
            <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
              <div
                v-for="field in group.fields"
                :key="field.key"
                class="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
              >
                <span class="text-sm text-gray-600 dark:text-gray-400 font-mono">{{ field.key }}</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">{{ formatValue(field.value) }}</span>
              </div>
            </div>
          </div>

          <!-- Message si aucun résultat -->
          <div v-if="filteredFieldCount === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            Aucun champ ne correspond à votre recherche
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Search, X } from 'lucide-vue-next'

export default {
  name: 'DonneesBrutesModal',
  components: {
    Search,
    X
  },
  props: {
    show: {
      type: Boolean,
      required: true
    },
    dpeData: {
      type: Object,
      default: null
    }
  },
  emits: ['close'],
  data() {
    return {
      searchQuery: ''
    }
  },
  computed: {
    isLegacyDPE() {
      if (!this.dpeData) return false
      return this.dpeData.isLegacyData || this.dpeData.fromLegacy || false
    },

    // Champs importants à toujours afficher en haut
    importantFields() {
      const fields = []
      const data = this.getAllData()

      // DPE et GES
      const dpeClass = data.etiquette_dpe || data.classeDPE || data.classe_consommation_energie
      const gesClass = data.etiquette_ges || data.classeGES || data.classe_estimation_ges
      const conso = data.conso_5_usages_par_m2_ep || data.consommationEnergie || data.consommation_energie
      const ges = data.emission_ges_5_usages_par_m2 || data.emissionGES || data.estimation_ges

      if (dpeClass) fields.push({ key: 'classe_dpe', label: 'Classe DPE', value: dpeClass })
      if (conso) fields.push({ key: 'consommation', label: 'Consommation', value: `${Math.round(conso)} kWh/m²/an` })
      if (gesClass) fields.push({ key: 'classe_ges', label: 'Classe GES', value: gesClass })
      if (ges) fields.push({ key: 'emissions', label: 'Émissions GES', value: `${Math.round(ges)} kg CO₂/m²/an` })

      return fields
    },

    // Grouper les champs par préfixe ou catégorie
    groupedFields() {
      const groups = {
        Identification: [],
        Localisation: [],
        Consommations: [],
        Isolation: [],
        Équipements: [],
        Surfaces: [],
        Autres: []
      }

      const allData = this.getAllData()

      Object.entries(allData).forEach(([key, value]) => {
        // Ignorer les valeurs nulles/vides
        if (value === null || value === undefined || value === '') return

        // Appliquer le filtre de recherche
        if (this.searchQuery) {
          const query = this.searchQuery.toLowerCase()
          if (!key.toLowerCase().includes(query) && !String(value).toLowerCase().includes(query)) {
            return
          }
        }

        const field = { key, value }

        // Classifier par préfixe ou mots-clés
        if (key.includes('numero_dpe') || key.includes('date_') || key.includes('diagnostiqueur')) {
          groups.Identification.push(field)
        } else if (
          key.includes('adresse') ||
          key.includes('commune') ||
          key.includes('code_postal') ||
          key.includes('latitude') ||
          key.includes('longitude') ||
          key.includes('_geopoint')
        ) {
          groups.Localisation.push(field)
        } else if (key.includes('conso_') || key.includes('consommation') || key.includes('emission_ges')) {
          groups.Consommations.push(field)
        } else if (key.includes('isolation') || key.includes('vitrage') || key.includes('menuiserie')) {
          groups.Isolation.push(field)
        } else if (
          key.includes('chauffage') ||
          key.includes('ecs') ||
          key.includes('ventilation') ||
          key.includes('energie')
        ) {
          groups.Équipements.push(field)
        } else if (key.includes('surface') || key.includes('hauteur') || key.includes('niveau')) {
          groups.Surfaces.push(field)
        } else {
          groups.Autres.push(field)
        }
      })

      // Retourner seulement les groupes non vides, triés
      return Object.entries(groups)
        .filter(([_, fields]) => fields.length > 0)
        .map(([name, fields]) => ({
          name,
          fields: fields.sort((a, b) => a.key.localeCompare(b.key))
        }))
    },

    totalFieldCount() {
      const allData = this.getAllData()
      return Object.entries(allData).filter(([_, v]) => v != null && v !== '').length
    },

    filteredFieldCount() {
      return this.groupedFields.reduce((sum, group) => sum + group.fields.length, 0)
    }
  },
  methods: {
    getAllData() {
      if (!this.dpeData) return {}

      // Fusionner les données brutes et les données mappées
      const rawData = this.dpeData.rawData || {}
      const mappedData = { ...this.dpeData }
      delete mappedData.rawData // Éviter la duplication

      return { ...rawData, ...mappedData }
    },

    formatValue(value) {
      if (value === null || value === undefined) return 'N/A'
      if (value === true) return 'Oui'
      if (value === false) return 'Non'
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    }
  }
}
</script>