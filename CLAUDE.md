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
  /enfantsVerifies/{uidAnonyme}     { codeSaisi, dateVerification }
  /profils/{uid}                    { prenom, nom, couleur, role, email, photoURL, tableauBord[],
                                      tableauMasques[], dernierLuGroupe, permissions }
                                     ← role: "admin" | "membre" | "restreint" ; permissions n'a de sens
                                       que pour "restreint" (voir § Accès et rôles) ; photoURL pointe
                                       vers Storage familles/{CODE}/avatars/{uid}
  /enfants/{id}                     { nom, couleur }            ← enfants sans compte
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
- **Enfant** : pas de compte. Saisit code famille + code enfant → connexion anonyme Firebase, puis
  écriture d'un doc dans `enfantsVerifies` que les règles n'autorisent que si le code enfant correspond.
  Il choisit ensuite son prénom dans la liste (ce qui pose `enfants/{id}.uidActuel`, voir plus haut).
  Depuis 2026-09, un enfant **n'est plus en lecture seule** : il peut écrire dans le groupe familial
  (et gérer ses propres messages), créer une **demande de course** (jamais l'ajouter directement —
  un parent valide), cocher ses tâches/courses/étapes de routine (déjà permis), et modifier sa propre
  couleur/photo de profil (`enfants/{id}`, jamais son prénom). Toujours interdit : créer/modifier une
  tâche, un événement, une routine, accéder aux documents, ou agir au nom d'un autre enfant.
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
    quelqu'un contourne l'interface. Un enfant ne peut que cocher (`achete`, `fait`/`faitLe`,
    `progression`), jamais créer ni supprimer, et n'a **aucun** accès aux documents. Un membre
    restreint sans la case cochée n'a **aucun** accès (lecture comme écriture) à la collection
    correspondante — `accesFonctionnalite()` dans `firestore.rules`.
- Le reset hebdomadaire des courses et l'expiration des achats ponctuels ne tournent que pour un parent.

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
  quel champ, y compris s'auto-nommer propriétaire — voir § Accès et rôles), et désormais aussi les
  permissions élargies pour les enfants (messages, demandes de courses, photo/couleur) et les
  collections `demandesCourses`/`notifications`. Tant que ce n'est pas fait : la messagerie privée
  échoue silencieusement, la faille `maisons` reste ouverte, et **un enfant ne peut ni écrire de
  message ni faire de demande de course** (vérifié en direct : le blocage vient bien du serveur, pas
  de l'interface — testé avec un compte enfant qui reçoit `permission-denied` jusqu'à republication).
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
