<template>
  <div v-if="show && property" ref="modalLayer" data-modal-layer="dpe" :style="{ zIndex: 10000 + modalDepth }" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4  overflow-y-auto" @click.self="$emit('close')">
    <div ref="modalDialog" role="dialog" tabindex="-1" :aria-modal="modalIsTop ? 'true' : undefined" :aria-labelledby="modalTitleId" class="bg-white dark:bg-gray-800 rounded-xl  max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-700 my-auto">
      <!-- En-tête -->
      <div class="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
        <div class="flex items-center justify-between">
          <h3 :id="modalTitleId" tabindex="-1" data-modal-initial-focus class="text-xl font-bold text-gray-900 dark:text-gray-100">
            Détails du diagnostic · {{ property.numeroDPE || property.numero_dpe || property.id }}
            <span v-if="isLegacyDPE" class="ml-2 text-xs font-normal text-gray-600 dark:text-gray-400">DPE ancien · avant juillet 2021</span>
          </h3>
          <button
            @click="$emit('close')"
            aria-label="Fermer"
            class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-white dark:bg-gray-700 rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <!-- Contenu scrollable -->
      <div class="overflow-y-auto" style="max-height: calc(90vh - 80px);">
        <div class="p-6 space-y-6">
          <!-- Only compare complete, arithmetically compatible source usages. -->
          <section v-if="consumptionBreakdown.hasUsageData" class="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Consommations par usage</h4>
            <template v-if="consumptionBreakdown.comparable">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Valeurs ADEME en énergie primaire, en kWh/an.</p>
              <dl class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div v-for="usage in consumptionBreakdown.entries" :key="usage.key" data-consumption-usage>
                  <dt class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ usage.label }}</dt>
                  <dd class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ usage.value }} kWh/an</dd>
                </div>
              </dl>
            </template>
            <p v-else data-consumption-unavailable class="text-sm text-gray-600 dark:text-gray-400">
              Le détail par usage est incomplet ou ne correspond pas au total transmis. Consultez les valeurs d’origine dans les données brutes.
            </p>
          </section>

          <!-- Section 2: Systèmes -->
          <div v-if="hasSystems" class="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              Systèmes et équipements
            </h4>
            <div class="space-y-3">
              <div v-if="property.systemeChauffage" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Système de chauffage</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.systemeChauffage }}</p>
              </div>
              <div v-if="property.systemeECS" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Système d'eau chaude sanitaire</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.systemeECS }}</p>
              </div>
              <div class="grid md:grid-cols-2 gap-3">
                <div v-if="property.typeVentilation || property.type_ventilation" class="py-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Ventilation</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getVentilationLabel(property.typeVentilation || property.type_ventilation) }}</p>
                </div>
                <div v-if="property.installationSolaire" class="py-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Installation solaire</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.installationSolaire }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Qualité de l'isolation -->
          <div v-if="hasInsulation" class="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              Qualité de l'isolation
            </h4>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div v-if="property.isolationEnveloppe" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Enveloppe</p>
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationEnveloppe).color">{{ getInsulationRating(property.isolationEnveloppe).level }}/{{ getInsulationRating(property.isolationEnveloppe).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationEnveloppe).label }}</p>
                </div>
              </div>
              <div v-if="property.isolationMurs" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Murs</p>
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationMurs).color">{{ getInsulationRating(property.isolationMurs).level }}/{{ getInsulationRating(property.isolationMurs).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationMurs).label }}</p>
                </div>
              </div>
              <div v-if="property.isolationMenuiseries" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Menuiseries</p>
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationMenuiseries).color">{{ getInsulationRating(property.isolationMenuiseries).level }}/{{ getInsulationRating(property.isolationMenuiseries).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationMenuiseries).label }}</p>
                </div>
              </div>
              <div v-if="property.isolationPlancherBas" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Plancher bas</p>
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationPlancherBas).color">{{ getInsulationRating(property.isolationPlancherBas).level }}/{{ getInsulationRating(property.isolationPlancherBas).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationPlancherBas).label }}</p>
                </div>
              </div>
              <div v-if="property.isolationToiture" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Toiture / Combles</p>
                <div v-if="property.isolationToiture === 'Oui' || property.isolationToiture === 'Non'">
                  <p class="text-sm font-medium" :class="property.isolationToiture === 'Oui' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">{{ property.isolationToiture }}</p>
                </div>
                <div v-else class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationToiture).color">{{ getInsulationRating(property.isolationToiture).level }}/{{ getInsulationRating(property.isolationToiture).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationToiture).label }}</p>
                </div>
              </div>
              <!-- Alternative isolation fields for Recent DPE -->
              <div v-if="property.type_vitrage" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Type de vitrage</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.type_vitrage }}</p>
              </div>
              <div v-if="property.type_materiaux_menuiseries" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Matériaux menuiseries</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.type_materiaux_menuiseries }}</p>
              </div>
            </div>
          </div>

          <!-- Section 4: Caractéristiques du bien -->
          <div class="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              Caractéristiques du bien
            </h4>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Surface habitable</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getSurface() === null ? 'Non renseignée' : `${getSurface()} m²` }}</p>
              </div>
              <div v-if="property.typeBien" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Type de bien</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.typeBien === 'appartement' ? 'Appartement' : property.typeBien === 'maison' ? 'Maison' : property.typeBien }}</p>
              </div>
              <div v-if="property.anneeConstruction" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Année de construction</p>
                <p data-construction-year class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formatYearDisplay(property.anneeConstruction) }}</p>
              </div>
              <div v-if="getFloorDisplay()" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Localisation</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getFloorDisplay() }}</p>
              </div>
              <div v-if="property.hauteurSousPlafond" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Hauteur sous plafond</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.hauteurSousPlafond }} m</p>
              </div>
              <div v-if="property.nombreNiveaux" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Nombre de niveaux</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.nombreNiveaux }}</p>
              </div>
              <div v-if="property.logementTraversant" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Logement traversant</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.logementTraversant }}</p>
              </div>
              <div v-if="property.ubat" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Coefficient Ubat</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.ubat.toFixed(2) }} W/m²K</p>
              </div>
              <div v-if="property.classeInertie" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Inertie thermique</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.classeInertie }}</p>
              </div>
            </div>
          </div>

          <!-- Section 5: Informations DPE -->
          <div class="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              Informations du diagnostic
            </h4>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div v-if="property.numeroDPE || property.numero_dpe" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Numéro DPE</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.numeroDPE || property.numero_dpe }}</p>
              </div>
              <div v-if="formatDate(property.dateVisite || property.date_visite_diagnostiqueur)" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Date du diagnostic</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formatDate(property.dateVisite || property.date_visite_diagnostiqueur) }}</p>
              </div>
              <div v-if="property.classeDPE || property.classe_consommation_energie" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Classe énergétique</p>
                <span :class="getDPEBadgeClass(property.classeDPE || property.classe_consommation_energie)" class="px-3 py-1 rounded text-sm font-bold">
                  Classe {{ property.classeDPE || property.classe_consommation_energie }}
                </span>
              </div>
              <div v-if="getConsommation()" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Consommation totale</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getConsommation() }} kWh/m²/an</p>
              </div>
              <div v-if="getGES()" class="py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Émissions GES</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getGES() }} kg CO₂/m²/an</p>
              </div>
            </div>
          </div>

          <!-- Bouton données brutes -->
          <div class="text-center pt-4">
            <button 
              @click="showRawData = true"
              class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
            >
              <Database class="w-4 h-4" />
              Voir les données brutes
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Modal données brutes -->
    <DonneesBrutesModal
      :show="showRawData"
      :dpeData="property"
      @close="showRawData = false"
    />
  </div>
