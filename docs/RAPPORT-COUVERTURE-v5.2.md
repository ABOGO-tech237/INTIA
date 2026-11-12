# Rapport de couverture, SAFINUM Éwondo v5.2.1

Page mesurée : https://safinum.cm/hackathon-test. Date : 12 novembre 2026, heure de Douala (UTC+1).

## Résultat v5.2.1

Outil : `tests/couverture/couverture.sh`, extension `safinum-ewondo-extension-v5.2.1`, manifeste 5.2.1. Mesure du 12 novembre 2026, de 20:03:33 à 20:06:18. La liste blanche (`allowlist.json`) n’a pas été élargie.

| Exécution | Extension | Couverture | Mots | Restants |
|---|---|---|---|---|
| 20:03:33–20:06:18 | ZIP v5.2.1 dézippé (manifeste 5.2.1) | 100,0 % (1 425 / 1 425 chaînes-occurrences) | 100,0 % (4 548 mots FR d’origine) | 0 |

Le dénominateur n’est plus 1 180 : nous avons ajouté au parcours continu (page déjà traduite) les modes Autre banque, les seuils minimum et les erreurs d’étape 2. Tous ces nouveaux états sont à 100 %. Le fichier brut est `resultat-couverture-final-v5.2.1.json`.

Le panneau jury, informatif et hors critère, reste à 90,08 %. Ce qui reste en français, ce sont les valeurs saisies et soumises (« Paiement de services », un numéro de téléphone), qui ne doivent pas être traduites, ainsi que les codes d’erreur.

Sur la page, 3 394 des 5 304 jetons éwondo affichés (63,99 %) viennent d’entrées « à confirmer ».

## Pourquoi la ligne de frais échappait au 1 180 / 1 180

La chaîne « Frais de 1,5 % (min. 100 FCFA, max. 2 500 FCFA) » était déjà dans le lexique de la 5.2.0, avec la traduction « Mɔni ya lom 1,5 % (abot 100 FCFA, anen 2 500 FCFA) ». La variante à 2 % (Autre banque, min. 200, max. 5 000) aussi. Les montants et le pourcentage ne changent pas. Aucun mot éwondo n’a été inventé : *frais*, *minimum* et *maximum* reprennent *mɔni ya lom*, *abot* et *anen*, déjà marqués « à confirmer ».

Le juge par-état traduit la page après que l’écran est déjà affiché. Dans ce cas, la ligne part du français déjà présent dans le nœud, et le lexique la rend correctement. D’où le 1 180 / 1 180 sur la 5.2.0.

Sur un parcours réel, on traduit d’abord (solde, ou formulaire encore sur Compte Safinum), puis on change le mode de paiement. Vue réécrit alors le libellé français dans le nœud. L’observateur de la 5.2.0 regroupait ces changements toutes les 150 ms. Surtout, en fin de passe, il vidait la file des mutations pour ignorer ses propres écritures. Ce vidage avalait aussi le français que Vue venait d’injecter, sans que l’observateur soit rappelé. La ligne restait en français jusqu’à une mutation plus tard (saisie du montant, par exemple). C’est ce qu’on voit vers 40 s dans la vidéo bonus tournée avec la 5.2.0 : le reste de l’écran Frais est déjà en éwondo, la description des frais est encore en français. Le même phénomène vaut pour « Frais de 2 % (min. 200 FCFA, max. 5 000 FCFA) » et pour « Transfert instantané et gratuit » quand le mode change.

## Correctif (v5.2.1)

Dans `content.js` seulement : une fois la page traduite, l’observateur retraduit tout de suite les textes que la page réinjecte, en plusieurs passes, et ne jette plus que ses propres écritures. Le français n’atteint pas l’affichage. Le lexique, le moteur et les montants sont ceux de la 5.2.0. Le ZIP 5.2.0 n’a pas été modifié.

Nous avons ajouté ces états dynamiques au parcours continu du test, sans élargir la liste blanche. Contrôle manuel après correctif : au moment où l’on choisit Mobile Money ou Autre banque, la ligne de frais est déjà en éwondo.

## Autres tests, sur la 5.2.1

`sources.py` : 0 défaut sur 77 entrées utilisées sur la page.

`protection.py` : 24 cas de frais et 3 parcours complets, 0 anomalie.

`tests/grammaire.js` : 38/38.

`tests/audit.py` : 113/113 chaînes, 38 contrôles de protection, 0 altération, 0 erreur console, retour au français identique, frais MTN 150 F sur 10 000 F.

`tests/frais-gele/test_frais_gele.py` : 74/74. Les règles de la démo CamFinance sont gelées (MTN 1,5 %, Orange 1 %, banque 500 F, Wave 0, minimum 500 F, arrondi Math.round). Le test porte sur 9 montants × 4 opérateurs, avant et après traduction, plus le refus à 499 F.

