/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Must be mocked before the fetch-retry is loaded in OSRMMode
global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;
import OSRMMode from '../OSRMMode';

import TestUtils from 'chaire-lib-common/src/test/TestUtils';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import osrm from 'osrm';

// Setup fetch mock
beforeEach(() => {
    jest.resetAllMocks();
});

describe('OSRM Mode tests', () => {

    /********************************/
    /* Constructor validation tests */

    test('Create valid Mode', async () => {
        const aMode = new OSRMMode('Walking', 'localhost', 4000);

        const hostPort = aMode.getHostPort();
        expect(hostPort).toStrictEqual({ host: 'localhost', port: 4000 });

    });

    test('Create invalid mode', async () => {
        await expect(() => { const aMode = new OSRMMode('', 'localhost', 4000); })
            .toThrow('OSRMMode: invalid empty mode');
    });

    test('Create invalid port', async () => {
        await expect(() => { const aMode = new OSRMMode('walking', 'localhost', -1); })
            .toThrow('OSRMMode: port number must be valid');
    });

    test('Create default localhost', async () => {
        const aMode = new OSRMMode('walking', '', 4000);
        //No expect since variable are all private, basically validate that nothing throws
    });
    test('Test basic fetch', async () => {
        const aMode = new OSRMMode('walking', '', 4000);

        const origin = TestUtils.makePoint([-73, 45]);
        const destination1 = TestUtils.makePoint([-73.1, 45.1]);


        const params = {
            mode: 'walking' as const,
            points: [origin, destination1]
        };

        const jsonResponse = jest.fn() as jest.MockedFunction<Response['json']>;
        jsonResponse.mockResolvedValue({
            status: 'OK'
        });
        const response = Promise.resolve({
            ok: true,
            status: 200,
            json: jsonResponse
        } as Partial<Response> as Response);
        mockedFetch.mockResolvedValue(response);

        const result = await aMode.route(params);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith('http://localhost:4000/route/v1/walking/-73,45;-73.1,45.1?alternatives=false&steps=false&annotations=false&continue_straight=default&geometries=geojson&overview=full', undefined);


    });

    test('Test invalid fetch with bad json', async () => {

        // TODO: This test should be updated when a better way to manage errors is implemented
        const aMode = new OSRMMode('walking', '', 4000);

        const origin = TestUtils.makePoint([-73, 45]);
        const destination1 = TestUtils.makePoint([-73.1, 45.1]);

        const params = {
            mode: 'walking' as const,
            points: [origin, destination1]
        };

        const jsonResponse = jest.fn() as jest.MockedFunction<Response['json']>;
        jsonResponse.mockRejectedValueOnce(new Error('invalid json response body at TEST reason: Unexpected end of JSON input'));
        const response = Promise.resolve({
            ok: true,
            status: 200,
            json: jsonResponse as any
        } as Partial<Response> as Response);
        mockedFetch.mockResolvedValue(response);

        await expect(aMode.route(params)).rejects.toThrow('invalid json response body at TEST reason: Unexpected end of JSON input');

    });

    test('Test basic fetch with result validation', async () => {
        const aMode = new OSRMMode('walking', '', 4000);

        const origin = TestUtils.makePoint([-73, 45]);
        const destination1 = TestUtils.makePoint([-73.1, 45.1]);

        const params = {
            mode: 'walking' as const,
            points: [origin, destination1]
        };

        const jsonObject = {
            code: 'Ok',
            waypoints: [
                {
                    hint: '8qsBgFWuAYAAAAAA8gIAAAAAAABidQAAAAAAAI0LzUIAAAAARm9_RQAAAADyAgAAAAAAAGJ1AAACAAAATZ-j-xcnswLAG6b7QKWuAgAATwCKE53A',
                    distance: 35241.065949,
                    location: [-73.162931, 45.295383],
                    name: 'Rang Double'
                },
                {
                    hint: '8qsBgFWuAYAAAAAA8gIAAAAAAABidQAAAAAAAI0LzUIAAAAARm9_RQAAAADyAgAAAAAAAGJ1AAACAAAATZ-j-xcnswIglaT74CuwAgAATwCKE53A',
                    distance: 22270.150032,
                    location: [-73.162931, 45.295383],
                    name: 'Rang Double'
                }
            ],
            routes: [
                {
                    legs: [
                        {
                            steps: [],
                            weight: 0,
                            distance: 0,
                            summary: '',
                            duration: 0
                        }
                    ],
                    weight_name: 'routability',
                    geometry: 'cwmsGhsp}L??',
                    weight: 0,
                    distance: 0,
                    duration: 0
                }
            ]
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);
        const result = await aMode.route(params);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith('http://localhost:4000/route/v1/walking/-73,45;-73.1,45.1?alternatives=false&steps=false&annotations=false&continue_straight=default&geometries=geojson&overview=full', undefined);

        //Check result
        expect(Status.unwrap(result)).toHaveProperty('waypoints');
        expect(Status.unwrap(result)).toHaveProperty('routes');
        expect(Status.unwrap(result).waypoints).toHaveLength(2);
        expect(Status.unwrap(result).routes).toHaveLength(1);

    });

    test('Test simple match call', async () => {

        const aMode = new OSRMMode('bus_urban', '', 4000);

        const origin = TestUtils.makePoint([-73.576361, 45.454669]);
        const destination1 = TestUtils.makePoint([-73.576504, 45.454872]);

        const params = {
            mode: 'bus_urban' as const,
            points: [origin, destination1],
            radiuses: [17, 17],
            timestamps: [0, 189],
        };

        const jsonObject = {
            code: 'Ok',
            tracepoints: [
                {
                    alternatives_count: 5,
                    location: [-73.576449, 45.454673],
                    distance: 6.895504,
                    hint: 'qUsCgKxLAgBCAAAAAgAAAAAAAAAAAAAAfwWVQibOnD8AAAAAAAAAAEIAAAACAAAAAAAAAAAAAAC0AAAA_0-d-1GVtQJXUJ37TZW1AgAAPwBSmAUi',
                    name: 'Rue Bannantyne',
                    matchings_index: 0,
                    waypoint_index: 0
                },
                {
                    alternatives_count: 10,
                    location: [-73.576431, 45.454876],
                    distance: 5.725519,
                    hint: 'GgkAgP___38AAAAARQAAAAAAAADOAAAAAAAAADIXKUIAAAAAJq_7QgAAAABFAAAAAAAAAM4AAAC0AAAAEVCd-xyWtQLIT537GJa1AgAAzwVSmAUi',
                    name: 'Avenue Desmarchais',
                    matchings_index: 0,
                    waypoint_index: 1
                }
            ],
            matchings: [
                {
                    duration: 5,
                    distance: 22.6,
                    weight: 5,
                    geometry: {
                        coordinates: [[-73.576449, 45.454673], [-73.576448, 45.454684], [-73.576431, 45.454876]],
                        type: 'LineString'
                    },
                    confidence: 0.09066,
                    weight_name: 'routability',
                    legs: [
                        {
                            steps: [
                                {
                                    intersections: [
                                        {
                                            out: 0,
                                            entry: [true],
                                            location: [-73.576449, 45.454673],
                                            bearings: [4]
                                        }, {
                                            out: 0,
                                            in: 1,
                                            entry: [true, false, false],
                                            location: [-73.576448, 45.454684],
                                            bearings: [0, 180, 270]
                                        }
                                    ],
                                    driving_side: 'right',
                                    geometry: {
                                        coordinates: [[-73.576449, 45.454673], [-73.576448, 45.454684], [-73.576431, 45.454876]],
                                        type: 'LineString'
                                    },
                                    duration: 5,
                                    distance: 22.6,
                                    name: 'Rue Bannantyne',
                                    weight: 5,
                                    mode: 'driving',
                                    maneuver: {
                                        bearing_after: 4,
                                        location: [-73.576449, 45.454673],
                                        type: 'depart',
                                        bearing_before: 0,
                                        modifier: 'right'
                                    }
                                },
                                {
                                    intersections: [],
                                    geometry: {
                                        coordinates: [[-73.576448, 45.454684], [-73.576431, 45.454876]],
                                        type: 'LineString'
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const result = await aMode.match(params);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith('http://localhost:4000/match/v1/busUrban/-73.576361,45.454669;-73.576504,45.454872?radiuses=17;17&timestamps=0;189&steps=true&annotations=false&gaps=ignore&geometries=geojson&overview=full', undefined);

        //Check result
        expect(Status.unwrap(result)).toHaveProperty('tracepoints');
        expect(Status.unwrap(result)).toHaveProperty('matchings');
        expect(Status.unwrap(result).tracepoints).toHaveLength(2);
        expect(Status.unwrap(result).matchings).toHaveLength(1);
        expect(Status.unwrap(result).matchings[0].legs[0].steps).toHaveLength(2);

    });

    test('Test simple tableFrom call', async () => {

        const aMode = new OSRMMode('walking', '', 5000);

        const origin = TestUtils.makePoint([-73.663473, 45.611544]);
        const destinations = [
            TestUtils.makePoint([-73.663473, 45.611544]),
            TestUtils.makePoint([-73.663473, 45.611544]),
            TestUtils.makePoint([-73.663083, 45.612892]),
            TestUtils.makePoint([-73.660853, 45.612142]),
        ];

        const params = {
            mode: 'walking' as const,
            origin: origin,
            destinations: destinations
        };

        const jsonObject = 
            {
                code: 'Ok',
                distances: [[0, 0, 0, 235.1, 438.6]],
                durations: [[0, 0, 0, 205.7, 389.3]],
                sources: [{
                    hint: '2TkMgL48DIAAAAAA5wEAAHMCAAAaAQAAAAAAAJQfikLY5bFCdh8gQgAAAADnAQAAcwIAABoBAAABAAAAEvyb-xr6twIP_Jv7GPq3AgUA3wh8GkX3',
                    distance: 0.322722,
                    location: [-73.66347, 45.611546],
                    name: ''
                }],
                destinations: [{
                    hint: '2TkMgL48DIAAAAAA5wEAAHMCAAAaAQAAAAAAAJQfikLY5bFCdh8gQgAAAADnAQAAcwIAABoBAAABAAAAEvyb-xr6twIP_Jv7GPq3AgUA3wh8GkX3',
                    distance: 0.322722,
                    location: [-73.66347, 45.611546],
                    name: ''
                }, {
                    hint: '2TkMgL48DIAAAAAA5wEAAHMCAAAaAQAAAAAAAJQfikLY5bFCdh8gQgAAAADnAQAAcwIAABoBAAABAAAAEvyb-xr6twIP_Jv7GPq3AgUA3wh8GkX3',
                    distance: 0.322722,
                    location: [-73.66347, 45.611546],
                    name: ''
                }, {
                    hint: '2TkMgL48DIAAAAAA5wEAAHMCAAAaAQAAAAAAAJQfikLY5bFCdh8gQgAAAADnAQAAcwIAABoBAAABAAAAEvyb-xr6twIP_Jv7GPq3AgUA3wh8GkX3',
                    distance: 0.322722,
                    location: [-73.66347, 45.611546],
                    name: ''
                }, {
                    hint: 'zzkMgP45DIA8AAAABQAAACMCAACqAQAAw4gJQUDCIz_LFJtCpmVxQjwAAAAFAAAAIwIAAKoBAAABAAAAlf2b-1v_twKV_Zv7XP-3AgQAzwN8GkX3',
                    distance: 0.111143,
                    location: [-73.663083, 45.612891],
                    name: 'Boulevard Saint-Martin Est'
                }, {
                    hint: 'CjoMgCU6DICzAAAAiQAAAAAAAABoAAAAshjMQUvCmkEAAAAADJ9rQbMAAACJAAAAAAAAAGgAAAABAAAAUAac-3H8twJLBpz7bvy3AgAA3wh8GkX3',
                    distance: 0.513055,
                    location: [-73.660848, 45.612145],
                    name: ''
                }
                ]
            };

        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const result = await aMode.tableFrom(params);

        const EXPECTED_QUERY = 'http://localhost:5000/table/v1/walking/-73.663473,45.611544;-73.663473,45.611544;-73.663473,45.611544;-73.663083,45.612892;-73.660853,45.612142?sources=0&annotations=duration,distance';

        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(EXPECTED_QUERY, undefined);


        //Check result
        expect(Status.unwrap(result)).toHaveProperty('query');
        expect(Status.unwrap(result)).toHaveProperty('distances');
        expect(Status.unwrap(result)).toHaveProperty('durations');
        expect(Status.unwrap(result).durations).toHaveLength(4);
        expect(Status.unwrap(result).distances).toHaveLength(4);
        expect(Status.unwrap(result).distances).toStrictEqual([0, 0, 235.1, 438.6]);
    });

    test('Test simple tableTo call', async () => {

        const aMode = new OSRMMode('walking', '', 5000);

        const destination = TestUtils.makePoint([-73.663473, 45.611544]);
        const origins = [TestUtils.makePoint([-73.663473, 45.611544]),
            TestUtils.makePoint([-73.663473, 45.611544]),
            TestUtils.makePoint([-73.663083, 45.612892]),
            TestUtils.makePoint([-73.660853, 45.612142]),
        ];

        const params = {
            mode: 'walking' as const,
            origins: origins,
            destination: destination
        };

        const jsonResponse = jest.fn() as jest.MockedFunction<Response['json']>;
        const jsonObject =
            {
                code: 'Ok',
                distances: [[0], [0], [0], [235.1], [438.6]],
                durations: [[0], [0], [0], [205.7], [389.3]],
                sources: [{
                    hint: '2TkMgL48DIAAAAAA5wEAAHMCAAAaAQAAAAAAAJQfikLY5bFCdh8gQgAAAADnAQAAcwIAABoBAAABAAAAEvyb-xr6twIP_Jv7GPq3AgUA3wh8GkX3',
                    distance: 0.322722,
                    location: [-73.66347, 45.611546],
                    name: ''
                }]
            };

        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const result = await aMode.tableTo(params);

        const EXPECTED_QUERY = 'http://localhost:5000/table/v1/walking/-73.663473,45.611544;-73.663473,45.611544;-73.663473,45.611544;-73.663083,45.612892;-73.660853,45.612142?destinations=0&annotations=duration,distance';

        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(EXPECTED_QUERY, undefined);

        //Check result
        expect(Status.unwrap(result)).toHaveProperty('query');
        expect(Status.unwrap(result)).toHaveProperty('distances');
        expect(Status.unwrap(result)).toHaveProperty('durations');
        expect(Status.unwrap(result).durations).toHaveLength(4);
        expect(Status.unwrap(result).distances).toHaveLength(4);
        expect(Status.unwrap(result).query).toBe(EXPECTED_QUERY);
        expect(Status.unwrap(result).distances).toStrictEqual([0, 0, 235.1, 438.6]);
    });

});

