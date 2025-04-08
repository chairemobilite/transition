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
    fn line_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "lines": [
                    {
                        "id": "1234-1234",
                        "agency_id": "2345-2345",
                        "internal_id": "internalId",
                        "is_enabled": true,
                        "is_frozen": true,
                        "color": "#FFAAFF",
                        "shortname": "23A",
                        "longname": "LineLongname",
                        "mode": "rail",
                        "category": "B",
                        "description": "testDescription",
                        "is_autonomous": false,
                        "allow_same_line_transfers": true,
                        "data": {
                            "foo": "bar"
                        }
                    },
                    {
                        "id": "2345-2345",
                        "agency_id": "4567-4567",
                        "shortname": "123ABC",
                        "mode": "bus"
                    },
                    {
                        "id": "3456-3456",
                        "agency_id": "5678-5678",
                        "shortname": "456CDE",
                        "mode": "cableCar",
                        "is_enabled": true,
                        "is_frozen": false,
                        "data": {}
                    }
                ]
            }
            "##;

            let compare_data = r##"
            {
                "lines": [
                    {
                        "id": "1234-1234",
                        "agency_id": "2345-2345",
                        "internal_id": "internalId",
                        "is_enabled": true,
                        "is_frozen": true,
                        "color": "#FFAAFF",
                        "shortname": "23A",
                        "longname": "LineLongname",
                        "mode": "rail",
                        "category": "B",
                        "description": "testDescription",
                        "is_autonomous": false,
                        "allow_same_line_transfers": true,
                        "data": {
                            "foo": "bar"
                        }
                    },
                    {
                        "id": "2345-2345",
                        "agency_id": "4567-4567",
                        "shortname": "123ABC",
                        "mode": "bus",
                        "internal_id": null,
                        "is_enabled": null,
                        "is_frozen": null,
                        "color": null,
                        "longname": null,
                        "category": null,
                        "description": null,
                        "is_autonomous": null,
                        "allow_same_line_transfers": null,
                        "data": {}
                    },
                    {
                        "id": "3456-3456",
                        "agency_id": "5678-5678",
                        "shortname": "456CDE",
                        "mode": "cableCar",
                        "is_enabled": true,
                        "is_frozen": false,
                        "internal_id": null,
                        "color": null,
                        "longname": null,
                        "category": null,
                        "description": null,
                        "is_autonomous": null,
                        "allow_same_line_transfers": null,
                        "data": {}
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/lines",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "lines",
            "lines",
            &config,
            &transition_capnp_data::serialization::line_collection::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "lines",
            "lines",
            &config,
            &transition_capnp_data::serialization::line_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["lines"], json_compare_data["lines"]);

    }
}






/*

capnp_data.set_geography(&crate::utils::string_or_null_to_empty_string(&json_data["geography"].to_string()));

*/
