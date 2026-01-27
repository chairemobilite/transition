# Generalized Cost Function

This module implements a generalized cost function for evaluating transit trip quality. The function converts various trip components into a single weighted travel time value (in seconds), allowing comparison between different transit options.

## Current Scope

This implementation calculates **weighted travel time with penalties** expressed in seconds. It does **not** convert the result to a real monetary cost using value of time ($c_{tu}$, user hourly cost). The output is a dimensionless weighted time that can be used for comparing transit options, but is not expressed in currency units.

**This serves as a first template** that will be verified, validated, and updated through modeling using OD data from travel surveys or transit smart card transactions. The penalty factors and formula structure may evolve based on calibration results.

Future enhancements may include:
- Calibration and validation using real-world OD data
- Conversion to monetary cost using value of time
- Fare integration for complete cost calculations
- Crowding penalties (requires demand data)

## Mathematical Formulation

The generalized cost $C$ is calculated as:

$$C = C_ {\text{access}} + C_ {\text{egress}} + C_ {\text{first wait}} + \sum_ {k=0}^{n_ {tr}} C_ {\text{leg}}^{(k)}$$

Where $n_ {tr}$ is the number of transfers (number of legs = $n_ {tr} + 1$).

### Access and Egress Components

$$C_ {\text{access}} = \mu_ {eO}^{(m_a)} \cdot t_ {eO}$$

$$C_ {\text{egress}} = \mu_ {eD}^{(m_e)} \cdot t_ {eD}$$

Where:
- $t_ {eO}$: access travel time to first boarding stop (seconds)
- $t_ {eD}$: egress travel time from last alighting stop (seconds)
- $m_a, m_e$: access and egress modes (walking, cycling, driving)
- $\mu_ {eO}^{(m)}, \mu_ {eD}^{(m)}$: mode-specific penalty factors

### First Boarding Wait Time

$$C_ {\text{first wait}} = \mu_ {wO}^{(\text{weatherProtection}_0)} \cdot t_ {wO}$$

Where:
- $t_ {wO}$: waiting time at first boarding stop (seconds)
- $\text{weatherProtection}_0$: weather protection at first boarding stop (none, covered, indoor)
- $\mu_ {wO}^{(\text{weatherProtection})}$: weather protection-specific penalty factor for first wait

### Per-Leg Components

For each leg $k$ (0-indexed, $k \in [0, n_ {tr}]$):

$$C_ {\text{leg}}^{(k)} = C_ {\text{in-vehicle}}^{(k)} + C_ {\text{transfer}}^{(k)} + C_ {\text{headway}}^{(k)} + C_ {\text{reliability}}^{(k)}$$

#### In-Vehicle Travel Time

The in-vehicle penalty is calculated by **multiplying** the penalty factors for ROW, support, vertical alignment, and load factor:

$$C_ {\text{in-vehicle}}^{(k)} = t_ {veh}^{(k)} \times \mu_ {\text{ROW}}^{(r_k)} \times \mu_ {\text{support}}^{(s_k)} \times \mu_ {\text{verticalAlignment}}^{(v_k)} \times \mu_ {\alpha_c}^{(k)}$$

Where:
- $t_ {veh}^{(k)}$: in-vehicle travel time for leg $k$ (seconds)
- $r_k$: right-of-way category (A, B, B-, C+, C, unknown)
- $s_k$: support type (rail, tires, water, suspended, magnetic, air, hover, hydrostatic, unknown)
- $v_k$: vertical alignment (underground, surface, aerial, unknown)

**Load factor multiplier** (optional):

$$\mu_ {\alpha_c}^{(k)} = \begin{cases} \mu_ {\alpha_c} \times (\alpha_ {c,k} + 1.0) & \text{if } \alpha_ {c,k} \text{ is defined, finite, and } \geq 0 \\ 1.0 & \text{otherwise} \end{cases}$$

Where $\alpha_ {c,k}$ is the load factor for leg $k$ (value $\geq 0$).

Like other in-vehicle weights (ROW, support), the load factor weight allows flexibility:
- **$\mu_ {\alpha_c} = 1.0$**: Empty vehicle ($\alpha_c = 0$) → multiplier = 1.0 (no effect); crowded ($\alpha_c = 1$) → multiplier = 2.0 (doubles perceived time)
- **$\mu_ {\alpha_c} < 1.0$**: Models productive travel time (e.g., working on an empty train reduces perceived time)
- **$\mu_ {\alpha_c} > 1.0$**: Models strong crowding aversion

#### Transfer Components (for $k > 0$)

