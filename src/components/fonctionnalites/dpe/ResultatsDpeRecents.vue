<template>
  <div v-if="results" class="mt-8 max-w-6xl mx-auto">
    <!-- Header -->
    <EnteteResultats
      :title="`${filteredResults.length} résultat${filteredResults.length > 1 ? 's' : ''} affiché${filteredResults.length > 1 ? 's' : ''}`"
      :hiddenCount="hiddenResults.size"
      :subtitle="searchContext"
      :showCloseButton="true"
      :showSort="filteredResults.length > 3"
      v-model:sortBy="sortBy"
      :sortOptions="sortOptions"
      @close="$emit('clear-results')"
    />

    <!-- Empty state -->
    <section v-if="filteredResults.length === 0" class="py-8 text-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Aucun DPE trouvé avec ces critères.</h3>
      <p class="text-gray-600 dark:text-gray-400">Essayez une période ou un rayon plus large.</p>
    </section>

    <!-- Results grid -->
    <div v-if="filteredResults.length > 0" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <CarteBien
        v-for="(dpe, index) in filteredResults"
        :key="dpe.numero_dpe"
        :result="dpe"
        :index="index"
        :dateDisplay="formatDate(dpe.date_etablissement_dpe)"
        :dateTooltip="formatFullDate(dpe.date_etablissement_dpe)"
        :distance="getFiniteNumber(dpe._distance) ?? undefined"
        :propertyType="getPropertyType(dpe)"
        :address="getAddressWithoutCityAndPostcode(dpe)"
        :location="`${dpe.nom_commune_ban || dpe.nom_commune_brut || 'Localisation inconnue'} - ${dpe.code_postal_ban || dpe.code_postal_brut || ''}`"
        :surface="getSurface(dpe)"
        :floor="getFloorDisplay(dpe)"
        :yearBuilt="formatYearDisplay(dpe.anneeConstruction)"
        :hasIncompleteData="false"
        :isLegacy="false"
        @click="showDetails"
        @hide="hideResult"
      />
    </div>

    <!-- Modals -->
    <ModaleProprietee
      v-if="selectedProperty"
      :property="selectedProperty"
      :formattedAddress="selectedProperty.adresse_ban || selectedProperty.adresse_brut || getFormattedAddress(selectedProperty)"
      :commune="selectedProperty.nom_commune_ban || selectedProperty.nom_commune_brut"
      :surface="getSurface(selectedProperty)"
      :energyClass="selectedProperty.etiquette_dpe"
      :mapUrl="getGoogleMapsEmbedUrlForDPE(selectedProperty)"
      :geoportailUrl="getGeoportailUrl(getLatitudeFromGeopoint(selectedProperty._geopoint), getLongitudeFromGeopoint(selectedProperty._geopoint))"
      :propertyType="selectedProperty.typeBien || selectedProperty.type_batiment"
      :floor="selectedProperty.typeBien && selectedProperty.typeBien.toLowerCase().includes('appartement') && selectedProperty.etage ? selectedProperty.etage : null"
      :location="selectedProperty.complementRefLogement"
      :yearBuilt="selectedProperty.anneeConstruction ? String(selectedProperty.anneeConstruction) : null"
      :numberOfLevels="selectedProperty.nombreNiveaux"
      :ceilingHeight="selectedProperty.hauteurSousPlafond"
      :diagnosisDate="formatFullDate(selectedProperty.date_etablissement_dpe)"
      :energyConsumption="getMetric(selectedProperty, ['conso_5_usages_par_m2_ep', 'consommationEnergie', 'consommation_energie'])"
      :gesEmissions="getMetric(selectedProperty, ['emission_ges_5_usages_par_m2', 'emissionGES', 'estimation_ges'])"
      :departmentAverages="departmentAverages"
      @close="closeModal()"
      @show-details="showDPEDetails = true"
    />

    <ModaleDetailsDPE
      :show="showDPEDetails && !!selectedProperty"
      :property="selectedProperty || {}"
      :departmentAverages="departmentAverages"
      @close="showDPEDetails = false"
    />

    <RetourEnHaut />
  </div>
</template>

