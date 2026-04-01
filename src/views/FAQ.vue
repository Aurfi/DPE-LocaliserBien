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
          Accueil
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
        
        <!-- Guide d'utilisation -->
        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-3xl shadow-xl p-8 border-2 border-blue-200 dark:border-blue-800">
          <h2 class="flex items-center text-2xl font-bold text-gray-900 dark:text-white mb-6">
            <BookOpen class="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
            Guide d'utilisation
          </h2>
          
          <div class="space-y-6">
            <!-- Étape 1: Qu'est-ce qu'un DPE -->
            <div class="bg-white/80 dark:bg-gray-700/80 rounded-2xl p-5">
              <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <span class="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-3 text-sm font-bold">1</span>
                Qu'est-ce qu'un DPE ?
              </h3>
              <p class="text-gray-600 dark:text-gray-400 mb-4">
                Le <strong>DPE (Diagnostic de Performance Énergétique)</strong> est un document obligatoire qui évalue la consommation d'énergie d'un logement. 
                Il attribue une classe énergétique de A à G :
              </p>
              <div class="flex flex-wrap gap-2 mb-4">
                <span class="px-3 py-1 bg-green-500 text-white rounded-lg font-bold text-sm">A < 50 kWh/m²/an</span>
                <span class="px-3 py-1 bg-green-600 text-white rounded-lg font-bold text-sm">B 51-90</span>
                <span class="px-3 py-1 bg-yellow-400 text-gray-800 rounded-lg font-bold text-sm">C 91-150</span>
                <span class="px-3 py-1 bg-orange-400 text-white rounded-lg font-bold text-sm">D 151-230</span>
                <span class="px-3 py-1 bg-orange-500 text-white rounded-lg font-bold text-sm">E 231-330</span>
                <span class="px-3 py-1 bg-red-500 text-white rounded-lg font-bold text-sm">F 331-450</span>
                <span class="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-sm">G > 450</span>
              </div>
            </div>

            <!-- Étape 2: Où trouver les infos -->
            <div class="bg-white/80 dark:bg-gray-700/80 rounded-2xl p-5">
              <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <span class="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-3 text-sm font-bold">2</span>
                Où trouver ces informations sur une annonce ?
              </h3>
              <p class="text-gray-600 dark:text-gray-400 mb-3">
                Sur les sites d'annonces immobilières, recherchez :
              </p>
              <ul class="space-y-2 text-gray-600 dark:text-gray-400">
                <li class="flex items-start">
                  <MapPin class="w-5 h-5 mr-2 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span><strong>La ville ou le code postal</strong> du bien</span>
                </li>
                <li class="flex items-start">
                  <Maximize2 class="w-5 h-5 mr-2 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>La surface habitable</strong> en m² (ex: 65m²)</span>
                </li>
                <li class="flex items-start">
                  <Zap class="w-5 h-5 mr-2 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span><strong>La consommation énergétique</strong> en kWh/m²/an (ex: 173 kWh/m²/an)</span>
                </li>
              </ul>
              <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700">
                <p class="text-sm text-blue-700 dark:text-blue-300">
                  <strong>💡 Astuce :</strong> Ces informations sont souvent affichées avec l'étiquette énergie colorée (de A en vert à G en rouge).
                </p>
              </div>
            </div>

            <!-- Étape 3: Comment rechercher -->
            <div class="bg-white/80 dark:bg-gray-700/80 rounded-2xl p-5">
              <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <span class="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mr-3 text-sm font-bold">3</span>
                Comment faire votre recherche ?
              </h3>
              <ol class="space-y-3 text-gray-600 dark:text-gray-400">
                <li class="flex items-start">
                  <span class="font-bold mr-2">1.</span>
                  <span>Entrez le <strong>code postal</strong> ou sélectionnez la <strong>commune</strong></span>
                </li>
                <li class="flex items-start">
                  <span class="font-bold mr-2">2.</span>
                  <span>Indiquez la <strong>surface</strong> exacte du bien</span>
                </li>
                <li class="flex items-start">
                  <span class="font-bold mr-2">3.</span>
                  <span>Renseignez la <strong>consommation énergétique</strong> précise</span>
                </li>
                <li class="flex items-start">
                  <span class="font-bold mr-2">4.</span>
                  <span>Cliquez sur <strong>"Rechercher"</strong></span>
                </li>
              </ol>
              <div class="mt-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-700">
                <p class="text-sm text-green-700 dark:text-green-300">
                  <strong>✅ Résultat :</strong> Le service vous affichera l'adresse exacte du bien, avec une vue satellite pour vérification.
                </p>
              </div>
            </div>

            <!-- Exemple pratique -->
            <div class="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-2xl p-5 border border-indigo-200 dark:border-indigo-700">
              <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200 mb-3">📍 Exemple pratique</h3>
              <p class="text-gray-600 dark:text-gray-400">
                Une annonce indique : "Appartement T3 à Marseille 13008, 65m², classe D (173 kWh/m²/an)"
              </p>
              <p class="text-gray-600 dark:text-gray-400 mt-2">
                Vous recherchez avec : <strong>13008</strong> • <strong>65m²</strong> • <strong>173 kWh/m²/an</strong>
              </p>
              <p class="text-gray-600 dark:text-gray-400 mt-2">
                → LocaliserBien trouve l'adresse exacte de cet appartement !
              </p>
            </div>
          </div>
        </div>

        <!-- Sections techniques (déplacées en bas) -->
        <div class="mt-12 flex justify-center mb-6">
          <router-link 
            to="/" 
            class="inline-flex items-center px-6 py-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium hover:scale-105 border border-white/50 dark:border-gray-700/50"
          >
            <Home class="w-5 h-5 mr-2" />
            Accueil
          </router-link>
        </div>
        
        <!-- Fonctionnement technique du service -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h3 class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Search class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Fonctionnement technique du service
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Le service croise les données saisies avec la base nationale de l'ADEME pour identifier les correspondances possibles.
            <br><br>
            <strong class="text-green-600 dark:text-green-400">✓ Fiabilité optimale :</strong> Pour les DPE réalisés <strong>depuis juillet 2021</strong>, 
            le service offre une précision maximale grâce aux données complètes et géolocalisées.
            <br><br>
            <strong class="text-blue-600 dark:text-blue-400">ℹ️ DPE anciens :</strong> Le service peut également retrouver des DPE réalisés <strong>avant juillet 2021</strong>, 
            mais avec une fiabilité moindre car certaines données (géolocalisation, adresse précise) peuvent être manquantes. 
            Ces résultats sont signalés avec la mention "DPE Ancien".
            <br><br>
            <strong class="text-orange-600 dark:text-orange-400">⚠️ Note :</strong> Selon la réglementation, les DPE réalisés avant le 30 juin 2021 ne sont plus valables depuis le 1er janvier 2025.
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
            (Agence de la transition écologique). Ces données sont officielles, vérifiées et mises à jour régulièrement.
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
            Aucune donnée personnelle n'est collectée. Le service n'utilise pas de cookies de tracking.
            Les requêtes sont traitées de manière anonyme et votre historique de recherche est uniquement
            sauvegardé dans le cache de votre navigateur.
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
            • Les bibliothèques 
            <a href="https://www.fsf.org/fr" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline"><strong>Open Source</strong></a>
            utilisées dans ce projet (
            <a href="https://github.com/vuejs/core" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Vue.js</a>,
            <a href="https://github.com/tailwindlabs/tailwindcss" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Tailwind CSS</a>,
            <a href="https://github.com/vitejs/vite" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Vite</a>,
            <a href="https://github.com/lucide-icons/lucide" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Lucide</a>
            )
            <br>
            • L'<a href="https://www.ademe.fr/" target="_blank" rel="noopener noreferrer" class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent hover:from-red-400 hover:to-red-500 transition-colors">ADEME</a> pour la mise à disposition des données DPE
            <br>
            • <a href="https://www.data.gouv.fr/" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline"><strong>data</strong>gouv*</a>, la plateforme des données publiques françaises
          </p>
        </div>

      </div>

      <!-- Navigation -->
      <div class="mt-6 text-center">
        <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Fait avec <Heart class="inline w-3 h-3 text-red-500 mx-1" /> par des neurones artificiels
        </p>
        <router-link 
          to="/" 
          class="inline-flex items-center px-6 py-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium hover:scale-105 border border-white/50 dark:border-gray-700/50"
        >
          <Home class="w-5 h-5 mr-2" />
          Accueil
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import {
  AlertCircle,
  BookOpen,
  Clock,
  Database,
  Heart,
  HelpCircle,
  Home,
  Lock,
  MapPin,
  Maximize2,
  Search,
  Shield,
  Target,
  Zap
} from 'lucide-vue-next'

export default {
  name: 'Informations',
  components: {
    BookOpen,
    HelpCircle,
    MapPin,
    Maximize2,
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
