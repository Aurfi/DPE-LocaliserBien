<template>
  <div v-if="show && property" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm overflow-y-auto" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-700 my-auto">
      <!-- En-tête -->
      <div class="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            Rapport DPE Complet - {{ property.numeroDPE || property.id }}
          </h3>
          <button 
            @click="$emit('close')"
            class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-white dark:bg-gray-700 rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <!-- Contenu scrollable -->
      <div class="overflow-y-auto" style="max-height: calc(90vh - 80px);">
        <div class="p-6 space-y-6">
          <!-- Section 1: Consommations détaillées avec moyennes départementales -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              Consommations détaillées
              <span v-if="departmentAverages" class="ml-auto text-xs font-normal text-gray-500 dark:text-gray-400">
                vs moyennes dept. {{ departmentAverages.department }}
              </span>
            </h4>
            <!-- Total consumption comparison if department averages available -->
            <div v-if="getDeptAverage('total')" class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mb-4 border border-blue-200 dark:border-blue-700">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">Consommation totale vs moyenne départementale</p>
                  <div class="flex items-center gap-4">
                    <div>
                      <span class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ getConsommation() }}</span>
                      <span class="text-sm text-gray-600 dark:text-gray-400 ml-1">kWh/m²/an</span>
                    </div>
                    <div class="text-gray-400 dark:text-gray-500">vs</div>
                    <div>
                      <span class="text-lg font-bold" :class="getConsommation() < getDeptAverage('total') ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'">{{ Math.round(getDeptAverage('total')) }}</span>
                      <span class="text-sm text-gray-600 dark:text-gray-400 ml-1">moy. dept.</span>
                    </div>
                  </div>
                  <p class="text-xs mt-2" :class="getConsommation() < getDeptAverage('total') ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'">
                    {{ getConsommation() < getDeptAverage('total') ? 
                      `${Math.round((getDeptAverage('total') - getConsommation()) / getDeptAverage('total') * 100)}% mieux que la moyenne` :
                      `${Math.round((getConsommation() - getDeptAverage('total')) / getDeptAverage('total') * 100)}% au-dessus de la moyenne` }}
                  </p>
                  <div v-if="getDeptRangeInfo()" class="mt-3 pt-3 border-t border-blue-300 dark:border-blue-800">
                    <p class="text-xs text-gray-600 dark:text-gray-400">
                      <span class="font-medium">Échantillon dept. {{ departmentAverages.department }}:</span> {{ getDeptRangeInfo().count.toLocaleString('fr-FR') }} biens de {{ getDeptRangeInfo().range }}
                      <span class="text-gray-500 dark:text-gray-500 ml-1">(surface moy: {{ getDeptRangeInfo().avgSurface }}m²)</span>
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Période: {{ formatDateRange(departmentAverages.dateRange) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div v-if="property.consoDetails?.chauffage !== undefined" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Chauffage</p>
                <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ Math.round(property.consoDetails.chauffage / getSurface()) }} kWh/m²/an</p>
                <div v-if="getDeptAverage('chauffage')" class="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span class="text-gray-500 dark:text-gray-400">Moy. dept:</span>
                  <span class="ml-1 font-medium" :class="(property.consoDetails?.chauffage / getSurface()) < getDeptAverage('chauffage') ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'">
                    {{ Math.round(getDeptAverage('chauffage')) }} kWh/m²/an
                  </span>
                </div>
              </div>
              <div v-if="property.consoDetails?.eauChaude !== undefined" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Eau chaude</p>
                <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ Math.round(property.consoDetails.eauChaude / getSurface()) }} kWh/m²/an</p>
                <div v-if="getDeptAverage('eau_chaude')" class="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span class="text-gray-500 dark:text-gray-400">Moy. dept:</span>
                  <span class="ml-1 font-medium" :class="(property.consoDetails?.eauChaude / getSurface()) < getDeptAverage('eau_chaude') ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'">
                    {{ Math.round(getDeptAverage('eau_chaude')) }} kWh/m²/an
                  </span>
                </div>
              </div>
              <div v-if="property.consoDetails?.refroidissement !== undefined" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Climatisation</p>
                <p v-if="property.consoDetails.refroidissement > 0" class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ Math.round(property.consoDetails.refroidissement / getSurface()) }} kWh/m²/an</p>
                <p v-else class="text-sm text-gray-600 dark:text-gray-400">Pas de climatisation</p>
                <div v-if="getDeptRangeInfo()?.acPercentage" class="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span class="text-gray-500 dark:text-gray-400">Dept. {{ departmentAverages.department }}:</span>
                  <span class="ml-1 font-medium text-gray-600 dark:text-gray-300">{{ getDeptRangeInfo().acPercentage }}% ont la clim</span>
                </div>
              </div>
              <div v-if="property.consoDetails?.eclairage !== undefined" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Éclairage</p>
                <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ Math.round(property.consoDetails.eclairage / getSurface()) }} kWh/m²/an</p>
              </div>
              <div v-if="property.consoDetails?.auxiliaires !== undefined" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Auxiliaires (VMC, pompes)</p>
                <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ Math.round(property.consoDetails.auxiliaires / getSurface()) }} kWh/m²/an</p>
              </div>
            </div>
          </div>

          <!-- Section 2: Systèmes -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Systèmes et équipements
            </h4>
            <div class="space-y-3">
              <div v-if="property.systemeChauffage" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Système de chauffage</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.systemeChauffage }}</p>
              </div>
              <div v-if="property.systemeECS" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Système d'eau chaude sanitaire</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.systemeECS }}</p>
              </div>
              <div class="grid md:grid-cols-2 gap-3">
                <div v-if="property.typeVentilation || property.type_ventilation" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Ventilation</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getVentilationLabel(property.typeVentilation || property.type_ventilation) }}</p>
                </div>
                <div v-if="property.installationSolaire" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Installation solaire</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.installationSolaire }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Qualité de l'isolation -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
              </svg>
              Qualité de l'isolation
            </h4>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div v-if="property.isolationEnveloppe" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Enveloppe</p>
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationEnveloppe).color">{{ getInsulationRating(property.isolationEnveloppe).level }}/{{ getInsulationRating(property.isolationEnveloppe).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationEnveloppe).label }}</p>
                </div>
              </div>
              <div v-if="property.isolationMurs" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Murs</p>
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationMurs).color">{{ getInsulationRating(property.isolationMurs).level }}/{{ getInsulationRating(property.isolationMurs).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationMurs).label }}</p>
                </div>
              </div>
              <div v-if="property.isolationMenuiseries" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Menuiseries</p>
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationMenuiseries).color">{{ getInsulationRating(property.isolationMenuiseries).level }}/{{ getInsulationRating(property.isolationMenuiseries).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationMenuiseries).label }}</p>
                </div>
              </div>
              <div v-if="property.isolationPlancherBas" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Plancher bas</p>
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium" :class="getInsulationRating(property.isolationPlancherBas).color">{{ getInsulationRating(property.isolationPlancherBas).level }}/{{ getInsulationRating(property.isolationPlancherBas).max }}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">{{ getInsulationRating(property.isolationPlancherBas).label }}</p>
                </div>
              </div>
              <div v-if="property.isolationToiture" class="bg-white dark:bg-gray-800 rounded-lg p-3">
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
              <div v-if="property.type_vitrage" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Type de vitrage</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.type_vitrage }}</p>
              </div>
              <div v-if="property.type_materiaux_menuiseries" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Matériaux menuiseries</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.type_materiaux_menuiseries }}</p>
              </div>
            </div>
          </div>

          <!-- Section 4: Caractéristiques du bien -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h-2M9 7h6m-6 4h6m-6 4h6"></path>
              </svg>
              Caractéristiques du bien
            </h4>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Surface habitable</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getSurface() }} m²</p>
              </div>
              <div v-if="property.typeBien" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Type de bien</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.typeBien === 'appartement' ? 'Appartement' : property.typeBien === 'maison' ? 'Maison' : property.typeBien }}</p>
              </div>
              <div v-if="property.anneeConstruction" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Année de construction</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.anneeConstruction }}</p>
              </div>
              <div v-if="getFloorDisplay()" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Localisation</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getFloorDisplay() }}</p>
              </div>
              <div v-if="property.hauteurSousPlafond" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Hauteur sous plafond</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.hauteurSousPlafond }} m</p>
              </div>
              <div v-if="property.nombreNiveaux" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Nombre de niveaux</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.nombreNiveaux }}</p>
              </div>
              <div v-if="property.logementTraversant" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Logement traversant</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.logementTraversant }}</p>
              </div>
              <div v-if="property.ubat" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Coefficient Ubat</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.ubat.toFixed(2) }} W/m²K</p>
              </div>
              <div v-if="property.classeInertie" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Inertie thermique</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.classeInertie }}</p>
              </div>
            </div>
          </div>

          <!-- Section 5: Informations DPE -->
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Informations du diagnostic
            </h4>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div v-if="property.numeroDPE || property.numero_dpe" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Numéro DPE</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ property.numeroDPE || property.numero_dpe }}</p>
              </div>
              <div v-if="property.dateVisite || property.date_visite_diagnostiqueur" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Date du diagnostic</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formatDate(property.dateVisite || property.date_visite_diagnostiqueur) }}</p>
              </div>
              <div v-if="property.classeDPE || property.classe_consommation_energie" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Classe énergétique</p>
                <span :class="getDPEBadgeClass(property.classeDPE || property.classe_consommation_energie)" class="px-3 py-1 rounded text-sm font-bold">
                  Classe {{ property.classeDPE || property.classe_consommation_energie }}
                </span>
              </div>
              <div v-if="getConsommation()" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Consommation totale</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getConsommation() }} kWh/m²/an</p>
              </div>
              <div v-if="getGES()" class="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Émissions GES</p>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ getGES() }} kg CO₂/m²/an</p>
              </div>
            </div>
          </div>

          <!-- Lien vers ADEME -->
          <div class="text-center pt-4">
            <a 
              :href="`https://observatoire-dpe-audit.ademe.fr/afficher-dpe/${property.numeroDPE || property.numero_dpe || property.id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
            >
              <ExternalLink class="w-4 h-4" />
              Voir le rapport complet sur ADEME
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ExternalLink, X } from 'lucide-vue-next'

