<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Animation principale -->
    <div class="relative w-full max-w-4xl h-full flex flex-col items-center justify-start pt-8 px-8">
      

      <!-- Zone d'analyse moderne -->
      <div class="relative w-full max-w-7xl h-[750px] mb-8">
        <!-- Fond moderne -->
        <div class="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-gray-700 shadow-lg"></div>
        
        <!-- Barre de progression en haut -->
        <div class="absolute top-4 left-6 right-6">
          <div class="bg-slate-200 dark:bg-gray-600 rounded-full h-3 mb-3 overflow-hidden">
            <div 
              class="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
              :style="`width: ${progress}%`"
            ></div>
          </div>
          <div class="flex justify-between text-base text-slate-600 dark:text-gray-300">
            <div class="flex items-center space-x-3">
              <div class="w-3 h-3 bg-green-400 rounded-full"></div>
              <span class="font-medium">{{ progress }}% - {{ currentTechMessage }}</span>
            </div>
            <div class="font-semibold">{{ scannerStatus }}</div>
          </div>
        </div>

        <!-- Fond propre sans grille -->

        <!-- Zone de carte adaptée selon la région -->
        <svg class="absolute inset-0 w-full h-full" viewBox="0 0 800 600" ref="franceMap">
          <!-- France métropolitaine -->
          <CarteFrance 
            v-if="regionType === 'france'"
            :france-color="franceColor"
            :france-border-color="franceBorderColor"
          />
          
          <!-- Carte de la Corse -->
          <CarteCorse 
            v-else-if="regionType === 'corsica'"
            :corse-color="franceColor"
            :corse-border-color="franceBorderColor"
          />
          
          <!-- Carte du monde pour DOM-TOM -->
          <g v-else-if="regionType === 'domtom'">
            <CarteMonde 
              :world-color="franceColor"
              :world-border-color="franceBorderColor"
            />
            <text x="400" y="120" text-anchor="middle" class="text-lg font-bold fill-current text-gray-600 dark:text-gray-400">
              {{ getDomTomName() }}
            </text>
          </g>
          
          <!-- Système de scan orbital avancé -->
          <g v-if="showScanning">
            <!-- Radar de balayage circulaire moderne -->
            <g v-if="showRadarSweep">
              <circle :cx="412" :cy="340" :r="radarRadius - 1" 
                      fill="none" stroke="url(#blueGradient)" stroke-width="1.5" opacity="0.6" class="pulse-ring"/>
              <circle :cx="412" :cy="340" :r="(radarRadius - 1) * 0.7" 
                      fill="none" stroke="url(#blueGradient)" stroke-width="1" opacity="0.4" class="pulse-ring-delayed"/>
              <circle :cx="412" :cy="340" :r="(radarRadius - 1) * 0.4" 
                      fill="none" stroke="url(#blueGradient)" stroke-width="0.5" opacity="0.3" class="pulse-ring-delayed-2"/>
            </g>
            
            
            <!-- Zone de convergence énergétique -->
            <g v-if="showEnergyConvergence && targetCoords">
              <!-- Particules énergétiques convergentes -->
              <circle v-for="(particle, i) in energyParticles" :key="`particle-${i}`"
                      :cx="particle.x" :cy="particle.y" :r="particle.size"
                      :fill="particle.color" :opacity="particle.opacity"
                      class="energy-particle"/>
              
              <!-- Point de verrouillage central -->
              <circle :cx="targetCoords.x" :cy="targetCoords.y" r="8"
                      class="target-lock" fill="#ff0000" filter="url(#energyGlow)"/>
              
              <!-- Anneaux de convergence -->
              <circle v-for="ring in convergenceRings" :key="`ring-${ring.id}`"
                      :cx="targetCoords.x" :cy="targetCoords.y" :r="ring.radius"
                      fill="none" :stroke="ring.color" stroke-width="2"
                      :opacity="ring.opacity" class="convergence-ring"/>
                      
              <!-- Croix de visée avancée -->
              <g class="targeting-system">
                <line :x1="targetCoords.x - 30" :y1="targetCoords.y" 
                      :x2="targetCoords.x + 30" :y2="targetCoords.y"
                      stroke="#ff0000" stroke-width="2" stroke-dasharray="8,4"/>
                <line :x1="targetCoords.x" :y1="targetCoords.y - 30" 
                      :x2="targetCoords.x" :y2="targetCoords.y + 30"
                      stroke="#ff0000" stroke-width="2" stroke-dasharray="8,4"/>
                      
                <!-- Coins de verrouillage -->
                <rect :x="targetCoords.x - 25" :y="targetCoords.y - 25" 
                      width="12" height="12" fill="none" stroke="#ff0000" stroke-width="2"/>
                <rect :x="targetCoords.x + 13" :y="targetCoords.y - 25" 
                      width="12" height="12" fill="none" stroke="#ff0000" stroke-width="2"/>
                <rect :x="targetCoords.x - 25" :y="targetCoords.y + 13" 
                      width="12" height="12" fill="none" stroke="#ff0000" stroke-width="2"/>
                <rect :x="targetCoords.x + 13" :y="targetCoords.y + 13" 
                      width="12" height="12" fill="none" stroke="#ff0000" stroke-width="2"/>
              </g>
            </g>
          </g>
          
          <!-- Définition des filtres SVG avancés -->
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            <filter id="energyGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
              <feColorMatrix in="coloredBlur" type="matrix" 
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.5 0"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#00ff00" stop-opacity="0.8"/>
              <stop offset="70%" stop-color="#00ff00" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="#00ff00" stop-opacity="0"/>
            </radialGradient>
            
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.9"/>
              <stop offset="50%" stop-color="#8B5CF6" stop-opacity="0.8"/>
              <stop offset="100%" stop-color="#A855F7" stop-opacity="0.7"/>
            </linearGradient>
          </defs>
        </svg>

      </div>

    </div>
  </div>