</template>

<script>
import { Database, X } from 'lucide-vue-next'
import { useModalLayer } from '../../../composables/useModalLayer.js'
import { finiteNonNegativeNumber, getConsumptionBreakdown } from '../../../utils/dpeConsumptionDetails.js'
import { formatDate, formatYearDisplay } from '../../../utils/formateursDPE.js'
import DonneesBrutesModal from './DonneesBrutesModal.vue'

export default {
  name: 'DPEDetailsModal',
  setup(_props, { emit }) {
    return useModalLayer(() => emit('close'))
  },
  components: {
    Database,
    DonneesBrutesModal,
    X
  },
  data() {
    return {
      showRawData: false
    }
  },
  props: {
    show: {
      type: Boolean,
      required: true
    },
    property: {
      type: Object,
      default: () => ({})
    },
    departmentAverages: {
      type: Object,
      default: null
    }
  },
  emits: ['close'],
  computed: {
    consumptionBreakdown() {
      return getConsumptionBreakdown(this.property)
    },
    isLegacyDPE() {
      return Boolean(this.property?.isLegacyData || this.property?.fromLegacy)
    },
    hasSystems() {
      return ['systemeChauffage', 'systemeECS', 'typeVentilation', 'type_ventilation', 'installationSolaire'].some(
        key => this.property?.[key]
      )
    },
    hasInsulation() {
      return [
        'isolationEnveloppe',
        'isolationMurs',
        'isolationMenuiseries',
        'isolationPlancherBas',
        'isolationToiture',
        'type_vitrage',
        'type_materiaux_menuiseries'
      ].some(key => this.property?.[key])
    }
  },
  watch: {
    show(value) {
      if (!value) this.showRawData = false
    },
    property: {
      immediate: true,
      handler(newVal) {
        this.showRawData = false
        if (newVal && Object.keys(newVal).length > 0) {
          // Données de propriété disponibles
        }
      }
    }
  },
  methods: {
    formatYearDisplay,
    getConsommation() {
      return this.getMetric('conso_5_usages_par_m2_ep', 'consommationEnergie', 'consommation_energie')
    },

    getGES() {
      return this.getMetric('emission_ges_5_usages_par_m2', 'emissionGES', 'ges', 'estimation_ges')
    },

    getMetric(...keys) {
      const source = this.property?.rawData ?? this.property
      for (const key of keys) {
        const value = finiteNonNegativeNumber(source?.[key])
        if (value !== null) return value
      }
      return null
    },

    getSurface() {
      return this.getMetric(
        'surface_habitable_logement',
        'surfaceHabitable',
        'surface_habitable',
        'surface_thermique_lot'
      )
    },

    formatDate,

    getVentilationLabel(value) {
      const labels = {
        VMC_SF: 'VMC Simple flux',
        VMC_DF: 'VMC Double flux',
        NATURELLE: 'Ventilation naturelle',
        HYBRIDE: 'Ventilation hybride'
      }
      return labels[value] || value
    },

    getInsulationRating(value) {
      if (!value) return { level: 0, max: 5, label: 'Non renseigné', color: 'text-gray-500' }

      // Gérer les valeurs textuelles comme "bonne", "insuffisante", etc.
      const lowerValue = value.toLowerCase()
      const textRatings = {
        'très bonne': { level: 5, max: 5, label: 'Très bonne', color: 'text-green-600 dark:text-green-400' },
        bonne: { level: 4, max: 5, label: 'Bonne', color: 'text-blue-600 dark:text-blue-400' },
        moyenne: { level: 3, max: 5, label: 'Moyenne', color: 'text-yellow-600 dark:text-yellow-400' },
        faible: { level: 2, max: 5, label: 'Faible', color: 'text-orange-600 dark:text-orange-400' },
        insuffisante: { level: 1, max: 5, label: 'Insuffisante', color: 'text-red-600 dark:text-red-400' },
        'très insuffisante': { level: 0, max: 5, label: 'Très insuffisante', color: 'text-red-700 dark:text-red-500' }
      }

      if (textRatings[lowerValue]) {
        return textRatings[lowerValue]
      }

      // Gérer le format numérique comme "3/5"
      if (value.includes('/')) {
        const [level, max] = value.split('/').map(n => parseInt(n, 10))
        const ratio = level / max
        let label, color

        if (ratio >= 0.8) {
          label = 'Très bonne'
          color = 'text-green-600 dark:text-green-400'
        } else if (ratio >= 0.6) {
          label = 'Bonne'
          color = 'text-blue-600 dark:text-blue-400'
        } else if (ratio >= 0.4) {
          label = 'Moyenne'
          color = 'text-yellow-600 dark:text-yellow-400'
        } else if (ratio >= 0.2) {
          label = 'Faible'
          color = 'text-orange-600 dark:text-orange-400'
        } else {
          label = 'Insuffisante'
          color = 'text-red-600 dark:text-red-400'
        }

        return { level, max, label, color }
      }

      return { level: '-', max: 5, label: value, color: 'text-gray-600 dark:text-gray-400' }
    },

    getFloorDisplay() {
      // D'abord vérifier si complementRefLogement contient des informations d'étage réelles
      if (this.property.complementRefLogement) {
        return this.property.complementRefLogement
      }
      // Afficher uniquement l'étage s'il est supérieur à 0 (0 est souvent juste une valeur par défaut/vide)
      if (this.property.etage && this.property.etage > 0) {
        const floor = parseInt(this.property.etage, 10)
        if (floor === 1) return '1er étage'
        return `${floor}ème étage`
      }
      return null
    },

    getDPEBadgeClass(classe) {
      const classes = {
        A: 'bg-green-500 text-white',
        B: 'bg-green-600 text-white',
        C: 'bg-yellow-400 text-gray-800',
        D: 'bg-orange-400 text-white',
        E: 'bg-orange-500 text-white',
        F: 'bg-red-500 text-white',
        G: 'bg-red-600 text-white'
      }
      return classes[classe?.toUpperCase()] || 'bg-gray-400 text-white'
    }
  }
}
</script>
