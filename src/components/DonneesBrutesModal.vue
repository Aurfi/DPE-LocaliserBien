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

      <!-- Contenu scrollable -->
      <div class="overflow-y-auto" style="max-height: calc(90vh - 100px);">
        <div class="p-6 space-y-6">
          
          <!-- Section Identification -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <FileText class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Identification du diagnostic
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DataRow label="Numéro DPE" :value="getData('numero_dpe', 'numeroDPE')" />
              <DataRow label="Date établissement" :value="formatDate(getData('date_etablissement_dpe', 'dateVisite'))" />
              <DataRow label="Date visite" :value="formatDate(getData('date_visite_diagnostiqueur', 'dateVisite'))" />
              <DataRow label="Version DPE" :value="getData('version_dpe')" />
              <DataRow label="Diagnostiqueur" :value="getData('nom_diagnostiqueur')" />
              <DataRow label="Méthode de calcul" :value="getData('methode_calcul_dpe')" />
            </div>
          </div>

          <!-- Section Localisation -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <MapPin class="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Localisation
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DataRow label="Adresse" :value="getAddress()" :colspan="true" />
              <DataRow label="Code postal" :value="getData('code_postal_ban', 'codePostal', 'code_postal_brut')" />
              <DataRow label="Commune" :value="getData('nom_commune_ban', 'commune', 'nom_commune_brut')" />
              <DataRow label="Code INSEE" :value="getData('code_insee_commune_actualise', 'code_insee_commune')" />
              <DataRow label="Département" :value="getData('code_departement_ban', 'tv016_departement_code')" />
              <DataRow label="Coordonnées GPS" :value="getCoordinates()" />
            </div>
          </div>

          <!-- Section Caractéristiques du bien -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <Home class="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              Caractéristiques du bien
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DataRow label="Type de bien" :value="getData('type_batiment', 'typeBien', 'tr002_type_batiment_description')" />
              <DataRow label="Surface habitable" :value="formatSurface(getData('surface_habitable_logement', 'surfaceHabitable', 'surface_thermique_lot'))" />
              <DataRow label="Année construction" :value="getData('annee_construction', 'anneeConstruction')" />
              <DataRow label="Nombre de niveaux" :value="getData('nombre_niveau_logement', 'nombreNiveaux')" />
              <DataRow label="Étage" :value="getData('etage')" />
              <DataRow label="Hauteur sous plafond" :value="formatHauteur(getData('hauteur_sous_plafond', 'hauteurSousPlafond'))" />
              <DataRow label="Surface baies vitrées" :value="formatSurface(getData('surface_baies_orientees_nord', 'surface_baies'))" />
              <DataRow label="Localisation dans immeuble" :value="getData('complement_ref_logement', 'complementRefLogement')" />
            </div>
          </div>

          <!-- Section Performance énergétique -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <Zap class="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" />
              Performance énergétique
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DataRow label="Consommation énergie (kWh/m²/an)" :value="formatNumber(getData('consommationEnergie', 'conso_5_usages_par_m2_ep', 'consommation_energie'))" />
              <DataRow label="Classe DPE" :value="getData('classeDPE', 'etiquette_dpe', 'classe_consommation_energie')" :highlight="true" />
              <DataRow label="Émissions GES (kg CO₂/m²/an)" :value="formatNumber(getData('emissionGES', 'emission_ges_5_usages_par_m2', 'estimation_ges'))" />
              <DataRow label="Classe GES" :value="getData('classeGES', 'etiquette_ges', 'classe_estimation_ges')" :highlight="true" />
            </div>

            <!-- Détails des consommations si disponibles -->
            <div v-if="hasConsommationDetails()" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h5 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Détails des consommations</h5>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DataRow label="Chauffage" :value="formatNumber(getData('conso_chauffage_par_m2'))" size="small" />
                <DataRow label="Eau chaude" :value="formatNumber(getData('conso_ecs_par_m2'))" size="small" />
                <DataRow label="Climatisation" :value="formatNumber(getData('conso_refroidissement_par_m2'))" size="small" />
                <DataRow label="Éclairage" :value="formatNumber(getData('conso_eclairage_par_m2'))" size="small" />
                <DataRow label="Auxiliaires" :value="formatNumber(getData('conso_auxiliaires_par_m2'))" size="small" />
              </div>
            </div>
          </div>

          <!-- Section Équipements -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <Settings class="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
              Équipements
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DataRow label="Type chauffage" :value="getData('type_energie_chauffage', 'tr001_modele_dpe_type_energie_chauffage')" />
              <DataRow label="Type eau chaude" :value="getData('type_energie_ecs', 'tr001_modele_dpe_type_energie_ecs')" />
              <DataRow label="Type ventilation" :value="getData('type_ventilation')" />
              <DataRow label="Isolation murs" :value="getData('qualite_isolation_murs')" />
              <DataRow label="Isolation toiture" :value="getData('qualite_isolation_plancher_haut')" />
              <DataRow label="Isolation plancher" :value="getData('qualite_isolation_plancher_bas')" />
              <DataRow label="Isolation menuiseries" :value="getData('qualite_isolation_menuiseries')" />
              <DataRow label="Type vitrage" :value="getData('type_vitrage')" />
            </div>
          </div>

          <!-- Section Données complémentaires (tous les autres champs) -->
          <div v-if="hasAdditionalData()" class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <Database class="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              Données complémentaires
              <span class="ml-auto text-xs font-normal text-gray-500 dark:text-gray-400">
                {{ Object.keys(getAdditionalData()).length }} champ{{ Object.keys(getAdditionalData()).length > 1 ? 's' : '' }}
              </span>
            </h4>
            <div class="space-y-2">
              <div 
                v-for="(value, key) in getAdditionalData()" 
                :key="key"
                class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
              >
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div class="flex-1">
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ key }}</span>
                    <div class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 break-all">
                      {{ formatRawValue(value) }}
                    </div>
                  </div>
                  <div class="text-xs text-gray-400 dark:text-gray-500 font-mono">
                    {{ getValueType(value) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Message pour DPE legacy -->
          <div v-if="isLegacyDPE" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
            <div class="flex items-start">
              <AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
              <div class="text-sm text-amber-700 dark:text-amber-300">
                <p class="font-semibold mb-1">DPE établi avant juillet 2021</p>
                <p>Ce diagnostic a été réalisé selon l'ancienne méthode de calcul. Certaines données peuvent être manquantes ou différer du format actuel.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { AlertTriangle, Database, FileText, Home, MapPin, Settings, X, Zap } from 'lucide-vue-next'
import { h } from 'vue'

// Composant pour afficher une ligne de données
const DataRow = {
  props: {
    label: String,
    value: [String, Number],
    colspan: {
      type: Boolean,
      default: false
    },
    highlight: {
      type: Boolean,
      default: false
    },
    size: {
      type: String,
      default: 'normal' // 'normal' ou 'small'
    }
  },
  render() {
    const classes = [this.colspan ? 'md:col-span-2' : '', 'flex flex-col']

    const labelClasses = [this.size === 'small' ? 'text-xs' : 'text-sm', 'text-gray-500 dark:text-gray-400']

    const valueClasses = [
      this.size === 'small' ? 'text-sm' : 'text-base',
      this.highlight ? 'font-bold' : 'font-medium',
      this.value && this.value !== 'N/A' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
    ]

    return h('div', { class: classes }, [
      h('span', { class: labelClasses }, this.label),
      h('span', { class: valueClasses }, String(this.value || 'N/A'))
    ])
  }
}

export default {
  name: 'DonneesBrutesModal',
  components: {
    AlertTriangle,
    Database,
    DataRow,
    FileText,
    Home,
    MapPin,
    Settings,
    X,
    Zap
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
  computed: {
    // Vérifie si c'est un DPE legacy (pré-2021)
    isLegacyDPE() {
      if (!this.dpeData) return false
      return this.dpeData.isLegacyData || this.dpeData.fromLegacy || false
    },

    // Récupère les données brutes ou les données mappées
    rawData() {
      if (!this.dpeData) return {}
      return this.dpeData.rawData || this.dpeData
    }
  },
  methods: {
    // Récupère une donnée en essayant plusieurs champs possibles
    getData(...fields) {
      // Essayer d'abord dans l'objet principal dpeData
      for (const field of fields) {
        const value = this.dpeData?.[field]
        if (value !== undefined && value !== null && value !== '') {
          return value
        }
      }

      // Ensuite essayer dans rawData si disponible
      const rawData = this.dpeData?.rawData
      if (rawData) {
        for (const field of fields) {
          const value = rawData[field]
          if (value !== undefined && value !== null && value !== '') {
            return value
          }
        }
      }

      return null
    },

    // Formate une date
    formatDate(dateStr) {
      if (!dateStr) return 'N/A'
      try {
        const date = new Date(dateStr)
        return date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      } catch {
        return dateStr
      }
    },

    // Formate un nombre
    formatNumber(value) {
      if (value === null || value === undefined || value === '') return 'N/A'
      const num = parseFloat(value)
      if (Number.isNaN(num)) return value
      return Math.round(num).toLocaleString('fr-FR')
    },

    // Formate une surface
    formatSurface(value) {
      const num = this.formatNumber(value)
      return num !== 'N/A' ? `${num} m²` : 'N/A'
    },

    // Formate une hauteur
    formatHauteur(value) {
      const num = this.formatNumber(value)
      return num !== 'N/A' ? `${num} m` : 'N/A'
    },

    // Récupère l'adresse complète
    getAddress() {
      const adresse = this.getData('adresseComplete', 'adresse_ban', 'geo_adresse', 'adresse_brut')
      return adresse || 'N/A'
    },

    // Récupère les coordonnées GPS
    getCoordinates() {
      const lat = this.getData('latitude')
      const lon = this.getData('longitude')

      if (lat && lon) {
        return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}`
      }

      // Essayer depuis _geopoint
      const geopoint = this.getData('_geopoint')
      if (geopoint) {
        const [lat, lon] = geopoint.split(',').map(v => parseFloat(v).toFixed(6))
        return `${lat}, ${lon}`
      }

      return 'N/A'
    },

    // Vérifie si on a des détails de consommation
    hasConsommationDetails() {
      return (
        this.getData('conso_chauffage_par_m2') ||
        this.getData('conso_ecs_par_m2') ||
        this.getData('conso_refroidissement_par_m2') ||
        this.getData('conso_eclairage_par_m2') ||
        this.getData('conso_auxiliaires_par_m2')
      )
    },

    // Liste des champs déjà affichés dans les sections
    getDisplayedFields() {
      return new Set([
        // Identification
        'numero_dpe',
        'numeroDPE',
        'date_etablissement_dpe',
        'dateVisite',
        'date_visite_diagnostiqueur',
        'version_dpe',
        'nom_diagnostiqueur',
        'methode_calcul_dpe',
        'modele_dpe',
        'methode_application_dpe',
        'nom_methode_dpe',
        'version_methode_dpe',
        // Localisation
        'adresse_ban',
        'adresseComplete',
        'geo_adresse',
        'adresse_brut',
        'code_postal_ban',
        'codePostal',
        'code_postal_brut',
        'nom_commune_ban',
        'commune',
        'nom_commune_brut',
        'code_insee_commune_actualise',
        'code_insee_commune',
        'code_insee_ban',
        'code_departement_ban',
        'tv016_departement_code',
        'latitude',
        'longitude',
        '_geopoint',
        'coordonnee_cartographique_x_ban',
        'coordonnee_cartographique_y_ban',
        // Champ à ignorer car peut contenir des données personnelles
        'complement_adresse_batiment',
        // Caractéristiques
        'type_batiment',
        'typeBien',
        'tr002_type_batiment_description',
        'surface_habitable_logement',
        'surfaceHabitable',
        'surface_thermique_lot',
        'annee_construction',
        'anneeConstruction',
        'nombre_niveau_logement',
        'nombreNiveaux',
        'etage',
        'numero_etage_appartement',
        'hauteur_sous_plafond',
        'hauteurSousPlafond',
        'surface_baies_orientees_nord',
        'surface_baies',
        'complement_ref_logement',
        'complementRefLogement',
        'complement_adresse_logement',
        'periode_construction',
        'nombre_appartement',
        // Performance énergétique
        'conso_5_usages_par_m2_ep',
        'consommationEnergie',
        'consommation_energie',
        'etiquette_dpe',
        'classeDPE',
        'classe_consommation_energie',
        'emission_ges_5_usages_par_m2',
        'emissionGES',
        'estimation_ges',
        'etiquette_ges',
        'classeGES',
        'classe_estimation_ges',
        'conso_chauffage_ep',
        'conso_ecs_ep',
        'conso_refroidissement_ep',
        'conso_eclairage_ep',
        'conso_auxiliaires_ep',
        'conso_chauffage_ef',
        'conso_ecs_ef',
        'conso_refroidissement_ef',
        'conso_eclairage_ef',
        'conso_auxiliaires_ef',
        'conso_5_usages_ep',
        'conso_5_usages_ef',
        // Équipements et isolation
        'type_energie_chauffage',
        'tr001_modele_dpe_type_energie_chauffage',
        'type_energie_ecs',
        'tr001_modele_dpe_type_energie_ecs',
        'type_energie_principale_chauffage',
        'type_energie_principale_ecs',
        'type_energie_n1',
        'type_energie_n2',
        'type_ventilation',
        'qualite_isolation_murs',
        'qualite_isolation_plancher_haut',
        'qualite_isolation_plancher_bas',
        'qualite_isolation_menuiseries',
        'type_vitrage',
        'qualite_isolation_enveloppe',
        'qualite_isolation_plancher_haut_toit_terrasse',
        'type_installation_chauffage',
        'type_installation_ecs',
        'type_generateur_chauffage_principal',
        'type_generateur_chauffage_principal_ecs',
        // Champs internes à ignorer (seulement les champs vraiment internes)
        'rawData',
        'matchScore',
        'matchReasons',
        'distance',
        '_distance',
        '_matchScore',
        '_searchRadius',
        '_isExactMatch',
        'isLegacyData',
        'fromLegacy',
        'hasIncompleteData',
        'legacyNote',
        'ademeUrl',
        '_tempDistance',
        '_searchScope',
        'codePostalDisplay',
        'communeDisplay',
        'codePostalADEME',
        'communeADEME',
        'suburb',
        'consoDetails'
      ])
    },

    // Récupère les données additionnelles non affichées
    getAdditionalData() {
      const displayed = this.getDisplayedFields()
      const additional = {}

      for (const [key, value] of Object.entries(this.rawData)) {
        if (!displayed.has(key) && value !== null && value !== undefined && value !== '') {
          additional[key] = value
        }
      }

      return Object.keys(additional).length > 0 ? additional : null
    },

    // Vérifie s'il y a des données additionnelles
    hasAdditionalData() {
      return this.getAdditionalData() !== null
    },

    // Formate le nom d'un champ pour l'affichage
    formatFieldName(fieldName) {
      // Remplace les underscores par des espaces et met en majuscule
      return fieldName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/Dpe/g, 'DPE')
        .replace(/Ges/g, 'GES')
        .replace(/Ecs/g, 'ECS')
        .replace(/M2/g, 'm²')
        .replace(/Co2/g, 'CO₂')
    },

    // Formate une valeur pour l'affichage
    formatValue(value) {
      if (value === null || value === undefined || value === '') return 'N/A'
      if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
      if (typeof value === 'number') return this.formatNumber(value)
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    },

    // Formate une valeur brute pour l'affichage dans les données complémentaires
    formatRawValue(value) {
      if (value === null) return 'null'
      if (value === undefined) return 'undefined'
      if (value === '') return '(vide)'
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (typeof value === 'number') {
        // Garder le nombre tel quel avec sa précision originale
        return value.toString()
      }
      if (typeof value === 'object') {
        // Formater le JSON de manière lisible
        return JSON.stringify(value, null, 2)
      }
      // Pour les strings, afficher telles quelles
      return String(value)
    },

    // Obtient le type d'une valeur pour l'affichage
    getValueType(value) {
      if (value === null) return 'null'
      if (value === undefined) return 'undefined'
      if (Array.isArray(value)) return `array[${value.length}]`
      if (typeof value === 'object') return 'object'
      if (typeof value === 'number') {
        if (Number.isInteger(value)) return 'number'
        return 'float'
      }
      if (typeof value === 'boolean') return 'boolean'
      if (typeof value === 'string') {
        // Détecter certains types de strings
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date'
        if (/^\d+$/.test(value)) return 'string(numeric)'
        if (value.length > 100) return `string(${value.length})`
        return 'string'
      }
      return typeof value
    }
  }
}
</script>

<style scoped>
/* Animation d'ouverture du modal */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
  }
  to {
    transform: translateY(0);
  }
}

.fixed {
  animation: fadeIn 0.2s ease-out;
}

.bg-white {
  animation: slideUp 0.3s ease-out;
}
</style>