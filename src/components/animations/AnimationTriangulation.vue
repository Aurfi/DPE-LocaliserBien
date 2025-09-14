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
          <div class="flex justify-center text-base text-slate-600 dark:text-gray-300">
            <div class="flex items-center space-x-3">
              <div class="w-3 h-3 bg-green-400 rounded-full"></div>
              <span class="font-medium min-w-[45px] text-right">{{ progress }}%</span>
              <span class="font-medium">{{ currentTechMessage }}</span>
            </div>
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
            
            
            <!-- Zone de convergence énergétique - Skip for DOM-TOM, limited for Corsica -->
            <g v-if="targetCoords && regionType !== 'domtom'">
              <!-- Particules énergétiques avec effets améliorés -->
              <g v-for="(particle, i) in energyParticles" :key="`particle-${i}`">
                <!-- Glow effect -->
                <circle :cx="particle.x" :cy="particle.y"
                        :r="particle.size * 2.5"
                        :fill="particle.color"
                        :opacity="particle.opacity * 0.2"
                        filter="blur(3px)"/>
                <!-- Outer ring -->
                <circle :cx="particle.x" :cy="particle.y"
                        :r="particle.size * 1.5"
                        :fill="particle.color"
                        :opacity="particle.opacity * 0.4"/>
                <!-- Core particle -->
                <circle :cx="particle.x" :cy="particle.y"
                        :r="particle.size"
                        fill="white"
                        :opacity="particle.opacity * 0.9"/>
                <!-- Inner color -->
                <circle :cx="particle.x" :cy="particle.y"
                        :r="particle.size * 0.7"
                        :fill="particle.color"
                        :opacity="particle.opacity"/>
              </g>

              <!-- Targeting effects only when convergence is active -->
              <g v-if="showEnergyConvergence">

                <!-- Modern 2025 Targeting System -->

                <!-- Dynamic energy rings -->
                <g v-for="(ring, idx) in convergenceRings" :key="`ring-${ring.id}`">
                  <circle :cx="targetCoords.x" :cy="targetCoords.y" :r="ring.radius"
                          fill="none" :stroke="ring.color" stroke-width="1.5"
                          :opacity="ring.opacity" class="convergence-ring">
                    <animate attributeName="r"
                             :values="`${ring.radius};${ring.radius + 10};${ring.radius}`"
                             dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="stroke-width"
                             values="1.5;0.5;1.5"
                             dur="2s" repeatCount="indefinite"/>
                  </circle>
                </g>

                <!-- Advanced HUD Targeting Interface -->
                <g class="targeting-hud" :opacity="visorOpacity">
                  <!-- Rotating scanner arcs -->
                  <g :transform="`translate(${targetCoords.x}, ${targetCoords.y}) rotate(${visorRotation})`">
                    <path d="M -35 0 A 35 35 0 0 1 0 -35"
                          fill="none" stroke="#6366F1" stroke-width="2" opacity="0.6"/>
                    <path d="M 35 0 A 35 35 0 0 1 0 35"
                          fill="none" stroke="#6366F1" stroke-width="2" opacity="0.6"/>
                  </g>

                  <g :transform="`translate(${targetCoords.x}, ${targetCoords.y}) rotate(${-visorRotation * 0.7})`">
                    <path d="M 0 -35 A 35 35 0 0 1 35 0"
                          fill="none" stroke="#6366F1" stroke-width="1.5" opacity="0.4"/>
                    <path d="M 0 35 A 35 35 0 0 1 -35 0"
                          fill="none" stroke="#6366F1" stroke-width="1.5" opacity="0.4"/>
                  </g>

                  <!-- Corner brackets with glow -->
                  <g class="corner-brackets">
                    <!-- Top-left -->
                    <path :d="`M ${targetCoords.x - 35} ${targetCoords.y - 25}
                              L ${targetCoords.x - 35} ${targetCoords.y - 35}
                              L ${targetCoords.x - 25} ${targetCoords.y - 35}`"
                          fill="none" stroke="#6366F1" stroke-width="2" stroke-linecap="round"/>
                    <!-- Top-right -->
                    <path :d="`M ${targetCoords.x + 25} ${targetCoords.y - 35}
                              L ${targetCoords.x + 35} ${targetCoords.y - 35}
                              L ${targetCoords.x + 35} ${targetCoords.y - 25}`"
                          fill="none" stroke="#6366F1" stroke-width="2" stroke-linecap="round"/>
                    <!-- Bottom-left -->
                    <path :d="`M ${targetCoords.x - 35} ${targetCoords.y + 25}
                              L ${targetCoords.x - 35} ${targetCoords.y + 35}
                              L ${targetCoords.x - 25} ${targetCoords.y + 35}`"
                          fill="none" stroke="#6366F1" stroke-width="2" stroke-linecap="round"/>
                    <!-- Bottom-right -->
                    <path :d="`M ${targetCoords.x + 25} ${targetCoords.y + 35}
                              L ${targetCoords.x + 35} ${targetCoords.y + 35}
                              L ${targetCoords.x + 35} ${targetCoords.y + 25}`"
                          fill="none" stroke="#6366F1" stroke-width="2" stroke-linecap="round"/>
                  </g>

                  <!-- Hexagonal targeting frame -->
                  <polygon :points="getHexagonPoints(targetCoords.x, targetCoords.y, 40)"
                           fill="none" stroke="rgba(0, 255, 255, 0.3)" stroke-width="1"
                           stroke-dasharray="5,5">
                    <animateTransform attributeName="transform"
                                      attributeType="XML"
                                      type="rotate"
                                      :values="`0 ${targetCoords.x} ${targetCoords.y};360 ${targetCoords.x} ${targetCoords.y}`"
                                      dur="20s"
                                      repeatCount="indefinite"/>
                  </polygon>

                  <!-- Data readout lines -->
                  <line :x1="targetCoords.x - 45" :y1="targetCoords.y"
                        :x2="targetCoords.x - 35" :y2="targetCoords.y"
                        stroke="#6366F1" stroke-width="1" opacity="0.8"/>
                  <line :x1="targetCoords.x + 35" :y1="targetCoords.y"
                        :x2="targetCoords.x + 45" :y2="targetCoords.y"
                        stroke="#6366F1" stroke-width="1" opacity="0.8"/>
                </g>
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
              <stop offset="100%" stop-color="#6366F1" stop-opacity="0.7"/>
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
import { departmentPositions } from '../../data/department-positions.js'
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
    },
    resultsCount: {
      type: Number,
      default: null
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
      particleIdCounter: 0,
      maxParticles: 35,
      particlesSpawned: 0,
      franceColor: 'rgba(59, 130, 246, 0.15)',
      franceBorderColor: '#3B82F6',
      regionType: 'france', // 'france', 'corsica', or 'domtom'
      loadingMessages: [],
      messageIndex: 0,
      animationStep: 0,
      animationInterval: null,
      isLooping: false,
      loopStartTime: null,
      visorRotation: 0,
      visorOpacity: 0
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
    // Delay animation start to reduce initial CPU spike
    this.$nextTick(() => {
      setTimeout(() => {
        this.startAnimation()
      }, 150) // Small delay to let the browser settle
    })
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

      // Utiliser les positions fixes des départements pour un meilleur alignement
      let svgX, svgY

      if (departmentPositions[this.targetDepartment]) {
        // Utiliser la position fixe si disponible
        const pos = departmentPositions[this.targetDepartment]
        svgX = pos.x
        svgY = pos.y
      } else {
        // Fallback sur l'ancienne formule si département non trouvé
        svgX = Math.round(150 + ((lon + 5.5) / 14) * 480)
        svgY = Math.round(165 + ((51 - lat) / 9) * 400)
      }

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
      const firstHalfDuration = 2000 // 2s pour la première moitié (0-50%)
      const secondHalfDuration = 1500 // 1.5s pour la seconde moitié (50-100%)
      const frameInterval = 16 // ~60fps

      // Small delay before starting animations to reduce CPU spike
      await new Promise(resolve => setTimeout(resolve, 100))

      // Démarrer les animations continues
      this.startContinuousAnimations()

      // Animation jusqu'à 50% d'abord (basée sur le temps réel)
      const startTime = Date.now()

      while (true) {
        const elapsed = Date.now() - startTime
        const progress = Math.min(50, (elapsed / firstHalfDuration) * 50)
        this.progress = Math.floor(progress)

        // Phases de couleur basées sur le progrès
        if (this.progress >= 10 && this.progress < 11) {
          this.franceColor = 'rgba(99, 102, 241, 0.2)'
          this.franceBorderColor = '#6366F1'
        }

        if (this.progress >= 35 && this.progress < 36) {
          this.franceColor = 'rgba(119, 97, 244, 0.22)'
          this.franceBorderColor = '#7761F3'
        }

        // Phase 1 : Generate particles when animation starts moving (1%) - Skip for DOM-TOM
        if (this.progress === 1 && !this.particlesGenerated && this.regionType !== 'domtom') {
          this.generateEnergyParticles()
          this.particlesGenerated = true
        }

        // Add new DPE data particles gradually until 50%
        if (this.progress % 3 === 0 && this.progress < 50 && this.regionType !== 'domtom' && this.progress > 3) {
          this.addNewParticle()
        }

        // Changer les messages techniques (minimum 2s par message)
        const elapsedSeconds = elapsed / 1000
        const messageIndex = Math.min(
          Math.floor(elapsedSeconds / 2), // 2 seconds per message
          Math.floor(this.progress / 20)
        )
        if (messageIndex < this.loadingMessages.length && messageIndex !== this.lastMessageIndex) {
          this.currentTechMessage = this.loadingMessages[messageIndex]
          this.lastMessageIndex = messageIndex
        }

        // Arrêter à 50%
        if (progress >= 50) {
          this.progress = 50
          break
        }

        await new Promise(resolve => setTimeout(resolve, frameInterval))
      }

      // Phase 3 : Localisation - Mid purple (55%)
      if (this.progress === 55) {
        this.franceColor = 'rgba(139, 92, 246, 0.25)'
        this.franceBorderColor = '#8B5CF6'
      }

      // À 50%, vérifier si on a des résultats
      if (this.isDataReady && this.resultsCount === 0) {
        // Aucun résultat - terminer l'animation immédiatement
        this.currentTechMessage = 'Aucun résultat trouvé'
        await new Promise(resolve => setTimeout(resolve, 500))
        this.stopContinuousAnimations()
        this.onComplete()
        return
      }

      // Si les données ne sont pas prêtes et qu'on attend
      if (!this.isDataReady && this.waitingForResults) {
        await this.loopFinalSteps()
        // Ne pas continuer jusqu'à la fin ici - laisser le watcher s'en occuper quand les données arrivent
        return
      }

      // Si les données sont prêtes avec des résultats OU qu'on n'attend pas de résultats, continuer de 50% à 100%
      await this.animateSecondHalf()

      // Animation terminée
      setTimeout(() => {
        this.stopContinuousAnimations()
        this.onComplete()
      }, 500)
    },

    async animateSecondHalf() {
      const secondHalfDuration = 1500 // 1.5s pour la seconde moitié
      const frameInterval = 16 // ~60fps
      const startTime = Date.now()

      while (true) {
        const elapsed = Date.now() - startTime
        const progress = Math.min(100, 50 + (elapsed / secondHalfDuration) * 50)
        this.progress = Math.floor(progress)

        // Phase 2 : Start showing convergence effects (visor) at 65% - only for mainland France
        if (this.progress === 65 && this.regionType === 'france' && !this.showEnergyConvergence) {
          this.showEnergyConvergence = true
          this.visorOpacity = 0.1
        }

        // Progressive visor fade-in from 65% to 78%
        if (this.regionType === 'france' && this.progress >= 65 && this.progress <= 78) {
          this.visorOpacity = Math.min(1, 0.1 + ((this.progress - 65) / 13) * 0.9)
        }

        // Phase 4 : Deeper purple (70%)
        if (this.progress === 70) {
          this.franceColor = 'rgba(153, 89, 247, 0.28)'
          this.franceBorderColor = '#9959F7'
          if (this.regionType === 'france' && !this.ringsGenerated) {
            this.generateConvergenceRings()
            this.ringsGenerated = true
          }
        }

        // Phase 4.6 : Final purple at 78%
        if (this.progress === 78) {
          this.franceColor = 'rgba(168, 85, 247, 0.3)'
          this.franceBorderColor = '#6366F1'
          if (this.regionType === 'france') {
            this.visorOpacity = 1
          }
        }

        // Phase 5 : Final (90-100%) - Keep purple for France/Corsica
        if (this.progress >= 90) {
          if (this.regionType === 'france' || this.regionType === 'corsica') {
            this.franceColor = 'rgba(168, 85, 247, 0.35)'
            this.franceBorderColor = '#6366F1'
          } else {
            this.franceColor = 'rgba(16, 185, 129, 0.4)'
            this.franceBorderColor = '#10b981'
          }
        }

        // Changer les messages techniques (minimum 2s par message)
        const elapsedSeconds = elapsed / 1000
        const messageIndex = Math.min(
          Math.floor(elapsedSeconds / 2) + 3, // Continue from message 3, 2s per message
          Math.floor((this.progress - 50) / 20) + 3
        )
        if (messageIndex < this.loadingMessages.length && messageIndex !== this.lastMessageIndex) {
          this.currentTechMessage = this.loadingMessages[messageIndex]
          this.lastMessageIndex = messageIndex
        }

        // Arrêter à 100%
        if (progress >= 100) {
          this.progress = 100
          break
        }

        await new Promise(resolve => setTimeout(resolve, frameInterval))
      }
    },

    async loopFinalSteps() {
      this.isLooping = true
      this.loopStartTime = Date.now()
      const maxLoopDuration = 60000 // Maximum 60 secondes de boucle

      // Messages de boucle
      const loopMessages = [
        'Analyse des données en cours...',
        'Traitement des résultats...',
        'Calcul des corrélations...',
        "Préparation de l'affichage...",
        'Synchronisation des données...',
        'Optimisation du signal...'
      ]

      let loopIndex = 0

      // Pause à 50% au lieu de boucler à 90-99%
      this.progress = 50
      this.currentTechMessage = loopMessages[0]

      // Faire revenir les particules en mode attente
      if (this.energyParticles.length > 0) {
        this.energyParticles.forEach(particle => {
          particle.waitingMode = true
        })
      }

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

        // Rester à 50% mais changer le message périodiquement
        if (loopIndex % 40 === 0) {
          // Changer le message toutes les 2 secondes environ
          this.currentTechMessage = loopMessages[Math.floor(loopIndex / 40) % loopMessages.length]
        }
        loopIndex++

        // Faire pulser doucement la couleur de la France
        const pulse = Math.sin(loopIndex * 0.05) * 0.1 + 0.25
        this.franceColor = `rgba(139, 92, 246, ${pulse})`

        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Quand les données arrivent, vérifier si on a des résultats
      if (this.isDataReady && this.isLooping) {
        this.isLooping = false

        // Si aucun résultat, terminer immédiatement
        if (this.resultsCount === 0) {
          this.currentTechMessage = 'Aucun résultat trouvé'
          await new Promise(resolve => setTimeout(resolve, 500))
          this.stopContinuousAnimations()
          this.onComplete()
          return
        }

        // Réactiver le mouvement normal des particules
        if (this.energyParticles.length > 0) {
          this.energyParticles.forEach(particle => {
            particle.waitingMode = false
          })
        }

        // Continuer avec la seconde moitié de l'animation
        await this.animateSecondHalf()

        // Animation terminée
        setTimeout(() => {
          this.stopContinuousAnimations()
          this.onComplete()
        }, 500)
        return
      }
      this.isLooping = false
    },

    startContinuousAnimations() {
      this.animationInterval = setInterval(() => {
        // Always update particles if they exist - Skip for DOM-TOM only
        if (this.energyParticles.length > 0 && this.regionType !== 'domtom') {
          this.updateEnergyParticles()
        }
        // Only update convergence rings when energy convergence is active
        if (this.showEnergyConvergence && this.regionType === 'france') {
          this.updateConvergenceRings()
          this.updateVisor()
        }
      }, 33)
    },

    stopContinuousAnimations() {
      if (this.animationInterval) {
        clearInterval(this.animationInterval)
        this.animationInterval = null
      }
    },

    generateEnergyParticles() {
      this.energyParticles = []
      this.particleIdCounter = 0
      this.particlesSpawned = 0
      // Start with even fewer DPE data points - 5 initially
      for (let i = 0; i < 5; i++) {
        this.addNewParticle()
      }
    },

    addNewParticle() {
      if (this.particlesSpawned >= this.maxParticles) {
        return // Don't spawn more particles if we've reached the limit
      }

      const position = this.getRandomPositionInMap()
      // Add some randomness to target position within credible radius of department
      const randomOffset = {
        x: (Math.random() - 0.5) * 30, // ±15 pixel radius
        y: (Math.random() - 0.5) * 30 // ±15 pixel radius
      }
      // DPE color distribution: red (3/6), yellow (2/6), green (1/6) - green is rare
      const colorRandom = Math.random()
      let particleColor
      if (colorRandom < 0.5) {
        particleColor = '#ff0000' // Red - 50% (3/6)
      } else if (colorRandom < 0.833) {
        particleColor = '#ffff00' // Yellow - 33.3% (2/6)
      } else {
        particleColor = '#00ff00' // Green - 16.7% (1/6)
      }

      this.energyParticles.push({
        id: this.particleIdCounter++,
        x: position.x,
        y: position.y,
        targetX: this.targetCoords.x + randomOffset.x,
        targetY: this.targetCoords.y + randomOffset.y,
        size: 2 + Math.random() * 3,
        color: particleColor,
        opacity: 0.8,
        erraticTime: Math.random() * Math.PI * 2
      })
      this.particlesSpawned++
    },

    getRandomPositionInMap() {
      if (this.regionType === 'corsica') {
        // Corsica departments: 2A and 2B with proper map coverage
        const corsicaDepts = ['2A', '2B']
        const randomDept = corsicaDepts[Math.floor(Math.random() * corsicaDepts.length)]
        const coords = getDepartmentCoords(randomDept)
        if (coords) {
          // For Corsica, use the full displayed map area (centered around 412, 340)
          return {
            x: 350 + Math.random() * 124, // Full Corsica map width
            y: 250 + Math.random() * 180 // Full Corsica map height
          }
        }
        // Fallback to center of Corsica map
        return {
          x: 400 + (Math.random() - 0.5) * 80,
          y: 340 + (Math.random() - 0.5) * 60
        }
      } else {
        // France mainland - use random department coordinates
        const departments = [
          '01',
          '02',
          '03',
          '04',
          '05',
          '06',
          '07',
          '08',
          '09',
          '10',
          '11',
          '12',
          '13',
          '14',
          '15',
          '16',
          '17',
          '18',
          '19',
          '21',
          '22',
          '23',
          '24',
          '25',
          '26',
          '27',
          '28',
          '29',
          '30',
          '31',
          '32',
          '33',
          '34',
          '35',
          '36',
          '37',
          '38',
          '39',
          '40',
          '41',
          '42',
          '43',
          '44',
          '45',
          '46',
          '47',
          '48',
          '49',
          '50',
          '51',
          '52',
          '53',
          '54',
          '55',
          '56',
          '57',
          '58',
          '59',
          '60',
          '61',
          '62',
          '63',
          '64',
          '65',
          '66',
          '67',
          '68',
          '69',
          '70',
          '71',
          '72',
          '73',
          '74',
          '75',
          '76',
          '77',
          '78',
          '79',
          '80',
          '81',
          '82',
          '83',
          '84',
          '85',
          '86',
          '87',
          '88',
          '89',
          '90',
          '91',
          '92',
          '93',
          '94',
          '95'
        ]
        const randomDept = departments[Math.floor(Math.random() * departments.length)]

        // Use fixed positions if available
        if (departmentPositions[randomDept]) {
          const pos = departmentPositions[randomDept]
          const svgX = pos.x + (Math.random() - 0.5) * 40
          const svgY = pos.y + (Math.random() - 0.5) * 40
          return { x: Math.max(150, Math.min(650, svgX)), y: Math.max(100, Math.min(520, svgY)) }
        }

        // Fallback to formula if position not found
        const coords = getDepartmentCoords(randomDept)
        if (coords) {
          const [lon, lat] = coords
          const svgX = Math.round(150 + ((lon + 5.5) / 14) * 480) + (Math.random() - 0.5) * 40
          const svgY = Math.round(165 + ((51 - lat) / 9) * 400) + (Math.random() - 0.5) * 40
          return { x: Math.max(150, Math.min(650, svgX)), y: Math.max(100, Math.min(520, svgY)) }
        }
        // Fallback to random position in France area
        return {
          x: 200 + Math.random() * 300,
          y: 150 + Math.random() * 300
        }
      }
    },

    updateEnergyParticles() {
      this.energyParticles.forEach(particle => {
        // Mouvement erratique jusqu'à 35% OU si en mode attente à 50%
        if (this.progress < 35 || particle.waitingMode) {
          // Slower erratic movement (encore plus lent en mode attente)
          particle.erraticTime += particle.waitingMode ? 0.04 : 0.08
          const movementScale = particle.waitingMode ? 0.7 : 1.5
          particle.x += Math.cos(particle.erraticTime) * movementScale
          particle.y += Math.sin(particle.erraticTime * 1.5) * movementScale
        } else if (this.progress < 75) {
          // 35-75%: Accelerating movement toward target
          const accelerationFactor = (this.progress - 35) / 40 // 0 to 1 over 35-75%
          const speed = 0.003 + accelerationFactor * 0.057 // 0.3% to 6% speed (slower acceleration)
          const dx = particle.targetX - particle.x
          const dy = particle.targetY - particle.y
          particle.x += dx * speed
          particle.y += dy * speed
        } else {
          // 75%+: Very fast movement toward target
          const dx = particle.targetX - particle.x
          const dy = particle.targetY - particle.y
          particle.x += dx * 0.08
          particle.y += dy * 0.08
        }

        // Handle particles near target
        const distance = Math.sqrt((particle.targetX - particle.x) ** 2 + (particle.targetY - particle.y) ** 2)
        if (distance < 3) {
          // Mark particle for removal when very close
          particle.shouldRemove = true
        } else if (distance < 15 && this.progress < 80) {
          // Reset particles that get too close during early phases (stop after 80%)
          const pos = this.getRandomPositionInMap()
          particle.x = pos.x
          particle.y = pos.y
        }
      })

      // Remove particles that reached the target
      this.energyParticles = this.energyParticles.filter(particle => !particle.shouldRemove)
    },

    activateErraticMovement() {
      // Activate erratic movement for all particles at 15%
      this.energyParticles.forEach(particle => {
        particle.isMoving = true
        particle.isErratic = true
      })
    },

    activateTargetingMovement() {
      // Activate targeting movement for all particles at 30%
      this.energyParticles.forEach(particle => {
        particle.isTargeting = true
        particle.currentSpeed = particle.baseSpeed
      })
    },

    generateConvergenceRings() {
      this.convergenceRings = []
      for (let i = 0; i < 5; i++) {
        this.convergenceRings.push({
          id: i,
          radius: 15 + i * 10,
          color: '#6366F1', // Monochromatic purple
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
    },

    updateVisor() {
      // Rotate the visor elements
      this.visorRotation += 2

      // Fade in the visor when energy convergence becomes active
      if (this.showEnergyConvergence && this.visorOpacity < 1) {
        this.visorOpacity = Math.min(1, this.visorOpacity + 0.05)
      }
    },

    getHexagonPoints(cx, cy, radius) {
      const points = []
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const x = cx + radius * Math.cos(angle)
        const y = cy + radius * Math.sin(angle)
        points.push(`${x},${y}`)
      }
      return points.join(' ')
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
