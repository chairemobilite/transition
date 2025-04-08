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
    fn node_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "nodes": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-72.963302,45.639486]
                            },
                            "id": 456,
                            "properties": {
                                "id": "915923f9-a768-49e5-81b6-8237d60a6125",
                                "data": {
                                    "foo": "bar"
                                },
                                "station_id": "715923f9-a768-49e5-81b6-8237d60a6125",
                                "code": "034A",
                                "name": "NodeName",
                                "color": "#1A2F3D",
                                "is_frozen": false,
                                "created_at": "2020-01-01T15:15:15.054321-04:00",
                                "integer_id": 456,
                                "is_enabled": true,
                                "updated_at": null,
                                "description": "description for node",
                                "internal_id": "N98765",
                                "routing_radius_meters": 212,
                                "default_dwell_time_seconds": 18
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
                            "type": "Point",
                            "coordinates": [-72.963302,45.639486]
                        },
                        "id": 456,
                        "properties": {
                            "id": "915923f9-a768-49e5-81b6-8237d60a6125",
                            "data": {
                                "foo": "bar"
                            },
                            "station_id": "715923f9-a768-49e5-81b6-8237d60a6125",
                            "code": "034A",
                            "name": "NodeName",
                            "color": "#1A2F3D",
                            "is_frozen": false,
                            "integer_id": 456,
                            "is_enabled": true,
                            "description": "description for node",
                            "internal_id": "N98765",
                            "routing_radius_meters": 212,
                            "default_dwell_time_seconds": 18
                        }
                    }
                ]
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/nodes",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "nodes",
            "nodes",
            &config,
            &transition_capnp_data::serialization::node_collection::write_collection,
            &request,
        );
        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "nodes",
            "nodes",
            &config,
            &transition_capnp_data::serialization::node_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["nodes"], json_compare_data);





        let data = r##"
            {
                "nodes": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-72.963302,45.639486]
                            },
                            "id": 456,
                            "properties": {
                                "id": "915923f9-a768-49e5-81b6-8237d60a6125",
                                "integer_id": 456
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
                            "type": "Point",
                            "coordinates": [-72.963302,45.639486]
                        },
                        "id": 456,
                        "properties": {
                            "id": "915923f9-a768-49e5-81b6-8237d60a6125",
                            "data": {},
                            "station_id": null,
                            "code": null,
                            "name": null,
                            "color": null,
                            "is_frozen": null,
                            "integer_id": 456,
                            "is_enabled": null,
                            "description": null,
                            "internal_id": null,
                            "routing_radius_meters": null,
                            "default_dwell_time_seconds": null
                        }
                    }
                ]
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/nodes",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "nodes",
            "nodes",
            &config,
            &transition_capnp_data::serialization::node_collection::write_collection,
            &request,
        );
        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "nodes",
            "nodes",
            &config,
            &transition_capnp_data::serialization::node_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["nodes"], json_compare_data);

    }
}
