# Streaming Node Weighting in Transit Network Design

This document describes the **streaming node weighting** used in the transit network design flow when node weighting is enabled (OD trips or POI-based).

## Overview

Node weighting assigns a numeric weight to each transit node based on the proximity of points of interest (POIs) or origin–destination (OD) points. The result is written to `node_weights.csv` in the job directory and applied to the node collection when the evolutionary job runs. Path and simulation logic use these weights (e.g. `properties.data.weight`) for fitness or display.

## Streaming Approach

- **No in-memory POI FeatureCollection**: The demand or POI file is never fully loaded. It is read in a **streamed** way (row-by-row via CSV parsing).
- **Inverse aggregation**: For each POI (or OD origin/destination point), we query **which transit nodes are reachable on foot within the configured maximum walking time** (e.g. 20 minutes). We maintain a single **map: node UUID → weight**. For each such node we add:  
  `weight += intrinsicWeight * decay(travelTimeSeconds)`  
  where decay uses the configured function (power, exponential, gamma, combined, or logistic) and parameters.
- **Output**: After the file is fully processed, the map is written to `node_weights.csv` (columns: `node_uuid`, `weight`). Only nodes with weight &gt; 0 are written.

## Parameters

- **Max walking time**: Configurable (e.g. 20 min in seconds). Used as the OSRM travel-time cutoff: only nodes reachable within this time by walking are considered.
- **Bird-distance pre-filter**: Before calling OSRM, candidate nodes are reduced using a bird-distance radius:  
  `maxRadiusMeters = maxWalkingTimeSeconds × walkingSpeedMps`  
  (walking speed from preferences or default). Only nodes within this radius are sent to OSRM, which reduces request size and keeps the algorithm scalable.
- **Decay**: Applied on **travel time** (walking time from OSRM). Decay type and parameters (e.g. beta for power/exponential) are configurable; see weighting types in `transition-common` and decay options in the network design form.
- **Routing**: OSRM **walking** profile via `tableFrom(origin: POI, destinations: candidate nodes)`. Same routing engine as the rest of the application.

## Manual Trigger

Weighting is **not** run automatically when the job is created. The user starts it manually from the network design form (**Start weighting**). The form shows progress and **Node weighting complete** when finished. The job can then be run; at runtime, if node weighting was enabled but `node_weights.csv` is missing, the job fails with a clear error asking the user to run **Start weighting** first.

## References

- Decay functions and parameters: `transition-backend` `DecayFunctionCalculator`, `transition-common` weighting types.
- Streaming implementation: `transition-backend` `StreamingNodeWeightingService`.
- Node weights in paths: `transition-common` `Path` (`properties.data.weight`, `getTotalWeight`).
