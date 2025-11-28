/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

#[cfg(test)]
mod tests {

    use pretty_assertions::{assert_eq};
    use crate::routers;
    use std::path::{Path};
    use std::fs;
    use rouille::Request;

    #[test]
    fn line() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "line": {
                    "id": "bddc12af-6c9f-4048-a800-a79ee187401d",
                    "internal_id": "Demo",
                    "mode": "bus",
                    "category": "C",
                    "agency_id": "f4f2043b-11cb-42ab-8711-c8da071b27d5",
                    "shortname": "A",
                    "longname": "A",
                    "color": "#ff0000",
                    "is_enabled": true,
                    "description": null,
                    "data": {
                        "isNew": false,
                        "deadHeadTravelTimesBetweenPathsByPathId": {
                            "cb01fe06-e450-4e6d-991c-a6e843cf30db": {
                                "cb01fe06-e450-4e6d-991c-a6e843cf30db": 506,
                                "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b":0
                            },
                            "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b": {
                                "cb01fe06-e450-4e6d-991c-a6e843cf30db": 0,
                                "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b": 501
                            }
                        },
                        "_pathsChangeTimestamp": 1608137820125
                    },
                    "created_at": "2020-12-16T16:55:18.963Z",
                    "updated_at": "2020-12-16T17:01:40.545Z",
                    "is_autonomous": false,
                    "allow_same_line_transfers": false,
                    "is_frozen": null,
                    "path_ids": ["cb01fe06-e450-4e6d-991c-a6e843cf30db","e39e0b59-9af4-4cc0-ae7e-84f01e293f0b"],
                    "scheduleByServiceId": {
                        "a52a2402-9510-4c46-a0a9-f58930355c10": {
                            "id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                            "service_id": "a52a2402-9510-4c46-a0a9-f58930355c10",
                            "periods_group_shortname": "default",
                            "allow_seconds_based_schedules": false,
                            "is_frozen": null,
                            "periods": [
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "morning",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": "06:02:45",
                                    "custom_end_at_str": "15:00",
                                    "start_at_hour": 4,
                                    "end_at_hour": 6,
                                    "interval_seconds": null,
                                    "number_of_units": 2,
                                    "trips": [
                                        {
                                            "id": "6650ebc1-75c8-4ae6-abef-ce4dbc1c3a5f",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                            "path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                            "departure_time_seconds": 14400,
                                            "arrival_time_seconds": 15272,
                                            "node_arrival_times_seconds": [null,14446,14517,14595,14650,14698,14798,14894,15005,15074,15193,15272],
                                            "node_departure_times_seconds": [14400,14466,14537,14615,14670,14718,14818,14914,15025,15094,15213,null],
                                            "nodes_can_board": [true,true,true,true,true,false,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,false,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity": 20
                                        },
                                        {
                                            "id": "dd1eec4b-4b88-4d75-82b0-2005707fc0bf",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                            "path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                            "departure_time_seconds": 14413,
                                            "arrival_time_seconds": 15267,
                                            "node_arrival_times_seconds": [null,14471,14579,14661,14772,14854,14950,14997,15052,15142,15201,15267],
                                            "node_departure_times_seconds": [14413,14491,14599,14681,14792,14874,14970,15017,15072,15162,15221,null],
                                            "nodes_can_board": [true,true,true,true,true,true,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,true,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity": 20
                                        }
                                    ]
                                },
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee18bbbbb",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "am_peak",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id":"e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": "28:45",
                                    "start_at_hour": 6,
                                    "end_at_hour": 9.5,
                                    "interval_seconds": 900,
                                    "number_of_units": null,
                                    "trips": [
                                        {
                                            "id":"a1f5fbc9-f692-49f3-a00f-430e5075c25f",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee18bbbbb",
                                            "path_id":"cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                            "departure_time_seconds": 21600,
                                            "arrival_time_seconds": 22472,
                                            "node_arrival_times_seconds": [null,21646,21717,21795,21850,21898,21998,22094,22205,22274,22393,22472],
                                            "node_departure_times_seconds": [21600,21666,21737,21815,21870,21918,22018,22114,22225,22294,22413,null],
                                            "nodes_can_board": [true,true,true,true,true,true,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,true,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity":20
                                        }
                                    ]
                                },
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee187cccc",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "night",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": null,
                                    "start_at_hour": 23,
                                    "end_at_hour": 28,
                                    "interval_seconds": null,
                                    "number_of_units": null,
                                    "trips": []
                                }
                            ],
                            "data": {
                                "isNew": false
                            }
                        }
                    }
                }
            }
        "##;

        let compare_data = r##"
            {
                "line": {
                    "id": "bddc12af-6c9f-4048-a800-a79ee187401d",
                    "internal_id": "Demo",
                    "mode": "bus",
                    "category": "C",
                    "agency_id": "f4f2043b-11cb-42ab-8711-c8da071b27d5",
                    "shortname": "A",
                    "longname": "A",
                    "color": "#ff0000",
                    "is_enabled": true,
                    "description": null,
                    "data": {
                        "isNew": false,
                        "deadHeadTravelTimesBetweenPathsByPathId": {
                            "cb01fe06-e450-4e6d-991c-a6e843cf30db": {
                                "cb01fe06-e450-4e6d-991c-a6e843cf30db": 506,
                                "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b":0
                            },
                            "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b": {
                                "cb01fe06-e450-4e6d-991c-a6e843cf30db": 0,
                                "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b": 501
                            }
                        },
                        "_pathsChangeTimestamp": 1608137820125
                    },
                    "is_autonomous": false,
                    "allow_same_line_transfers": false,
                    "is_frozen": null,
                    "scheduleByServiceId": {
                        "a52a2402-9510-4c46-a0a9-f58930355c10": {
                            "id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                            "line_id": "bddc12af-6c9f-4048-a800-a79ee187401d",
                            "service_id": "a52a2402-9510-4c46-a0a9-f58930355c10",
                            "periods_group_shortname": "default",
                            "allow_seconds_based_schedules": false,
                            "is_frozen": null,
                            "periods": [
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "morning",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": "06:02:45",
                                    "custom_end_at_str": "15:00",
                                    "start_at_hour": 4.0,
                                    "end_at_hour": 6.0,
                                    "interval_seconds": null,
                                    "number_of_units": 2,
                                    "is_frozen": null,
                                    "trips": [
                                        {
                                            "id": "6650ebc1-75c8-4ae6-abef-ce4dbc1c3a5f",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                            "path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                            "departure_time_seconds": 14400,
                                            "arrival_time_seconds": 15272,
                                            "node_arrival_times_seconds": [null,14446,14517,14595,14650,14698,14798,14894,15005,15074,15193,15272],
                                            "node_departure_times_seconds": [14400,14466,14537,14615,14670,14718,14818,14914,15025,15094,15213,null],
                                            "nodes_can_board": [true,true,true,true,true,false,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,false,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity": 20,
                                            "is_frozen": null
                                        },
                                        {
                                            "id": "dd1eec4b-4b88-4d75-82b0-2005707fc0bf",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                            "path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                            "departure_time_seconds": 14413,
                                            "arrival_time_seconds": 15267,
                                            "node_arrival_times_seconds": [null,14471,14579,14661,14772,14854,14950,14997,15052,15142,15201,15267],
                                            "node_departure_times_seconds": [14413,14491,14599,14681,14792,14874,14970,15017,15072,15162,15221,null],
                                            "nodes_can_board": [true,true,true,true,true,true,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,true,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity": 20,
                                            "is_frozen": null
                                        }
                                    ]
                                },
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee18bbbbb",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "am_peak",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id":"e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": "28:45",
                                    "custom_end_at_str": null,
                                    "start_at_hour": 6.0,
                                    "end_at_hour": 9.5,
                                    "interval_seconds": 900,
                                    "number_of_units": null,
                                    "is_frozen": null,
                                    "trips": [
                                        {
                                            "id":"a1f5fbc9-f692-49f3-a00f-430e5075c25f",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee18bbbbb",
                                            "path_id":"cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                            "departure_time_seconds": 21600,
                                            "arrival_time_seconds": 22472,
                                            "node_arrival_times_seconds": [null,21646,21717,21795,21850,21898,21998,22094,22205,22274,22393,22472],
                                            "node_departure_times_seconds": [21600,21666,21737,21815,21870,21918,22018,22114,22225,22294,22413,null],
                                            "nodes_can_board": [true,true,true,true,true,true,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,true,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity":20,
                                            "is_frozen": null
                                        }
                                    ]
                                },
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee187cccc",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "night",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": null,
                                    "custom_end_at_str": null,
                                    "start_at_hour": 23.0,
                                    "end_at_hour": 28.0,
                                    "interval_seconds": null,
                                    "number_of_units": null,
                                    "trips": [],
                                    "is_frozen": null
                                }
                            ]
                        }
                    }
                }
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/line",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_object_route(
            "line",
            "lines",
            &config,
            &transition_capnp_data::serialization::line::write_object,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_object_route(
            "line",
            &String::from("bddc12af-6c9f-4048-a800-a79ee187401d"),
            "lines",
            &config,
            &transition_capnp_data::serialization::line::read_object,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["line"], json_compare_data["line"]);

        // Test non-existing line
        let response = routers::read_object_route(
            "line",
            &String::from("bddc12af-6c9f-4048-a800-aaaaaaaaaaaa"),
            "lines",
            &config,
            &transition_capnp_data::serialization::line::read_object,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        // TODO Return code should be 404 Not found
        assert_eq!(response.status_code, 200);
        assert!(json_response["data"].is_null());

    }
}
