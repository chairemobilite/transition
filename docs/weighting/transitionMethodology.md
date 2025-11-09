# Methodology Used in Transition for Weighting

## Weighting of Stop Nodes and Paths

Transition implements multiple decay formulas and can use distance or travel time as the input variable for the [formula](poiAndTransitNodeWeighting.md#distance-and-travel-time-decay-functions). See [weighting types](/packages/transition-backend/src/services/weighting/types.ts) for more info.

### Decay Formulas Available in Transition

- Power
- Exponential
- Gamma
- Combined
- Logistic

### Weighting Steps and Specifications

- Import of points of interest, homes and/or OD origins/destinations (POIs) by uploading a CSV or GeoJSON file
- Calculation of walking path between POIs and stop nodes within 1.67 km or less as the crow flies (20 min at 5km/h).
- Calculation of the weight of each POI using the decay formula (using network distance, Euclidean/bird's-eye distance or walking travel time according to the user's choice)
- Calculation of the sum of the weights of accessible POIs for each stop node
- If transit paths are present: for each path, calculate the sum of the weights of the served nodes to characterize its total weighted attractiveness.

### Use Cases

#### Preparation for Node Weighting

To obtain the weights of the different stop nodes and paths, the user must first import or create the stop nodes for their network. Once the nodes are obtained, they upload a file of points of interest (POIs), choose the decay formula, the decay variable (travel time, network distance or bird's-eye distance) and the value of each required variable according to the formula choice ($\beta$, $\beta_1$, $\beta_2$, $a$, $b$, $c$, $d_0$ or $t_0$). TODO: detail how to import data for node weighting (not yet implemented)

#### Genetic Algorithm

To determine the number of vehicles to assign to each line in a candidate network, the genetic algorithm uses the weights assigned to the stop nodes, whose totals have been added to the paths of each line (for symmetrical bidirectional lines, the total weight of the outbound and return paths of the line will be used). During configuration, the user chooses their data source for weighting, which has already been associated with a decay formula and for which the weights have already been calculated.
