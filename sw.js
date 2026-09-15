/* =============================================================================
   VIEENFAMILLE — SERVICE WORKER

   Rôle volontairement limité : garder la coquille de l'application disponible
   hors connexion (page, icône, manifeste). Les DONNÉES ne sont pas mises en
   cache ici — Firestore gère lui-même son cache et la synchronisation, et
   dupliquer ce cache créerait des incohérences entre membres.
   ============================================================================= */

const CACHE = "vieenfamille-v1";
const COQUILLE = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", evenement => {
    evenement.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(COQUILLE)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", evenement => {
    evenement.waitUntil(
        caches.keys()
            .then(cles => Promise.all(cles.filter(c => c !== CACHE).map(c => caches.delete(c))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", evenement => {
    const requete = evenement.request;
    // On ne touche ni aux appels Firebase, ni aux méthodes autres que GET.
    if (requete.method !== "GET") return;
    const url = new URL(requete.url);
    if (url.origin !== location.origin) return;

    // Réseau d'abord, cache en secours : l'application reste à jour tant qu'il
    // y a du réseau, et reste ouvrable quand il n'y en a plus.
    evenement.respondWith(
        fetch(requete)
            .then(reponse => {
                const copie = reponse.clone();
                caches.open(CACHE).then(cache => cache.put(requete, copie));
                return reponse;
            })
            .catch(() => caches.match(requete).then(r => r || caches.match("./index.html")))
    );
});
