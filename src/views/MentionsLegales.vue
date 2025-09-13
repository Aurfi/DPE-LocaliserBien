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
          <Scale class="w-10 h-10 text-blue-600 dark:text-blue-400 mr-3" />
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white">Mentions Légales</h1>
        </div>
        <p class="text-lg text-gray-600 dark:text-gray-400">
          Dernière mise à jour : Septembre 2025
        </p>
      </div>

      <!-- Contenu -->
      <div class="space-y-8">
        
        <!-- Éditeur du site -->
        <section class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h2 class="flex items-center text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Building class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Éditeur du site
          </h2>
          <div class="text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>Nom du service :</strong> {{ siteName }}</p>
            <p><strong>Directeur de la publication :</strong> <a :href="githubUrl" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">{{ directorName }}</a></p>
            <p><strong>Type de service :</strong> Plateforme de recherche de diagnostics de performance énergétique</p>
          </div>
        </section>

        <!-- Hébergement -->
        <section class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h2 class="flex items-center text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Server class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Hébergement
          </h2>
          <div class="text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>Hébergeur :</strong> {{ hostName }}</p>
            <p><strong>Siège social :</strong> {{ hostAddress }}</p>
          </div>
        </section>

        <!-- Sources des données -->
        <section class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h2 class="flex items-center text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Database class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Sources des données
          </h2>
          <div class="text-gray-600 dark:text-gray-400 space-y-4">
            <div>
              <p class="mb-2">
                <strong>Diagnostics de Performance Énergétique (DPE) :</strong> Données fournies par l'<a href="https://www.ademe.fr/" target="_blank" rel="noopener noreferrer" class="font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent hover:from-red-400 hover:to-red-500 transition-all">ADEME</a>.
              </p>
            </div>
            
            <p class="text-sm pt-2">
              <strong>Licence :</strong> Licence Ouverte v2.0 (Etalab) pour l'ensemble des données publiques
            </p>
          </div>
        </section>

        <!-- Propriété intellectuelle -->
        <section class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h2 class="flex items-center text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Copyright class="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
            Propriété intellectuelle
          </h2>
          <div class="text-gray-600 dark:text-gray-400 space-y-3">
            <p>
              <strong>Code source :</strong> Application développée avec des bibliothèques open source :
            </p>
            <ul class="list-disc list-inside space-y-1 ml-4 text-sm">
              <li>Vue.js (licence MIT)</li>
              <li>Tailwind CSS (licence MIT)</li>
              <li>Vite (licence MIT)</li>
              <li>Lucide Icons (licence ISC)</li>
              <li>SQLite3 (licence BSD-3-Clause)</li>
              <li>Biome (licence MIT/Apache-2.0)</li>
            </ul>
            <p class="mt-3">
              <strong>Cartes SVG :</strong> Les cartes géographiques utilisées dans les animations proviennent de 
              <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Wikimedia Commons</a> 
              et sont disponibles sous licences libres.
            </p>
            <p class="mt-3">
              <strong>Données :</strong> Toutes les données affichées proviennent de sources publiques 
              officielles et sont librement réutilisables selon leurs licences respectives.
            </p>
          </div>
        </section>

        <!-- Protection des données -->
        <section class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h2 class="flex items-center text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            <Shield class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Vie privée
          </h2>
          <div class="text-gray-600 dark:text-gray-400">
            <div class="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 dark:border-green-600 p-4 mb-4">
              <p class="text-green-800 dark:text-green-400 font-semibold mb-2">
                ✓ Aucune donnée personnelle collectée
              </p>
              <p class="text-sm text-green-700 dark:text-green-500">
                Ce service respecte intégralement votre vie privée. Pas de compte utilisateur, 
                pas de tracking, pas d'analyse comportementale.
              </p>
            </div>
            <p class="text-sm">
              Bien que n'en collectant aucune, le site s'engage à ce que le traitement d'éventuelles données 
              personnelles soit conforme au Règlement Général sur la Protection des Données (<a href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">RGPD</a>) et à la 
              <a href="https://www.cnil.fr/fr/le-cadre-national/la-loi-informatique-et-libertes" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">loi Informatique et Libertés</a>.
            </p>
          </div>
        </section>


        <!-- Conditions d'utilisation -->
        <section class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h2 class="flex items-center text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            <FileText class="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
            Conditions d'utilisation
          </h2>
          <div class="text-gray-600 dark:text-gray-400 space-y-3">
            <p class="mb-3">
              En utilisant ce service, vous acceptez :
            </p>
            <ul class="list-disc list-inside space-y-1 ml-4">
              <li>D'utiliser le service uniquement à des fins personnelles et légales</li>
              <li>De ne pas effectuer de requêtes automatisées excessives</li>
              <li>De ne pas tenter d'extraire massivement les données (elles sont disponibles directement sur 
                <a href="https://www.data.gouv.fr/" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">data.gouv.fr</a>)</li>
              <li>Que le service est fourni "tel quel" sans garantie</li>
            </ul>
          </div>
        </section>

        <!-- Responsabilité -->
        <section class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-white/50 dark:border-gray-700/50">
          <h2 class="flex items-center text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            <AlertTriangle class="w-5 h-5 mr-2 text-orange-500 dark:text-orange-400" />
            Limitation de responsabilité
          </h2>
          <div class="text-gray-600 dark:text-gray-400 space-y-3">
            <p>
              Les informations fournies par ce service sont à titre indicatif uniquement :
            </p>
            <ul class="list-disc list-inside space-y-1 ml-4">
              <li>Les données affichées proviennent de l'ADEME et peuvent contenir des inexactitudes</li>
              <li>Ce service ne constitue pas un diagnostic officiel</li>
              <li>La disponibilité du service n'est pas garantie</li>
              <li>L'éditeur décline toute responsabilité en cas d'erreur ou d'omission</li>
            </ul>
            
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 mt-4">
              <p class="text-sm text-yellow-800 dark:text-yellow-400">
                <AlertTriangle class="w-4 h-4 inline mr-1" />
                <strong>Important :</strong> Pour toute démarche officielle, consultez directement 
                les organismes compétents (ADEME, diagnostiqueurs certifiés, etc.).
              </p>
            </div>
          </div>
        </section>


      </div>

      <!-- Contact -->
      <section class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-xl p-6 mt-8 border border-white/50 dark:border-gray-700/50">
        <h2 class="flex items-center text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          <Mail class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          Contact
        </h2>
        <div class="text-gray-600 dark:text-gray-400">
          <p>
            Pour toute question concernant ces mentions légales, 
            vous pouvez nous <a :href="`mailto:${contactEmail}`" class="text-blue-600 dark:text-blue-400 hover:underline">contacter</a>.
          </p>
        </div>
      </section>

      <!-- Bottom navigation -->
      <div class="mt-6 text-center">
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
  AlertTriangle,
  Building,
  Copyright,
  Database,
  FileText,
  HelpCircle,
  Home,
  Mail,
  Scale,
  Server,
  Shield
} from 'lucide-vue-next'

export default {
  name: 'MentionsLegales',
  components: {
    Scale,
    Building,
    Server,
    Database,
    Copyright,
    Shield,
    AlertTriangle,
    FileText,
    Home,
    HelpCircle,
    Mail
  },
  computed: {
    siteName() {
      return import.meta.env.VITE_SITE_NAME || 'Site Name'
    },
    githubUrl() {
      return import.meta.env.VITE_GITHUB_URL || '#'
    },
    directorName() {
      return import.meta.env.VITE_DIRECTOR_NAME || 'Director'
    },
    contactEmail() {
      return import.meta.env.VITE_CONTACT_EMAIL || 'contact@example.com'
    },
    hostName() {
      return import.meta.env.VITE_HOST_NAME || 'Your Hosting Provider'
    },
    hostAddress() {
      return import.meta.env.VITE_HOST_ADDRESS || 'Hosting provider address'
    }
  }
}
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>
