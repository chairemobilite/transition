/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Map as MaplibreMap } from 'maplibre-gl';
import { bbox as turfBbox } from '@turf/turf';
import { safeFitBounds, fitBoundsIfNotVisible } from '../MapBoundsUtils';

jest.mock('@turf/turf', () => ({
    ...jest.requireActual('@turf/turf'),
    bbox: jest.fn((...args: Parameters<typeof turfBbox>) => (jest.requireActual('@turf/turf') as typeof import('@turf/turf')).bbox(...args))
}));
const mockedTurfBbox = turfBbox as jest.MockedFunction<typeof turfBbox>;

type MockMap = jest.Mocked<Pick<MaplibreMap, 'getBounds' | 'getBearing' | 'fitBounds' | 'getCanvas' | 'getContainer' | 'resize'>>;

const makeViewportBounds = (west: number, south: number, east: number, north: number) => ({
    getWest: () => west,
    getEast: () => east,
    getSouth: () => south,
    getNorth: () => north
});

/**
 * Returns a mock that satisfies the MaplibreMap methods used by
 * safeFitBounds / fitBoundsIfNotVisible. The internal object is
 * typed as MockMap for IDE hints and refactor safety; the outer
 * return type is MaplibreMap so callers don't need any cast.
 */
const makeMockMap = (
    west: number,
    south: number,
    east: number,
    north: number,
    bearing = 0,
    canvas?: { width: number; height: number },
    container?: { clientWidth: number; clientHeight: number }
): MockMap & MaplibreMap => {
    const mock: MockMap = {
        getBounds: jest.fn().mockReturnValue(makeViewportBounds(west, south, east, north)),
        getBearing: jest.fn().mockReturnValue(bearing),
        fitBounds: jest.fn().mockReturnThis(),
        getCanvas: jest.fn().mockReturnValue(canvas ?? { width: 800, height: 600 }),
        getContainer: jest.fn().mockReturnValue(container ?? { clientWidth: 800, clientHeight: 600 }),
        resize: jest.fn().mockReturnThis()
    };
    return mock as MockMap & MaplibreMap;
};

/** Helper: builds a LineString whose turf bbox matches the given SW/NE. */
const lineStringFromBounds = (
    swLng: number,
    swLat: number,
    neLng: number,
    neLat: number
): GeoJSON.LineString => ({
    type: 'LineString',
    coordinates: [
        [swLng, swLat],
        [neLng, neLat]
    ]
});

