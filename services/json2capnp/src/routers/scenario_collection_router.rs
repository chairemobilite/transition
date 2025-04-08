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
    fn scenario_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "scenarios": [
                    {
                        "id": "1234-1234",
                        "is_enabled": null,
                        "is_frozen": true,
                        "color": "#FFFFFF",
                        "description": "testDescription",
                        "name": "Name",
                        "simulation_id": null,
                        "data": {
                            "foo": "bar"
                        },
                        "services": ["1", "2", "3"],
                        "only_agencies": ["1111", "22222", "33333"],
                        "except_agencies": ["111", "222", "333"],
                        "only_lines": ["11110", "222220", "333330"],
                        "except_lines": ["1110", "2220", "3330"],
                        "only_nodes": ["01111", "022222", "033333"],
                        "except_nodes": ["0111", "0222", "0333"],
                        "only_modes": ["bus", "plane", "boat"],
                        "except_modes": ["car", "walk", "oops"]
                    },
                    {
                        "id": "2345-2345"
                    },
                    {
                        "id": "2345-2345",
                        "is_enabled": true,
                        "is_frozen": false,
                        "data": {}
                    }
                ]
            }
            "##;

            let compare_data = r##"
            {
                "scenarios": [
                    {
                        "id": "1234-1234",
                        "is_enabled": null,
                        "is_frozen": true,
                        "color": "#FFFFFF",
                        "description": "testDescription",
                        "name": "Name",
                        "simulation_id": null,
                        "data": {
                            "foo": "bar"
                        },
                        "services": ["1", "2", "3"],
                        "only_agencies": ["1111", "22222", "33333"],
                        "except_agencies": ["111", "222", "333"],
                        "only_lines": ["11110", "222220", "333330"],
                        "except_lines": ["1110", "2220", "3330"],
                        "only_nodes": ["01111", "022222", "033333"],
                        "except_nodes": ["0111", "0222", "0333"],
                        "only_modes": ["bus", "plane", "boat"],
                        "except_modes": ["car", "walk", "oops"]
                    },
                    {
                        "id": "2345-2345",
                        "is_enabled": null,
                        "is_frozen": null,
                        "color": null,
                        "description": null,
                        "name": null,
                        "simulation_id": null,
                        "data": {},
                        "services": [],
                        "only_agencies": [],
                        "except_agencies": [],
                        "only_lines": [],
                        "except_lines": [],
                        "only_nodes": [],
                        "except_nodes": [],
                        "only_modes": [],
                        "except_modes": []
                    },
                    {
                        "id": "2345-2345",
                        "is_enabled": true,
                        "is_frozen": false,
                        "color": null,
                        "description": null,
                        "name": null,
                        "simulation_id": null,
                        "data": {},
                        "services": [],
                        "only_agencies": [],
                        "except_agencies": [],
                        "only_lines": [],
                        "except_lines": [],
                        "only_nodes": [],
                        "except_nodes": [],
                        "only_modes": [],
                        "except_modes": []
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/scenarios",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "scenarios",
            "scenarios",
            &config,
            &transition_capnp_data::serialization::scenario_collection::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "scenarios",
            "scenarios",
            &config,
            &transition_capnp_data::serialization::scenario_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["scenarios"], json_compare_data["scenarios"]);

    }
}
