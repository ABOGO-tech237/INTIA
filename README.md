# SAFINUM Éwondo

Extension Chrome de traduction français → éwondo, pour les services financiers numériques. Version 5.2.1, présentée par l’équipe Numerid au SAFINUM Innovate Challenge 2026.

Fichier de l’extension : `release/safinum-ewondo-extension-v5.2.1.zip`  
SHA-256 : `e2e99cf8ee79e3acad6cd7fa4479543704decb1ab021ca05829a32c26d83e14e`

Page de test : [https://safinum.cm/hackathon-test](https://safinum.cm/hackathon-test)

Vidéo principale (parcours Safinum Pay, tournée avec la 5.2.1) : [docs/videos/demo-safinum-pay-v5.2.1.mp4](docs/videos/demo-safinum-pay-v5.2.1.mp4)  
Vidéo bonus (même page, puis un exemple ailleurs) : [docs/videos/demo-safinum-ewondo-v5.2.1.mp4](docs/videos/demo-safinum-ewondo-v5.2.1.mp4)

## En 30 secondes

Nous avons fait une extension Chrome qui traduit le texte d’une page du français vers l’éwondo, sans modifier l’application. Les montants, les références, les dates et les frais restent ceux du site.

Nous n’avons entraîné aucun modèle. Le fichier `ewondo_model.json` est un lexique, tiré de grammaires et de dictionnaires, avec quelques règles (surtout Pichon, 1950). Nous n’avons inventé aucun mot éwondo. Quand nous n’avons pas trouvé d’équivalent attesté, nous avons gardé un calque ou un emprunt, marqué « à confirmer ».

La page de test des organisateurs est https://safinum.cm/hackathon-test (Safinum Pay, compte d’Amina Ngo Bell, 250 000 FCFA).

## 1. Présentation

L’extension s’ajoute à une page déjà en ligne. Elle change le texte visible, pas la logique métier. Un transfert de 25 000 FCFA avec 375 F de frais en Mobile Money reste un transfert de 25 000 FCFA avec 375 F de frais, en français comme en éwondo.

L’orthographe suit l’Alphabet général des langues camerounaises (AGLC, 1984) : les lettres ɛ, ɔ, ə et ŋ. Nous n’avons pas noté les tons dans cette version.

## 2. Installation

L’extension n’est pas sur le Chrome Web Store. Il faut la charger en mode développeur. Nous conseillons un profil Chrome sans compte, pour ne pas la lier à une session personnelle.

1. Dézipper `safinum-ewondo-extension-v5.2.1.zip`. Le fichier `manifest.json` doit être à la racine du dossier choisi, pas dans un sous-dossier.
2. Ouvrir `chrome://extensions`.
3. Activer le mode développeur, en haut à droite.
4. Cliquer sur « Charger l’extension non empaquetée » et choisir le dossier qui contient directement `manifest.json`.
5. Pour traduire aussi des fichiers locaux (`file://`), ouvrir les détails de l’extension et activer « Autoriser l’accès aux URL de fichier ».
6. Recharger les onglets déjà ouverts (F5).

L’icône SAFINUM Éwondo apparaît ensuite dans la barre d’outils.

## 3. Utilisation

Un clic sur l’icône ouvre la fenêtre de l’extension. Le bouton « Traduire cette page en Éwondo » lance la traduction de l’onglet actif. Le même bouton permet ensuite de revenir au texte original. On peut aussi cocher « Traduction automatique » pour que chaque nouvelle page soit traduite à l’ouverture.

Un clic droit sur la page propose les mêmes commandes : « Traduire cette page en Éwondo » et « Restaurer le texte original ».

L’extension travaille sur n’importe quelle page, y compris dans les cadres, et sur le contenu qui arrive plus tard (étape suivante d’un parcours, message d’erreur, liste mise à jour, changement de mode de paiement). Une fois la traduction lancée, ce qui s’ajoute est traduit aussi. La version 5.2.1 corrige un cas où la ligne des frais restait en français après un changement de mode de paiement. Le terme figurait déjà dans le lexique ; le défaut venait de la détection des changements de la page.

Nous ne touchons jamais aux montants, dates, références, numéros, codes et pourcentages, ni à ce que l’utilisateur a saisi dans un champ, ni au code, ni aux zones `contenteditable`, ni à ce qui porte `translate="no"` ou `.notranslate`. Les noms propres et les marques (Amina, Safinum Pay, MTN) restent en place. Le texte indicatif d’un champ, lui, peut être traduit.

La page de référence du hackathon, https://safinum.cm/hackathon-test, enchaîne cinq étapes : solde, frais, bénéficiaire, récapitulatif, confirmation. C’est ce parcours que montre la vidéo principale, d’abord en français, puis en éwondo, avec les mêmes montants.

La vidéo bonus reprend cette page, puis un article de Wikipédia, pour montrer ce qui se passe ailleurs. Sur une page générale, seuls les termes présents dans le lexique sont traduits.

Une démo CamFinance est aussi embarquée dans l’extension (bouton de la fenêtre de l’extension). Ses règles de frais ne sont pas celles de la page de test, et la traduction ne les modifie pas non plus.

## 4. Architecture

C’est une extension Manifest V3, version 5.2.1. Les scripts `engine.js`, `dictionary.js` et `content.js` s’injectent sur toutes les URL, dans tous les cadres. Le service worker `background.js` gère le menu contextuel et réinjecte les scripts si besoin. Le lexique (`ewondo_model.json`, aussi fourni en `ewondo_model.js`) n’est chargé qu’au moment de traduire, pas à chaque visite. S’il n’est pas encore prêt, l’extension se rabat sur `dictionary.js`.

Un MutationObserver surveille les nœuds ajoutés et les textes modifiés sur place. Les mises à jour sont regroupées et appliquées au plus une fois toutes les 150 ms, pour ne pas ralentir les pages très dynamiques. Le titre de l’onglet est traduit aussi. Quand on revient au français, nous n’écrasons pas un texte que le site a changé entre-temps.

Les règles de `engine.js` viennent surtout de Pichon 1950 (pages imprimées). Elles ne remplacent pas le lexique, elles règlent ce qu’une entrée figée ne peut pas régler seule.

« Et » a trois formes : *ban* entre deux personnes (p. 11, par exemple Atangana ban Esomba), *ai* entre des noms, « et, avec » (p. 14, page PDF 16), *ndɔ fə* entre deux phrases (p. 21). La locution *tɔ eyɔŋ* (« jamais ») va en fin de proposition (p. 114 ; on retrouve cette place dans le Nouveau Testament éwondo, Jn 6,35, 10,28 et 13,8). Le possessif suit le nom et s’accorde en classe (p. 43-44) : en classe I, « son / sa » au singulier est *woe*, comme « ton », et « ses » au pluriel est *boe*. La négation d’indicatif se fait par le verbe suivi de *kik* (p. 20 et 56). La défense (impératif négatif) se forme avec *tə* et le préfixe sujet. Pour l’impératif positif, Pichon (p. 63-65) donne un schéma (-ak au singulier, -an / -gan au pluriel) mais aussi beaucoup de formes irrégulières. Nous n’avons pas généralisé ce schéma : seules des formes attestées sont utilisées.

## 5. Données et sources

Malgré son nom, `ewondo_model.json` n’est pas le produit d’un entraînement. C’est un lexique. Chaque entrée typique porte le français, le rendu éwondo (orthographe AGLC, sans tons), la source avec la page, une certitude (attesté, calque ou à confirmer) et une remarque.

Attesté : le mot se trouve dans une source consultée, avec ce sens. Calque : les mots sont attestés, mais le sens ou l’assemblage est élargi. À confirmer : nous n’avons pas trouvé de terme satisfaisant dans les sources obtenues, et nous avons retenu un calque ou un emprunt en attendant un locuteur natif.

Le lexique compte 500 expressions et 265 mots. 118 entrées sont marquées « à confirmer » ; les 21 termes de base correspondants sont listés au § 8. Détail dans le rapport de couverture.

Nous n’avons utilisé que des copies libres ou ouvertement diffusées, plus quelques versets du Nouveau Testament éwondo lus en ligne (œuvre sous droits, non téléchargée). Les numéros de page sont ceux imprimés dans l’ouvrage.

Pichon, Fr., *Petite grammaire ewondo avec exercices appropriés*, 1950. C’est notre source principale de grammaire et de vocabulaire : lexique éwondo-français p. 92-108, français-éwondo p. 109-120, classes nominales, possessifs p. 43-44, pronoms p. 52, négation *kik* p. 20 et 56, « et » p. 11, 14 et 21, impératif p. 63-65. Parmi les mots repris : *mɔni* « argent » (p. 101), à ne pas confondre avec *mendim* « eau » ; *ngaŋ* « remercier » (p. 118) ; *mana* « terminer » ; *dugan* « retourner » ; *wan* / *wɔm* ; *kokoa*, *mɔmɔ* « non, rien » ; *tə ai* « sans ».

Redden, James E., *A Descriptive Grammar of Ewondo*, 1979 (microfiche ERIC ED185833). Grammaire (phonologie, tons, morphologie) et dictionnaire éwondo-anglais p. 189-253, utile pour préciser des sens absents ou ambigus chez Pichon. Nous en avons tiré notamment *asoe* « secret, caché » (p. 193), *nkoo* « ligne, téléphone » (p. 234), *kiege* « essayer, tester » (p. 213), *taŋ* « nombre, numéro » (p. 243), *tug* « tromper, frauder » (p. 245), *moní* « money » (p. 224), *tɔ* « same » (p. 245), *mfie* « lumière, lampe ».

Nekes, P. H., *Lehrbuch der Jaunde-Sprache*, 1911. Manuel et vocabulaire en ancienne orthographe allemande, qui nous a servi de recoupement (par exemple *kiege* « probieren »).

Nekes, P. H., *Die Sprache der Jaunde in Kamerun*, 1913. On y trouve *moni* « Geld », *te ai moni* « ohne Geld » (sans argent), *ngɔn* « mois ».

Heepe, M. (éd.), *Jaunde-Texte von Karl Atangana und Paul Messi*, 1919. Textes éwondo authentiques. La forme *Fransi* y apparaît, à côté de *Flansi* chez Pichon p. 71. Nous avons gardé *Flansi*.

Tadadjeu, M. et Sadembouo, E. (éd.), *Alphabet général des langues camerounaises*, 1984 (AGLC, SIL REAP 32295, licence CC BY-NC-SA 3.0). C’est la norme d’écriture : ɛ ɔ ə ŋ, les diacritiques étant réservés aux tons (§ 5 et § 9). Nous avons normalisé tout le lexique : è → ɛ, ò → ɔ, ë → ə, ñ / ṅ → ŋ, et nous avons retiré les autres accents (tons).

Hartell, R. (éd.), *Alphabets of Africa*, fiche éwondo, 1993 (Rosetta Project). Cela confirme l’alphabet. Nous n’y avons pas pris de vocabulaire financier.

Alliance biblique du Cameroun, *Mkpamaŋ Amvoe* (Nouveau Testament éwondo, NTE12, 2012). Nous l’avons consulté en ligne seulement (bible.com, version 1854), sans télécharger le texte intégral. Il montre l’usage moderne : *Ovuma* « salut » (Lc 1,28 ; aussi Mt 26,49 et Mt 28,9), *mòni* (Ac 8,20 ; Lc 19,23), *ngaŋ* (Rm 1,8), la défense *Të mia-…* (Mt 7,6), *Boan okala* « prenez garde » (Mt 6,1 ; Mt 24,4), la place de *tɔ eyɔŋ* en fin de proposition (Jn 6,35, 10,28, 13,8), *kalara ekola* (Col 2,14), *baŋ* « banque » (Lc 19,23), *makogëlan ai wa na…* (Ac 21,39).

Le *Dictionnaire ewondo-français* de Tsala (1955), encore protégé, n’a pas été consulté ; il serait la référence principale pour trancher les termes à confirmer.

## Matériel de traduction

Le lexique et ses sources sont publiés dans `lexique/`. Chaque entrée cite l’ouvrage et la page dont elle est tirée. Les ouvrages eux-mêmes ne sont pas inclus, pour des raisons de droits.

## 6. Résultats des tests (v5.2.1)

Mesures du 12 novembre 2026 sur le paquet 5.2.1 ; résultats détaillés dans `hackathon-test/resultat-couverture-final-v5.2.1.json`. La liste d’exceptions n’a pas été élargie.

| Test | Résultat |
|---|---|
| Couverture de la page de test | 100,0 % (1 425 / 1 425 occurrences, 0 mot français restant). Le dénominateur monte par rapport aux 1 180 de la mesure précédente : nous avons ajouté, après traduction déjà active, les modes Autre banque, les seuils minimum et les erreurs d’étape 2 |
| Panneau jury (`?jury=1`), hors critère | 90,08 %. Les valeurs saisies, les codes d’erreur et certains textes soumis restent en français, volontairement |
| Audit des 113 chaînes de la démo CamFinance | 113 / 113, 38 contrôles de protection, 0 altération, 0 erreur console, retour au français identique |
| Grammaire | 38 / 38 |
| Frais gelés (démo CamFinance : MTN 1,5 %, Orange 1 %, banque 500 F, Wave 0, minimum 500 F) | 74 / 74, avant et après traduction |
| Sources du lexique de couverture | 0 défaut (77 entrées utilisées sur la page) |
| Protection des montants et parcours | 24 cas de frais et 3 parcours complets, 0 anomalie |
| Changement de mode, lecture immédiate (toutes les 20 ms, 400 ms) | la ligne des frais reste un instant en français sur la mesure précédente ; sur la 5.2.1, aucun français, dès 0 ms |
| Page réelle https://safinum.cm/hackathon-test | montants identiques : 250 000, −12 500, +180 000 ; frais 375 F sur 25 000 F en Mobile Money |

Le détail de la cause, du correctif et de l’écart 108 / 118 est dans `docs/RAPPORT-COUVERTURE-v5.2.1.md`.

## 7. Limites

Environ 64 % des mots éwondo affichés sur la page de test viennent d’entrées « à confirmer » (3 394 mots sur 5 304, soit 63,99 %). Une couverture à 100 % veut dire : plus aucun mot français restant sur le périmètre jugé. Cela ne veut pas dire que tous les termes sont attestés. Les 118 entrées « à confirmer » et les 21 termes de base du § 8 en font partie.

Le panneau jury (`?jury=1`) est à environ 90 % et reste hors critère.

Aucun locuteur natif n’a encore validé le lexique.

Le *Dictionnaire ewondo-français* de Tsala (1955), encore protégé, n’a pas été consulté.

Sur une page générale, seuls les termes présents dans le lexique sont traduits.

Les tons ne sont pas notés. L’accord de classe des possessifs n’est vraiment sûr que pour les noms de classe I. Quelques mots hérités de versions antérieures restent étiquetés « non attesté » dans le lexique v5.1. Nous ne les avons pas inventés en v5.2 ; ils restent à revoir.

## 8. Calques et emprunts à confirmer

Ces 21 termes sont rendus par un calque ou un emprunt, en attente de validation par un locuteur natif.

| Français | Rendu proposé | Nature | Remarque (morceaux sourcés, pas le terme composé) |
|---|---|---|---|
| frais | mɔni ya lom | calque | « argent de l’envoi » : *mɔni* (Pichon p. 101) + *ya* (p. 111) + *lom* (p. 100). Faux amis écartés : *evovoe* (fraîcheur), *nlɔman* (mission). |
| compte (bancaire) | mɔni a baŋ | calque + emprunt (*baŋ*) | « argent à la banque ». *baŋ* est un emprunt attesté (NT Lc 19,23). |
| solde | mɔni wan | calque | « votre argent » (Pichon p. 101 ; p. 43-44). Rien d’attesté pour « solde ». |
| courant (compte courant) | mɔni a baŋ | calque | Le type de compte n’est pas rendu. |
| récapitulatif | mam məsə | calque | « toutes les choses » (NT 1 Th 5,21). |
| protocole | mbol (kiege) | calque | « manière (d’essayer) » (Pichon p. 115 ; Redden p. 213). |
| facture | kalara ekola | calque (+ emprunt *kalara*) | « acte de dette » : NT Col 2,14 ; *kalara* Pichon p. 99. |
| électricité | mfie | calque | « lumière, lampe » (Redden p. 184 ; Pichon p. 114). |
| en ligne / connexion / réseau | nkoo | calque | « ligne, corde ; téléphone » (Redden p. 234). |
| automatiquement | *(non rendu)* | calque | La phrase « Les frais sont calculés automatiquement » est rendue *Bayi laŋ mɔni ya lom* (« on comptera l’argent de l’envoi »). |
| référence | taŋ / taŋ lom | calque | « numéro (de l’envoi) » : *taŋ* (Redden p. 243 ; Pichon p. 115). |
| statut | mbol | calque | « manière, état » (Pichon p. 115). |
| optionnel | ngë wayi | calque | « si tu veux » : *ngë* (Pichon p. 14) + *wayi* (p. 23). |
| transactions récentes | mɔni woe etetəg nyɔ ai mvus | calque | Approximation : « ton argent maintenant et après ». |
| minimum / maximum | abot / anen | calque | « petitesse / grandeur » (Pichon p. 38). |
| débiter / débité | yan ; mɔni osə | calque | « payer » (Pichon p. 116). |
| veuillez (politesse) | makogəlan ai wa na… | calque (formule NT) | NT Ac 21,39 ; Pichon p. 117 « prier, kogelan ». |
| fictif / fictives | məsiki bəbəla | calque | « ne sont pas vraies » (Pichon p. 19-20 ; *bəbəla* NT Ap 21,5). |
| jury | bod bə nkat | calque | « les gens du jugement » : *bod* (NT Lc 19,45) + *bə* (Pichon p. 34) + *nkat* (p. 103). |
| mois abrégés (nov., oct., …) | ngɔn 11, ngɔn 10, … | calque | *ngɔn* « mois » (Pichon p. 115 ; Nekes 1913) + le numéro (chiffre protégé). Aucun nom de mois attesté. |
| hackathon (nom commun) ; base ; hook | Hackathon SAFINUM Innovate (nom propre) ; *mam ma osu* ; *nlɔb* | nom propre / calque | « Retour au hackathon » → *Dugan a Hackathon SAFINUM Innovate*. *nlɔb* « hameçon » (Pichon p. 113 ; NT Mt 17,27). |

La liste complète des 118 clés « à confirmer » est dans `hackathon-test/registre-des-manques.json`.

## 9. Équipe Numerid

Ce travail est présenté par l’équipe Numerid, pour le SAFINUM Innovate Challenge 2026. Nous sommes trois.

| Nom | Rôle |
|---|---|
| ATANGANA ABOGO Emmanuel | développement de l’extension, tests |
| [coéquipière, nom en attente] | développement de l’extension |
| Gervais Azanga | linguistique et sources |

## 10. Prochaines étapes

Nous voulons d’abord faire relire le lexique par des locuteurs natifs éwondo, en commençant par les 21 calques et emprunts encore « à confirmer », et par les entrées héritées non attestées.

Ensuite, une version vocale des messages importants (solde, frais, alertes de sécurité), enregistrée par des locuteurs éwondo et embarquée hors ligne. Il n’existe pas aujourd’hui de synthèse vocale fiable pour l’éwondo. Cette fonction n’est pas dans la v5.2.1.

## 11. Licence des sources et crédits

Nous avons consulté Pichon (1950), Redden (1979, microfiche ERIC), Nekes (1911 et 1913) et Heepe (1919) sur des dépôts publics (Internet Archive / ERIC). L’AGLC 1984 est diffusé par le SIL sous licence CC BY-NC-SA 3.0. Le Nouveau Testament éwondo *Mkpamaŋ Amvoe* (2012) reste sous droits : nous n’en avons cité que quelques versets, à partir de la consultation en ligne.

Cette extension est un prototype. Sa prochaine étape est la validation du lexique par des locuteurs natifs (voir § 10).