<script>
import { watch } from 'vue'
import { useGestionResultats } from '../../../composables/useGestionResultats'
import { formatDpeDate, getDpeAgeDays, getDpeDateSortValue } from '../../../utils/datesDPE.js'
import {
  extractYearFromValue,
  formatYearDisplay,
  getFloorDisplay as getFloorDisplayUtil
} from '../../../utils/formateursDPE'
import {
  getGeoportailUrl,
  getGoogleMapsEmbedUrl,
  getLatitudeFromGeopoint,
  getLongitudeFromGeopoint
} from '../../../utils/utilsCartes'
import RetourEnHaut from '../../base/RetourEnHaut.vue'
import CarteBien from '../../partages/CarteBien.vue'
import EnteteResultats from '../../partages/EnteteResultats.vue'
import ModaleProprietee from '../recherche/ModaleProprietee.vue'
import ModaleDetailsDPE from './ModaleDetailsDPE.vue'

export default {
  name: 'ResultatsDpeRecents',
  components: {
    ModaleProprietee,
    ModaleDetailsDPE,
    RetourEnHaut,
    CarteBien,
    EnteteResultats
  },
  props: {
    results: {
      type: Object,
      default: null
    },
    searchCriteria: {
      type: Object,
      default: null
    },
    departmentAverages: {
      type: Object,
      default: null
    }
  },
  emits: ['clear-results'],
  setup(props) {
    const { selectedProperty, showDPEDetails, hiddenResults, showDetails, closeModal } = useGestionResultats()

    // A new search (or replacement rows) must not inherit hidden cards or stale dialogs.
    // Keep this local to recent results: localiser mode has its own history lifecycle.
    watch([() => props.results, () => props.results?.results], () => {
      hiddenResults.value.clear()
      closeModal()
    })

    return {
      selectedProperty,
      showDPEDetails,
      hiddenResults,
      showDetails,
      closeModal
    }
  },
  data() {
    return {
      sortBy: 'distance' // Default sort by distance for recent searches
    }
  },
  computed: {
    searchContext() {
      const parts = this.results?.searchAddress ? [`Autour de ${this.results.searchAddress}`] : []
      const radius = this.getFiniteNumber(this.results?.searchRadius)
      if (radius !== null && radius > 0) {
        parts.push(radius < 1 ? `Rayon : ${radius * 1000} m` : `Rayon : ${radius} km`)
      }
      const months = this.getFiniteNumber(this.searchCriteria?.monthsBack)
      if (months !== null && Number.isInteger(months) && months > 0) {
        parts.push(months === 1 ? 'Dernier mois' : `${months} derniers mois`)
      }
      return parts.join(' · ')
    },
    sortOptions() {
      const options = [
        { value: 'distance', label: 'Distance' },
        { value: 'surface', label: 'Surface' },
        { value: 'date-desc', label: 'DPE récent' },
        { value: 'date-asc', label: 'DPE ancien' },
        { value: 'construction-desc', label: 'Construction récente' },
        { value: 'construction-asc', label: 'Construction ancienne' }
      ]

      if (this.shouldShowEtageSort) {
        options.splice(2, 0, { value: 'etage', label: 'Étage' })
      }

      return options
    },

    shouldShowEtageSort() {
      if (!this.results?.results || this.results.results.length < 3) return false
      const etages = this.results.results
        .map(r => {
          const display = this.getFloorDisplay(r)
          if (!display) return null
          if (display === 'RDC') return 0
          const match = display.match(/\d+/)
          return match ? parseInt(match[0], 10) : null
        })
        .filter(e => e !== null)
      if (etages.length < 3) return false
      const uniqueEtages = new Set(etages)
      return uniqueEtages.size > 1
    },

    filteredResults() {
      if (!this.results?.results) return []

      let results = this.results.results.filter((_, index) => !this.hiddenResults.has(index))

      // Apply sorting
      if (this.sortBy === 'surface') {
        const targetSurface = this.searchCriteria?.surface ? parseFloat(this.searchCriteria.surface) : null
        if (targetSurface) {
          results = [...results].sort((a, b) => {
            const surfA = a.surfaceHabitable || 0
            const surfB = b.surfaceHabitable || 0
            const diffA = Math.abs(surfA - targetSurface)
            const diffB = Math.abs(surfB - targetSurface)
            return diffA - diffB
          })
        } else {
          results = [...results].sort((a, b) => (b.surfaceHabitable || 0) - (a.surfaceHabitable || 0))
        }
      } else if (this.sortBy === 'etage') {
        results = [...results].sort((a, b) => {
          const getFloorNumber = result => {
            const display = this.getFloorDisplay(result)
            if (!display) return 999
            if (display === 'RDC') return 0
            const match = display.match(/\d+/)
            return match ? parseInt(match[0], 10) : 999
          }
          const floorA = getFloorNumber(a)
          const floorB = getFloorNumber(b)
          if (floorA === floorB) {
            const distA = a._distance !== undefined ? a._distance : Infinity
            const distB = b._distance !== undefined ? b._distance : Infinity
            return distA - distB
          }
          return floorA - floorB
        })
      } else if (this.sortBy === 'construction-asc') {
        results = [...results].sort((a, b) => {
          const yearA = extractYearFromValue(a.anneeConstruction) || 9999
          const yearB = extractYearFromValue(b.anneeConstruction) || 9999
          return yearA - yearB
        })
      } else if (this.sortBy === 'construction-desc') {
        results = [...results].sort((a, b) => {
          const yearA = extractYearFromValue(a.anneeConstruction) || 0
          const yearB = extractYearFromValue(b.anneeConstruction) || 0
          return yearB - yearA
        })
      } else if (this.sortBy === 'date-desc') {
        results = [...results].sort((a, b) => {
          const dateA = getDpeDateSortValue(a.date_etablissement_dpe)
          const dateB = getDpeDateSortValue(b.date_etablissement_dpe)
          return dateB - dateA
        })
      } else if (this.sortBy === 'date-asc') {
        results = [...results].sort((a, b) => {
          const dateA = getDpeDateSortValue(a.date_etablissement_dpe)
          const dateB = getDpeDateSortValue(b.date_etablissement_dpe)
          return dateA - dateB
        })
      } else {
        // Default: sort by distance with exact match detection
        results = [...results].sort((a, b) => {
          const normalizeAddr = addr => (addr || '').toLowerCase().replace(/\s+/g, ' ').trim()
          const searchAddr = normalizeAddr(this.results?.fullSearchAddress || this.results?.searchAddress || '')

          const aMatchesSearch = normalizeAddr(a.adresse_ban || a.adresseComplete) === searchAddr
          const bMatchesSearch = normalizeAddr(b.adresse_ban || b.adresseComplete) === searchAddr

          const aIsExact = a._isExactMatch || aMatchesSearch
          const bIsExact = b._isExactMatch || bMatchesSearch

          if (aIsExact && !bIsExact) return -1
          if (!aIsExact && bIsExact) return 1

          const distA = a._distance !== undefined ? a._distance : a.distance !== undefined ? a.distance : Infinity
          const distB = b._distance !== undefined ? b._distance : b.distance !== undefined ? b.distance : Infinity
          return distA - distB
        })
      }

      return results
    }
  },
  methods: {
    formatYearDisplay,

    hideResult(index) {
      if (!Number.isInteger(index) || index < 0) return
      // The event index belongs to the sorted/filtered cards, not the source rows.
      const result = this.filteredResults[index]
      if (!result) return
      const originalIndex = this.results.results.indexOf(result)
      if (originalIndex !== -1) this.hiddenResults.add(originalIndex)
    },

    getFiniteNumber(value) {
      if (typeof value !== 'number' && typeof value !== 'string') return null
      if (typeof value === 'string' && !value.trim()) return null
      const number = Number(value)
      return Number.isFinite(number) ? number : null
    },

    getMetric(dpe, keys) {
      for (const key of keys) {
        const value = this.getFiniteNumber(dpe[key])
        if (value !== null && value >= 0) return value
      }
      return null
    },

    getSurface(dpe) {
      for (const value of [dpe.surfaceHabitable, dpe.surface_habitable_logement, dpe.surface_habitable]) {
        const number = this.getFiniteNumber(value)
        if (number !== null && number >= 0) return number
      }
      return null
    },

    formatDate(dateStr) {
      const diffDays = getDpeAgeDays(dateStr)
      if (diffDays === null) return null

      if (diffDays === 0) return "Aujourd'hui"
      if (diffDays === 1) return 'Hier'
      if (diffDays < 7) return `Il y a ${diffDays} jours`
      if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`

      const totalMonths = Math.floor(diffDays / 30)
      if (totalMonths >= 24) {
        const years = Math.floor(totalMonths / 12)
        const months = totalMonths % 12
        if (months === 0) {
          return `Il y a ${years} an${years > 1 ? 's' : ''}`
        }
        return `Il y a ${years} an${years > 1 ? 's' : ''} et ${months} mois`
      }

      if (totalMonths > 0) {
        return `Il y a ${totalMonths} mois`
      }

      return formatDpeDate(dateStr) || null
    },

    formatFullDate(dateStr) {
      return formatDpeDate(dateStr) || null
    },

    getFormattedAddress(dpe) {
      // Prioritize adresseComplete if it exists (it's the reconstructed clean address)
      if (dpe.adresseComplete) {
        return dpe.adresseComplete.replace(/â€™/g, "'")
      }

      // Fallback to original logic if adresseComplete doesn't exist
      let address = ''
      if (dpe.adresse_ban && /^\d/.test(dpe.adresse_ban.trim())) {
        address = dpe.adresse_ban
      } else if (dpe.adresse_ban && dpe.adresse_brut && /^\d+/.test(dpe.adresse_brut.trim())) {
        const streetNumber = dpe.adresse_brut.match(/^\d+[a-z]?\s*/i)[0].trim()
        address = `${streetNumber} ${dpe.adresse_ban}`
      } else {
        address = dpe.adresse_ban || dpe.adresse_brut || 'Adresse non disponible'
      }
      return address.replace(/â€™/g, "'")
    },

    getAddressWithoutCityAndPostcode(dpe) {
      let address = this.getFormattedAddress(dpe)
      const cityName = dpe.nom_commune_ban || dpe.nom_commune_brut
      const postcode = dpe.code_postal_ban || dpe.code_postal_brut

      if (postcode) {
        address = address.replace(new RegExp(`\\b${postcode}\\b`, 'g'), '').trim()
      }

      if (cityName) {
        const cityRegex = new RegExp(`,?\\s*${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,?`, 'gi')
        address = address.replace(cityRegex, ' ').trim()
      }

      address = address.replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim()
      return address
    },

    getPropertyType(dpe) {
      if (dpe.type_batiment) {
        const type = dpe.type_batiment.toLowerCase()
        if (type.includes('appartement')) return 'appartement'
        if (type.includes('maison')) return 'maison'
      }
      return null
    },

    getFloorDisplay(result) {
      // Adapter for recent DPE data structure
      const adapted = {
        etage: result.etage,
        complementRefLogement: result.complementRefLogement,
        typeBien: result.type_batiment,
        nombreNiveaux: result.nombreNiveaux
      }
      return getFloorDisplayUtil(adapted)
    },

    getGoogleMapsEmbedUrlForDPE(dpe) {
      if (!dpe) return ''

      // Get both address and coordinates
      const adresse = dpe.adresse_ban || dpe.adresse_brut
      let lat = null
      let lon = null

      if (dpe._geopoint) {
        lat = getLatitudeFromGeopoint(dpe._geopoint)
        lon = getLongitudeFromGeopoint(dpe._geopoint)
      }

      // Pass both coordinates and address for best results
      // Coordinates ensure accurate pin placement, address provides context
      return getGoogleMapsEmbedUrl(lat, lon, adresse, 19)
    },

    getLatitudeFromGeopoint,
    getLongitudeFromGeopoint,
    getGeoportailUrl
  }
}
</script>

<style scoped>
/* Animations pour les résultats */
.grid > div {
  animation: fadeInUp 0.6s ease-out;
}

.grid > div:nth-child(2) {
  animation-delay: 0.1s;
}

.grid > div:nth-child(3) {
  animation-delay: 0.2s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>