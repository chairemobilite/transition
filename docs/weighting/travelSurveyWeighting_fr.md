# Pondération dans les enquêtes de déplacement : Rendre les échantillons représentatifs

**Justification** Le processus de pondération des enquêtes de déplacement n'est pas implémentée dans Transition, mais une courte introduction est utile pour comprendre comment fonctionne la pondération et pour quelles raisons il est important d'avoir des données d'entrée pondérées lorsqu'elles sont disponibles. Lors de l'importation d'un fichier de déplacements provenant d'une enquête Origine-Destination dans Transition pour des calculs de chemin ou comme données entrantes pour la conception de réseaux, une colonne de poids peut être incluse (TODO: la sélection de la colonne de poids lors de l'importation d'un fichier n'est pas encore implémentée).

La **pondération des enquêtes de déplacement** transforme les données d'échantillon en estimations représentatives de la population en attribuant des poids numériques aux ménages, aux personnes et/ou aux déplacements. Ces poids peuvent corriger les probabilités de sélection inégales, les biais de non-réponse ou le désalignement avec les distributions démographiques connues, garantissant qu'une enquête portant sur un petit pourcentage de ménages (généralement entre 0,5 et 10%) peut représenter avec précision la population totale. Sans pondération appropriée, les estimations du comportement de déplacements représenteraient systématiquement de manière erronée les modèles réels de la population, conduisant à des décisions de planification des transports incorrectes.

## L'architecture de pondération en trois étapes

La pondération des enquêtes de déplacement suit une structure hiérarchique qui construit progressivement des représentations plus précises de la population. Le processus commence par une certitude mathématique (l'inverse de la probabilité de sélection) puis superpose des corrections empiriques pour ceux qui répondent réellement et comment ils diffèrent des totaux du recensement.

Les **poids de conception** forment la base, calculés comme $w_i = 1/p_i$ où $p_i$ représente la probabilité que l'unité $i$ ait été sélectionnée dans l'échantillon. Pour les échantillons stratifiés, cela tient compte du suréchantillonnage délibéré de zones géographiques ou de groupes démographiques spécifiques. Un ménage dans une strate rurale de faible densité avec un taux d'échantillonnage de 1/50 reçoit un poids initial de 50, ce qui signifie qu'il représente 50 ménages similaires. Ces poids garantissent que la structure mathématique du plan d'échantillonnage est préservée dans toutes les estimations.

La calibration complète le processus en ajustant les distributions d'échantillon pondérées pour correspondre aux totaux de population connus. L'ajustement proportionnel itératif ("raking") est devenu la méthode dominante, ajustant les poids pour correspondre à plusieurs distributions marginales sans nécessiter la connaissance de leur distribution conjointe, mais d'autres méthodes existent également.

## Pondération hiérarchique à travers les ménages, les personnes et les déplacements

Les enquêtes de déplacement collectent intrinsèquement des données imbriquées: les ménages contiennent des personnes qui effectuent des déplacements. Cette structure nécessite potentiellement trois ensembles de poids distincts mais liés, chacun s'appuyant sur le niveau précédent tout en ajoutant des ajustements appropriés. Certaines enquêtes pondèrent uniquement les ménages, d'autres pondèrent à la fois les ménages et les personnes, et d'autres encore pondèrent séparément les ménages, les personnes et les déplacements.

## Références clés

[UK Department for Transport (2024). National Travel Survey Weighting Review.](https://www.gov.uk/government/publications/future-developments-for-the-nts/)

Verreault, H., & Morency, C. (2024). Multi-frame sampling in household travel surveys: a Montreal case study. Transportation Research Procedia, 76, 13-24. DOI: 10.1016/j.trpro.2023.12.034

[Ipsos (2022). 2022 NHTS Weighting Plan.](https://nhts.ornl.gov/media/2022/doc/2022_NextGen_NHTS_Weighting_Memo.pdf)

Haziza, D., & Beaumont, J.-F. (2017). Construction of Weights in Surveys: A Review. Statistical Science, 32(2), 206-226. DOI: 10.1214/16-STS608

[Roth, S.B., DeMatteis, J., & Dai, Y. (2017). 2017 NHTS Weighting Report. Federal Highway Administration.](https://nhts.ornl.gov/assets/2017_NHTS_Weighting_Report.pdf)

[Lavallée, P., & Beaumont, J.-F. (2015). Why We Should Put Some Weight on Weights. Survey Insights: Methods from the Field.](https://surveyinsights.org/?p=6255)

Kolenikov, S. (2014). Calibrating Survey Data using Iterative Proportional Fitting (Raking). Stata Journal, 14(1), 22-59. DOI: 10.1177/1536867X1401400104

National Research Council (2013). Nonresponse in Social Science Surveys. National Academies Press. DOI: 10.17226/18293

[Battaglia, M.P., Hoaglin, D.C., & Frankel, M.R. (2009). Practical Considerations in Raking Survey Data. Survey Practice, 2(5).](https://www.surveypractice.org/article/2953)

Madre, J.L., Axhausen, K.W., & Bricka, S. (2007). The European Harmonization of Travel Surveys. Transport Reviews, 27(1), 101-117. DOI: 10.1080/01441640600746973

Deville, J.-C., & Särndal, C.-E. (1992). Calibration Estimators in Survey Sampling. Journal of the American Statistical Association, 87(418), 376-382. DOI: 10.1080/01621459.1992.10475217

