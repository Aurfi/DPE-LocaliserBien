<template>
  <div>
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      
      <!-- Bouton retour -->
      <div class="mb-8">
        <router-link 
          to="/" 
          class="inline-flex items-center px-6 py-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium hover:scale-105 border border-white/50 dark:border-gray-700/50"
        >
          <Home class="w-5 h-5 mr-2" />
          Retour à l'accueil
        </router-link>
      </div>
      
      <!-- En-tête -->
      <div class="text-center mb-12">
        <div class="flex items-center justify-center mb-4">
          <HelpCircle class="w-10 h-10 text-blue-600 dark:text-blue-400 mr-3" />
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white">Informations</h1>
        </div>
        <p class="text-xl text-gray-600 dark:text-gray-400">
          Guide d'utilisation et informations pratiques
        </p>
      </div>

      <!-- Questions et Réponses -->
      <div class="space-y-6">
        
        <!-- Question 1 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Search class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Fonctionnement du service
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Le service permet de retrouver l'adresse d'un bien à partir des informations du Diagnostic de Performance Énergétique (DPE) : 
            commune ou code postal, surface habitable et consommation énergétique. 
            Ces données sont croisées avec la base nationale de l'ADEME pour identifier les correspondances possibles.
            <br><br>
            <strong class="text-orange-600 dark:text-orange-400">⚠️ Important :</strong> Ce service fonctionnera uniquement pour les DPE réalisés <strong>depuis juillet 2021</strong>. 
            Selon la réglementation, les DPE réalisés avant le 30 juin 2021 ne sont plus valables depuis le 1er janvier 2025.
          </p>
        </div>

        <!-- Question 2 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Target class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Fiabilité des résultats
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            La précision de notre service dépend directement de l'exactitude des données publiées dans les annonces. 
            La combinaison surface + consommation permet généralement d'identifier le bien correspondant au DPE affiché. 
            Dans les zones denses (immeubles, grandes villes), plusieurs biens peuvent présenter des caractéristiques similaires. 
            L'utilisation de la vue satellite et la vérification de l'adresse permettent alors de confirmer l'identification.
          </p>
        </div>

        <!-- Question 3 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Database class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Sources des données
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Les données proviennent de la base publique officielle des <strong>DPE</strong> de l'<span class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">ADEME</span> 
            (<span class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">A</span>gence <span class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">D</span>e la <span class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">T</span>ransition <span class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">É</span>cologique). Ces données sont officielles, vérifiées et mises à jour régulièrement, comme leur nom.
          </p>
        </div>

        <!-- Question 4 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Shield class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Gratuité du service
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Le service est entièrement gratuit et sans publicité. 
            Aucune inscription n'est requise pour l'utiliser.
          </p>
        </div>

        <!-- Question 5 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <AlertCircle class="w-5 h-5 mr-2 text-orange-500 dark:text-orange-400" />
            Absence de résultats
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Plusieurs raisons possibles : le DPE est peut-être trop récent (délai de publication), 
            ou les valeurs annoncées ne correspondent pas exactement au document officiel. 
            Vérifiez notamment que les consommations correspondent précisément aux valeurs du DPE.
          </p>
        </div>

        <!-- Question 6 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Clock class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Actualisation des données
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Les diagnostics récents mettent entre 1 et 3 semaines à être intégrés dans la base officielle de l'ADEME. 
            Pour un DPE réalisé très récemment, il est normal qu'il n'apparaisse pas encore.
          </p>
        </div>

        <!-- Question 7 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Lock class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Protection de vos données
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Aucune donnée personnelle n'est collectée. Le service n'utilise pas de cookies de tracking 
            et ne conserve aucun historique de recherche. Les requêtes sont traitées de manière anonyme et éphémère.
          </p>
        </div>

        <!-- Question 8 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Zap class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Résultats multiples
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Plusieurs biens peuvent correspondre aux critères saisis, particulièrement dans les zones urbaines denses. 
            L'adresse, l'étage et la date du diagnostic permettent d'affiner l'identification. 
            Les résultats sont présentés par ordre de correspondance décroissante.
          </p>
        </div>

        <!-- Question 9 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Heart class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Remerciements
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            • Les bibliothèques <strong>Open Source</strong> utilisées dans ce projet (Vue.js, Tailwind CSS, Vite, Lucide)
            <br>
            • L'<span class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">ADEME</span> pour la mise à disposition des données DPE
            <br>
            • <a href="https://www.data.gouv.fr/" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline"><strong>Data</strong>Gouv</a>, la plateforme des données publiques françaises
          </p>
        </div>

      </div>

      <!-- Navigation -->
      <div class="mt-6 text-center">
        <router-link to="/" class="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 py-3 rounded-2xl transition-all duration-200 hover:shadow-lg hover:scale-[1.02] inline-flex items-center shadow-md">
          <Home class="w-4 h-4 mr-2" />
          Retour à l'accueil
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import {
  AlertCircle,
  Clock,
  Database,
  Heart,
  HelpCircle,
  Home,
  Lock,
  Search,
  Shield,
  Target,
  Zap
} from 'lucide-vue-next'

export default {
  name: 'Informations',
  components: {
    HelpCircle,
    Search,
    Target,
    Database,
    Shield,
    AlertCircle,
    Lock,
    Clock,
    Home,
    Zap,
    Heart
  }
}
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>