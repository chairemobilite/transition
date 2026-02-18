/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::scenarioCollection_capnp::scenario_collection as collection;
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

    let json_objects = &json["scenarios"];

    let count: usize = json_objects.as_array().unwrap().len();
    let collection_capnp = message.init_root::<collection::Builder>();
    let mut capnp = collection_capnp.init_scenarios(count as u32);

    for i in 0..count {
        let json_data = &json_objects[i];
        let mut capnp_data = capnp.reborrow().get(i as u32);
        capnp_data.set_uuid(&required_string(json_data.get("id")));
        capnp_data.set_simulation_uuid(&optional_string(json_data.get("simulation_id")));
        capnp_data.set_name(&optional_string(json_data.get("name")));
        capnp_data.set_color(&optional_string(json_data.get("color")));
        capnp_data.set_description(&optional_string(json_data.get("description")));
        capnp_data.set_data(&json_data.get("data").unwrap_or(&json!({})).to_string().as_str());
        capnp_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
        capnp_data.set_is_enabled(json_boolean_to_i8(json_data.get("is_enabled").unwrap_or(&json!(null))));
        
        if json_data.get("services") != None && json_data["services"].is_array()
        {
            let services_optional = json_data.get("services").unwrap().as_array();
            if services_optional != None {
                let services = services_optional.unwrap();
                let services_count: usize = services.len();

                capnp_data.reborrow().init_services_uuids(services_count as u32);
                for j in 0..services_count
                {
                    capnp_data.reborrow().get_services_uuids().unwrap().set(j as u32, services[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_services_uuids(0);
            }
        }

        if json_data.get("only_lines") != None && json_data["only_lines"].is_array()
        {
            let only_lines_optional = json_data.get("only_lines").unwrap().as_array();
            if only_lines_optional != None {
                let only_lines = only_lines_optional.unwrap();
                let only_lines_count: usize = only_lines.len();

                capnp_data.reborrow().init_only_lines_uuids(only_lines_count as u32);
                for j in 0..only_lines_count
                {
                    capnp_data.reborrow().get_only_lines_uuids().unwrap().set(j as u32, only_lines[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_only_lines_uuids(0);
            }
        }

        if json_data.get("except_lines") != None && json_data["except_lines"].is_array()
        {
            let except_lines_optional = json_data.get("except_lines").unwrap().as_array();
            if except_lines_optional != None {
                let except_lines = except_lines_optional.unwrap();
                let except_lines_count: usize = except_lines.len();

                capnp_data.reborrow().init_except_lines_uuids(except_lines_count as u32);
                for j in 0..except_lines_count
                {
                    capnp_data.reborrow().get_except_lines_uuids().unwrap().set(j as u32, except_lines[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_except_lines_uuids(0);
            }
        }

        if json_data.get("only_agencies") != None && json_data["only_agencies"].is_array()
        {
            let only_agencies_optional = json_data.get("only_agencies").unwrap().as_array();
            if only_agencies_optional != None {
                let only_agencies = only_agencies_optional.unwrap();
                let only_agencies_count: usize = only_agencies.len();

                capnp_data.reborrow().init_only_agencies_uuids(only_agencies_count as u32);
                for j in 0..only_agencies_count
                {
                    capnp_data.reborrow().get_only_agencies_uuids().unwrap().set(j as u32, only_agencies[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_only_agencies_uuids(0);
            }
        }

        if json_data.get("except_agencies") != None && json_data["except_agencies"].is_array()
        {
            let except_agencies_optional = json_data.get("except_agencies").unwrap().as_array();
            if except_agencies_optional != None {
                let except_agencies = except_agencies_optional.unwrap();
                let except_agencies_count: usize = except_agencies.len();

                capnp_data.reborrow().init_except_agencies_uuids(except_agencies_count as u32);
                for j in 0..except_agencies_count
                {
                    capnp_data.reborrow().get_except_agencies_uuids().unwrap().set(j as u32, except_agencies[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_except_agencies_uuids(0);
            }
        }

        if json_data.get("only_nodes") != None && json_data["only_nodes"].is_array()
        {
            let only_nodes_optional = json_data.get("only_nodes").unwrap().as_array();
            if only_nodes_optional != None {
                let only_nodes = only_nodes_optional.unwrap();
                let only_nodes_count: usize = only_nodes.len();

                capnp_data.reborrow().init_only_nodes_uuids(only_nodes_count as u32);
                for j in 0..only_nodes_count
                {
                    capnp_data.reborrow().get_only_nodes_uuids().unwrap().set(j as u32, only_nodes[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_only_nodes_uuids(0);
            }
        }

        if json_data.get("except_nodes") != None && json_data["except_nodes"].is_array()
        {
            let except_nodes_optional = json_data.get("except_nodes").unwrap().as_array();
            if except_nodes_optional != None {
                let except_nodes = except_nodes_optional.unwrap();
                let except_nodes_count: usize = except_nodes.len();

                capnp_data.reborrow().init_except_nodes_uuids(except_nodes_count as u32);
                for j in 0..except_nodes_count
                {
                    capnp_data.reborrow().get_except_nodes_uuids().unwrap().set(j as u32, except_nodes[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_except_nodes_uuids(0);
            }
        }

        if json_data.get("only_modes") != None && json_data["only_modes"].is_array()
        {
            let only_modes_shortnames_optional = json_data.get("only_modes").unwrap().as_array();
            if only_modes_shortnames_optional != None {
                let only_modes_shortnames = only_modes_shortnames_optional.unwrap();
                let only_modes_shortnames_count: usize = only_modes_shortnames.len();

                capnp_data.reborrow().init_only_modes_shortnames(only_modes_shortnames_count as u32);
                for j in 0..only_modes_shortnames_count
                {
                    capnp_data.reborrow().get_only_modes_shortnames().unwrap().set(j as u32, only_modes_shortnames[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_only_modes_shortnames(0);
            }
        }

        if json_data.get("except_modes") != None && json_data["except_modes"].is_array()
        {
            let except_modes_shortnames_optional = json_data.get("except_modes").unwrap().as_array();
            if except_modes_shortnames_optional != None {
                let except_modes_shortnames = except_modes_shortnames_optional.unwrap();
                let except_modes_shortnames_count: usize = except_modes_shortnames.len();

                capnp_data.reborrow().init_except_modes_shortnames(except_modes_shortnames_count as u32);
                for j in 0..except_modes_shortnames_count
                {
                    capnp_data.reborrow().get_except_modes_shortnames().unwrap().set(j as u32, except_modes_shortnames[j].as_str().unwrap());
                }
            }
            else
            {
                capnp_data.reborrow().init_except_modes_shortnames(0);
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
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_scenarios()?.len() as usize);

    for capnp_object in capnp_collection.get_scenarios()?.iter() {
        
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?.to_str()?).unwrap();
        let mut object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?.to_str()?,
            "simulation_id": empty_str_to_json_null(capnp_object.get_simulation_uuid()?.to_str()?),
            "name": empty_str_to_json_null(capnp_object.get_name()?.to_str()?),
            "color": empty_str_to_json_null(capnp_object.get_color()?.to_str()?),
            "description": empty_str_to_json_null(capnp_object.get_description()?.to_str()?),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "is_enabled": i8_to_json_boolean(capnp_object.get_is_enabled()),
            "data": data_attributes
        });

        let mut services_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_services_uuids()?.len() as usize);
        for service_uuid in capnp_object.get_services_uuids()?.iter() {
            services_uuids_vec.push(json!(service_uuid.unwrap().to_str()?));
        }
        object_json["services"] = json!(services_uuids_vec);

        let mut only_agencies_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_only_agencies_uuids()?.len() as usize);
        for only_agency_uuid in capnp_object.get_only_agencies_uuids()?.iter() {
            only_agencies_uuids_vec.push(json!(only_agency_uuid.unwrap().to_str()?));
        }
        object_json["only_agencies"] = json!(only_agencies_uuids_vec);

        let mut except_agencies_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_except_agencies_uuids()?.len() as usize);
        for except_agency_uuid in capnp_object.get_except_agencies_uuids()?.iter() {
            except_agencies_uuids_vec.push(json!(except_agency_uuid.unwrap().to_str()?));
        }
        object_json["except_agencies"] = json!(except_agencies_uuids_vec);

        let mut only_lines_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_only_lines_uuids()?.len() as usize);
        for only_line_uuid in capnp_object.get_only_lines_uuids()?.iter() {
            only_lines_uuids_vec.push(json!(only_line_uuid.unwrap().to_str()?));
        }
        object_json["only_lines"] = json!(only_lines_uuids_vec);

        let mut except_lines_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_except_lines_uuids()?.len() as usize);
        for except_line_uuid in capnp_object.get_except_lines_uuids()?.iter() {
            except_lines_uuids_vec.push(json!(except_line_uuid.unwrap().to_str()?));
        }
        object_json["except_lines"] = json!(except_lines_uuids_vec);

        let mut only_nodes_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_only_nodes_uuids()?.len() as usize);
        for only_node_uuid in capnp_object.get_only_nodes_uuids()?.iter() {
            only_nodes_uuids_vec.push(json!(only_node_uuid.unwrap().to_str()?));
        }
        object_json["only_nodes"] = json!(only_nodes_uuids_vec);

        let mut except_nodes_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_except_nodes_uuids()?.len() as usize);
        for except_node_uuid in capnp_object.get_except_nodes_uuids()?.iter() {
            except_nodes_uuids_vec.push(json!(except_node_uuid.unwrap().to_str()?));
        }
        object_json["except_nodes"] = json!(except_nodes_uuids_vec);

        let mut only_modes_shortnames_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_only_modes_shortnames()?.len() as usize);
        for only_mode_shortname in capnp_object.get_only_modes_shortnames()?.iter() {
            only_modes_shortnames_vec.push(json!(only_mode_shortname.unwrap().to_str()?));
        }
        object_json["only_modes"] = json!(only_modes_shortnames_vec);

        let mut except_modes_shortnames_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_except_modes_shortnames()?.len() as usize);
        for except_mode_shortname in capnp_object.get_except_modes_shortnames()?.iter() {
            except_modes_shortnames_vec.push(json!(except_mode_shortname.unwrap().to_str()?));
        }
        object_json["except_modes"] = json!(except_modes_shortnames_vec);

        collection_json_vec.push(object_json);

    }

    let collection_json = json!({
        "scenarios": serde_json::Value::Array(collection_json_vec)
    });

    Ok(collection_json)

}

