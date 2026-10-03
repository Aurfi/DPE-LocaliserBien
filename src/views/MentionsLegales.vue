<template>
  <div class="container mx-auto max-w-4xl px-4 py-8">
    <router-link to="/" class="quiet-link">Retour à la recherche</router-link>
    <h1 class="mt-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">Mentions légales et vie privée</h1>
    <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Projet de notice · 2 octobre 2026</p>
    <p role="note" class="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      Cette notice est en cours de validation dans la prévisualisation. L’identification du responsable au titre du RGPD,
      les modalités des journaux d’hébergement et la conservation des messages restent à préciser avant publication.
    </p>

    <div class="mt-6 space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Éditeur et hébergement</h2>
        <p>{{ siteName }} est un service gratuit, sans publicité et sans compte utilisateur, édité par une personne physique à titre non professionnel.</p>
        <p class="mt-3">L’éditeur souhaite préserver son anonymat dans le cadre de l’<a class="quiet-link underline" href="https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614" target="_blank" rel="noopener noreferrer">article 1-1 II de la loi pour la confiance dans l’économie numérique</a>. Son identité a été communiquée à l’hébergeur.</p>
        <p class="mt-3"><strong>Hébergeur :</strong> OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.</p>
        <p class="mt-2"><strong>Contact du site :</strong> <a class="quiet-link underline" :href="`mailto:${contactEmail}`">{{ contactEmail }}</a></p>
      </section>

      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Données et attribution</h2>
        <p>Les diagnostics consultés proviennent des jeux publics de l’ADEME. Les pages sources indiquent leurs conditions d’utilisation et dates de mise à jour :</p>
        <ul class="mt-3 list-disc space-y-2 pl-5">
          <li><a class="quiet-link underline" href="https://data.ademe.fr/datasets/dpe03existant" target="_blank" rel="noopener noreferrer">DPE logements existants depuis juillet 2021</a></li>
          <li><a class="quiet-link underline" href="https://data.ademe.fr/datasets/dpe-france" target="_blank" rel="noopener noreferrer">DPE antérieurs à juillet 2021</a></li>
          <li><a class="quiet-link underline" href="https://geoservices.ign.fr/" target="_blank" rel="noopener noreferrer">Géocodage de la Géoplateforme de l’IGN</a></li>
        </ul>
        <p class="mt-3">Les jeux DPE sont présentés sous <a class="quiet-link underline" href="https://www.data.gouv.fr/pages/legal/licences/etalab-2.0" target="_blank" rel="noopener noreferrer">Licence Ouverte 2.0</a>. Cette mention ne dispense pas du respect des dispositions légales applicables, notamment à la réutilisation et à la protection des données personnelles.</p>
        <p class="mt-3">{{ siteName }} est un outil indépendant. Il n’est ni un diagnostic officiel, ni un service agréé par l’ADEME ou l’IGN. Le score compare les critères saisis ; il ne confirme pas l’identité du bien.</p>
      </section>

      <section class="card p-5 sm:p-7" id="vie-privee">
        <h2 class="section-title">Recherches et services externes</h2>
        <p>Votre navigateur interroge directement l’ADEME et, selon la recherche, le service de géocodage de l’IGN. Ils reçoivent les critères nécessaires, tels que la commune, l’adresse ou les coordonnées recherchées, ainsi que des informations techniques de connexion dont votre adresse IP.</p>
        <p class="mt-3">L’application ne comporte pas de serveur recevant un historique centralisé des recherches. Cela ne signifie pas qu’aucune donnée personnelle n’est traitée par les services contactés.</p>
        <p class="mt-3">Les polices sont celles disponibles sur votre appareil. Le site ne charge pas automatiquement Google Fonts ni de carte Google intégrée. Le lien « Voir sur Maps » ouvre volontairement un site externe, soumis à ses propres règles de confidentialité.</p>
        <p class="mt-3">Aucun outil publicitaire ou script d’analyse comportementale n’est configuré dans cette application. Les éventuels journaux techniques et statistiques de l’hébergement doivent être distingués de ce fonctionnement côté navigateur.</p>
      </section>

      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Données conservées sur votre appareil</h2>
        <p>L’historique persistant est facultatif. Vous pouvez l’activer depuis les réglages du site. Sans activation, aucune nouvelle recherche n’est enregistrée dans cet historique.</p>
        <p class="mt-3">Une fois activé, le stockage local de votre navigateur conserve jusqu’à dix recherches par mode, avec leurs critères, date, nombre de résultats et éventuel libellé personnalisé. Les recherches de proximité peuvent inclure une adresse et des coordonnées. Ces listes ne sont pas synchronisées par l’application vers un compte ou un serveur.</p>
        <p class="mt-3">Il n’y a pas d’expiration automatique des entrées. Les plus anciennes sont remplacées lorsque la limite est atteinte. Vous pouvez supprimer une entrée ou effacer les historiques. Désactiver l’option arrête l’enregistrement et masque les listes sans effacer automatiquement les données déjà présentes.</p>
        <p class="mt-3">Un choix explicite de thème clair ou sombre est conservé localement ; sélectionner « Système » supprime ce choix. Le navigateur peut aussi conserver les fichiers statiques de l’application installable. Son service worker ne met pas les réponses de recherche des API dans ce cache.</p>
        <p class="mt-3">Les paramètres de votre navigateur permettent également d’effacer les données du site.</p>
      </section>

      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Hébergement et contact</h2>
        <p>La consultation du site entraîne des échanges techniques avec OVH. La configuration des journaux, leur durée de conservation et les rôles respectifs de l’hébergeur et de l’éditeur doivent être confirmés pour cette installation.</p>
        <p class="mt-3">Si vous écrivez à {{ contactEmail }}, votre adresse électronique et votre message servent à traiter votre demande. La messagerie utilise OVH et une redirection vers Gmail. La durée de conservation et les modalités d’exercice des droits seront précisées dans la notice finalisée.</p>
        <p class="mt-3">Pour une question relative à vos données, utilisez <a class="quiet-link underline" :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>. Vous pouvez également consulter les <a class="quiet-link underline" href="https://www.cnil.fr/fr/mes-demarches/les-droits-pour-maitriser-vos-donnees-personnelles" target="_blank" rel="noopener noreferrer">informations de la CNIL sur vos droits</a>.</p>
      </section>

      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Utilisation et limites</h2>
        <p>Les résultats sont indicatifs et peuvent contenir des erreurs, des informations manquantes ou des diagnostics anciens. Vérifiez les caractéristiques du bien et consultez un professionnel compétent pour toute démarche nécessitant un diagnostic officiel.</p>
        <p class="mt-3">Respectez les droits des personnes, les conditions des sources et leurs limites techniques. Les bibliothèques du projet conservent leurs licences respectives, notamment Vue.js, Tailwind CSS et Vite (MIT), Lucide (ISC) et Biome (MIT/Apache-2.0).</p>
      </section>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MentionsLegales',
  computed: {
    siteName() {
      return import.meta.env.VITE_SITE_NAME || 'LocaliserBien'
    },
    contactEmail() {
      return import.meta.env.VITE_CONTACT_EMAIL || 'contact@localiserbien.fr'
    }
  }
}
</script>
