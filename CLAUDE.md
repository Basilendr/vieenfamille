# VieEnFamille

Application web d'organisation familiale : calendrier, tâches, courses, repas, événements
importants, messages, documents et routines — partagés en temps réel entre les membres d'une famille.

Chaque utilisateur a son propre compte (e-mail/mot de passe ou Google) et peut appartenir à
**plusieurs maisons** (typiquement une par parent séparé) — il choisit/change de maison depuis
l'écran « Vos familles » ou le sélecteur dans l'en-tête de l'app (`ouvrirSelecteurMaison`, section D).
Ce n'est pas un site à une seule famille : la donnée est entièrement cloisonnée par maison
(`maisons/{CODE}/...`), et un utilisateur peut en créer ou en rejoindre autant qu'il veut avec un code.

Site statique en **un seul fichier** (`index.html`) — c'est un choix assumé et **reconfirmé** par
l'utilisateur : il n'est pas développeur et veut pouvoir ouvrir, lire et déployer le site sans build
ni outillage. Ne pas éclater en modules, même si le fichier est gros (~4 700 lignes).

## Stack

- HTML/CSS/JS pur, aucune dépendance à installer, aucun build, aucun `package.json`.
- Firebase (projet `liste-courses-famille-a0096`), chargé par CDN en modules ES :
  Authentication + Firestore (temps réel) + **Storage** (documents familiaux).
- Hébergement : Vercel, relié directement au dépôt GitHub — **redéploiement automatique à chaque
  push sur `main`**, plus de glisser-déposer manuel. *(Changé depuis Netlify en 2026-09.)*

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Tout le site (structure + styles + logique), organisé en sections numérotées |
| `firestore.rules` | Règles de sécurité Firestore — **à publier dans la console Firebase** |
| `storage.rules` | Règles de sécurité Storage — **à publier dans la console Firebase** |
| `manifest.json` + `icon.svg` | Installation sur écran d'accueil |
| `sw.js` | Service worker : garde la coquille disponible hors connexion (pas les données) |
| `design-system/vieenfamille/MASTER.md` | Direction de design issue du skill `ui-ux-pro-max` |
| `.claude/launch.json` | Serveur local de prévisualisation (développement seulement) |

## Organisation de `index.html`

Le fichier suit deux sommaires, l'un pour le CSS, l'autre pour le JS. Chaque section est
délimitée par un bandeau de commentaire.

- **CSS** : 1. jetons · 2. base · 3. utilitaires · 4. composants · 5. modale/toast/états ·
  6. coquille applicative · 7. écrans hors application · 8. pages · 9. préférences système
