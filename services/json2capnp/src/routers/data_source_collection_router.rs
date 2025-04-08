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
    fn data_source_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "dataSources": [
                    {
                        "id": "1234-1234",
                        "is_frozen": true,
                        "description": "testDescription",
                        "name": "Name",
                        "shortname": "Shortname",
                        "type": "odTrips",
                        "data": {
                            "foo": "bar"
                        }
                    },
                    {
                        "id": "2345-2345",
                        "is_frozen": null
                    },
                    {
                        "type": null,
                        "id": "2345-2345",
                        "is_frozen": false,
                        "data": {}
                    }
                ]
            }
            "##;

            let compare_data = r##"
            {
                "dataSources": [
                    {
                        "id": "1234-1234",
                        "is_frozen": true,
                        "description": "testDescription",
                        "name": "Name",
                        "shortname": "Shortname",
                        "type": "odTrips",
                        "data": {
                            "foo": "bar"
                        }
                    },
                    {
                        "id": "2345-2345",
                        "is_frozen": null,
                        "description": null,
                        "name": null,
                        "shortname": null,
                        "type": "none",
                        "data": {}
                    },
                    {
                        "id": "2345-2345",
                        "is_frozen": false,
                        "description": null,
                        "name": null,
                        "shortname": null,
                        "type": "none",
                        "data": {}
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();
        
        let request = Request::fake_http(
            "POST",
            "/dataSources",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "dataSources",
            "dataSources",
            &config,
            &transition_capnp_data::serialization::data_source_collection::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "dataSources",
            "dataSources",
            &config,
            &transition_capnp_data::serialization::data_source_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["dataSources"], json_compare_data["dataSources"]);

    }
}
