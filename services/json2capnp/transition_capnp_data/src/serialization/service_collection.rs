/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::serviceCollection_capnp::service_collection as collection;
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

    let json_objects = &json["services"];

    let count: usize = json_objects.as_array().unwrap().len();
    let collection_capnp = message.init_root::<collection::Builder>();
    let mut capnp = collection_capnp.init_services(count as u32);

    for i in 0..count {
        let json_data = &json_objects[i];
        let mut capnp_data = capnp.reborrow().get(i as u32);
        capnp_data.set_uuid(&required_string(json_data.get("id")));
        capnp_data.set_internal_id(&optional_string(json_data.get("internal_id")));
        capnp_data.set_simulation_uuid(&optional_string(json_data.get("simulation_id")));
        capnp_data.set_name(&optional_string(json_data.get("name")));
        capnp_data.set_color(&optional_string(json_data.get("color")));
        capnp_data.set_description(&optional_string(json_data.get("description")));
        capnp_data.set_data(&json_data.get("data").unwrap_or(&json!({})).to_string().as_str());
        capnp_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
        capnp_data.set_is_enabled(json_boolean_to_i8(json_data.get("is_enabled").unwrap_or(&json!(null))));
        capnp_data.set_monday(json_boolean_to_i8(json_data.get("monday").unwrap_or(&json!(null))));
        capnp_data.set_monday(json_boolean_to_i8(json_data.get("monday").unwrap_or(&json!(null))));
        capnp_data.set_tuesday(json_boolean_to_i8(json_data.get("tuesday").unwrap_or(&json!(null))));
        capnp_data.set_wednesday(json_boolean_to_i8(json_data.get("wednesday").unwrap_or(&json!(null))));
        capnp_data.set_thursday(json_boolean_to_i8(json_data.get("thursday").unwrap_or(&json!(null))));
        capnp_data.set_friday(json_boolean_to_i8(json_data.get("friday").unwrap_or(&json!(null))));
        capnp_data.set_saturday(json_boolean_to_i8(json_data.get("saturday").unwrap_or(&json!(null))));
        capnp_data.set_sunday(json_boolean_to_i8(json_data.get("sunday").unwrap_or(&json!(null))));
        capnp_data.set_start_date(&optional_string(json_data.get("start_date")));
        capnp_data.set_end_date(&optional_string(json_data.get("end_date")));

        if json_data.get("only_dates") != None && json_data["only_dates"].is_array()
        {
            let only_dates_optional = json_data.get("only_dates").unwrap().as_array();
            if only_dates_optional != None {
                let only_dates = only_dates_optional.unwrap();
                let only_dates_count: usize = only_dates.len();

                capnp_data.reborrow().init_only_dates(only_dates_count as u32);
                for j in 0..only_dates_count
                {
                    capnp_data.reborrow().get_only_dates().unwrap().set(j as u32, only_dates[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_only_dates(0);
            }
        }

        if json_data.get("except_dates") != None && json_data["except_dates"].is_array()
        {
            let except_dates_optional = json_data.get("except_dates").unwrap().as_array();
            if except_dates_optional != None {
                let except_dates = except_dates_optional.unwrap();
                let except_dates_count: usize = except_dates.len();

                capnp_data.reborrow().init_except_dates(except_dates_count as u32);
                for j in 0..except_dates_count
                {
                    capnp_data.reborrow().get_except_dates().unwrap().set(j as u32, except_dates[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_except_dates(0);
            }
        }

      

    }

    serialize_packed::write_message(file, &message)
}


pub fn read_collection(
    file: &mut std::fs::File,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_services()?.len() as usize);

    for capnp_object in capnp_collection.get_services()?.iter() {
        
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?.to_str()?).unwrap();
        let mut object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?.to_str()?,
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?.to_str()?),
            "simulation_id": empty_str_to_json_null(capnp_object.get_simulation_uuid()?.to_str()?),
            "name": empty_str_to_json_null(capnp_object.get_name()?.to_str()?),
            "color": empty_str_to_json_null(capnp_object.get_color()?.to_str()?),
            "description": empty_str_to_json_null(capnp_object.get_description()?.to_str()?),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "is_enabled": i8_to_json_boolean(capnp_object.get_is_enabled()),
            "monday": i8_to_json_boolean(capnp_object.get_monday()),
            "tuesday": i8_to_json_boolean(capnp_object.get_tuesday()),
            "wednesday": i8_to_json_boolean(capnp_object.get_wednesday()),
            "thursday": i8_to_json_boolean(capnp_object.get_thursday()),
            "friday": i8_to_json_boolean(capnp_object.get_friday()),
            "saturday": i8_to_json_boolean(capnp_object.get_saturday()),
            "sunday": i8_to_json_boolean(capnp_object.get_sunday()),
            "start_date": empty_str_to_json_null(capnp_object.get_start_date()?.to_str()?),
            "end_date": empty_str_to_json_null(capnp_object.get_end_date()?.to_str()?),
            "data": data_attributes
        });

        let mut only_dates_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_only_dates()?.len() as usize);
        for only_date in capnp_object.get_only_dates()?.iter() {
            only_dates_vec.push(json!(only_date.unwrap().to_str()?));
        }
        object_json["only_dates"] = json!(only_dates_vec);

        let mut except_dates_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_except_dates()?.len() as usize);
        for except_date in capnp_object.get_except_dates()?.iter() {
            except_dates_vec.push(json!(except_date.unwrap().to_str()?));
        }
        object_json["except_dates"] = json!(except_dates_vec);

        collection_json_vec.push(object_json);

    }

    let collection_json = json!({
        "services": serde_json::Value::Array(collection_json_vec)
    });

    Ok(collection_json)

}