$$C_ {\text{transfer}}^{(k)} = \mu_ {wtr}^{(\text{weatherProtection}_k)} \cdot t_ {wtr}^{(k)} + \mu_ {tr}^{(m_a)} \cdot t_ {tr}^{(k)} + c_ {t}^{(k-1)}$$

Where:
- $t_ {wtr}^{(k)}$: waiting time at transfer boarding stop (seconds)
- $t_ {tr}^{(k)}$: non-transit travel time between transfer stops (seconds)
- $\text{weatherProtection}_k$: weather protection at boarding stop for leg $k$
- $c_ {t}^{(j)}$: transfer penalty for transfer index $j$

Transfer penalty:

$$c_ {t}^{(j)} = \begin{cases} c_ {t,j} & \text{if } j < |c_t| \\ c_ {t,\text{max}} & \text{otherwise} \end{cases}$$

Where $|c_t|$ is the number of defined transfer penalties.

#### Headway Penalty (optional, only if headway data provided for all legs)

$$C_ {\text{headway}}^{(k)} = h_k \times \mu_ {h}^{(\text{ROW}_k)}$$

Where:
- $h_k$: headway of the service for leg $k$ (seconds)
- $\mu_ {h}^{(\text{ROW}_k)}$: headway penalty factor by ROW category

#### Unreliability Penalty (optional)

$$C_ {\text{reliability}}^{(k)} = \begin{cases} \mu_ {R} \times (1 - R_k) & \text{if } R_k \in [0, 1] \\ 0 & \text{otherwise} \end{cases}$$

Where:
- $R_k$: reliability ratio for leg $k$ (ratio of on-time arrivals/departures, value between 0.0 and 1.0)
- $\mu_ {R}$: unreliability penalty weight (max penalty in seconds for completely unreliable service)
- $(1 - R_k)$: unreliability factor (100% reliable → 0 penalty, 0% reliable → full penalty)

## Complete Formula (Expanded)

$$\begin{aligned}
C = & \; \mu_ {eO}^{(m_a)} \cdot t_ {eO} + \mu_ {eD}^{(m_e)} \cdot t_ {eD} \\
& + \mu_ {wO}^{(\text{weatherProtection}_0)} \cdot t_ {wO} \\
& + \sum_ {k=0}^{n_ {tr}} \left[ t_ {veh}^{(k)} \times \mu_ {\text{ROW}}^{(r_k)} \times \mu_ {\text{support}}^{(s_k)} \times \mu_ {\text{verticalAlignment}}^{(v_k)} \times \mu_ {\alpha_c}^{(k)} \right] \\
& + \sum_ {k=1}^{n_ {tr}} \left[ \mu_ {wtr}^{(\text{weatherProtection}_k)} \cdot t_ {wtr}^{(k)} + \mu_ {tr}^{(m_a)} \cdot t_ {tr}^{(k)} + c_ {t}^{(k-1)} \right] \\
& + \sum_ {k=0}^{n_ {tr}} \left[ h_k \times \mu_ {h}^{(\text{ROW}_k)} \right] \quad \text{(if headway data available for all legs)} \\
& + \sum_ {k=0}^{n_ {tr}} \left[ \mu_ {R} \times (1 - R_k) \right] \quad \text{(if reliability data available)}
\end{aligned}$$

*** All input time and headways must be in seconds ***

## Symbol Summary

| Symbol | Description | Unit |
|--------|-------------|------|
| $t_ {eO}$ | Access travel time | s |
| $t_ {eD}$ | Egress travel time | s |
| $t_ {wO}$ | Origin waiting time | s |
| $t_ {wtr}^{(k)}$ | Transfer waiting time at leg $k$ | s |
| $t_ {tr}^{(k)}$ | Transfer travel time to leg $k$ | s |
| $t_ {veh}^{(k)}$ | In-vehicle travel time for leg $k$ | s |
| $h_k$ | Headway for leg $k$ | s |
| $R_k$ | Reliability ratio for leg $k$ | - |
| $\alpha_ {c,k}$ | Load factor for leg $k$ | - |
| $n_ {tr}$ | Number of transfers | - |
| $c_ {t}^{(j)}$ | Transfer penalty for transfer $j$ | s |
| $\mu$ | Penalty factor (weight) | - |

## Notes

### Constraints

**All weights ($\mu$) must be $\geq 0$**. This ensures penalties can never be negative:
- Weights in range $(0, 1)$: reduce perceived time (e.g., productive travel on comfortable train)
- Weight $= 1$: neutral (no adjustment)
- Weight $> 1$: increase perceived time (penalty)

