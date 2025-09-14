// Messages humoristiques façon "CSI: Miami" pour l'animation de loading
export const LOADING_MESSAGES = [
  'Triangulation par imagerie satellite avancée...',
  'Reconstruction 3D des flux convectifs...',
  'Calibrage des détecteurs quantiques...',
  'Synchronisation avec les données géothermiques...',
  'Interprétion des signatures thermiques...',
  'Validation des algorithmes de Deep Learning...',
  'Croisement avec les bases militaires classifiées...',
  "Consultation d'un joueur pro Geoguessr...",
  'Déchiffrement des codes cadastraux secrets...',
  'Analyse des ondes gravitationnelles locales...',
  'Détection des anomalies spatio-temporelles...',
  'Corrélation avec les données météorologiques NASA...',
  'Reconstruction holographique des bâtiments...',
  'Analyse topographique multi-dimensionnelle...',
  'Décryptage des signaux électromagnétiques...',
  'Validation par intelligence artificielle quantique...',
  'Triangulation par laser satellitaire...',
  'Reconstruction des modèles énergétiques 4D...',
  'Détection des signatures énergétiques uniques...',
  'Déchiffrement des codes thermiques ADN...',
  'Triangulation par écholocation ultrasonique...',
  'Déchiffrement des codes génétiques du bâtiment...',
  'Validation par superordinateur quantique...',
  'Analyse des micro-ondes cosmiques...',
  'Interrogation des pigeons voyageurs locaux...',
  'Consultation des archives secrètes du Vatican...',
  'Triangulation par échos de clocher...',
  'Analyse de Street View pour deviner la topographie...'
]

// Fonction pour obtenir un message aléatoire
export function getRandomLoadingMessage() {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
}

// Fonction pour obtenir une séquence de messages (pour affichage progressif)
export function getLoadingMessageSequence(count = 3) {
  const shuffled = [...LOADING_MESSAGES].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}
