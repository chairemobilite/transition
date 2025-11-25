# Weighting in Travel Surveys: Making Samples Representative

**Rationale** Travel survey weighting process is not implemented in Transition, but a short introduction is useful to understand how weighting work and why having weighted input data is important when available. When data from travel surveys are imported into Transition for a routing calculation or a network design process, the weight of each trip and/or POI can be provided in one of the columns of the imported file (TODO: the weight column selection is not yet implemented though).

**Travel survey weighting** transforms sample data into population-representative estimates by assigning numerical weights to households, persons, and/or trips. These weights can correct for unequal selection probabilities, non-response bias, or misalignment with known demographic distributions, ensuring that a survey of a small percentage of households (usually between 0.5 and 10%) can accurately represent the total population. Without proper weighting, travel behavior estimates would systematically misrepresent actual population patterns, leading to incorrect transportation planning decisions.

## The three-stage weighting architecture

Travel survey weighting follows a hierarchical structure that builds progressively more accurate population representations. The process begins with mathematical certainty—the inverse probability of selection—then layers on empirical corrections for who actually responds and how they differ from census totals.

**Design weights** form the foundation, calculated as $w_i = 1/p_i$ where $p_i$ represents the probability that unit $i$ was selected into the sample. For stratified samples, this accounts for deliberate oversampling of specific geographic areas or demographic groups. A household in a low-density rural stratum with sampling rate 1/50 receives initial weight 50, meaning it represents 50 similar households. These weights ensure that the mathematical structure of the sampling design is preserved in all estimates.

Calibration completes the process by adjusting weighted sample distributions to match known population totals. **Raking** (iterative proportional fitting) has become the dominant method, adjusting weights to match multiple marginal distributions without requiring knowledge of their joint distribution, but other methods exist.

## Hierarchical weighting across households, persons, and trips

Travel surveys inherently collect nested data: households contain persons who make trips. This structure requires possibly three related but distinct sets of weights, each building on the previous level while adding appropriate adjustments. Some surveys weight only households,  some weight both the households and persons, and some others weight households, persons and trips separately.

## Connection to Intrinsic Weights

The final weights calculated through this process (design weights adjusted by calibration) attached to a trip destination, a person, or a household effectively become its **Intrinsic Weight** ($W_j$) in gravity models and accessibility calculations.

For example:
- If a surveyed trip to a shopping mall has a final weight of 50, that destination contributes 50 units of "attraction" (**intrinsic weight**) to the accessibility calculation of nearby transit nodes.
- If a household has a weight of 20, it represents 20 households at that location, contributing to the **intrinsic weight** of that origin point for trip generation.
- To weight a residential building, we usually use the sum of the **intrinsic weights** of all households or persons living in the whole building, depending if we want a household weight or a person weight.

## Key references

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
