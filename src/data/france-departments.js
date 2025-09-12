// Coordonnées réelles des départements français pour la triangulation
// Format: [longitude, latitude] en coordonnées géographiques réelles
export const DEPARTMENTS_COORDS = {
  // Auvergne-Rhône-Alpes
  '01': [5.2281, 46.2044], // Ain
  '03': [3.3417, 46.3406], // Allier
  '07': [4.36, 44.73], // Ardèche
  15: [2.4492, 45.0377], // Cantal
  26: [5.05, 44.7333], // Drôme
  38: [5.7167, 45.1667], // Isère
  42: [4.3872, 45.4397], // Loire
  43: [3.8833, 45.05], // Haute-Loire
  63: [3.0833, 45.7667], // Puy-de-Dôme
  69: [4.8357, 45.764], // Rhône
  73: [6.1167, 45.5333], // Savoie
  74: [6.1292, 46.0747], // Haute-Savoie

  // Nouvelle-Aquitaine
  16: [0.15, 45.65], // Charente
  17: [-0.75, 45.75], // Charente-Maritime
  19: [1.7667, 45.2667], // Corrèze
  23: [1.8667, 46.1667], // Creuse
  24: [0.7167, 45.1833], // Dordogne
  33: [-0.5667, 44.8333], // Gironde
  40: [-0.7667, 44.0], // Landes
  47: [0.6333, 44.2], // Lot-et-Garonne
  64: [-0.6833, 43.3], // Pyrénées-Atlantiques
  79: [-0.4667, 46.3167], // Deux-Sèvres
  86: [0.3333, 46.5667], // Vienne
  87: [1.2667, 45.8333], // Haute-Vienne

  // Occitanie
  '09': [1.6, 43.0], // Ariège
  11: [2.35, 43.2167], // Aude
  12: [2.5667, 44.35], // Aveyron
  30: [4.3667, 44.1167], // Gard
  31: [1.4333, 43.6], // Haute-Garonne
  32: [0.5833, 43.65], // Gers
  34: [3.8667, 43.6167], // Hérault
  46: [1.4333, 44.45], // Lot
  48: [3.5, 44.5167], // Lozère
  65: [0.1, 43.2333], // Hautes-Pyrénées
  66: [2.8833, 42.7], // Pyrénées-Orientales
  81: [2.15, 43.9333], // Tarn
  82: [1.3667, 44.0167], // Tarn-et-Garonne

  // Grand Est
  '08': [4.7167, 49.7667], // Ardennes
  10: [4.0667, 48.3], // Aube
  51: [4.0333, 49.25], // Marne
  52: [5.15, 48.1167], // Haute-Marne
  54: [6.1833, 48.7], // Meurthe-et-Moselle
  55: [5.3667, 49.1167], // Meuse
  57: [6.1667, 49.1167], // Moselle
  67: [7.75, 48.5833], // Bas-Rhin
  68: [7.3333, 47.75], // Haut-Rhin
  88: [6.45, 48.1667], // Vosges

  // Hauts-de-France
  '02': [3.6167, 49.5667], // Aisne
  59: [3.0667, 50.6333], // Nord
  60: [2.4167, 49.4167], // Oise
  62: [2.7833, 50.4167], // Pas-de-Calais
  80: [2.3, 49.8833], // Somme

  // Île-de-France
  75: [2.3522, 48.8566], // Paris
  77: [2.65, 48.5333], // Seine-et-Marne
  78: [2.0333, 48.8], // Yvelines
  91: [2.3167, 48.6333], // Essonne
  92: [2.25, 48.8167], // Hauts-de-Seine
  93: [2.5167, 48.9], // Seine-Saint-Denis
  94: [2.4667, 48.7833], // Val-de-Marne
  95: [2.25, 49.0333], // Val-d'Oise

  // Centre-Val de Loire
  18: [2.3833, 47.0833], // Cher
  28: [1.5, 48.45], // Eure-et-Loir
  36: [1.6833, 46.8167], // Indre
  37: [0.6833, 47.3833], // Indre-et-Loire
  41: [1.3333, 47.5833], // Loir-et-Cher
  45: [2.7667, 47.9], // Loiret

  // Bourgogne-Franche-Comté
  21: [5.0167, 47.3167], // Côte-d'Or
  25: [6.0333, 47.25], // Doubs
  39: [5.7667, 46.6667], // Jura
  58: [3.1667, 47.2167], // Nièvre
  70: [6.15, 47.6333], // Haute-Saône
  71: [4.8333, 46.7667], // Saône-et-Loire
  89: [3.5667, 47.8], // Yonne
  90: [6.8667, 47.6333], // Territoire de Belfort

  // Normandie
  14: [-0.3667, 49.1833], // Calvados
  27: [0.7333, 49.0167], // Eure
  50: [-1.0833, 49.1167], // Manche
  61: [0.0833, 48.7333], // Orne
  76: [1.0833, 49.5], // Seine-Maritime

  // Pays de la Loire
  44: [-1.5667, 47.2167], // Loire-Atlantique
  49: [-0.55, 47.4667], // Maine-et-Loire
  53: [-0.7667, 48.0667], // Mayenne
  72: [0.2, 48.0], // Sarthe
  85: [-1.4333, 46.6667], // Vendée

  // Bretagne
  22: [-2.7833, 48.5167], // Côtes-d'Armor
  29: [-4.0967, 48.1967], // Finistère
  35: [-1.6833, 48.1167], // Ille-et-Vilaine
  56: [-2.75, 47.75], // Morbihan

  // Provence-Alpes-Côte d'Azur
  '04': [6.2333, 44.0833], // Alpes-de-Haute-Provence
  '05': [6.0833, 44.5667], // Hautes-Alpes
  '06': [7.2667, 43.7], // Alpes-Maritimes
  13: [5.5, 43.5333], // Bouches-du-Rhône
  83: [6.1333, 43.4667], // Var
  84: [5.25, 44.05], // Vaucluse

  // Corse
  '2A': [8.7167, 41.9167], // Corse-du-Sud
  '2B': [9.15, 42.4], // Haute-Corse

  // DOM-TOM (coordonnées approximatives pour l'animation)
  971: [-61.5833, 16.25], // Guadeloupe
  972: [-61.0167, 14.6667], // Martinique
  973: [-53.1667, 3.9333], // Guyane
  974: [55.5333, -21.1167], // La Réunion
  976: [45.1667, -12.8333] // Mayotte
}

