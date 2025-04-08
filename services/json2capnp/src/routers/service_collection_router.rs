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
    fn service_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "services": [
                    {
                        "id": "1234-1234",
                        "is_enabled": null,
                        "is_frozen": true,
                        "internal_id": "iid",
                        "color": "#FFFFFF",
                        "description": "testDescription",
                        "name": "Name",
                        "simulation_id": "456-789",
                        "monday": true,
                        "tuesday": true,
                        "wednesday": false,
                        "thursday": false,
                        "friday": true,
                        "saturday": true,
                        "sunday": false,
                        "start_date": "2020-01-01",
                        "end_date": "2021-12-31",
                        "data": {
                            "foo": "bar"
                        },
                        "only_dates": ["2020-01-01", "2020-02-02", "2020-03-03"],
                        "except_dates": ["2021-01-01", "2021-02-02", "2021-03-03"]
                    },
                    {
                        "id": "2345-2345"
                    },
                    {
                        "id": "2345-2346",
                        "is_enabled": true,
                        "is_frozen": false,
                        "data": {}
                    }
                ]
            }
            "##;

            let compare_data = r##"
            {
                "services": [
                    {
                        "id": "1234-1234",
                        "is_enabled": null,
                        "is_frozen": true,
                        "internal_id": "iid",
                        "color": "#FFFFFF",
                        "description": "testDescription",
                        "name": "Name",
                        "simulation_id": "456-789",
                        "monday": true,
                        "tuesday": true,
                        "wednesday": false,
                        "thursday": false,
                        "friday": true,
                        "saturday": true,
                        "sunday": false,
                        "start_date": "2020-01-01",
                        "end_date": "2021-12-31",
                        "data": {
                            "foo": "bar"
                        },
                        "only_dates": ["2020-01-01", "2020-02-02", "2020-03-03"],
                        "except_dates": ["2021-01-01", "2021-02-02", "2021-03-03"]
                    },
                    {
                        "id": "2345-2345",
                        "internal_id": null,
                        "is_enabled": null,
                        "is_frozen": null,
                        "color": null,
                        "description": null,
                        "name": null,
                        "simulation_id": null,
                        "data": {},
                        "monday": null,
                        "tuesday": null,
                        "wednesday": null,
                        "thursday": null,
                        "friday": null,
                        "saturday": null,
                        "sunday": null,
                        "start_date": null,
                        "end_date": null,
                        "only_dates": [],
                        "except_dates": []
                    },
                    {
                        "id": "2345-2346",
                        "internal_id": null,
                        "is_enabled": true,
                        "is_frozen": false,
                        "color": null,
                        "description": null,
                        "name": null,
                        "simulation_id": null,
                        "data": {},
                        "monday": null,
                        "tuesday": null,
                        "wednesday": null,
                        "thursday": null,
                        "friday": null,
                        "saturday": null,
                        "sunday": null,
                        "start_date": null,
                        "end_date": null,
                        "only_dates": [],
                        "except_dates": []
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/services",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "services",
            "services",
            &config,
            &transition_capnp_data::serialization::service_collection::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "services",
            "services",
            &config,
            &transition_capnp_data::serialization::service_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["services"], json_compare_data["services"]);

    }
}
