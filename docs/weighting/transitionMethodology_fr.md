# Méthodologie utilisée dans Transition pour la pondération

## Pondération des nœuds d'arrêt et des trajets

Transition implémente plusieurs formules de décroissance et utilise soit la distance ou le temps de parcours comme variable d'entrée de la [formule](IntrinsicAndAccessibilityWeights_fr.md#fonctions-de-décroissance-en-fonction-de-la-distance-et-du-temps-de-déplacement). Voir les [types pour la pondération](/packages/transition-backend/src/services/weighting/types.ts) pour plus d'information.

### Formules de décroissance disponibles dans Transition

- Puissance
- Exponentielle
- Gamma
- Combinée
- Logistique

### Étapes de pondération et spécification

- Importation des lieux d'intérêt, domiciles et/ou origines/destinations OD (POIs) par le téléversement d'un fichier CSV ou GeoJSON. **Note: Le fichier d'entrée doit inclure une colonne de poids contenant les poids propres pré-calculés pour chaque POI. Transition ne calcule pas les poids propres.**
- Calcul de chemin à pied entre les POIs et les nœuds d'arrêt distants de 1.67 km ou moins à vol d'oiseau (20 min à 5km/h).
- Application de la formule de décroissance au **poids propre** de chaque POI (utilisant la distance réseau, la distance Euclidienne/à vol d'oiseau ou le temps de parcours à pied selon le choix de l'utilisateur) pour calculer la contribution du POI au poids d'accessibilité du nœud d'arrêt.
- Calcul de la somme des contributions des POIs accessibles pour chaque nœud d'arrêt (le **poids d'accessibilité**).
- Si présence de trajets: pour chaque trajet (path), calculer la somme des **poids d'accessibilité** des nœuds desservis afin de caractériser son attractivité pondérée totale.

### Cas d'utilisation

#### Préparation de la pondération des nœuds

Pour obtenir les **poids d'accessibilité** des différents nœuds d'arrêt et des trajets, l'utilisateur doit d'abord importer ou créer les nœuds d'arrêt pour son réseau. Une fois les nœuds obtenus, il téléverse un fichier de lieux d'intérêt (POIs) ou de destinations de déplacements qui **doit inclure une colonne de poids avec les poids propres pré-calculés** (Transition ne fournit pas de pondération propre). L'utilisateur choisit ensuite la formule de décroissance, la variable de décroissance (temps de parcours, distance réseau ou distance à vol d'oiseau) et la valeur de chacune des variables requises selon le choix de formule ($\beta$, $\beta_1$, $\beta_2$, $a$, $b$, $c$, $d_0$ ou $t_0$).

### Algorithme génétique

Afin de déterminer le nombre de véhicules à attribuer à chaque ligne d'un réseau candidat, l'algorithme génétique utilise les **poids d'accessibilité** assignés aux nœuds d'arrêt et dont le total a été ajouté aux trajets de chaque ligne (pour des lignes bidirectionnelles symétriques, le poids total des trajets aller et retour de la ligne sera utilisé). Lors de la configuration, l'utilisateur choisit sa source de données pour la pondération, qui a déjà été associée à une formule de décroissance et dont les **poids d'accessibilité** ont déjà été calculés.