// Fonction pour extraire le département d'un code postal
export function getDepartmentFromPostalCode(postalCode) {
  if (!postalCode || postalCode.length < 2) return null

  // Cas spéciaux Corse
  if (postalCode.startsWith('200') || postalCode.startsWith('201')) return '2A'
  if (postalCode.startsWith('202') || postalCode.startsWith('206')) return '2B'

  // DOM-TOM
  if (postalCode.startsWith('971')) return '971' // Guadeloupe
  if (postalCode.startsWith('972')) return '972' // Martinique
  if (postalCode.startsWith('973')) return '973' // Guyane
  if (postalCode.startsWith('974')) return '974' // La Réunion
  if (postalCode.startsWith('976')) return '976' // Mayotte

  // Départements métropolitains
  const dept = postalCode.substring(0, 2)

  // Cas spécial Paris et petite couronne
  if (dept === '75') return '75' // Paris
  if (['92', '93', '94'].includes(dept)) return dept

  return dept
}

// Fonction pour obtenir les coordonnées d'un département
export function getDepartmentCoords(department) {
  return DEPARTMENTS_COORDS[department] || null // No default - return null if not found
}

// Fonction pour résoudre commune → département
export function getDepartmentFromCommune(commune) {
  // Si c'est déjà un code postal
  if (/^\d{5}$/.test(commune)) {
    return getDepartmentFromPostalCode(commune)
  }

  // Dictionnaire des principales villes vers départements
  const MAIN_CITIES = {
    // Grandes villes
    paris: '75',
    marseille: '13',
    lyon: '69',
    toulouse: '31',
    nice: '06',
    nantes: '44',
    montpellier: '34',
    strasbourg: '67',
    bordeaux: '33',
    lille: '59',
    rennes: '35',
    reims: '51',
    'saint-étienne': '42',
    'saint-etienne': '42',
    toulon: '83',
    grenoble: '38',
    dijon: '21',
    angers: '49',
    nîmes: '30',
    nimes: '30',
    villeurbanne: '69',
    'clermont-ferrand': '63',
    'aix-en-provence': '13',
    aix: '13',
    brest: '29',
    tours: '37',
    amiens: '80',
    limoges: '87',
    annecy: '74',
    perpignan: '66',
    besançon: '25',
    besancon: '25',
    metz: '57',
    orléans: '45',
    orleans: '45',
    rouen: '76',
    mulhouse: '68',
    caen: '14',
    nancy: '54',
    argenteuil: '95',
    'saint-denis': '93',
    roubaix: '59',
    tourcoing: '59',
    avignon: '84',
    carpentras: '84',
    cavaillon: '84',
    pertuis: '84',
    orange: '84',
    sorgues: '84',
    'isle-sur-la-sorgue': '84',
    'lisle-sur-la-sorgue': '84',
    'l-isle-sur-la-sorgue': '84',
    apt: '84',
    bollene: '84',
    bollène: '84',
    'vaison-la-romaine': '84',
    vaison: '84',
    monteux: '84',
    pernes: '84',
    'pernes-les-fontaines': '84',
    vedene: '84',
    vedène: '84',
    'le-pontet': '84',
    morières: '84',
    'morières-lès-avignon': '84',
    'morieres-les-avignon': '84',
    cucuron: '84',
    ansouis: '84',
    cadenet: '84',
    lauris: '84',
    lourmarin: '84',
    merindol: '84',
    mérindol: '84',
    villelaure: '84',
    'la-tour-daigues': '84',
    'la-tour-d-aigues': '84',
    gordes: '84',
    roussillon: '84',
    menerbes: '84',
    ménerbes: '84',
    oppede: '84',
    oppède: '84',
    robion: '84',
    maubec: '84',
    cabrieres: '84',
    cabrières: '84',
    'cabrieres-davignon': '84',
    'cabrières-d-avignon': '84',
    poitiers: '86',
    dunkerque: '59',
    'aulnay-sous-bois': '93',
    aubervilliers: '93',
    colombes: '92',
    versailles: '78',
    cherbourg: '50',
    'saint-pierre': '974',
    'fort-de-france': '972',
    'pointe-à-pitre': '971',
    cayenne: '973',
    // Grandes villes manquantes
    'le-havre': '76',
    'le-mans': '72',
    'aix-les-bains': '73',
    'saint-etienne-du-rouvray': '76',
    'saint-étienne-du-rouvray': '76',
    sotteville: '76',
    'sotteville-les-rouen': '76',
    'sotteville-lès-rouen': '76',
    'mont-saint-aignan': '76',
    'grand-quevilly': '76',
    'petit-quevilly': '76',
    cholet: '49',
    'la-baule': '44',
    'saint-herblain': '44',
    reze: '44',
    rezé: '44',
    'saint-sebastien': '44',
    'saint-sébastien-sur-loire': '44',
    vertou: '44',
    orvault: '44',
    coueron: '44',
    couëron: '44',
    carquefou: '44',
    bouguenais: '44',
    'sainte-luce': '44',
    'sainte-luce-sur-loire': '44',
    'la-chapelle-sur-erdre': '44',
    'basse-goulaine': '44',
    'les-sorinieres': '44',
    'les-sorinières': '44',
    'saint-jean-de-monts': '85',
    'les-sables-dolonne': '85',
    'les-sables-d-olonne': '85',
    challans: '85',
    'fontenay-le-comte': '85',
    lucon: '85',
    luçon: '85',
    montaigu: '85',
    // Villes moyennes supplémentaires
    pau: '64',
    'la-rochelle': '17',
    calais: '62',
    beziers: '34',
    béziers: '34',
    arles: '13',
    martigues: '13',
    'la-ciotat': '13',
    salon: '13',
    'salon-de-provence': '13',
    istres: '13',
    marignane: '13',
    miramas: '13',
    gardanne: '13',
    'les-pennes-mirabeau': '13',
    'les-pennes': '13',
    vitrolles: '13',
    rognac: '13',
    septemes: '13',
    'septemes-les-vallons': '13',
    'septèmes-les-vallons': '13',
    allauch: '13',
    'plan-de-cuques': '13',
    'la-penne-sur-huveaune': '13',
    'port-de-bouc': '13',
    fos: '13',
    'fos-sur-mer': '13',
    chateaurenard: '13',
    châteaurenard: '13',
    tarascon: '13',
    'saint-remy': '13',
    'saint-rémy': '13',
    'saint-remy-de-provence': '13',
    'saint-rémy-de-provence': '13',
    trets: '13',
    bouc: '13',
    'bouc-bel-air': '13',
    cabries: '13',
    cabrìes: '13',
    eguilles: '13',
    éguilles: '13',
    lambesc: '13',
    pelissanne: '13',
    pélissanne: '13',
    venelles: '13',
    velaux: '13',
    berre: '13',
    'berre-letang': '13',
    'berre-l-etang': '13',
    'berre-l-étang': '13',
    gignac: '13',
    'gignac-la-nerthe': '13',
    'chateauneuf-les-martigues': '13',
    'châteauneuf-les-martigues': '13',
    sausset: '13',
    'sausset-les-pins': '13',
    'carry-le-rouet': '13',
    ensues: '13',
    'ensues-la-redonne': '13',
    'ensuès-la-redonne': '13',
    cassis: '13',
    gemenos: '13',
    gémenos: '13',
    carnoux: '13',
    'carnoux-en-provence': '13',
    roquefort: '13',
    'roquefort-la-bedoule': '13',
    'roquefort-la-bédoule': '13',
    aubagne: '13',
    auriol: '13',
    'la-destrousse': '13',
    peypin: '13',
    roquevaire: '13',
    'saint-martin-de-crau': '13',
    eyguieres: '13',
    eyguières: '13',
    orgon: '13',
    'saint-andiol': '13',
    noves: '13',
    mallemort: '13',
    'saint-cannat': '13',
    rognes: '13',
    'la-roque-d-antheron': '13',
    'la-roque-dantheron': '13',
    'la-roque-d-anthéron': '13',
    puyricard: '13',
    jouques: '13',
    meyrargues: '13',
    peyrolles: '13',
    'peyrolles-en-provence': '13',
    bourges: '18',
    'la-roche-sur-yon': '85',
    niort: '79',
    belfort: '90',
    quimper: '29',
    vannes: '56',
    lorient: '56',
    lanester: '56',
    hennebont: '56',
    pontivy: '56',
    auray: '56',
    ploemeur: '56',
    morlaix: '29',
    concarneau: '29',
    douarnenez: '29',
    landerneau: '29',
    guipavas: '29',
    plougastel: '29',
    'plougastel-daoulas': '29',
    dinan: '22',
    lannion: '22',
    ploufragan: '22',
    lamballe: '22',
    guingamp: '22',
    paimpol: '22',
    perros: '22',
    'perros-guirec': '22',
    fougeres: '35',
    fougères: '35',
    vitre: '35',
    vitré: '35',
    cesson: '35',
    'cesson-sevigne': '35',
    'cesson-sévigné': '35',
    bruz: '35',
    'saint-gregoire': '35',
    'saint-grégoire': '35',
    betton: '35',
    chantepie: '35',
    pace: '35',
    pacé: '35',
    redon: '35',
    dinard: '35',
    troyes: '10',
    charleville: '08',
    'charleville-mézières': '08',
    'charleville-mezieres': '08',
    laval: '53',
    evreux: '27',
    évreux: '27',
    hyeres: '83',
    hyères: '83',
    'saint-nazaire': '44',
    colmar: '68',
    chambery: '73',
    chambéry: '73',
    chalon: '71',
    'chalon-sur-saône': '71',
    'chalon-sur-saone': '71',
    auxerre: '89',
    brive: '19',
    'brive-la-gaillarde': '19',
    carcassonne: '11',
    tarbes: '65',
    albi: '81',
    blois: '41',
    'saint-brieuc': '22',
    'châlons-en-champagne': '51',
    'chalons-en-champagne': '51',
    'saint-malo': '35',
    sete: '34',
    sète: '34',
    valenciennes: '59',
    angouleme: '16',
    angoulême: '16',
    boulogne: '92',
    'boulogne-billancourt': '92',
    drancy: '93',
    cergy: '95',
    'cergy-pontoise': '95',
    'saint-quentin': '02',
    noisy: '93',
    'noisy-le-grand': '93',
    sarcelles: '95',
    pessac: '33',
    merignac: '33',
    mérignac: '33',
    // Villes de la région toulousaine
    cugnaux: '31',
    colomiers: '31',
    tournefeuille: '31',
    blagnac: '31',
    muret: '31',
    balma: '31',
    ramonville: '31',
    'ramonville-saint-agne': '31',
    labege: '31',
    labège: '31',
    castanet: '31',
    'castanet-tolosan': '31',
    // Autres villes connues
    cannes: '06',
    antibes: '06',
    grasse: '06',
    menton: '06',
    frejus: '83',
    fréjus: '83',
    draguignan: '83',
    ajaccio: '2A',
    bastia: '2B',
    bayonne: '64',
    biarritz: '64',
    agen: '47',
    montauban: '82',
    rodez: '12',
    auch: '32',
    cahors: '46',
    foix: '09',
    pamiers: '09',
    castres: '81',
    mazamet: '81',
    millau: '12',
    vichy: '03',
    moulins: '03',
    nevers: '58',
    macon: '71',
    mâcon: '71',
    bourg: '01',
    'bourg-en-bresse': '01',
    valence: '26',
    montélimar: '26',
    montelimar: '26',
    gap: '05',
    digne: '04',
    'digne-les-bains': '04',
    briancon: '05',
    briançon: '05'
  }

  const normalized = commune
    .toLowerCase()
    .replace(/[àáâäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôöø]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[-\s]/g, '-')

  return MAIN_CITIES[normalized] || null // No default - return null if not found
}
