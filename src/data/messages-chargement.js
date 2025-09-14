// Messages humoristiques façon "CSI: Miami" pour l'animation de loading
export const LOADING_MESSAGES = [
  'Analyse des cumulonimbus atmosphériques...',
  'Calcul de la densité volumique des particules...',
  'Triangulation par imagerie satellite avancée...',
  'Décodage des métadonnées énergétiques...',
  'Corrélation des coefficients thermodynamiques...',
  'Analyse spectrale des émissions infrarouges...',
  'Reconstruction 3D des flux convectifs...',
  'Calibrage des détecteurs quantiques...',
  'Synchronisation avec les données géothermiques...',
  'Interprétion des signatures thermiques...',
  'Validation des algorithmes de Deep Learning...',
  'Croisement avec les bases militaires classifiées...',
  'Déchiffrement des codes cadastraux secrets...',
  'Analyse des ondes gravitationnelles locales...',
  'Calcul des variables stochastiques complexes...',
  'Triangulation par résonance magnétique...',
  'Détection des anomalies spatio-temporelles...',
  'Analyse des flux quantiques énergétiques...',
  'Corrélation avec les données météorologiques NASA...',
  'Reconstruction holographique des bâtiments...',
  'Analyse topographique multi-dimensionnelle...',
  'Calibrage des senseurs atmosphériques...',
  'Décryptage des signaux électromagnétiques...',
  'Validation par intelligence artificielle quantique...',
  'Analyse des micro-variations climatiques...',
  'Triangulation par laser satellitaire...',
  'Corrélation des données géophysiques...',
  'Décodage des fréquences thermiques...',
  'Analyse des particules en suspension...',
  'Reconstruction des modèles énergétiques 4D...',
  'Calibrage des matrices de transformation...',
  'Synchronisation avec les réseaux quantiques...',
  'Analyse des gradients thermodynamiques...',
  'Détection des signatures énergétiques uniques...',
  'Triangulation par interférométrie avancée...',
  'Calcul des coefficients de dispersion...',
  'Analyse des ondes sismiques microscopiques...',
  'Corrélation avec les flux solaires...',
  'Déchiffrement des codes thermiques ADN...',
  'Validation par réseaux de neurones quantiques...',
  'Analyse des variations magnétiques locales...',
  'Reconstruction des champs énergétiques...',
  'Triangulation par écholocation ultrasonique...',
  'Calcul des invariants topologiques...',
  'Analyse spectrale des radiations naturelles...',
  'Corrélation avec les données géologiques...',
  'Décodage des signatures moléculaires...',
  'Validation par cryptographie quantique...',
  'Analyse des fluctuations atmosphériques...',
  'Reconstruction par tomographie énergétique...',
  'Triangulation par holographie laser...',
  'Calcul des harmoniques thermiques...',
  'Analyse des résonances cristallines...',
  'Corrélation avec les champs magnétiques terrestres...',
  'Déchiffrement des codes génétiques du bâtiment...',
  'Validation par superordinateur quantique...',
  'Analyse des micro-ondes cosmiques...',
  'Reconstruction des patterns énergétiques...',
  'Triangulation par diffraction X...',
  'Calcul des tenseurs de déformation...'
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
