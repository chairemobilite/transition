# Transit Node Weighting

## Overview

Transit node weighting is a feature that allows you to calculate weights for transit stops (nodes) based on the proximity and importance of nearby points of interest (POIs), destinations, or other weighted geographic features. These weights are used by Transition's genetic algorithm to optimize the allocation of transit vehicles (buses) to different transit lines.

**Why use node weighting?**

When designing or optimizing a transit network, not all stops are equally important. A stop near a major employment center, shopping mall, or residential area should potentially receive more service than a stop in a less populated area. Node weighting helps quantify this importance, allowing the genetic algorithm to:

- Allocate more buses to transit lines that serve high-demand areas (in genetic algorithm for example)
- Optimize service frequency based on actual demand patterns
- Improve overall network efficiency by prioritizing heavily-used routes

---

## How It Works

The node weighting system works in two phases:

### Phase 1: Upload Weighted Points

You upload a file containing geographic points (locations) with associated weight values. These points represent:
- **Points of Interest (POIs)**: Employment centers, schools, hospitals, shopping centers
- **Population data**: Census tract centroids with population counts
- **Destination data**: Trip attractors/generators with associated demand values
- **Any other geographic features**: With numeric values representing their relative importance

**Supported file formats:**
- **CSV files**: Point coordinates (latitude/longitude) with a weight column
- **GeoJSON files**: Point features with weight properties
- **GeoPackage files**: Point layers with weight attributes

### Phase 2: Calculate Node Weights

For each transit stop in your network, the system:

1. **Finds nearby weighted points** within a configurable radius (default: 20 minutes walking distance, ~1.67 km)

2. **Calculates network travel times** from each weighted point to the transit stop using the road network (OSRM routing)

3. **Applies a gravitational model** to calculate the stop's weight based on:
   - The weight value of each nearby point
   - The network travel time from the point to the stop
   - The selected weighting model (see below)

4. **Stores the calculated weight** for use in transit network optimization

**The result**: Each transit stop gets a numeric weight value that reflects the total "importance" of nearby destinations, adjusted by travel time and distance.

---

## Weighting Models

Transition provides several predefined weighting models that determine how the weight of nearby points contributes to a transit stop's final weight. These models use different mathematical formulas to account for travel time and distance.

### Available Models

#### 1. Weight Only
**Calculation**: `weight`

Ignores travel time and distance. Simply sums the weights of all nearby points within the search radius. Useful when you want all points to contribute equally regardless of accessibility.

**Use case**: When you want to prioritize stops based purely on the number or total importance of nearby destinations, without considering how easy they are to reach.

---

#### 2. Gravity Models (Walking, Cycling, Driving)

These models use travel time by different modes to calculate weights. The weight contribution decreases as travel time increases, following a gravitational model similar to Newton's law of gravity.

**Gravity Model (Walking, exponent 1)**
- **Calculation**: `weight / travel_time_walking`
- **Formula**: Linear decay with walking time
- **Use case**: When pedestrians are the primary access mode to transit stops

**Gravity Model (Walking, exponent 2)**
- **Calculation**: `weight / (travel_time_walking^2)`
- **Formula**: Stronger decay with walking time (inverse square)
- **Use case**: When walking time has a strong influence on accessibility (more realistic for transit planning)

**Gravity Model (Cycling, exponent 1)**
- **Calculation**: `weight / travel_time_cycling`
- **Use case**: When cyclists are a significant user group accessing transit

**Gravity Model (Cycling, exponent 2)**
- **Calculation**: `weight / (travel_time_cycling^2)`
- **Use case**: Strong cycling-oriented accessibility weighting

**Gravity Model (Driving, exponent 1)**
- **Calculation**: `weight / travel_time_driving`
- **Use case**: When park-and-ride or kiss-and-ride access is important

**Gravity Model (Driving, exponent 2)**
- **Calculation**: `weight / (travel_time_driving^2)`
- **Use case**: Strong emphasis on driving access time

---

#### 3. Distance-Based Gravity Models

These models use straight-line (Euclidean) distance instead of network travel time.

