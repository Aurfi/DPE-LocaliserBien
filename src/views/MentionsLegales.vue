<template>
  <div class="container mx-auto max-w-4xl px-4 py-8">
    <router-link to="/" class="quiet-link">Retour à la recherche</router-link>
    <h1 class="mt-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">Mentions légales et vie privée</h1>
    <div class="mt-6 space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Hébergement</h2>
        <p><strong>Hébergeur :</strong> OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.</p>
        <p class="mt-2"><strong>Contact du site :</strong> <a class="quiet-link underline" :href="`mailto:${contactEmail}`">{{ contactEmail }}</a></p>
      </section>

      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Sources et limites des résultats</h2>
        <p>Les diagnostics proviennent des données publiques de l’ADEME. Le géocodage utilise la Géoplateforme de l’IGN.</p>
        <ul class="mt-3 list-disc space-y-2 pl-5">
          <li><a class="quiet-link underline" href="https://data.ademe.fr/datasets/dpe03existant" target="_blank" rel="noopener noreferrer">DPE logements existants depuis juillet 2021</a></li>
          <li><a class="quiet-link underline" href="https://data.ademe.fr/datasets/dpe-france" target="_blank" rel="noopener noreferrer">DPE antérieurs à juillet 2021</a></li>
          <li><a class="quiet-link underline" href="https://geoservices.ign.fr/" target="_blank" rel="noopener noreferrer">Géocodage de la Géoplateforme de l’IGN</a></li>
        </ul>
        <p class="mt-3">Les jeux DPE sont diffusés sous <a class="quiet-link underline" href="https://www.data.gouv.fr/pages/legal/licences/etalab-2.0" target="_blank" rel="noopener noreferrer">Licence Ouverte 2.0</a>. Les pages sources précisent leurs dates de mise à jour et conditions d’utilisation.</p>
        <p class="mt-3">{{ siteName }} est un outil indépendant. Le score compare les critères saisis ; il ne confirme pas l’identité du bien et ne remplace pas un diagnostic officiel. Les données peuvent être anciennes, incomplètes ou comporter des erreurs.</p>
      </section>

      <section class="card p-5 sm:p-7" id="vie-privee">
        <h2 class="section-title">Recherches et services externes</h2>
        <p>Votre navigateur interroge directement l’ADEME et, selon la recherche, le service de géocodage de l’IGN. Ils reçoivent les critères nécessaires, tels que la commune, l’adresse ou les coordonnées recherchées, ainsi que des informations techniques de connexion dont votre adresse IP.</p>
        <p class="mt-3">L’application ne conserve pas d’historique centralisé des recherches.</p>
        <p class="mt-3">L’affichage de la carte dans une fiche de bien établit une connexion à Google Maps. Google reçoit l’adresse et/ou les coordonnées du bien ainsi que des informations techniques de connexion, dont votre adresse IP. Le lien « Voir sur Maps » ouvre également Google Maps.</p>
      </section>

      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Données conservées sur votre appareil</h2>
        <p>L’historique est désactivé par défaut. Vous pouvez l’activer depuis les réglages du site. Il est enregistré uniquement dans ce navigateur.</p>
        <p class="mt-3">Une fois activé, il conserve jusqu’à dix recherches par mode, avec leurs critères, date, nombre de résultats et éventuel libellé personnalisé. Les recherches de proximité peuvent inclure une adresse et des coordonnées. Ces listes ne sont pas synchronisées vers un compte ou un serveur.</p>
        <p class="mt-3">Il n’y a pas d’expiration automatique des entrées. Les plus anciennes sont remplacées lorsque la limite est atteinte. Vous pouvez supprimer une entrée ou effacer les historiques. Désactiver l’option arrête l’enregistrement et masque les listes sans effacer automatiquement les données déjà présentes.</p>
        <p class="mt-3">Votre choix de thème est conservé localement ; sélectionner « Système » supprime ce choix. Le navigateur peut aussi conserver les fichiers de l’application. Le cache de l’application n’inclut pas les réponses de recherche des API.</p>
        <p class="mt-3">Les paramètres de votre navigateur permettent également d’effacer les données du site.</p>
      </section>

      <section class="card p-5 sm:p-7">
        <h2 class="section-title">Contact et droits</h2>
        <p>Si vous écrivez à {{ contactEmail }}, votre adresse électronique et votre message servent à traiter votre demande. La messagerie passe par OVH, puis les messages sont redirigés vers Gmail.</p>
        <p class="mt-3">Pour exercer vos droits ou poser une question sur vos données, écrivez à <a class="quiet-link underline" :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>. Consultez aussi les <a class="quiet-link underline" href="https://www.cnil.fr/fr/mes-demarches/les-droits-pour-maitriser-vos-donnees-personnelles" target="_blank" rel="noopener noreferrer">informations de la CNIL sur vos droits</a>.</p>
        <p class="mt-3"><a class="quiet-link underline" href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener noreferrer">Crédits et licences des éléments du site</a></p>
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
