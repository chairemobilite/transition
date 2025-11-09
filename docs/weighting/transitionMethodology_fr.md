# Méthodologie utilisée dans Transition pour la pondération

## Pondération des nœuds d'arrêt et des trajets

Transition implémente plusieurs formules de décroissance et utilise soit la distance ou le temps de parcours comme variable d'entrée de la [formule](poiAndTransitNodeWeighting_fr.md#fonctions-de-décroissance-en-fonction-de-la-distance-et-du-temps-de-déplacement). Voir les [types pour la pondération](/packages/transition-backend/src/services/weighting/types.ts) pour plus d'information.

### Formules de décroissance disponibles dans Transition

- Puissance
- Exponentielle
- Gamma
- Combinée
- Logistique

### Étapes de pondération et spécification

- Importation des lieux d'intérêt, domiciles et/ou origines/destinations OD (POIs) par le téléversement d'un fichier CSV ou GeoJSON
- Calcul de chemin à pied entre les POIs et les nœuds d'arrêt distants de 1.67 km ou moins à vol d'oiseau (20 min à 5km/h).
- Calcul du poids de chaque POI au moyen de la formule de décroissance (utilisant la distance réseau, la distance Euclidienne/à vol d'oiseau ou le temps de parcours à pied selon le choix de l'utilisateur)
- Calcul de la somme des poids des POIs accessibles pour chaque nœud d'arrêt
- Si présence de trajets: pour chaque trajet (path), calculer la somme des poids des nœuds desservis afin de caractériser son attractivité pondérée totale.

### Cas d'utilisation

#### Préparation de la pondération des nœuds

Pour obtenir les poids des différents nœuds d'arrêt et des trajets, l'utilisateur doit d'abord importer ou créer les nœuds d'arrêt pour son réseau. Une fois les nœuds obtenus, il téléverse un fichier de lieux d'intérêt (POIs), choisit la formule de décroissance, la variable de décroissance (temps de parcours, distance réseau ou distance à vol d'oiseau) et la valeur de chacune des variables requises selon le choix de formule ($\beta$, $\beta_1$, $\beta_2$, $a$, $b$, $c$, $d_0$ ou $t_0$). TODO: détailler la procédure exacte (pas encore implémenté).

### Algorithme génétique

Afin de déterminer le nombre de véhicules à attribuer à chaque ligne d'un réseau candidat, l'algorithme génétique utilise les poids assignés aux nœuds d'arrêt et dont le total a été ajouté aux trajets de chaque ligne (pour des lignes bidirectionnelles symétriques, le poids total des trajets aller et retour de la ligne sera utilisé). Lors de la configuration, l'utilisateur choisit sa source de données pour la pondération, qui a déjà été associée à une formule de décroissance et dont les poids ont déjà été calculés.