- **JS** : A. Firebase/constantes/utilitaires · B. thème/toasts/**modales et formulaires génériques** ·
  C. état global et accès aux données · D. authentification/familles/enfant/intégration ·
  E. routeur et coquille · F1–F11. pages · G. délégation d'événements et démarrage

Deux mécanismes portent la majeure partie du code, à réutiliser plutôt qu'à contourner :

- `ouvrirFormulaire({ titre, champs, valeurs, onValider })` construit n'importe quel éditeur à
  partir d'une liste de champs (`texte`, `zone`, `select`, `date`, `heure`, `nombre`, `coche`,
  `couleur`, `recurrence`, `ingredients`, `etapes`). Les champs `avance: true` sont repliés
  derrière « Options supplémentaires ».
- Un **seul** écouteur de clic global dispatche tout, via `ACTIONS` (actions nommées) et
  `GESTIONNAIRES` (attributs `data-*`). Le dispatch remonte le DOM : l'élément **le plus proche**
  gagne — ne pas revenir à un `closest()` par gestionnaire, cela cassait les événements posés
  dans les colonnes du calendrier.

## Modèle de données Firestore

```
maisons/{CODE}                      { nom, proprietaireUid, membres: [uid], dateCreation }
  /prive/secrets                    { codeEnfant }   ← jamais lisible par un client
  /enfantsVerifies/{uidAnonyme}     { codeSaisi, dateVerification, enfantIdActuel }
                                     ← enfantIdActuel : quel enfants/{id} cette session anonyme
                                       incarne actuellement (posé en même temps que uidActuel,
                                       voir plus bas) — permet aux règles de retrouver les
                                       permissions de CET enfant sans requête inverse.
  /profils/{uid}                    { prenom, nom, couleur, role, email, photoURL, tableauBord[],
                                      tableauMasques[], dernierLuGroupe, permissions }
                                     ← role: "admin" | "membre" | "restreint" ; permissions n'a de sens
                                       que pour "restreint" (voir § Accès et rôles) ; photoURL pointe
                                       vers Storage familles/{CODE}/avatars/{uid}
  /enfants/{id}                     { nom, couleur, photoURL, uidActuel, permissions }
                                     ← enfants sans compte ; permissions : voir § Permissions enfant
  /evenements/{id}                  { titre, date, debut, fin, journeeEntiere, recurrence,
                                      personneId, categorie, lieu, description, couleur }
  /taches/{id}                      { nom, assigneA, date, heureLimite, priorite, statut,
                                      categorie, description, recurrence, fait, faitLe }
  /listes/{id}                      { nom }                     ← listes de courses créées
  /articles/{id}                    { listeId, nom, quantite, categorie, achete, note, ajoutePar }
  /coursesSemaine/{id}              { nom, quantite, categorie, achete, ... }  ← liste hebdo intégrée
  /achatsSpecifiques/{id}           { nom, note, achete, dateAchat, ... }      ← achats ponctuels
  /repas/{id}                       { date, type, nom, description, recette, ingredients[], responsable }
  /evenementsImportants/{id}        { titre, date, personneId, recurrenceAnnuelle, anneeNaissance }
  /messages/{id}                    { texte, auteurId, auteurNom, important, epingle, dateCreation }
                                     ← tableau familial unique, présenté comme la conversation « Groupe »
  /conversations/{id}                { type: "privee", participants: [uid1, uid2], dernierTexte,
                                       dernierAuteurId, dateDernierMessage, lu: {uid: horodatage} }
    /messages/{id}                   { texte, auteurId, auteurNom, dateCreation }
                                     ← messagerie privée à deux, réservée aux membres d'une même maison
                                       (jamais aux enfants) ; id déterministe `dm_` + les deux uid triés
  /documents/{id}                   { nom, url, chemin, taille, typeMime, categorie, ajoutePar }
  /routines/{id}                    { nom, assigneA, recurrence, actif, etapes[], progression{ISO:[ids]} }
  /demandesCourses/{id}             { nom, quantite, commentaire, demandeurId, demandeurNom,
                                       statut: "attente"|"acceptee"|"refusee", dateCreation,
                                       dateTraitement, traiteePar, traiteeParNom }
                                     ← un enfant demande, un parent valide ; accepter ajoute
                                       automatiquement l'article dans achatsSpecifiques
  /notifications/{id}               { destinataireId, type, titre, description, dateCreation,
                                       lu, ressourceType, ressourceId }
                                     ← in-app uniquement (pas de serveur pour du vrai push) ;
                                       types : SHOPPING_REQUEST_CREATED/_ACCEPTED/_REJECTED,
                                       FAMILY_EVENT_CREATED, TASK_REMINDER, EVENT_REMINDER
  /meta/coursesSemaine              { semaine }        ← reset hebdomadaire automatique
  /meta/parametres                  { categoriesCourses[], categoriesDocuments[] }
```

`enfants/{id}` porte aussi `photoURL` et, depuis 2026-09, `uidActuel` : l'uid de la session anonyme
qui a choisi cette identité en dernier (posé par `retenirMaisonEnfant`/le clic sur « qui es-tu »).
Sert de base à `estCetEnfant()` dans les règles — la seule façon de vérifier qu'un enfant écrit bien
en son propre nom (message, demande de course, sa photo) et pas au nom d'un autre enfant de la
maison. Ce n'est **pas** une authentification forte : une session anonyme perdue (nettoyage du
navigateur, nouvel appareil) fait juste re-choisir le prénom, qui reprend la main sur l'identité.

Fichiers dans Storage : `familles/{CODE}/documents/{id}_{nom}` et `familles/{CODE}/avatars/{uid}`
(une seule photo par personne, écrasée à chaque changement — pas d'historique).

`{CODE}` est un code de 8 caractères généré à la création (alphabet sans caractères ambigus), qui sert
**à la fois** d'identifiant du document et de code à partager. Affiché à l'utilisateur au format `XXXX-XXXX`
mais stocké sans tiret — toujours passer les saisies par `nettoyerCodeFamille()`.

`coursesSemaine` et `achatsSpecifiques` sont des **listes intégrées** conservées depuis la première
version : ne pas les fusionner dans `articles`, des données réelles y vivent.

## Accès et rôles

- **Administrateur** : compte Firebase, `profils/{uid}.role === "admin"` ou propriétaire de la famille.
  Gère les membres, les rôles/accès, le code enfant, renomme la famille.
- **Membre** : compte Firebase. Crée et modifie tout le contenu, mais pas les rôles.
- **Accès restreint** (`role === "restreint"`) : un membre avec un **vrai compte** (e-mail ou Google),
  mais dont un administrateur a coché uniquement certaines fonctionnalités dans
  `profils/{uid}.permissions` (clés : `calendrier`, `taches`, `courses`, `repas`, `evenements`,
  `messages`, `documents`, `routines`). Pensé pour « rétrograder » un parent façon enfant tout en
  gardant son compte. Se règle depuis Famille → icône bouclier sur la personne (`gererAccesMembre`,
  section F11) ; réutilise le champ `select` + des `coche` de `ouvrirFormulaire`.
  `Famille`, `Profil`, `Paramètres` et `Recherche` restent toujours accessibles (ce ne sont pas des
  « fonctionnalités » à cocher) ; `Documents` reste de toute façon interdit à un enfant (voir plus bas).
- **Enfant** : pas de compte. Écran en **2 étapes** (`#ecranEnfant`, `.etape`/`.etapes-indicateur`,
  section D ~ligne 2565) : 1) code famille (8 caractères, `nettoyerCodeFamille()`) → affiche le nom
  de la famille ; 2) code secret propre à l'enfant, comparé côté serveur au code défini par un parent
  (`changerCodeEnfant`, jamais lisible du client). Les deux étapes déclenchent `signInAnonymously`
  dès qu'un `getDoc`/`setDoc` en a besoin — **important** : la lecture du nom de famille à l'étape 1
  exige déjà `request.auth != null` côté règles (`allow get: if estConnecte()`), donc la connexion
  anonyme doit avoir lieu **avant** cette lecture, pas seulement à l'étape 2 ; l'oublier fait échouer
  l'étape 1 à chaque tentative sur un appareil/navigateur neuf (corrigé le 2026-09-15, bug qui rendait
  la connexion enfant totalement inutilisable en pratique). Le code secret est normalisé des deux
  côtés (`normaliserCodeEnfant`, `.trim().toLowerCase()`) pour éviter les échecs liés à la casse ou
  aux espaces, la comparaison Firestore étant une égalité stricte de chaîne. Une fois validé,
  écriture d'un doc dans `enfantsVerifies` que les règles n'autorisent que si le code correspond,
  puis choix du prénom dans la liste (ce qui pose `enfants/{id}.uidActuel`, voir plus haut).
  Depuis 2026-09, un enfant **n'est plus en lecture seule** : il peut toujours (sans rien à cocher,
  quel que soit ce qu'un parent lui accorde en plus) écrire dans le groupe familial et gérer ses
  propres messages, créer une **demande de course** (jamais l'ajouter directement — un parent
  valide), cocher ses tâches/courses/étapes de routine, et modifier sa propre couleur/photo de
  profil (`enfants/{id}`, jamais son prénom). Le reste (créer/modifier/supprimer une tâche, un
  événement, un repas, une date importante, une routine, un produit de liste…) dépend de
  **permissions granulaires par enfant** — voir § Permissions enfant juste après. `Documents` reste
  de toute façon interdit à un enfant (Storage ne lui ouvre aucun accès, voir plus bas).
  Peut changer de maison sans se déconnecter : `afficherMesMaisonsEnfant()` relit la liste des
  maisons déjà vérifiées avec succès sur **ce navigateur** (`localStorage['vef-enfant-maisons']`,
  posée par `retenirMaisonEnfant`) — un enfant n'a pas de `membres[]` à interroger côté serveur
  comme un parent, donc pas de synchronisation entre appareils pour cette liste.
- Les restrictions sont **doublées**, pour les trois niveaux :
  - CSS/JS : `body.role-enfant .parent-seulement`, `body.role-membre .admin-seulement` (le membre
    « restreint » porte aussi `role-membre`), et `majVisibiliteNav()` qui masque les onglets de
    navigation (barre latérale, barre basse, menu « Plus ») selon `aAccesFonctionnalite(cle)` —
    le routeur (`Routeur.aller`) redirige aussi vers l'accueil si on force une page non autorisée.
  - Règles Firestore/Storage : **c'est la vraie barrière de sécurité**, la seule qui compte si
    quelqu'un contourne l'interface. Cocher (`achete`, `fait`/`faitLe`, `progression`) reste
    toujours permis à un enfant ; créer/modifier/supprimer dépend de `enfants/{id}.permissions`
    (voir § Permissions enfant) — jamais un accès accordé par la seule interface. Un enfant n'a
    **aucun** accès aux documents, quoi qu'un parent coche. Un membre restreint sans la case cochée
    n'a **aucun** accès (lecture comme écriture) à la collection correspondante —
    `accesFonctionnalite()` dans `firestore.rules`.
- Le reset hebdomadaire des courses et l'expiration des achats ponctuels ne tournent que pour un parent.

## Permissions enfant (2026-09)

Un enfant **n'est pas condamné à la lecture seule** : au-delà de ce qui est toujours permis
(consulter, terminer ses tâches/routines, demander un produit, écrire dans le groupe, modifier sa
couleur/photo — voir § Accès et rôles), chaque action de création/modification/suppression est une
**permission granulaire, désactivée par défaut**, qu'un parent accorde au cas par cas — jamais un
simple bouton « enfant = oui/non ». Ni migration ni valeur par défaut à écrire quelque part : un
champ absent de `enfants/{id}.permissions` vaut `false` partout (client comme règles), donc les
enfants déjà créés n'ont besoin d'aucun traitement particulier.

- **Catalogue** (`PERMISSIONS_ENFANT`, section F11, ~ligne 5230) : une trentaine de clés du type
  `calendrier_creer`, `taches_modifier_propres`, `courses_supprimer`, `messages_epingler`…
  regroupées par fonctionnalité, avec leur libellé affiché. `taches_*_propres` vs `taches_*_autres`
  distingue modifier/supprimer une tâche **assignée à cet enfant** (`assigneA == l'enfant`) d'une
  tâche de quelqu'un d'autre — les autres fonctionnalités n'ont pas cette distinction (pas de notion
  de « propriétaire » pertinente pour un événement ou un repas dans ce modèle de données).
  `Documents` et `Administration` (gérer les permissions, paramètres de famille, membres) ne
  figurent **volontairement pas** au catalogue : jamais accordables à un enfant, quel que soit ce
  qu'un parent coche.
- **Interface parent** : Famille → icône bouclier sur un enfant → `gererPermissionsEnfant()`, une
  modale (pas le `ouvrirFormulaire()` générique, la grille catégorisée de cases à cocher s'y prêtait
  mal) qui écrit l'objet complet dans `enfants/{id}.permissions` (remplace tout, pas de fusion
  partielle — chaque sauvegarde envoie l'état de toutes les cases).
- **Interface enfant** : `enfantA(cle)` (section C) lit `Etat.donnees.enfants` (déjà écouté en temps
  réel pour tout le monde, y compris un enfant) — un changement de permission par un parent se
  reflète donc **sans reconnexion**, dès le prochain instantané Firestore. Chaque bouton
  « créer/modifier/supprimer » vérifie `peutEcrire() || enfantA(cle)` plutôt que `peutEcrire()` seul
  (ex. `nouvelleTache`, `ligneTacheHTML`) ; `Donnees.ajouter`/`Donnees.supprimer` acceptent un
  paramètre `autoriseEnfant` (booléen déjà calculé par l'appelant, pas une simple clé — nécessaire
  pour les cas « propres » qui dépendent de la ressource) en plus de `peutEcrire()`. Le bouton flottant
  d'ajout rapide (`peutCreerFonctionnalite()`) et le raccourci `data-action="ajout-rapide"` sont
  désormais visibles pour un enfant aussi (avant : masqués sans condition), leur contenu se filtrant
  tout seul selon les permissions.
- **Règles Firestore** : `enfantA(maisonId, cle)` retrouve l'enfant **précisément incarné** par la
  session anonyme via `enfantsVerifies/{uid}.enfantIdActuel` (un lookup direct, impossible à obtenir
  par une requête inverse en règles), posé par le même clic que `enfants/{id}.uidActuel`
  (`afficherChoixEnfant`, dans cet ordre — la règle de `enfantsVerifies` exige que `uidActuel`
  désigne déjà cette session avant d'accepter `enfantIdActuel`, jamais l'inverse). Chaque collection
  (`evenements`, `taches`, `coursesSemaine`/`achatsSpecifiques`/`articles`/`listes`, `repas`,
  `evenementsImportants`, `routines`, `messages`) a sa règle `create`/`update`/`delete` élargie d'un
  `|| enfantA(maisonId, 'cle_pertinente')`, en plus de `accesFonctionnalite()` pour les membres.
- **Ce que ça ne couvre pas** (limitation honnête) : pas d'approbation parentale a posteriori pour
  une action accordée directement (contrairement aux demandes de courses) — une permission cochée
  est un accès direct, pas une file d'attente. Pas de distinction « propres/autres » pour le
  calendrier, les repas, les événements importants ou les routines : le modèle de données ne porte
  pas de notion de propriétaire pertinente pour ces collections (à la différence de `assigneA` pour
  les tâches), donc une permission comme `calendrier_modifier` s'applique à tous les événements de la
  maison, pas seulement ceux créés par cet enfant — décision technique raisonnable plutôt que
  d'inventer un champ de propriété qui n'existe nulle part ailleurs dans l'app.

**Sécurité — 2026-09** : une faille a été corrigée dans `firestore.rules` sur `maisons/{maisonId}` —
la règle `update` permettait auparavant à **n'importe quel membre simple** (pas seulement un admin) de
modifier n'importe quel champ du document, y compris renommer la famille ou, plus grave, s'attribuer
`proprietaireUid`. La règle actuelle distingue précisément : rejoindre (+1 soi-même), quitter/supprimer
son compte (-1 soi-même), et administrateur seul pour renommer ou retirer un tiers — `proprietaireUid`
n'est modifiable par personne via cette règle. **Republier `firestore.rules` corrige cette faille.**

Mot de passe exigé à la **création** d'un compte : 10 caractères minimum, une majuscule, une minuscule,
un chiffre (`motDePasseValide()`, section A). Ne s'applique pas à la connexion à un compte existant,
pour ne pas bloquer les comptes déjà créés avec l'ancienne règle (6 caractères).

## Notifications et rappels (2026-09)

Centre de notifications in-app (cloche dans l'en-tête) — **pas de vrai push** : ce projet n'a aucun
serveur (choix « aucun outillage » reconfirmé), donc rien ne peut déclencher un envoi quand l'appli
est fermée. Décision actée avec l'utilisateur : notifications en base, visibles tant que l'app est
ouverte, plutôt que de faire semblant. Si le besoin de vraies notifications hors application devient
prioritaire, il faudrait des Firebase Cloud Functions (+ Cloud Scheduler pour les rappels programmés)
— un vrai backend à déployer, à rediscuter avec l'utilisateur avant de l'introduire.

- `creerNotification()`/`notifierParents()` : écriture immédiate après l'action (demande de course
  créée/acceptée/refusée, nouvel événement important) — pas de délai, contrairement aux rappels.
- `verifierRappels()` (appelée toutes les 60 s tant que l'app est ouverte, section G) : rappel
  « dans 10 minutes » pour les tâches/événements de la personne connectée, **sauf** récurrence
  quotidienne ou par jours de semaine (`estRoutinier`) — pas de « planning du jour » distinct dans
  ce modèle de données, cette récurrence en tient lieu. Dédoublonnage par clé
  `tache_{id}_{date}`/`evenement_{id}_{date}` : un changement d'heure produit naturellement une
  nouvelle clé (donc un nouveau rappel), une tâche terminée/supprimée sort simplement du parcours
  au tour suivant (pas de mécanisme d'annulation séparé).
- Réglage personnel (Paramètres, `profils/{uid}.rappelsActifs`, `true` par défaut) — pour un enfant,
  toujours actif (pas de stockage de préférence côté `enfants/{id}` pour l'instant).

## Configuration Firebase à faire / vérifier

- Authentication → fournisseurs **Email/Password** et **Anonymous** activés. *(déjà fait)*
- Authentication → fournisseur **Google** : **à activer** dans Authentication → Sign-in method.
  Sans ça, le bouton « Continuer avec Google » échoue avec `auth/operation-not-allowed`.
- Authentication → Settings → Authorized domains : le domaine de production Vercel
  (`....vercel.app`, ou le domaine personnalisé si un jour il y en a un) doit y figurer, sinon la
  connexion échoue. Comme Vercel redéploie automatiquement à chaque push, le domaine de production
  reste stable une fois ajouté — pas besoin de le refaire à chaque déploiement. Seules les URLs de
  **preview** (une par branche/PR) sont différentes et devront être ajoutées séparément si vous testez
  la connexion dessus.
- Firestore → Rules : publier le contenu de `firestore.rules`. **À REPUBLIER, urgent** — plusieurs
  changements de sécurité en attente : conversations privées, accès restreint par fonctionnalité, la
  **correction d'une faille** sur `maisons/{maisonId}` (un membre simple pouvait modifier n'importe
  quel champ, y compris s'auto-nommer propriétaire — voir § Accès et rôles), les permissions élargies
  pour les enfants (messages, demandes de courses, photo/couleur), les collections
  `demandesCourses`/`notifications`, et désormais aussi les **permissions granulaires enfant** (§
  Permissions enfant : `enfantA()`, `enfantActuelId()`, et l'élargissement de `enfantsVerifies` pour
  y poser `enfantIdActuel`). Tant que ce n'est pas fait : la messagerie privée échoue silencieusement,
  la faille `maisons` reste ouverte, un enfant ne peut ni écrire de message ni faire de demande de
  course, et **les permissions accordées depuis Famille → bouclier restent sans effet réel** — le
  parent peut cocher/sauvegarder normalement (ça écrit dans `enfants/{id}`, déjà autorisé), l'enfant
  voit bien les boutons apparaître (le client lit la même donnée), mais toute tentative d'écriture
  reçoit `permission-denied` jusqu'à republication (vérifié en direct le 2026-09-15).
- Storage → activer le service puis publier `storage.rules`. **Non fait à ce jour** : depuis fin 2024,
  Firebase impose le plan **Blaze** (carte bancaire au dossier) pour activer Storage. L'usage d'une
  famille reste dans le quota gratuit, mais la décision appartient à l'utilisateur.
  Tant que Storage n'est pas activé, les onglets Documents et la photo de profil affichent un message
  d'explication et refusent proprement les envois (`stockageIndisponible`) — **tout le reste fonctionne**.

## Direction visuelle

Deux thèmes complets, pilotés par jetons CSS (`[data-theme="sombre"]` / `[data-theme="clair"]`),
avec un réglage « Système ». **Le sombre reste le défaut** : l'utilisateur avait trouvé une ancienne
version claire « nulle » — ne pas changer ce défaut sans lui demander.

Palette **sobre et professionnelle, volontairement anti-« AI/SaaS »** (reconfirmé par l'utilisateur en
2026-09 : pas de dégradés, pas de glassmorphism, pas de lueurs colorées, pas de couleurs saturées).
Tout passe par les jetons de la section CSS 1 (`:root` + `[data-theme=…]`) — ne jamais coder une
couleur en dur dans un composant, toujours réutiliser une variable existante.

- Clair : fond blanc cassé chaud `#F8F8F6`, cartes blanches à bordure très légère `#E5E5E2`, texte
  `#1F1F1F`/`#6B6B6B`, accent unique bleu ardoise `#3E5C76` (`--primaire`), utilisé avec parcimonie
  (boutons primaires, liens, sélection) — jamais comme décoration.
- Sombre : fond presque noir mais neutre `#17171A` (pas de teinte violette), surfaces qui s'éclaircissent
  progressivement (`--fond` < `--fond-2` < `--carte` < `--carte-2`), même logique d'accent unique,
  desaturé et éclairci pour rester lisible sur fond sombre.
- Couleurs fonctionnelles desaturées : succès (vert sauge `--secondaire`), attention (ambre `--accent`),
  erreur (rouge sourd `--danger`) — jamais de couleurs vives.
- `--degrade` (dégradés du logo/FAB/avatars) et `--voile-fond` (halos colorés d'arrière-plan) sont
  volontairement neutralisés : le premier vaut `var(--primaire)` (couleur plate), le second `none`.
  Ne pas les réintroduire comme de vrais dégradés sans en reparler à l'utilisateur.
- Ombres très légères (`--ombre-carte`, `--ombre-haute`) — jamais de glow coloré (`box-shadow` teinté
  par `--primaire` par ex.) autour des boutons ou du FAB.
- Typographie : Varela Round (titres) + Nunito Sans (texte) — appairage « Soft Rounded », chaleureux.
- Chaque membre a **sa couleur**, réutilisée partout (calendrier, tâches, avatars) — palette
  `--membre-1..8` douce et désaturée (bleu ardoise, vert sauge, terracotta, mauve, gris bleuté, ocre,
  taupe, sarcelle), dupliquée en JS dans `COULEURS_MEMBRE` (les profils existants gardent leur ancienne
  couleur stockée en base tant qu'elle n'est pas changée manuellement — aucune migration automatique).
- Icônes : sprite SVG intégré (jeu Lucide). **Jamais d'emoji comme icône.**
- Logo : maison en trait blanc sur carré bleu ardoise (`icon.svg`, réutilisé inline via
  `<use href="#i-accueil">` dans `.logo`/`.logo-centre` pour l'en-tête, la barre latérale et les
  4 écrans de connexion/inscription). Le favicon et l'icône d'écran d'accueil partagent le même motif.

## Pièges rencontrés

- Copier-coller le code depuis une fenêtre de chat a déjà corrompu la clé API Firebase (caractère altéré,
  longueur identique) → erreur `auth/api-key-not-valid`. Toujours transmettre le **fichier**, pas le texte.
- Ouvrir `index.html` en `file://` ne marche pas : Firebase Auth exige un vrai domaine (serveur local ou Vercel).
- `[hidden]` est neutralisé par les `display: flex` des composants : la règle
  `.cachee, [hidden] { display: none !important; }` est indispensable.
- Ne pas recaler le défilement du calendrier à chaque instantané Firestore : utiliser
  `Etat.ui.calDefilerVersMaintenant`, sinon la vue saute sous les doigts à chaque modification.
- Sous macOS, un serveur local lancé par l'agent ne peut pas lire `~/Documents` (protection TCC) :
  copier le site dans le dossier temporaire de session pour le prévisualiser.

## Pistes non faites

- Tests automatisés (§34 du cahier des charges) : impossibles sans npm + l'émulateur Firebase,
  ce qui contredit la contrainte « aucun outillage ». À rouvrir si la contrainte évolue.
- Notifications poussées hors application (nécessite Firebase Cloud Functions + Cloud Messaging, donc
  un vrai backend — voir § Notifications et rappels). Le centre in-app existe, pas le push.
- Synchronisation Google Calendar / Apple Calendar (le modèle de données s'y prête).
- Approbation par l'administrateur avant qu'un parent rejoigne (aujourd'hui, quiconque a le code peut rejoindre).
- Permissions par document dans l'espace Documents.
- Glisser-déposer pour réordonner (widgets et étapes de routine se réordonnent par boutons haut/bas).
- Compte de test laissé dans Firebase Auth : `kevin.test+notrefamille@kawaa.co` (supprimable depuis la console).
- Compte de test laissé dans Maison Test (membre simple, pour tester l'écran de permissions enfant sans
  les identifiants d'Alice) : `testperm+vef@kawaa.co` (supprimable depuis Famille ou la console).
