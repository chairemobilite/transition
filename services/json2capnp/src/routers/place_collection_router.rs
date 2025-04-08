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
    fn place_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test",
            "data_source_uuid"            : "1234-5678"
        });

        let data = r##"
            {
                "data_source_uuid": "1234-5678",
                "places": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-72.963302,45.639486]
                            },
                            "id": 1234,
                            "properties": {
                                "id": "1234-1234",
                                "integer_id": 1234,
                                "is_frozen": true,
                                "internal_id": "iid",
                                "data_source_id": "4567-8910",
                                "shortname": "place",
                                "name": "Place",
                                "description": "desc.",
                                "data": {
                                    "foo": "bar",
                                    "nodes": ["abc", "def", "efg"],
                                    "nodesTravelTimes": [234, 567, 8910],
                                    "nodesDistances": [1243, 3453, 9455]
                                }
                            }
                            
                        },
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-75.45785, 44.45577]
                            },
                            "id": 1245,
                            "properties": {
                                "integer_id": 1245,
                                "id": "2345-2345",
                                "is_frozen": null
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
                        "id": 1234,
                        "properties": {
                            "id": "1234-1234",
                            "integer_id": 1234,
                            "is_frozen": true,
                            "internal_id": "iid",
                            "data_source_id": "4567-8910",
                            "shortname": "place",
                            "name": "Place",
                            "description": "desc.",
                            "data": {
                                "foo": "bar",
                                "nodes": ["abc", "def", "efg"],
                                "nodesTravelTimes": [234, 567, 8910],
                                "nodesDistances": [1243, 3453, 9455]
                            }
                        }

                    },
                    {
                        "type": "Feature",
                        "geometry": { 
                            "type": "Point",
                            "coordinates": [-75.45785, 44.45577]
                        },
                        "id": 1245,
                        "properties": {
                            "id": "2345-2345",
                            "is_frozen": null,
                            "internal_id": null,
                            "integer_id": 1245,
                            "data_source_id": null,
                            "data": {},
                            "shortname": null,
                            "name": null,
                            "description": null
                        }
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();
        
        let request = Request::fake_http(
            "POST",
            "/places",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "places",
            "places",
            &config,
            &transition_capnp_data::serialization::place_collection::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "places",
            "places",
            &config,
            &transition_capnp_data::serialization::place_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["places"], json_compare_data);

    }
}




