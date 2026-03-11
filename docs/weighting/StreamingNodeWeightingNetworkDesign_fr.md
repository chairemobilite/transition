# Pondération des nœuds en flux continu en conception de réseau de transport

Ce document décrit la **pondération des nœuds en flux continu** utilisée dans le flux de conception de réseau de transport lorsque la pondération des nœuds est activée (trajets OD ou POI).

## Aperçu

La pondération des nœuds attribue un poids numérique à chaque nœud de transport en fonction de la proximité des points d'intérêt (POI) ou des points origine–destination (OD). Le résultat est écrit dans `node_weights.csv` dans le répertoire de la tâche et appliqué à la collection de nœuds lorsque le job évolutif s'exécute. La logique des chemins et de la simulation utilise ces poids (p. ex. `properties.data.weight`) pour l'adaptation ou l'affichage.

## Approche en flux continu

- **Pas de FeatureCollection POI en mémoire** : Le fichier de demande ou de POI n'est jamais entièrement chargé. Il est lu de manière **flux continu** (ligne par ligne via l'analyse CSV).
- **Agrégation inverse** : Pour chaque POI (ou point origine/destination OD), on détermine **quels nœuds de transport sont accessibles à pied dans le temps de marche maximum configuré** (p. ex. 20 minutes). On maintient une seule **map : UUID nœud → poids**. Pour chaque nœud concerné on ajoute :  
  `poids += poidsIntrinsèque * décroissance(tempsTrajetSecondes)`  
  où la décroissance utilise la fonction configurée (puissance, exponentielle, gamma, combinée ou logistique) et ses paramètres.
- **Sortie** : Une fois le fichier entièrement traité, la map est écrite dans `node_weights.csv` (colonnes : `node_uuid`, `weight`). Seuls les nœuds avec un poids &gt; 0 sont écrits.

## Paramètres

- **Temps de marche max.** : Configurable (p. ex. 20 min en secondes). Utilisé comme seuil de temps de trajet OSRM : seuls les nœuds accessibles à pied dans ce temps sont considérés.
- **Pré-filtre à la distance à vol d'oiseau** : Avant d'appeler OSRM, les nœuds candidats sont réduits à l'aide d'un rayon à vol d'oiseau :  
  `maxRadiusMeters = maxWalkingTimeSeconds × walkingSpeedMps`  
  (vitesse de marche depuis les préférences ou par défaut). Seuls les nœuds dans ce rayon sont envoyés à OSRM, ce qui réduit la taille des requêtes et garde l'algorithme scalable.
- **Décroissance** : Appliquée sur le **temps de trajet** (temps de marche depuis OSRM). Le type de décroissance et les paramètres (p. ex. bêta pour puissance/exponentielle) sont configurables ; voir les types de pondération dans `transition-common` et les options de décroissance dans le formulaire de conception de réseau.
- **Routage** : Profil OSRM **marche** via `tableFrom(origin: POI, destinations: nœuds candidats)`. Même moteur de routage que le reste de l'application.

## Déclenchement manuel

La pondération **n'est pas** exécutée automatiquement à la création de la tâche. L'utilisateur la lance manuellement depuis le formulaire de conception de réseau (**Démarrer la pondération**). Le formulaire affiche la progression et **Pondération des nœuds terminée** à la fin. Le job peut ensuite être exécuté ; à l'exécution, si la pondération des nœuds était activée mais que `node_weights.csv` est manquant, le job échoue avec un message clair invitant à lancer **Démarrer la pondération** d'abord.

## Références

- Fonctions et paramètres de décroissance : `transition-backend` `DecayFunctionCalculator`, types de pondération dans `transition-common`.
- Implémentation en flux continu : `transition-backend` `StreamingNodeWeightingService`.
- Poids des nœuds dans les chemins : `transition-common` `Path` (`properties.data.weight`, `getTotalWeight`).