**Gravity Model (Distance, exponent 1)**
- **Calculation**: `weight / bird_distance`
- **Formula**: Linear decay with straight-line distance
- **Use case**: When you want to weight points based on proximity alone, without considering network travel time

**Gravity Model (Distance, exponent 2)**
- **Calculation**: `weight / (bird_distance^2)`
- **Formula**: Stronger decay with distance (inverse square law)
- **Use case**: When distance has a strong influence on accessibility

---

## Configuration Options

When setting up a weight data source, you can configure:

### Maximum Access Time
- **Default**: 1200 seconds (20 minutes)
- **Purpose**: Maximum network travel time from a weighted point to a transit stop for it to be considered
- **Recommendation**: Match this to typical walking/cycling/driving times for your study area

### Maximum Bird Distance
- **Default**: 1250 meters (~1.25 km)
- **Purpose**: Maximum straight-line distance for the initial filtering step (before network routing)

---

## Workflow Example

### Step 1: Prepare Your Data

Create a CSV, GeoJSON, or GeoPackage file with your weighted points:

**CSV Example:**
```csv
longitude,latitude,weight
-73.5615,45.5017,150.5
-73.5689,45.5089,82.3
-73.5750,45.5100,120.0
```

**GeoJSON Example:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-73.5615, 45.5017]
      },
      "properties": {
        "weight": 150.5,
        "name": "Downtown Office", // ignored
        "description": "Major employment center" // ignored
      }
    }
  ]
}
```

### Step 2: Upload Weighted Points

1. Navigate to the Weighted Points upload form in Transition
2. Enter a name and description for your weight data source
3. Select your file (CSV, GeoJSON, or GeoPackage)
4. The system will detect the file format and columns
5. Select the column/property that contains the weight values
6. Choose a weighting model (e.g., "Gravity Model (Walking, exponent 2)")
7. Configure maximum access time and distance (or use defaults)
8. Upload and validate

### Step 3: Calculate Node Weights

Once weighted points are uploaded:

1. The system processes each transit stop in your network
2. For each stop, it finds weighted points within the search radius
3. Calculates network travel times (if using gravity models with travel time)
4. Applies the selected weighting model to calculate the stop's weight
5. Stores the weights in the database

### Step 4: Use in Genetic Algorithm

When running a genetic algorithm simulation:

1. The algorithm considers node weights when allocating buses to transit lines
2. Transit lines serving stops with higher weights are prioritized for additional service
3. The optimization balances multiple objectives while respecting weight constraints

---

## Best Practices

### Data Quality

- **Use accurate coordinates**: Ensure your weighted points use WGS84 (latitude/longitude) coordinates
- **Validate weights**: Ensure weight values are positive numbers representing relative importance
- **Remove duplicates**: Clean your data to avoid double-counting the same location
- **Consider scale**: Weight values should be on a consistent scale (e.g., 0-100, 0-1000, or actual counts)

### Interpretation

- **Weights are relative**: The absolute values matter less than the relative differences between stops
- **Combine with other factors**: Node weights are one factor in network optimization; consider them alongside other planning objectives
- **Validate results**: Check that high-weight stops correspond to areas you expect to be important

---

## Technical Details

### Calculation Formula

For a transit stop `n` with nearby weighted points `P`, the stop weight is calculated as:

```
node_weight(n) = Σ(p in P) [point_weight(p) / (travel_time(p, n)^α)]
```

Where:
- `point_weight(p)` is the weight value of point `p`
- `travel_time(p, n)` is the network travel time from point `p` to stop `n`
- `α` is the gravity exponent (1 for linear, 2 for inverse square)

Points are only included if:
- They are within the maximum bird distance (straight-line distance)
- The network travel time is ≤ maximum access time
- The travel time is valid (not zero, negative, or infinite)

### Data Storage

- **Weighting Models**: Stored in `tr_weighting_models` table
- **Weight Data Sources**: Stored in `tr_weight_data_sources` table
- **Calculated Node Weights**: Stored in `tr_transit_node_weights` table, linked to data sources and transit nodes

---

## Related Features

- **Genetic Algorithm Simulations**: Uses node weights for bus allocation optimization
- **Accessibility Maps**: Can use weighted points for destination-based accessibility calculations (not yet implemented)