Sur la page réelle, avec un profil Chrome vierge et temporaire, sans compte : montants identiques (250 000, −12 500, +180 000 ; frais 375 F sur 25 000 F en Mobile Money).

## Fichiers utiles

ZIP 5.2.1 : `/workspace/safinum-ewondo-v5/safinum-ewondo-extension-v5.2.1.zip`, `manifest.json` à la racine, version 5.2.1, sha256 `8cfd39fb3bfdd8f70ddfc773bb09051d2bb4ba98b7b6f12e4d225cc9fc1461de`.

ZIP 5.2.0, inchangé : `/workspace/safinum-ewondo-v5/safinum-ewondo-extension-v5.2.zip`, version 5.2.0, sha256 `924acd0c9912ea2ad98cf6328a1213ee95ab2c27e40ab4cd5d1f5348bc08ffb6`.

Captures : `hackathon-test/captures-v5.2/` (fr-*.png avant, ext-*.png après, pour 19 états, plus deux vues côte à côte : solde et récapitulatif).

Inventaire : `hackathon-test/inventaire.json`.

Lexique : `hackathon-test/lexique/` (glossaire.py, 125 mots avec leur certitude ; phrases.py ; mots.py, avec un champ source ; lexique-v52.json, 192 entrées). La fusion se fait par `outils/ajouter-lexique-v52.py`. Les 49 conflits avec la v5.1 sont dans `lexique/conflits-v51-v52.json`.

Registre : `hackathon-test/registre-des-manques.json`. Il contient 21 termes sans équivalent attesté, et 118 clés marquées « à confirmer ».

Résultat 5.2.1 : `hackathon-test/resultat-couverture-final-v5.2.1.json`.

## Mesures historiques de la 5.2.0

Le lexique (`ewondo_model.json`, `dictionary.js`) a été gelé à 17:10:19. Les scripts `engine.js` et `content.js` de la 5.2.0 sont ceux de 16:59.

| Exécution | Extension | Couverture | Mots | Restants |
|---|---|---|---|---|
| 17:12–17:15 | dossier de travail (`safinum-ewondo-extension/`) | 100,0 % (1 180 / 1 180 chaînes-occurrences) | 100,0 % (3 761 mots FR d’origine) | 0 |
| 17:15–17:18 | ZIP v5.2.0 dézippé (`/tmp/v52-unzip`, manifest 5.2.0) | 100,0 % (1 180 / 1 180) | 100,0 % | 0 |

À 17:12, le dossier de travail avait déjà le lexique et le moteur de la v5.2, gelés à 17:10:19. En revanche, le champ `version` de son `manifest.json` n’avait pas encore été passé à 5.2.0 : il affichait encore 5.1.1. Le ZIP 5.2.0 porte bien la version 5.2.0. Les deux arbres étaient identiques octet pour octet, à l’exception de ce numéro. Les fichiers bruts de ces mesures sont `resultat-couverture-final-source.json` et `resultat-couverture-final-zip.json`.

## Écart 108 / 118 entrées « à confirmer »

Deux décomptes circulent. Nous les avons recomptés sur les fichiers gelés. Le lexique n’a pas bougé entre la 5.2.0 et la 5.2.1.

| Fichier | Décompte | Ce qui est compté |
|---|---|---|
| `hackathon-test/lexique/lexique-v52.json` | 108 entrées (107 formes distinctes hors casse) | entrées v5.2 dont le champ `certitude` vaut « à confirmer ». `Jury` et `jury` comptent pour deux entrées, une seule forme une fois la casse ignorée. |
| `ewondo_model.json` (ZIP 5.2.0 et 5.2.1), champ `certainty` | 118 clés `v5.2-à-confirmer` | clés réellement embarquées dans l’extension, après fusion |
| `registre-des-manques.json`, `entrees_a_confirmer` | 118 clés, les mêmes que dans le modèle | même liste |

Le compte est 107 − 4 + 15 = 118.

Quatre entrées du lexique v5.2 marquées « à confirmer » étaient déjà dans le lexique v5.1, avec une autre étiquette (calque ou attesté) : *avertissement*, *confirmer le transfert*, *motif du transfert*, *reçu*. La fusion ne remplace pas la certitude v5.1, donc ces quatre-là ne figurent pas parmi les 118 clés `v5.2-à-confirmer`.

La fusion ajoute quinze clés-fragments, pour attraper un morceau de phrase ou une parenthèse non fermée dans la page. Exemples : `frais de 1,5 % (min. 100 fcfa, max. 2 500 fcfa` sans la parenthèse finale, ou `les frais sont calculés automatiquement` à côté de la phrase complète. Ces fragments ont la même certitude « à confirmer » et apparaissent dans le registre.

Ce ne sont pas deux listes contradictoires : 108 dans le fichier source du lexique v5.2, 118 dans l’extension livrée et dans le registre.