export default {
  name: 'DPEDetailsModal',
  components: {
    X,
    ExternalLink
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
  watch: {
    property: {
      immediate: true,
      handler(newVal) {
        if (newVal && Object.keys(newVal).length > 0) {
          // Property data is available
        }
      }
    }
  },
  methods: {
    getConsommation() {
      return this.property.consommationEnergie || this.property.consommation_energie || 0
    },

    getGES() {
      return this.property.emissionGES || this.property.ges || this.property.estimation_ges || 0
    },

    getSurface() {
      return (
        this.property.surfaceHabitable ||
        this.property.surface_habitable_logement ||
        this.property.surface_habitable ||
        1
      )
    },

    getDeptAverage(type) {
      if (!this.departmentAverages || !this.property) return null

      // Find the appropriate surface range
      const surface = this.getSurface()
      let range = null

      for (const surfaceRange of this.departmentAverages.surfaceRanges) {
        const [min, max] = surfaceRange.range
          .replace('m²', '')
          .replace('+', '-999')
          .split('-')
          .map(n => parseInt(n, 10))
        if (surface >= min && (max === 999 || surface <= max)) {
          range = surfaceRange
          break
        }
      }

      // Handle edge cases for very small or very large surfaces
      if (!range && this.departmentAverages.surfaceRanges.length > 0) {
        if (surface < 15) {
          range = this.departmentAverages.surfaceRanges[0]
        } else if (surface > 150) {
          range = this.departmentAverages.surfaceRanges[this.departmentAverages.surfaceRanges.length - 1]
        }
      }

      if (!range) return null

      // Return the appropriate consumption value
      if (type === 'total') {
        return range.consumption.total
      } else if (type === 'chauffage') {
        return range.consumption.chauffage
      } else if (type === 'eau_chaude') {
        return range.consumption.eau_chaude
      } else if (type === 'ges') {
        return range.ges
      }

      return null
    },

    getDeptRangeInfo() {
      if (!this.departmentAverages || !this.property) return null

      // Find the appropriate surface range
      const surface = this.getSurface()
      let range = null

      for (const surfaceRange of this.departmentAverages.surfaceRanges) {
        const [min, max] = surfaceRange.range
          .replace('m²', '')
          .replace('+', '-999')
          .split('-')
          .map(n => parseInt(n, 10))
        if (surface >= min && (max === 999 || surface <= max)) {
          range = surfaceRange
          break
        }
      }

      // Handle edge cases for very small or very large surfaces
      if (!range && this.departmentAverages.surfaceRanges.length > 0) {
        if (surface < 15) {
          range = this.departmentAverages.surfaceRanges[0]
        } else if (surface > 150) {
          range = this.departmentAverages.surfaceRanges[this.departmentAverages.surfaceRanges.length - 1]
        }
      }

      return range
    },

    formatDateRange(dateRange) {
      if (!dateRange) return 'sept. 2022 → présent'

      // Parse the date range string (format: "2022-09-11 to present")
      const match = dateRange.match(/(\d{4})-(\d{2})-(\d{2}) to (.+)/)
      if (!match) return dateRange

      const [, year, month, , end] = match
      const months = {
        '01': 'janv.',
        '02': 'févr.',
        '03': 'mars',
        '04': 'avr.',
        '05': 'mai',
        '06': 'juin',
        '07': 'juil.',
        '08': 'août',
        '09': 'sept.',
        10: 'oct.',
        11: 'nov.',
        12: 'déc.'
      }

      const startDate = `${months[month]} ${year}`
      const endDate = end === 'present' ? 'présent' : end

      return `${startDate} → ${endDate}`
    },

    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    },

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

      // Handle text values like "bonne", "insuffisante", etc.
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

      // Handle numeric format like "3/5"
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
      // First check if complementRefLogement has actual floor info
      if (this.property.complementRefLogement) {
        return this.property.complementRefLogement
      }
      // Only show etage if it's greater than 0 (0 is often just default/empty)
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
        B: 'bg-green-400 text-white',
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