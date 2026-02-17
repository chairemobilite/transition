/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

#[cfg(test)]
mod tests {

    use crate::routers;
    use std::path::{Path};
    use std::fs;
    use rouille::Request;
    use pretty_assertions::{assert_eq};

    #[test]
    fn path_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "paths": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "LineString",
                                "coordinates": [
                                    [-72.963302,45.639486],
                                    [-72.962992,45.639276],
                                    [-72.962526,45.639643],
                                    [-72.962265,45.639492],
                                    [-72.962158,45.639414],
                                    [-72.961906,45.639259],
                                    [-72.961848,45.639144],
                                    [-72.961792,45.639055],
                                    [-72.961789,45.639001],
                                    [-72.97436,45.63308],
                                    [-72.974538,45.633058],
                                    [-72.974768,45.633033],
                                    [-72.974984,45.633]
                                ]
                            },
                            "id": 234,
                            "properties": {
                                "id": "515923f9-a768-49e5-81b6-8237d60a6125",
                                "data": {
                                    "gtfs": {
                                        "shape_id": "A0000"
                                    },
                                    "isNew": false,
                                    "segments": [
                                        {
                                            "distanceMeters": 1700,
                                            "travelTimeSeconds": 120
                                        },
                                        {
                                            "distanceMeters": 300,
                                            "travelTimeSeconds": 60
                                        },
                                        {
                                            "distanceMeters": 388,
                                            "travelTimeSeconds": 0
                                        },
                                        {
                                            "distanceMeters": 411,
                                            "travelTimeSeconds": 60
                                        }
                                    ],
                                    "dwellTimeSeconds": [0,20,18,20,23],
                                    "layoverTimeSeconds": 180,
                                    "totalDistanceMeters": 6939,
                                    "totalDwellTimeSeconds": 0,
                                    "birdDistanceBetweenTerminals": 0,
                                    "operatingSpeedMetersPerSecond": 8.9,
                                    "travelTimeWithoutDwellTimesSeconds": 780,
                                    "operatingTimeWithLayoverTimeSeconds": 960,
                                    "totalTravelTimeWithReturnBackSeconds": null,
                                    "operatingTimeWithoutLayoverTimeSeconds": 780,
                                    "operatingSpeedWithLayoverMetersPerSecond": 7.23,
                                    "averageSpeedWithoutDwellTimesMetersPerSecond": 8.9
                                },
                                "mode": "bus",
                                "name": "PathName",
                                "color": "#1F1F1F",
                                "nodes":[
                                    "02c36463-fca3-48dc-8722-c8d2cdf62ad1",
                                    "073709b9-38de-4092-9010-0c636d4e7031",
                                    "02d6f932-14ef-4405-97d6-fc1c6d55328c",
                                    "07de5ccb-0c2b-4f83-aedb-2d7d4000a107",
                                    "02f2a4a0-399f-4894-aaca-b687bcf00058"
                                ],
                                "line_id": "83269525-9100-45b3-b00b-67b5d5a3f12d",
                                "segments": [0,61,66,84],
                                "direction": "inbound",
                                "is_frozen": false,
                                "created_at": "2020-01-01T15:15:15.054321-04:00",
                                "integer_id": 234,
                                "is_enabled": true,
                                "updated_at": null,
                                "description": "description for path",
                                "internal_id": "A12345"
                            }
                        }
                    ]
                }
            }
        "##;

        let compare_data = r##"
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": { 
                            "type": "LineString",
                            "coordinates": [
                                [-72.963302,45.639486],
                                [-72.962992,45.639276],
                                [-72.962526,45.639643],
                                [-72.962265,45.639492],
                                [-72.962158,45.639414],
                                [-72.961906,45.639259],
                                [-72.961848,45.639144],
                                [-72.961792,45.639055],
                                [-72.961789,45.639001],
                                [-72.97436,45.63308],
                                [-72.974538,45.633058],
                                [-72.974768,45.633033],
                                [-72.974984,45.633]
                            ]
                        },
                        "id": 234,
                        "properties": {
                            "id": "515923f9-a768-49e5-81b6-8237d60a6125",
                            "data": {
                                "gtfs": {
                                    "shape_id": "A0000"
                                },
                                "isNew": false,
                                "segments": [
                                    {
                                        "distanceMeters": 1700,
                                        "travelTimeSeconds": 120
                                    },
                                    {
                                        "distanceMeters": 300,
                                        "travelTimeSeconds": 60
                                    },
                                    {
                                        "distanceMeters": 388,
                                        "travelTimeSeconds": 0
                                    },
                                    {
                                        "distanceMeters": 411,
                                        "travelTimeSeconds": 60
                                    }
                                ],
                                "dwellTimeSeconds": [0,20,18,20,23],
                                "layoverTimeSeconds": 180,
                                "totalDistanceMeters": 6939,
                                "totalDwellTimeSeconds": 0,
                                "birdDistanceBetweenTerminals": 0,
                                "operatingSpeedMetersPerSecond": 8.9,
                                "travelTimeWithoutDwellTimesSeconds": 780,
                                "operatingTimeWithLayoverTimeSeconds": 960,
                                "totalTravelTimeWithReturnBackSeconds": null,
                                "operatingTimeWithoutLayoverTimeSeconds": 780,
                                "operatingSpeedWithLayoverMetersPerSecond": 7.23,
                                "averageSpeedWithoutDwellTimesMetersPerSecond": 8.9
                            },
                            "name": "PathName",
                            "stops": [],
                            "nodes":[
                                "02c36463-fca3-48dc-8722-c8d2cdf62ad1",
                                "073709b9-38de-4092-9010-0c636d4e7031",
                                "02d6f932-14ef-4405-97d6-fc1c6d55328c",
                                "07de5ccb-0c2b-4f83-aedb-2d7d4000a107",
                                "02f2a4a0-399f-4894-aaca-b687bcf00058"
                            ],
                            "line_id": "83269525-9100-45b3-b00b-67b5d5a3f12d",
                            "segments": [0,61,66,84],
                            "direction": "inbound",
                            "is_frozen": false,
                            "integer_id": 234,
                            "is_enabled": true,
                            "description": "description for path",
                            "internal_id": "A12345"
                        }
                    }
                ]
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/paths",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "paths",
            "paths",
            &config,
            &transition_capnp_data::serialization::path_collection::write_collection,
            &request,
        );
        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "paths",
            "paths",
            &config,
            &transition_capnp_data::serialization::path_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["paths"], json_compare_data);

    }
}
