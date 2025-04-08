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
    fn node() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "node": {
                    "id": "cddc12af-6c9f-4048-a800-a79ee187401d",
                    "internal_id": "Stop internal id",
                    "integer_id": 77,
                    "name": "Stop name",
                    "code": "Stop code",
                    "color": "#ffff00",
                    "is_enabled": true,
                    "description": null,
                    "station_id": null,
                    "geography": {
                        "type": "Point",
                        "coordinates": [-73.70, 45.40]
                    },
                    "data": {
                        "isNew": false,
                        "transferableNodes": {
                            "nodesIds": ["addc12af-6c9f-4048-a800-a79ee187401d","bddc12af-6c9f-4048-a800-a79ee187401d","dddc12af-6c9f-4048-a800-a79ee187401d","eddc12af-6c9f-4048-a800-a79ee187401d"],
                            "walkingTravelTimesSeconds": [234,233,555,0],
                            "walkingDistancesMeters": [444,555,666,0]
                        }
                    },
                    "created_at": "2020-12-16T16:55:18.963Z",
                    "updated_at": "2020-12-16T17:01:40.545Z",
                    "routing_radius_meters": 50,
                    "default_dwell_time_seconds": 25,
                    "is_frozen": null
                }
            }
        "##;

        let compare_data = r##"
            {
                "node": {
                    "id": "cddc12af-6c9f-4048-a800-a79ee187401d",
                    "internal_id": "Stop internal id",
                    "integer_id": 77,
                    "name": "Stop name",
                    "code": "Stop code",
                    "color": "#ffff00",
                    "is_enabled": true,
                    "description": null,
                    "station_id": null,
                    "geography": {
                        "type": "Point",
                        "coordinates": [-73.70, 45.40]
                    },
                    "data": {
                        "isNew": false,
                        "transferableNodes": {
                            "nodesIds": ["addc12af-6c9f-4048-a800-a79ee187401d","bddc12af-6c9f-4048-a800-a79ee187401d","dddc12af-6c9f-4048-a800-a79ee187401d","eddc12af-6c9f-4048-a800-a79ee187401d"],
                            "walkingTravelTimesSeconds": [234,233,555,0],
                            "walkingDistancesMeters": [444,555,666,0]
                        }
                    },
                    "routing_radius_meters": 50,
                    "default_dwell_time_seconds": 25,
                    "is_frozen": null
                }
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/node",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_object_route(
            "node",
            "nodes",
            &config,
            &transition_capnp_data::serialization::node::write_object,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_object_route(
            "node",
            &String::from("cddc12af-6c9f-4048-a800-a79ee187401d"),
            "nodes",
            &config,
            &transition_capnp_data::serialization::node::read_object,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["node"], json_compare_data["node"]);

        // Test unexisting node
        let response = routers::read_object_route(
            "node",
            &String::from("cddc12af-6c9f-4048-a800-aaaaaaaaaaaa"),
            "nodes",
            &config,
            &transition_capnp_data::serialization::node::read_object,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        // TODO Response code should be 404 not found
        assert_eq!(response.status_code, 200);
        assert!(json_response["data"].is_null());

    }
}
