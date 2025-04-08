/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::agencyCollection_capnp::agency_collection as collection;
//use crate::my_error::MyError;
use capnp::serialize_packed;
use serde_json;
use std::io::BufReader;
use crate::utils::{ 
    required_string, 
    optional_string_json_null_to_empty_str as optional_string, 
    json_boolean_to_i8, 
    empty_str_to_json_null, 
    i8_to_json_boolean 
};

pub fn write_collection(
    json: &serde_json::Value,
    file: &mut std::fs::File,
) -> ::std::result::Result<(), capnp::Error> {
    let mut message = ::capnp::message::Builder::new_default();

    let json_objects = &json["agencies"];

    let count: usize = json_objects.as_array().unwrap().len();
    let collection_capnp = message.init_root::<collection::Builder>();
    let mut capnp = collection_capnp.init_agencies(count as u32);

    for i in 0..count {
        let json_data = &json_objects[i];
        let mut capnp_data = capnp.reborrow().get(i as u32);
        capnp_data.set_uuid(&required_string(json_data.get("id")));
        capnp_data.set_simulation_uuid(&optional_string(json_data.get("simulation_id")));
        capnp_data.set_acronym(&optional_string(json_data.get("acronym")));
        capnp_data.set_name(&optional_string(json_data.get("name")));
        capnp_data.set_internal_id(&optional_string(json_data.get("internal_id")));
        capnp_data.set_color(&optional_string(json_data.get("color")));
        capnp_data.set_description(&optional_string(json_data.get("description")));
        capnp_data.set_data(&json_data.get("data").unwrap_or(&json!({})).to_string().as_str());
        capnp_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
        capnp_data.set_is_enabled(json_boolean_to_i8(json_data.get("is_enabled").unwrap_or(&json!(null))));
    }

    serialize_packed::write_message(file, &message)
}


pub fn read_collection(
    file: &mut std::fs::File,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_agencies()?.len() as usize);

    for capnp_object in capnp_collection.get_agencies()?.iter() {
        
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
        let object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?,
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?),
            "simulation_id": empty_str_to_json_null(capnp_object.get_simulation_uuid()?),
            "acronym": empty_str_to_json_null(capnp_object.get_acronym()?),
            "name": empty_str_to_json_null(capnp_object.get_name()?),
            "color": empty_str_to_json_null(capnp_object.get_color()?),
            "description": empty_str_to_json_null(capnp_object.get_description()?),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "is_enabled": i8_to_json_boolean(capnp_object.get_is_enabled()),
            "data": data_attributes
        });
        collection_json_vec.push(object_json);

    }

    let collection_json = json!({
        "agencies": serde_json::Value::Array(collection_json_vec)
    });

    Ok(collection_json)

}


#[cfg(test)]
mod tests {

    use crate::routers;
    use std::path::{Path};
    use std::fs;
    use rouille::Request;
    use pretty_assertions::{assert_eq};

    #[test]
    fn agency_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "agencies": [
                    {
                        "id": "1234-1234",
                        "internal_id": "internalId",
                        "is_enabled": null,
                        "is_frozen": true,
                        "color": "#FFFFFF",
                        "description": "testDescription",
                        "name": "Name",
                        "acronym": "ACR",
                        "simulation_id": null,
                        "data": {
                            "foo": "bar"
                        }
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
                "agencies": [
                    {
                        "id": "1234-1234",
                        "internal_id": "internalId",
                        "is_enabled": null,
                        "is_frozen": true,
                        "color": "#FFFFFF",
                        "description": "testDescription",
                        "name": "Name",
                        "acronym": "ACR",
                        "simulation_id": null,
                        "data": {
                            "foo": "bar"
                        }
                    },
                    {
                        "id": "2345-2345",
                        "internal_id": null,
                        "is_enabled": null,
                        "is_frozen": null,
                        "color": null,
                        "description": null,
                        "name": null,
                        "acronym": null,
                        "simulation_id": null,
                        "data": {}
                    },
                    {
                        "id": "2345-2345",
                        "internal_id": null,
                        "is_enabled": true,
                        "is_frozen": false,
                        "color": null,
                        "description": null,
                        "name": null,
                        "acronym": null,
                        "simulation_id": null,
                        "data": {}
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/agencies",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "agencies",
            "agencies",
            &config,
            &routers::agency_collection_router::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "agencies",
            "agencies",
            &config,
            &routers::agency_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["agencies"], json_compare_data["agencies"]);

    }
}
