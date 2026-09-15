# VieEnFamille

Application web d'organisation familiale : calendrier, tâches, courses, repas, événements
importants, messages, documents et routines — partagés en temps réel entre les membres d'une famille.

Site statique en **un seul fichier** (`index.html`) — c'est un choix assumé et **reconfirmé** par
l'utilisateur : il n'est pas développeur et veut pouvoir ouvrir, lire et déployer le site sans build
ni outillage. Ne pas éclater en modules, même si le fichier est gros (~4 700 lignes).

## Stack

- HTML/CSS/JS pur, aucune dépendance à installer, aucun build, aucun `package.json`.
- Firebase (projet `liste-courses-famille-a0096`), chargé par CDN en modules ES :
  Authentication + Firestore (temps réel) + **Storage** (documents familiaux).
- Hébergement : Netlify (glisser-déposer des fichiers sur https://app.netlify.com/drop).

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
  /profils/{uid}                    { prenom, nom, couleur, role, email, tableauBord[], tableauMasques[] }
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
  /documents/{id}                   { nom, url, chemin, taille, typeMime, categorie, ajoutePar }
  /routines/{id}                    { nom, assigneA, recurrence, actif, etapes[], progression{ISO:[ids]} }
  /meta/coursesSemaine              { semaine }        ← reset hebdomadaire automatique
  /meta/parametres                  { categoriesCourses[], categoriesDocuments[] }
```

Fichiers dans Storage : `familles/{CODE}/documents/{id}_{nom}`.

`{CODE}` est un code de 8 caractères généré à la création (alphabet sans caractères ambigus), qui sert
**à la fois** d'identifiant du document et de code à partager. Affiché à l'utilisateur au format `XXXX-XXXX`
mais stocké sans tiret — toujours passer les saisies par `nettoyerCodeFamille()`.

`coursesSemaine` et `achatsSpecifiques` sont des **listes intégrées** conservées depuis la première
version : ne pas les fusionner dans `articles`, des données réelles y vivent.

## Accès et rôles

- **Administrateur** : compte Firebase, `profils/{uid}.role === "admin"` ou propriétaire de la famille.
  Gère les membres, les rôles, le code enfant, renomme la famille.
- **Membre** : compte Firebase. Crée et modifie tout le contenu, mais pas les rôles.
- **Enfant** : pas de compte. Saisit code famille + code enfant → connexion anonyme Firebase, puis
  écriture d'un doc dans `enfantsVerifies` que les règles n'autorisent que si le code enfant correspond.
  Il choisit ensuite son prénom dans la liste.
- Les restrictions sont **doublées** : CSS (`body.role-enfant .parent-seulement`, `body.role-membre
  .admin-seulement`) **et** règles Firestore. Un enfant ne peut que cocher (`achete`, `fait`/`faitLe`,
  `progression`), jamais créer ni supprimer, et n'a **aucun** accès aux documents.
- Le reset hebdomadaire des courses et l'expiration des achats ponctuels ne tournent que pour un parent.

## Configuration Firebase à faire / vérifier

- Authentication → fournisseurs **Email/Password** et **Anonymous** activés. *(déjà fait)*
- Authentication → Settings → Authorized domains : le domaine Netlify doit y figurer.
  **À refaire à chaque nouvelle URL Netlify**, sinon la connexion échoue.
- Firestore → Rules : publier le contenu de `firestore.rules`. **À REPUBLIER** — les règles ont changé
  (profils, evenements, listes, articles, repas, evenementsImportants, messages, documents, routines).
- Storage → activer le service puis publier `storage.rules`. **Nouveau** : sans cela, l'onglet
  Documents ne peut rien envoyer.

## Direction visuelle

Deux thèmes complets, pilotés par jetons CSS (`[data-theme="sombre"]` / `[data-theme="clair"]`),
avec un réglage « Système ». **Le sombre reste le défaut** : l'utilisateur avait trouvé une ancienne
version claire « nulle » — ne pas changer ce défaut sans lui demander.

- Sombre : fond quasi noir, dégradé violet → bleu → cyan, cartes en verre dépoli, lueurs.
- Clair : blanc cassé chaleureux, bleu famille `#2563EB`, vert « tâche faite » `#047857`, ambre `#B45309`
  (palette « Family Calendar & Chores » du skill `ui-ux-pro-max`).
- Typographie : Varela Round (titres) + Nunito Sans (texte) — appairage « Soft Rounded », chaleureux.
- Chaque membre a **sa couleur**, réutilisée partout (calendrier, tâches, avatars).
- Icônes : sprite SVG intégré (jeu Lucide). **Jamais d'emoji comme icône.**

## Pièges rencontrés

- Copier-coller le code depuis une fenêtre de chat a déjà corrompu la clé API Firebase (caractère altéré,
  longueur identique) → erreur `auth/api-key-not-valid`. Toujours transmettre le **fichier**, pas le texte.
- Ouvrir `index.html` en `file://` ne marche pas : Firebase Auth exige un vrai domaine (serveur local ou Netlify).
- `[hidden]` est neutralisé par les `display: flex` des composants : la règle
  `.cachee, [hidden] { display: none !important; }` est indispensable.
- Ne pas recaler le défilement du calendrier à chaque instantané Firestore : utiliser
  `Etat.ui.calDefilerVersMaintenant`, sinon la vue saute sous les doigts à chaque modification.
- Sous macOS, un serveur local lancé par l'agent ne peut pas lire `~/Documents` (protection TCC) :
  copier le site dans le dossier temporaire de session pour le prévisualiser.

## Pistes non faites

- Tests automatisés (§34 du cahier des charges) : impossibles sans npm + l'émulateur Firebase,
  ce qui contredit la contrainte « aucun outillage ». À rouvrir si la contrainte évolue.
- Notifications poussées hors application (nécessite Firebase Cloud Messaging + un service worker dédié).
  L'architecture et le réglage existent déjà côté interface.
- Synchronisation Google Calendar / Apple Calendar (le modèle de données s'y prête).
- Approbation par l'administrateur avant qu'un parent rejoigne (aujourd'hui, quiconque a le code peut rejoindre).
- Permissions par document dans l'espace Documents.
- Glisser-déposer pour réordonner (widgets et étapes de routine se réordonnent par boutons haut/bas).
- Compte de test laissé dans Firebase Auth : `kevin.test+notrefamille@kawaa.co` (supprimable depuis la console).
