/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::dataSourceCollection_capnp::data_source_collection as collection;
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

    let json_objects = &json["dataSources"];

    let count: usize = json_objects.as_array().unwrap().len();
    let collection_capnp = message.init_root::<collection::Builder>();
    let mut capnp = collection_capnp.init_data_sources(count as u32);

    for i in 0..count {
        let json_data = &json_objects[i];
        let mut capnp_data = capnp.reborrow().get(i as u32);
        capnp_data.set_uuid(&required_string(json_data.get("id")));
        capnp_data.set_name(&optional_string(json_data.get("name")));
        capnp_data.set_shortname(&optional_string(json_data.get("shortname")));
        capnp_data.set_description(&optional_string(json_data.get("description")));
        capnp_data.set_type(crate::enum_mappings::data_source_type(&json_data["type"].as_str().unwrap_or("none")));
        capnp_data.set_data(&json_data.get("data").unwrap_or(&json!({})).to_string().as_str());
        capnp_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
    }

    serialize_packed::write_message(file, &message)
}


pub fn read_collection(
    file: &mut std::fs::File,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_data_sources()?.len() as usize);

    for capnp_object in capnp_collection.get_data_sources()?.iter() {
        
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
        let object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?,
            "shortname": empty_str_to_json_null(capnp_object.get_shortname()?),
            "name": empty_str_to_json_null(capnp_object.get_name()?),
            "description": empty_str_to_json_null(capnp_object.get_description()?),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "type": crate::enum_mappings::data_source_type_to_str(&capnp_object.get_type()?),
            "data": data_attributes
        });
        collection_json_vec.push(object_json);

    }
    
    let collection_json = json!({
        "dataSources": serde_json::Value::Array(collection_json_vec)
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
            &routers::data_source_collection_router::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "dataSources",
            "dataSources",
            &config,
            &routers::data_source_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["dataSources"], json_compare_data["dataSources"]);

    }
}