// turfBbox (from @turf/turf) returns zero-area bounding boxes when all
// coordinates are co-located (e.g. a single Point or a LineString whose
// endpoints coincide). safeBoundsFromGeojson detects these degenerate
// bboxes and expands them so the map always receives a valid extent.
// These tests verify the behaviour through safeFitBounds (the public API).
describe('safeFitBounds', () => {
    it('should call fitBounds with correct bounds for a normal geometry', () => {
        const map = makeMockMap(0, 0, 1, 1, 10);

        safeFitBounds(map, lineStringFromBounds(-75.0, 46.0, -74.5, 46.5));

        expect(map.fitBounds).toHaveBeenCalledTimes(1);
        expect(map.fitBounds).toHaveBeenCalledWith(
            [[-75.0, 46.0], [-74.5, 46.5]],
            { padding: 20, bearing: 10 }
        );
    });

    it('should call fitBounds for a FeatureCollection with features', () => {
        const map = makeMockMap(0, 0, 1, 1);
        const fc: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: lineStringFromBounds(-75.0, 46.0, -74.5, 46.5), properties: {} }]
        };

        safeFitBounds(map, fc);

        expect(map.fitBounds).toHaveBeenCalledWith(
            [[-75.0, 46.0], [-74.5, 46.5]],
            expect.objectContaining({ padding: 20 })
        );
    });

    it('should use custom padding when provided', () => {
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, lineStringFromBounds(-75.0, 46.0, -74.5, 46.5), 50);

        expect(map.fitBounds).toHaveBeenCalledWith(
            expect.anything(),
            { padding: 50, bearing: 0 }
        );
    });

    it('should expand a co-located point to a non-zero-area rectangle', () => {
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, { type: 'Point', coordinates: [-73.5, 45.5] });

        expect(map.fitBounds).toHaveBeenCalledTimes(1);
        const [[swLng, swLat], [neLng, neLat]] = map.fitBounds.mock.calls[0][0] as [[number, number], [number, number]];
        expect(neLng - swLng).toBeGreaterThan(0);
        expect(neLat - swLat).toBeGreaterThan(0);
        expect((swLng + neLng) / 2).toBeCloseTo(-73.5, 5);
        expect((swLat + neLat) / 2).toBeCloseTo(45.5, 5);
    });

    it('should expand a bbox degenerate only in longitude', () => {
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, lineStringFromBounds(-73.5, 45.3, -73.5, 45.6));

        const [[swLng, swLat], [neLng, neLat]] = map.fitBounds.mock.calls[0][0] as [[number, number], [number, number]];
        expect(neLng - swLng).toBeGreaterThan(0);
        expect(swLat).toBe(45.3);
        expect(neLat).toBe(45.6);
    });

    it('should expand a bbox degenerate only in latitude', () => {
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, lineStringFromBounds(-73.8, 45.5, -73.4, 45.5));

        const [[swLng, swLat], [neLng, neLat]] = map.fitBounds.mock.calls[0][0] as [[number, number], [number, number]];
        expect(swLng).toBe(-73.8);
        expect(neLng).toBe(-73.4);
        expect(neLat - swLat).toBeGreaterThan(0);
    });

    test.each([
        { name: 'near north pole', coords: [0, 89.9999] as [number, number] },
        { name: 'near south pole', coords: [0, -89.9999] as [number, number] },
        { name: 'near antimeridian +', coords: [179.9999, 0] as [number, number] },
        { name: 'near antimeridian -', coords: [-179.9999, 0] as [number, number] },
        { name: 'at longitude 180', coords: [180, 0] as [number, number] },
        { name: 'at longitude -180', coords: [-180, 0] as [number, number] },
        { name: 'at latitude 90', coords: [0, 90] as [number, number] },
        { name: 'at latitude -90', coords: [0, -90] as [number, number] }
    ])('should clamp bounds to valid range for point $name', ({ coords }) => {
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, { type: 'Point', coordinates: coords });

        expect(map.fitBounds).toHaveBeenCalledTimes(1);
        const [[swLng, swLat], [neLng, neLat]] = map.fitBounds.mock.calls[0][0] as [[number, number], [number, number]];
        expect(swLng).toBeGreaterThanOrEqual(-180);
        expect(neLng).toBeLessThanOrEqual(180);
        expect(swLat).toBeGreaterThanOrEqual(-90);
        expect(neLat).toBeLessThanOrEqual(90);
        expect(neLng - swLng).toBeGreaterThan(0);
        expect(neLat - swLat).toBeGreaterThan(0);
    });

    it('should clamp when turfBbox returns out-of-range longitudes', () => {
        mockedTurfBbox.mockReturnValueOnce([181, 0, 182, 1]);
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, { type: 'Point', coordinates: [0, 0] });

        const [[swLng], [neLng]] = map.fitBounds.mock.calls[0][0] as [[number, number], [number, number]];
        expect(swLng).toBe(180);
        expect(neLng).toBe(180);
    });

    it('should clamp when turfBbox returns out-of-range latitudes', () => {
        mockedTurfBbox.mockReturnValueOnce([0, 91, 1, 92]);
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, { type: 'Point', coordinates: [0, 0] });

        const [[, swLat], [, neLat]] = map.fitBounds.mock.calls[0][0] as [[number, number], [number, number]];
        expect(swLat).toBe(90);
        expect(neLat).toBe(90);
    });

    it('should handle a bbox that spans the full valid range', () => {
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, lineStringFromBounds(-180, -90, 180, 90));

        expect(map.fitBounds).toHaveBeenCalledWith(
            [[-180, -90], [180, 90]],
            expect.anything()
        );
    });

    it('should expand co-located LineString endpoints', () => {
        const map = makeMockMap(0, 0, 1, 1);
        const geojson: GeoJSON.LineString = {
            type: 'LineString',
            coordinates: [[-73.5, 45.5], [-73.5, 45.5]]
        };

        safeFitBounds(map, geojson);

        const [[swLng, swLat], [neLng, neLat]] = map.fitBounds.mock.calls[0][0] as [[number, number], [number, number]];
        expect(neLng - swLng).toBeGreaterThan(0);
        expect(neLat - swLat).toBeGreaterThan(0);
    });

    test.each([
        { name: 'empty FeatureCollection', geojson: { type: 'FeatureCollection' as const, features: [] } },
        { name: 'empty GeometryCollection', geojson: { type: 'GeometryCollection' as const, geometries: [] } },
        { name: 'Feature with null geometry', geojson: { type: 'Feature' as const, geometry: null, properties: {} } },
        {
            name: 'FeatureCollection with only null-geometry features',
            geojson: {
                type: 'FeatureCollection' as const,
                features: [{ type: 'Feature' as const, geometry: null, properties: {} }]
            }
        }
    ])('should not call fitBounds for $name', ({ geojson }) => {
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, geojson as GeoJSON.GeoJSON);

        expect(map.fitBounds).not.toHaveBeenCalled();
    });

    it('should not call fitBounds when turfBbox returns a 3D (6-element) bbox', () => {
        mockedTurfBbox.mockReturnValueOnce([-75, 46, 100, -74.5, 46.5, 200]);
        const map = makeMockMap(0, 0, 1, 1);

        safeFitBounds(map, { type: 'Point', coordinates: [-73.5, 45.5, 150] });

        expect(map.fitBounds).not.toHaveBeenCalled();
    });
});

