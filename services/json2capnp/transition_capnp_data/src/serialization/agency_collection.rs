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
        
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?.to_str()?).unwrap();
        let object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?.to_str()?,
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?.to_str()?),
            "simulation_id": empty_str_to_json_null(capnp_object.get_simulation_uuid()?.to_str()?),
            "acronym": empty_str_to_json_null(capnp_object.get_acronym()?.to_str()?),
            "name": empty_str_to_json_null(capnp_object.get_name()?.to_str()?),
            "color": empty_str_to_json_null(capnp_object.get_color()?.to_str()?),
            "description": empty_str_to_json_null(capnp_object.get_description()?.to_str()?),
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