**All input time values must be $\geq 0$** (accessTravelTimeSeconds, inVehicleTravelTimeSeconds, etc.).

**Penalties for transfers and headway must be $\geq 0$** ($c_ {t}^{(j)}$ and $c_ {t,\text{max}}$).

### Behavior Notes

- **Multiplicative in-vehicle factors**: ROW, support, vertical alignment, and load factor penalties are **multiplied** together (not added)
- **All-or-nothing headway**: If headway data is missing for any leg, headway costs are excluded for the entire trip
- **Transfer penalty fallback**: When the transfer index exceeds defined penalties, $c_ {t,\text{max}}$ is used
- **Weather protection**: Affects waiting time penalties at boarding stops
- **Load factor**: The load factor value $\alpha_ {c,k}$ must be $\geq 0$ (0.0 = empty, 0.5 = good comfort, 1.0 = low comfort, > 1.0 = crowded). The effective multiplier is $\mu_ {\alpha_c} \times (\alpha_ {c,k} + 1.0)$. With weight in $(0, 1)$, this can reduce perceived time (e.g., productive work time on empty train); with weight $\geq 1$, it increases perceived time (crowding penalty)
- **Reliability ratio**: On-time performance ratio, must be in range [0.0, 1.0]. Higher values indicate better reliability. The penalty uses $(1 - R_k)$ so that 100% reliable service adds no penalty
- **Optional components**: Load factor is ignored when undefined, not finite, or negative. Reliability ratio is ignored when undefined, not finite, or outside [0, 1] range

## Simplified Configuration

If you don't need differentiated penalty factors for ROW, support, vertical alignment, weather protection, or load factor, you can simplify the configuration:

1. Set all values in `inVehicleTravelTimeWeightByROW`, `inVehicleTravelTimeWeightBySupport`, and `inVehicleTravelTimeWeightByVerticalAlignment` to `1.0`
2. Set `inVehicleTravelTimeWeightForLoadFactor` to `1.0` (or ensure load factor values are undefined)
3. Change only the `unknown` value to your desired single in-vehicle time penalty factor

For example, to use a single in-vehicle time penalty of `0.9`:

```typescript
inVehicleTravelTimeWeightByROW: {
    A: 1.0, B: 1.0, 'B-': 1.0, 'C+': 1.0, C: 1.0, unknown: 0.9
},
inVehicleTravelTimeWeightBySupport: {
    rail: 1.0, tires: 1.0, water: 1.0, suspended: 1.0,
    magnetic: 1.0, air: 1.0, hover: 1.0, hydrostatic: 1.0, unknown: 1.0
},
inVehicleTravelTimeWeightByVerticalAlignment: {
    surface: 1.0, aerial: 1.0, underground: 1.0, unknown: 1.0
}
```

Then set all your leg data to use `rightOfWayCategory: 'unknown'`, `support: 'unknown'`, and `verticalAlignment: 'unknown'`. The result will be: $C_ {\text{in-vehicle}}^{(k)} = t_ {veh}^{(k)} \times 0.9 \times 1.0 \times 1.0 = 0.9 \cdot t_ {veh}^{(k)}$

The same approach works for weather protection: set all values to `1.0` except `unknown`, and use `weatherProtection: 'unknown'` in your data.

## Penalty Factor Types Summary

| Component | Penalty Factor | Notes |
|-----------|----------------|-------|
| Access time | $\mu_ {eO}^{(m)}$ by mode | Additive |
| Egress time | $\mu_ {eD}^{(m)}$ by mode | Additive |
| First waiting time | $\mu_ {wO}^{(\text{weatherProtection})}$ | Additive |
| Transfer waiting time | $\mu_ {wtr}^{(\text{weatherProtection})}$ | Additive |
| Transfer travel time | $\mu_ {tr}^{(m)}$ by access mode | Additive |
| Transfer penalty | $c_ {t}^{(j)}$ by index | Additive |
| In-vehicle time | $\mu_ {\text{ROW}} \times \mu_ {\text{support}} \times \mu_ {\text{verticalAlignment}} \times \mu_ {\alpha_c}$ | **Multiplicative** |
| Headway penalty | $\mu_ {h}^{(\text{ROW})}$ | Additive |
| Unreliability penalty | $\mu_ {R} \times (1 - R_k)$ | Additive |

## References

For detailed symbol definitions and theoretical background, see the [Overleaf documentation](https://www.overleaf.com/read/dtxfhttxgjrx).