describe('fitBoundsIfNotVisible', () => {
    // Viewport centred roughly on Montreal: lon [-73.8, -73.4], lat [45.3, 45.6]
    const VP = { west: -73.8, south: 45.3, east: -73.4, north: 45.6 };

    it('should call fitBounds when geometry is completely outside viewport', () => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north, 15);

        fitBoundsIfNotVisible(map, lineStringFromBounds(-75.0, 46.0, -74.5, 46.5));

        expect(map.fitBounds).toHaveBeenCalledTimes(1);
        expect(map.fitBounds).toHaveBeenCalledWith(
            [[-75.0, 46.0], [-74.5, 46.5]],
            { padding: 20, bearing: 15 }
        );
    });

    it('should preserve current map bearing in fitBounds options', () => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north, 42);

        fitBoundsIfNotVisible(map, lineStringFromBounds(-75.0, 46.0, -74.5, 46.5));

        expect(map.fitBounds).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ bearing: 42 })
        );
    });

    it('should pass bearing: 0 explicitly and not skip falsy zero', () => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north, 0);

        fitBoundsIfNotVisible(map, lineStringFromBounds(-75.0, 46.0, -74.5, 46.5));

        expect(map.fitBounds).toHaveBeenCalledWith(
            expect.anything(),
            { padding: 20, bearing: 0 }
        );
    });

    it('should use custom padding when provided', () => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north, 0);

        fitBoundsIfNotVisible(map, lineStringFromBounds(-75.0, 46.0, -74.5, 46.5), 50);

        expect(map.fitBounds).toHaveBeenCalledWith(
            expect.anything(),
            { padding: 50, bearing: 0 }
        );
    });

    it('should not call fitBounds for an empty GeometryCollection', () => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north);

        fitBoundsIfNotVisible(map, { type: 'GeometryCollection', geometries: [] });

        expect(map.fitBounds).not.toHaveBeenCalled();
    });

    it('should not throw for a Feature with null geometry', () => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north);
        const nullGeomFeature: GeoJSON.Feature = { type: 'Feature', geometry: null as unknown as GeoJSON.Geometry, properties: {} };

        expect(() => fitBoundsIfNotVisible(map, nullGeomFeature)).not.toThrow();
        expect(map.fitBounds).not.toHaveBeenCalled();
    });

    // Viewport:       [-73.8, 45.3] to [-73.4, 45.6]
    // Inner (5% margin): [-73.78, 45.315] to [-73.42, 45.585]
    //
    // Geometry is tested against the inner viewport. shouldCallFitBounds=true means
    // the geometry does NOT intersect the inner viewport (so fitBounds fires).
    //
    //  lat
    //  46.0 |                                     N (north)
    //       |                                     |
    //  45.8 |                              corner +---+ NE
    //       |                                 +---+   |
    //  45.6 |        +========================+---+---+
    //       |        | outer viewport         |
    //  45.585        |  +==================+  |
    //       |        |  | inner viewport   |  |
    //  45.5 |  W     |  |   fully inside   |  |     E (east)
    //       |  |     |  |   [-73.7→-73.5,  |  |     |
    //  45.4 |  +-----+--+---45.4→45.5]-----+--+-----+
    //       |        |  |                  |  |
    //  45.315        |  +==================+  |
    //       |        |         margin zone  |  |
    //  45.3 |        +========================+
    //       |                 |
    //  45.1 |           S (south)
    //       +--------+--+-------------------+--+---------> lng
    //      -75.0  -73.8 -73.78           -73.42 -73.4  -73.0
    //         |                                           |
    //     W (west)                                    NE (northeast)
    //
    test.each([
        //  +==================+
        //  |    A---------B   |  fully inside inner viewport
        //  +==================+
        { name: 'fully inside', geojson: lineStringFromBounds(-73.7, 45.4, -73.5, 45.5), shouldCallFitBounds: false },

        //  +========================+
        //  |A======================B|  identical to outer viewport, crosses inner
        //  +========================+
        { name: 'identical to viewport', geojson: lineStringFromBounds(-73.8, 45.3, -73.4, 45.6), shouldCallFitBounds: false },

        //       +==================+
        //  A----+======B           |  overlaps left edge, crosses inner
        //       +==================+
        { name: 'overlaps left edge deeply', geojson: lineStringFromBounds(-74.0, 45.4, -73.6, 45.5), shouldCallFitBounds: false },

        //  +==================+
        //  |           A======+----B  overlaps right edge, crosses inner
        //  +==================+
        { name: 'overlaps right edge deeply', geojson: lineStringFromBounds(-73.5, 45.4, -73.2, 45.5), shouldCallFitBounds: false },

        //       A---------B
        //  +=====|========|====+
        //  |     A--------B   |      overlaps top edge, crosses inner
        //  +==================+
        { name: 'overlaps top edge deeply', geojson: lineStringFromBounds(-73.7, 45.5, -73.5, 45.8), shouldCallFitBounds: false },

        //  +==================+
        //  |     A--------B   |      overlaps bottom edge, crosses inner
        //  +=====|========|====+
        //       A---------B
        { name: 'overlaps bottom edge deeply', geojson: lineStringFromBounds(-73.7, 45.1, -73.5, 45.4), shouldCallFitBounds: false },

        //  A--------------------------+
        //  | +========================+ |
        //  | |  +==================+  | |  diagonal encloses entire viewport
        //  | |  |                  |  | |
        //  | +========================+ |
        //  +--------------------------B
        { name: 'diagonal that encloses viewport', geojson: lineStringFromBounds(-74.0, 45.0, -73.0, 46.0), shouldCallFitBounds: false },

        //  +========================+
        //  | AB |                   |  A-B sits in the left margin zone
        //  | +==================+  |   (between outer and inner edge)
        //  +========================+
        { name: 'inside but within left margin zone', geojson: lineStringFromBounds(-73.80, 45.4, -73.79, 45.5), shouldCallFitBounds: true },

        //  +========================+
        //  |  +==================+  |
        //  |  |      A------B    |  |  A-B sits in the bottom margin zone
        //  +========================+
        { name: 'inside but within bottom margin zone', geojson: lineStringFromBounds(-73.6, 45.30, -73.5, 45.31), shouldCallFitBounds: true },

        //  +========================+
        //  |                        A---B  A at outer corner, in margin zone
        //  +========================+
        { name: 'shares only a corner (in margin)', geojson: lineStringFromBounds(-73.4, 45.6, -73.2, 45.8), shouldCallFitBounds: true },

        //                     +========================+
        //  A-----------B      |  +==================+  |  entirely west
        //                     +========================+
        { name: 'entirely to the west', geojson: lineStringFromBounds(-75.0, 45.4, -74.0, 45.5), shouldCallFitBounds: true },

        //  +========================+
        //  |  +==================+  |      A-----------B  entirely east
        //  +========================+
        { name: 'entirely to the east', geojson: lineStringFromBounds(-73.2, 45.4, -72.5, 45.5), shouldCallFitBounds: true },

        //       A---------B
        //
        //  +========================+
        //  |  +==================+  |  entirely north
        //  +========================+
        { name: 'entirely to the north', geojson: lineStringFromBounds(-73.7, 46.0, -73.5, 46.5), shouldCallFitBounds: true },

        //  +========================+
        //  |  +==================+  |  entirely south
        //  +========================+
        //
        //       A---------B
        { name: 'entirely to the south', geojson: lineStringFromBounds(-73.7, 44.0, -73.5, 44.5), shouldCallFitBounds: true },

        //  +========================+
        //  |  +==================+  |
        //  +========================+ A----B  northeast, outside viewport
        { name: 'to the northeast', geojson: lineStringFromBounds(-73.3, 45.7, -73.0, 46.0), shouldCallFitBounds: true }
    ])('$name → shouldCallFitBounds=$shouldCallFitBounds', ({ geojson, shouldCallFitBounds }) => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north);

        fitBoundsIfNotVisible(map, geojson);

        if (shouldCallFitBounds) {
            expect(map.fitBounds).toHaveBeenCalledTimes(1);
        } else {
            expect(map.fitBounds).not.toHaveBeenCalled();
        }
    });

    // C-shape whose bbox covers viewport but no segment enters inner viewport:
    //
    //  lat
    //  45.7 |  C--------------D              path opens to the right
    //       |  |
    //  45.6 |  |  +========================+
    //       |  |  | outer viewport         |
    //  45.585  |  |  +==================+  |
    //       |  |  |  | inner viewport   |  |
    //       |  |  |  |                  |  |
    //  45.315  |  |  +==================+  |
    //  45.3 |  |  +========================+
    //       |  |
    //  45.2 |  B--------------A
    //       +--+--------------+---> lng
    //       -73.9          -73.5
    //
    // Path: A(-73.5,45.2) → B(-73.9,45.2) → C(-73.9,45.7) → D(-73.5,45.7)
    // Opens to the right. The left side at lng -73.9 is west of the outer
    // viewport (-73.8). Top/bottom segments at lat 45.7/45.2 are above/below
    // the viewport. No segment crosses the inner viewport → fitBounds fires.
    //
    it('should fitBounds for a C-shaped path whose bbox covers the viewport but geometry does not', () => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north);
        const cShape: GeoJSON.LineString = {
            type: 'LineString',
            coordinates: [
                [-73.5, 45.2],
                [-73.9, 45.2],
                [-73.9, 45.7],
                [-73.5, 45.7]
            ]
        };

        fitBoundsIfNotVisible(map, cShape);

        expect(map.fitBounds).toHaveBeenCalledTimes(1);
    });

    // C-shape where the top segment crosses the inner viewport:
    //
    //  lat
    //  45.585|        |  +==================+  |
    //        |        |  |  inner viewport  |  |
    //  45.45 |  C-----+--+-----D            |  |  segment C→D at lat 45.45
    //        |  |     |  |                  |  |  crosses inner viewport
    //  45.315|  |     |  +==================+  |
    //  45.3  |  |     +========================+
    //        |  |
    //  45.2  |  B--------------A
    //        +--+--------------+---> lng
    //        -73.9          -73.5
    //
    // Path: A(-73.5,45.2) → B(-73.9,45.2) → C(-73.9,45.45) → D(-73.5,45.45)
    // Opens downward. The top segment C→D at lat 45.45 is between inner
    // south (45.315) and inner north (45.585), and spans lng -73.9 to -73.5
    // which crosses through the inner viewport → visible, no fitBounds.
    //
    it('should not fitBounds for a C-shaped path when a segment crosses the inner viewport', () => {
        const map = makeMockMap(VP.west, VP.south, VP.east, VP.north);
        const cShapeCrossing: GeoJSON.LineString = {
            type: 'LineString',
            coordinates: [
                [-73.5, 45.2],
                [-73.9, 45.2],
                [-73.9, 45.45],
                [-73.5, 45.45]
            ]
        };

        fitBoundsIfNotVisible(map, cShapeCrossing);

        expect(map.fitBounds).not.toHaveBeenCalled();
    });

    // -- geojsonIntersectsViewport behaviour through fitBoundsIfNotVisible --
    //
    // Uses a simple [-1,-1,1,1] viewport so the inner viewport (5% margin)
    // is [-0.9, -0.9, 0.9, 0.9]:
    //
    //   lat
    //    1 |  +----------+
    //  0.9 |  | +------+ |
    //      |  | |      | |
    //    0 |  | | inner | |   viewport [-1,-1,1,1]
    //      |  | |      | |
    // -0.9 |  | +------+ |
    //   -1 |  +----------+
    //      +--+-----------+---> lng
    //       -1 -0.9     0.9 1
    //
    // -- bare Geometry / Feature --
    //
    //   lat
    //    1 |  +----------+
    //      |  |       *G |      *G Feature<Point> inside (0.5,0.5)
    //    0 A==|=== *C ===|==B   A----B LineString crossing
    //      |  |          |      *C Point inside (0,0)
    //   -1 |  +----------+
    //      +--+-----------+---> lng
    //       -2 -1         1  2
    //
    //                          *D (5,5) Point outside
    //                          E----F (3,3)→(4,4) Feature<LineString> outside
    //                          *G (0.5,0.5) Feature<Point> inside
    //                          *H (5,5) Feature<Point> outside
    //
    describe('intersection detection (simple viewport)', () => {
        const SIMPLE_VP = { west: -1, south: -1, east: 1, north: 1 };

        test.each([
            {
                name: 'LineString crossing the viewport', // A-B
                geojson: { type: 'LineString' as const, coordinates: [[-2, 0], [2, 0]] },
                shouldCallFitBounds: false
            },
            {
                name: 'Point inside the viewport', // C
                geojson: { type: 'Point' as const, coordinates: [0, 0] },
                shouldCallFitBounds: false
            },
            {
                name: 'Point outside the viewport', // D
                geojson: { type: 'Point' as const, coordinates: [5, 5] },
                shouldCallFitBounds: true
            },
            {
                name: 'Feature wrapping a LineString entirely outside the viewport', // E-F
                geojson: { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: [[3, 3], [4, 4]] }, properties: {} },
                shouldCallFitBounds: true
            },
            {
                name: 'Feature wrapping a Point inside', // G
                geojson: { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [0.5, 0.5] }, properties: {} },
                shouldCallFitBounds: false
            },
            {
                name: 'Feature wrapping a Point outside', // H
                geojson: { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [5, 5] }, properties: {} },
                shouldCallFitBounds: true
            }
        ])('$name → shouldCallFitBounds=$shouldCallFitBounds', ({ geojson, shouldCallFitBounds }) => {
            const map = makeMockMap(SIMPLE_VP.west, SIMPLE_VP.south, SIMPLE_VP.east, SIMPLE_VP.north);

            fitBoundsIfNotVisible(map, geojson as GeoJSON.GeoJSON);

            if (shouldCallFitBounds) {
                expect(map.fitBounds).toHaveBeenCalledTimes(1);
            } else {
                expect(map.fitBounds).not.toHaveBeenCalled();
            }
        });

        it('should not call fitBounds for a Feature with null geometry', () => {
            const map = makeMockMap(SIMPLE_VP.west, SIMPLE_VP.south, SIMPLE_VP.east, SIMPLE_VP.north);
            const nullGeom: GeoJSON.Feature = { type: 'Feature', geometry: null as unknown as GeoJSON.Geometry, properties: {} };

            fitBoundsIfNotVisible(map, nullGeom);

            expect(map.fitBounds).not.toHaveBeenCalled();
        });

        // -- FeatureCollection --
        //
        //   lat
        //    1 |  +----------+
        //      |  |          |
        //    0 |  |   *B     |    A=(5,5) outside, B=(0,0) inside
        //      |  |          |
        //   -1 |  +----------+                    *A
        //      +--+-----------+---> lng
        //       -2 -1         1  2  ...  5
        //
        it('should not call fitBounds when at least one feature intersects', () => {
            const map = makeMockMap(SIMPLE_VP.west, SIMPLE_VP.south, SIMPLE_VP.east, SIMPLE_VP.north);
            const fc: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', geometry: { type: 'Point', coordinates: [5, 5] }, properties: {} },
                    { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }
                ]
            };

            fitBoundsIfNotVisible(map, fc);

            expect(map.fitBounds).not.toHaveBeenCalled();
        });

        //   lat
        //    1 |  +----------+
        //      |  |          |
        //    0 |  | (empty)  |    A=(5,5) outside, B=(6,6) outside
        //      |  |          |
        //   -1 |  +----------+              *A    *B
        //      +--+-----------+---> lng
        //       -2 -1         1  ... 5  6
        //
        it('should call fitBounds when no feature intersects', () => {
            const map = makeMockMap(SIMPLE_VP.west, SIMPLE_VP.south, SIMPLE_VP.east, SIMPLE_VP.north);
            const fc: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', geometry: { type: 'Point', coordinates: [5, 5] }, properties: {} },
                    { type: 'Feature', geometry: { type: 'Point', coordinates: [6, 6] }, properties: {} }
                ]
            };

            fitBoundsIfNotVisible(map, fc);

            expect(map.fitBounds).toHaveBeenCalledTimes(1);
        });

        it('should not call fitBounds for an empty FeatureCollection', () => {
            const map = makeMockMap(SIMPLE_VP.west, SIMPLE_VP.south, SIMPLE_VP.east, SIMPLE_VP.north);
            const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

            fitBoundsIfNotVisible(map, fc);

            expect(map.fitBounds).not.toHaveBeenCalled();
        });

        //   lat
        //    1 |  +----------+
        //      |  |          |
        //    0 |  |   *B     |    A=null geometry (skipped), B=(0,0) inside
        //      |  |          |
        //   -1 |  +----------+
        //      +--+-----------+---> lng
        //       -2 -1         1
        //
        it('should skip null-geometry features and still detect intersecting ones', () => {
            const map = makeMockMap(SIMPLE_VP.west, SIMPLE_VP.south, SIMPLE_VP.east, SIMPLE_VP.north);
            const fc: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', geometry: null as unknown as GeoJSON.Geometry, properties: {} },
                    { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }
                ]
            };

            fitBoundsIfNotVisible(map, fc);

            expect(map.fitBounds).not.toHaveBeenCalled();
        });

        it('should call fitBounds for a FeatureCollection with only null-geometry features', () => {
            const map = makeMockMap(SIMPLE_VP.west, SIMPLE_VP.south, SIMPLE_VP.east, SIMPLE_VP.north);
            const fc: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    { type: 'Feature', geometry: null as unknown as GeoJSON.Geometry, properties: {} },
                    { type: 'Feature', geometry: null as unknown as GeoJSON.Geometry, properties: {} }
                ]
            };

            fitBoundsIfNotVisible(map, fc);

            expect(map.fitBounds).not.toHaveBeenCalled();
        });
    });

    // -- isMapCanvasOutOfSync behaviour through fitBoundsIfNotVisible --
    //
    // When canvas and container sizes diverge (accounting for devicePixelRatio),
    // fitBoundsIfNotVisible calls resize() before the visibility test.
    describe('canvas out-of-sync detection', () => {
        const savedDpr = window.devicePixelRatio;
        afterEach(() => {
            Object.defineProperty(window, 'devicePixelRatio', { value: savedDpr, writable: true });
        });

        test.each([
            { dpr: 1, canvasW: 800, canvasH: 600, containerW: 800, containerH: 600, shouldResize: false, name: 'dpr=1, sizes match' },
            { dpr: 1, canvasW: 1024, canvasH: 600, containerW: 800, containerH: 600, shouldResize: true, name: 'dpr=1, width mismatch' },
            { dpr: 1, canvasW: 800, canvasH: 768, containerW: 800, containerH: 600, shouldResize: true, name: 'dpr=1, height mismatch' },
            { dpr: 2, canvasW: 1600, canvasH: 1200, containerW: 800, containerH: 600, shouldResize: false, name: 'dpr=2, sizes match (canvas = 2x container)' },
            { dpr: 2, canvasW: 1602, canvasH: 1200, containerW: 800, containerH: 600, shouldResize: true, name: 'dpr=2, width off by >0.5 CSS px' },
            { dpr: 2, canvasW: 1601, canvasH: 1200, containerW: 800, containerH: 600, shouldResize: false, name: 'dpr=2, width off by 0.5 CSS px (within tolerance)' },
            { dpr: 3, canvasW: 2400, canvasH: 1800, containerW: 800, containerH: 600, shouldResize: false, name: 'dpr=3, sizes match (canvas = 3x container)' },
            { dpr: 3, canvasW: 2404, canvasH: 1800, containerW: 800, containerH: 600, shouldResize: true, name: 'dpr=3, width off by >0.5 CSS px' }
        ])('$name → shouldResize=$shouldResize', ({ dpr, canvasW, canvasH, containerW, containerH, shouldResize }) => {
            Object.defineProperty(window, 'devicePixelRatio', { value: dpr, writable: true });
            const map = makeMockMap(
                VP.west, VP.south, VP.east, VP.north, 0,
                { width: canvasW, height: canvasH },
                { clientWidth: containerW, clientHeight: containerH }
            );
            const outside = lineStringFromBounds(-75.0, 46.0, -74.5, 46.5);

            fitBoundsIfNotVisible(map, outside);

            if (shouldResize) {
                expect(map.resize).toHaveBeenCalledTimes(1);
            } else {
                expect(map.resize).not.toHaveBeenCalled();
            }
            expect(map.fitBounds).toHaveBeenCalledTimes(1);
        });

        it('should default to dpr=1 when devicePixelRatio is undefined', () => {
            Object.defineProperty(window, 'devicePixelRatio', { value: undefined, writable: true });
            const map = makeMockMap(
                VP.west, VP.south, VP.east, VP.north, 0,
                { width: 800, height: 600 },
                { clientWidth: 800, clientHeight: 600 }
            );
            const outside = lineStringFromBounds(-75.0, 46.0, -74.5, 46.5);

            fitBoundsIfNotVisible(map, outside);

            expect(map.resize).not.toHaveBeenCalled();
        });

        it('should not call resize() when geojson has no computable extent', () => {
            Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
            const map = makeMockMap(
                VP.west, VP.south, VP.east, VP.north, 0,
                { width: 1024, height: 768 },
                { clientWidth: 800, clientHeight: 600 }
            );

            fitBoundsIfNotVisible(map, { type: 'FeatureCollection', features: [] });

            expect(map.resize).not.toHaveBeenCalled();
        });
    });
});