</template>

<script>
import { MapPin, Search } from 'lucide-vue-next'
import { getDepartmentCoords, getDepartmentFromCommune } from '../../data/departements-france.js'
import { getLoadingMessageSequence } from '../../data/messages-chargement.js'
import CarteCorse from '../fonctionnalites/localisation/CarteCorse.vue'
import CarteFrance from '../fonctionnalites/localisation/CarteFrance.vue'
import CarteMonde from '../fonctionnalites/localisation/CarteMonde.vue'

export default {
  name: 'TriangulationAnimation',
  components: {
    Search,
    MapPin,
    CarteFrance,
    CarteMonde,
    CarteCorse
  },
  props: {
    commune: {
      type: String,
      required: true
    },
    coordinates: {
      type: Object,
      default: null
    },
    onComplete: {
      type: Function,
      required: true
    },
    isDataReady: {
      type: Boolean,
      default: false
    },
    waitingForResults: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      progress: 0,
      currentMessage: 'Initialisation du système orbital...',
      currentTechMessage: 'Connexion aux satellites...',
      scannerStatus: '',
      showScanning: true,
      showRadarSweep: true,
      showEnergyConvergence: false,
      targetDepartment: null,
      targetCoords: null,
      radarRadius: 285,
      radarAngle: 0,
      energyParticles: [],
      convergenceRings: [],
      franceColor: 'rgba(59, 130, 246, 0.15)',
      franceBorderColor: '#3B82F6',
      regionType: 'france', // 'france', 'corsica', or 'domtom'
      loadingMessages: [],
      messageIndex: 0,
      animationStep: 0,
      animationInterval: null,
      isLooping: false,
      loopStartTime: null
    }
  },
  watch: {
    isDataReady(newVal) {
      if (newVal) {
        if (this.isLooping) {
          // Les données sont prêtes, arrêter la boucle et terminer l'animation
          this.isLooping = false
          // Terminer l'animation à 100%
          this.progress = 100
          setTimeout(() => {
            this.stopContinuousAnimations()
            this.onComplete()
          }, 500)
        }
        // Si pas encore en boucle, le flux d'animation normal gérera la fin
      }
    }
  },
  mounted() {
    this.startAnimation()
  },

  beforeUnmount() {
    this.stopContinuousAnimations()
  },
  methods: {
    detectRegionType(department) {
      if (!department) return 'france'

      // Corse
      if (department === '2A' || department === '2B') {
        return 'corsica'
      }

      // DOM-TOM
      if (['971', '972', '973', '974', '976'].includes(department)) {
        return 'domtom'
      }

      return 'france'
    },

    startAnimation() {
      let lon, lat

      // Utiliser les coordonnées fournies si disponibles (pour les résultats DPE récents avec géocodage)
      if (this.coordinates?.lat && this.coordinates.lon) {
        lat = this.coordinates.lat
        lon = this.coordinates.lon
        // Essayer de déterminer le département à partir de l'adresse pour l'affichage
        const postalMatch = this.commune.match(/\b\d{5}\b/)
        if (postalMatch) {
          this.targetDepartment = postalMatch[0].substring(0, 2)
        } else {
          this.targetDepartment = getDepartmentFromCommune(this.commune)
        }
      } else {
        // Solution de repli vers des coordonnées basées sur le département pour une recherche normale
        this.targetDepartment = getDepartmentFromCommune(this.commune)
        if (!this.targetDepartment) {
          this.$emit('complete')
          return
        }
        const coords = getDepartmentCoords(this.targetDepartment)
        if (!coords) {
          this.$emit('complete')
          return
        }
        ;[lon, lat] = coords
      }

      // Détecter le type de région
      this.regionType = this.detectRegionType(this.targetDepartment)

      // Convertir les coordonnées géographiques vers l'espace SVG
      // France repositionnée: scale(1.0) + translate(150, 50) dans viewBox 800x600
      // Limites du chemin SVG : X de ~9 à ~500, Y de ~5 à ~505
      // Coordonnées réelles de la France : lon -5°O à 9°E, lat 42°N à 51°N

      // Mapper la longitude vers X
      const svgX = Math.round(150 + ((lon + 5.5) / 14) * 480)

      // Mapper la latitude vers Y - ajusté pour la France décalée à Y=80
      const svgY = Math.round(165 + ((51 - lat) / 9) * 400) // Ajusté pour position optimale

      this.targetCoords = this.adjustTargetCoordsForRegion(svgX, svgY)

      // Générer les messages techniques
      this.loadingMessages = getLoadingMessageSequence(8)

      // Démarrer l'animation progressive
      this.animateProgress()
    },

    adjustTargetCoordsForRegion(svgX, svgY) {
      // Garder les coordonnées continentales pour la carte de France ; centrer pour les espaces réservés Corse et DOM-TOM
      if (this.regionType === 'corsica' || this.regionType === 'domtom') {
        return { x: 412, y: 340 }
      }
      return { x: svgX, y: svgY }
    },

    async animateProgress() {
      const duration = 3000 // 3 secondes - animation plus rapide
      const steps = 60 // Étapes ajustées pour nouvelle durée
      const stepDuration = duration / steps

      // Démarrer les animations continues
      this.startContinuousAnimations()

      for (let i = 0; i <= steps; i++) {
        await new Promise(resolve => setTimeout(resolve, stepDuration))

        this.progress = Math.floor((i / steps) * 100)

        // Phase 2 : Analyse (10-45%)
        if (i === 6) {
          this.franceColor = 'rgba(99, 102, 241, 0.2)'
          this.franceBorderColor = '#6366F1'
        }

        // Phase 3 : Localisation (45-70%)
        if (i === 27) {
          this.franceColor = 'rgba(139, 92, 246, 0.25)'
          this.franceBorderColor = '#8B5CF6'
        }

        // Phase 4 : Convergence (70-90%)
        if (i === 42) {
          this.showEnergyConvergence = true
          this.generateEnergyParticles()
          this.generateConvergenceRings()
          this.franceColor = 'rgba(168, 85, 247, 0.3)'
          this.franceBorderColor = '#A855F7'
        }

        // Phase 5 : Final (90-100%)
        if (i === 54) {
          this.franceColor = 'rgba(16, 185, 129, 0.4)'
          this.franceBorderColor = '#10b981'
        }

        // Changer les messages techniques (plus lentement pour qu'on puisse les lire)
        if (i % 20 === 0 && this.messageIndex < this.loadingMessages.length) {
          this.currentTechMessage = this.loadingMessages[this.messageIndex]
          this.messageIndex++
        }
      }

      // Si les données ne sont pas prêtes et qu'on attend, boucler sur les dernières étapes
      if (!this.isDataReady && this.waitingForResults) {
        await this.loopFinalSteps()
        // Ne pas continuer jusqu'à la fin ici - laisser le watcher s'en occuper quand les données arrivent
        return
      }

      // Animation terminée si on n'attend pas de résultats
      setTimeout(() => {
        this.stopContinuousAnimations()
        this.onComplete()
      }, 500)
    },

    async loopFinalSteps() {
      this.isLooping = true
      this.loopStartTime = Date.now()
      const maxLoopDuration = 60000 // Maximum 60 secondes de boucle

      // Messages de boucle
      const loopMessages = [
        "Finalisation de l'analyse...",
        'Traitement des données...',
        'Vérification des résultats...',
        'Calibration finale...',
        'Synchronisation des données...',
        'Optimisation du signal...'
      ]

      let loopIndex = 0

      while (!this.isDataReady && this.isLooping) {
        // Vérifier le timeout
        if (Date.now() - this.loopStartTime > maxLoopDuration) {
          // Timeout atteint - forcer la fin
          this.isLooping = false
          this.progress = 100
          setTimeout(() => {
            this.stopContinuousAnimations()
            this.onComplete()
          }, 500)
          return
        }

        // Osciller le progrès entre 90% et 99%
        for (let p = 90; p <= 99; p++) {
          if (this.isDataReady || !this.isLooping) break

          this.progress = p
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        for (let p = 99; p >= 90; p--) {
          if (this.isDataReady || !this.isLooping) break

          this.progress = p
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        // Changer le message
        this.currentTechMessage = loopMessages[loopIndex % loopMessages.length]
        loopIndex++

        // Faire pulser les couleurs
        if (loopIndex % 2 === 0) {
          this.franceColor = 'rgba(217, 119, 6, 0.4)'
          this.franceBorderColor = '#d97706'
        } else {
          this.franceColor = 'rgba(16, 185, 129, 0.4)'
          this.franceBorderColor = '#10b981'
        }
      }

      // Finaliser à 100% seulement si on est encore en boucle
      if (this.isLooping) {
        this.progress = 100
      }
      this.isLooping = false
    },

    startContinuousAnimations() {
      this.animationInterval = setInterval(() => {
        // Animation des particules d'énergie
        if (this.showEnergyConvergence) {
          this.updateEnergyParticles()
          this.updateConvergenceRings()
        }
      }, 50)
    },

    stopContinuousAnimations() {
      if (this.animationInterval) {
        clearInterval(this.animationInterval)
        this.animationInterval = null
      }
    },

    generateEnergyParticles() {
      this.energyParticles = []
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2
        const distance = 150 + Math.random() * 200
        this.energyParticles.push({
          id: i,
          baseX: this.targetCoords.x + Math.cos(angle) * distance,
          baseY: this.targetCoords.y + Math.sin(angle) * distance,
          x: this.targetCoords.x + Math.cos(angle) * distance,
          y: this.targetCoords.y + Math.sin(angle) * distance,
          targetX: this.targetCoords.x,
          targetY: this.targetCoords.y,
          size: 2 + Math.random() * 3,
          color: ['#ff0000', '#ff4400', '#ffff00'][Math.floor(Math.random() * 3)],
          opacity: 0.8,
          speed: 0.02 + Math.random() * 0.03
        })
      }
    },

    updateEnergyParticles() {
      this.energyParticles.forEach(particle => {
        const dx = particle.targetX - particle.x
        const dy = particle.targetY - particle.y
        particle.x += dx * particle.speed
        particle.y += dy * particle.speed

        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < 10) {
          // Réinitialiser la particule
          const angle = Math.random() * Math.PI * 2
          const distance = 150 + Math.random() * 200
          particle.x = particle.targetX + Math.cos(angle) * distance
          particle.y = particle.targetY + Math.sin(angle) * distance
        }
      })
    },

    generateConvergenceRings() {
      this.convergenceRings = []
      for (let i = 0; i < 5; i++) {
        this.convergenceRings.push({
          id: i,
          radius: 15 + i * 10,
          color: ['#ff0000', '#ff4400', '#ffff00', '#00ff00', '#00ffff'][i],
          opacity: 0.8 - i * 0.15,
          pulsePhase: i * 0.5
        })
      }
    },

    updateConvergenceRings() {
      this.convergenceRings.forEach(ring => {
        ring.pulsePhase += 0.05
        ring.opacity = (0.8 - ring.id * 0.15) * (0.5 + 0.5 * Math.sin(ring.pulsePhase))
        ring.radius = (15 + ring.id * 10) * (1 + 0.1 * Math.sin(ring.pulsePhase * 2))
      })
    },

    formatCoords() {
      if (!this.targetCoords) return ''
      const coords = getDepartmentCoords(this.targetDepartment)
      if (!coords) return ''
      const [lon, lat] = coords
      return `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`
    },

    getDomTomName() {
      const names = {
        971: 'Guadeloupe',
        972: 'Martinique',
        973: 'Guyane',
        974: 'La Réunion',
        976: 'Mayotte'
      }
      return names[this.targetDepartment] || 'DOM-TOM'
    }
  }
}
</script>

<style scoped>
.matrix-bg {
  background: 
    linear-gradient(90deg, transparent 98%, rgba(0, 255, 0, 0.03) 100%),
    linear-gradient(0deg, transparent 98%, rgba(0, 255, 0, 0.03) 100%);
  background-size: 30px 30px;
  width: 100%;
  height: 100%;
  animation: matrix-scroll 20s linear infinite;
}

@keyframes matrix-scroll {
  0% { transform: translate(0, 0); }
  100% { transform: translate(30px, 30px); }
}

.scan-line {
  width: 2px;
  height: 100%;
  background: linear-gradient(to bottom, transparent, #00ff00, transparent);
  animation: scan 1.5s ease-in-out infinite;
}

@keyframes scan {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400px); }
}

/* Modern pulse animations for radar rings */
.pulse-ring {
  animation: pulse 2s ease-in-out infinite;
}

.pulse-ring-delayed {
  animation: pulse 2s ease-in-out infinite;
  animation-delay: 0.5s;
}

.pulse-ring-delayed-2 {
  animation: pulse 2s ease-in-out infinite;
  animation-delay: 1s;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.2;
    transform-origin: center;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

@keyframes animate-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.animate-blink {
  animation: animate-blink 1s infinite;
}

@keyframes animate-typing {
  0% { width: 0; }
  100% { width: 100%; }
}

.animate-typing {
  overflow: hidden;
  white-space: nowrap;
  animation: animate-typing 2s steps(40, end) infinite;
}

/* Animations sci-fi avancées */
.scan-overlay {
  animation: scan-sweep 2s ease-in-out infinite;
}

@keyframes scan-sweep {
  0%, 100% { opacity: 0.1; }
  50% { opacity: 0.3; }
}

/* Animation radar rotatif */
.radar-sweep {
  filter: drop-shadow(0 0 8px #00ff00);
}

/* Animation faisceaux laser */
.laser-beam {
  animation: laser-flicker 0.5s ease-in-out infinite alternate;
}

@keyframes laser-flicker {
  0% { opacity: 0.4; }
  100% { opacity: 1; }
}

/* Animation particules d'énergie */
.energy-particle {
  animation: particle-glow 1s ease-in-out infinite alternate;
}

@keyframes particle-glow {
  0% { filter: drop-shadow(0 0 3px currentColor); }
  100% { filter: drop-shadow(0 0 8px currentColor); }
}

/* Animation point de verrouillage */
.target-lock {
  animation: target-lock-pulse 0.8s ease-in-out infinite;
}

@keyframes target-lock-pulse {
  0%, 100% { 
    r: 6;
    filter: drop-shadow(0 0 10px #ff0000);
  }
  50% { 
    r: 10;
    filter: drop-shadow(0 0 20px #ff0000);
  }
}

/* Animation anneaux de convergence */
.convergence-ring {
  animation: ring-pulse 2s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%, 100% { stroke-width: 1; }
  50% { stroke-width: 3; }
}

/* Animation système de visée */
.targeting-system {
  animation: targeting-blink 1.5s ease-in-out infinite;
}

@keyframes targeting-blink {
  0%, 80% { opacity: 1; }
  90% { opacity: 0.3; }
  100% { opacity: 1; }
}
</style>
