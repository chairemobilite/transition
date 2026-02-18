/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::odTripCollection_capnp::od_trip_collection as collection;
use capnp::serialize_packed;
use serde_json;
use std::io::BufReader;
use geojson::{Value as GeojsonValue};
use crate::utils::{ 
    required_string, 
    optional_string_json_null_to_empty_str as optional_string, 
    json_boolean_to_i8, 
    empty_str_to_json_null, 
    i8_to_json_boolean,
    minus_one_i64_to_null,
    minus_one_f64_to_null,
    json_value_or_null_to_i64_or_minus_one,
    json_value_or_null_to_f64_or_minus_one
};

pub fn write_collection(
    json: &serde_json::Value,
    file: &mut std::fs::File,
) -> ::std::result::Result<(), capnp::Error> {
    let mut message = ::capnp::message::Builder::new_default();

    let json_objects = &json["odTrips"];

    let count: usize = json_objects.as_array().unwrap().len();
    let collection_capnp = message.init_root::<collection::Builder>();
    let mut capnp = collection_capnp.init_od_trips(count as u32);

    for i in 0..count {
        let mut json_data = json_objects[i].clone();

        let origin_geometry = geojson::Geometry::from_json_value(json_data["origin_geography"].clone());
        let origin_geojson_value = origin_geometry.unwrap().value;
        let origin_latitude;
        let origin_longitude;
        match origin_geojson_value {
            GeojsonValue::Point(point) => {
                origin_longitude = (point[0] * 1000000.0).round() as i32;
                origin_latitude  = (point[1] * 1000000.0).round() as i32;
            },
            _ => {
                origin_longitude = -1;
                origin_latitude  = -1;
            }
        }

        let destination_geometry = geojson::Geometry::from_json_value(json_data["destination_geography"].clone());
        let destination_geojson_value = destination_geometry.unwrap().value;
        let destination_latitude;
        let destination_longitude;
        match destination_geojson_value {
            GeojsonValue::Point(point) => {
                destination_longitude = (point[0] * 1000000.0).round() as i32;
                destination_latitude  = (point[1] * 1000000.0).round() as i32;
            },
            _ => {
                destination_longitude = -1;
                destination_latitude  = -1;
            }
        }

        let mut capnp_data = capnp.reborrow().get(i as u32);
        capnp_data.set_uuid(&required_string(json_data.get("id")));
        capnp_data.set_person_uuid(&optional_string(json_data.get("person_id")));
        capnp_data.set_household_uuid(&optional_string(json_data.get("household_id")));
        capnp_data.set_data_source_uuid(&optional_string(json_data.get("data_source_id")));
        capnp_data.set_id(json_data.get("integer_id").unwrap().as_u64().unwrap() as u32); // required
        capnp_data.set_internal_id(&optional_string(json_data.get("internal_id")));
        capnp_data.set_data(&json_data.get("data").unwrap_or(&json!({})).to_string().as_str());
        capnp_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
        capnp_data.set_expansion_factor(json_value_or_null_to_f64_or_minus_one(&json_data.get("expansion_factor").unwrap_or(&json!(null))) as f32);
        capnp_data.set_departure_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("departure_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_arrival_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("arrival_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_walking_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("walking_travel_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_cycling_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("cycling_travel_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_driving_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("driving_travel_time_seconds").unwrap_or(&json!(null))) as i32);

        capnp_data.set_mode(crate::enum_mappings::mode(&json_data["mode"].as_str().unwrap_or("none")));
        capnp_data.set_origin_activity(crate::enum_mappings::activity(&json_data["origin_activity"].as_str().unwrap_or("none")));
        capnp_data.set_destination_activity(crate::enum_mappings::activity(&json_data["destination_activity"].as_str().unwrap_or("none")));
        capnp_data.set_origin_latitude(origin_latitude);
        capnp_data.set_origin_longitude(origin_longitude);
        capnp_data.set_destination_latitude(destination_latitude);
        capnp_data.set_destination_longitude(destination_longitude);

        if json_data.get("data") != None && json_data["data"].is_object() && json_data["data"].get("originNodes") != None && json_data["data"]["originNodes"].is_array()
        {
            let nodes_count = json_data["data"]["originNodes"].as_array().unwrap().len();
            capnp_data.reborrow().init_origin_nodes_uuids(nodes_count as u32);
            capnp_data.reborrow().init_origin_nodes_travel_times(nodes_count as u32);
            capnp_data.reborrow().init_origin_nodes_distances(nodes_count as u32);
            for j in 0..nodes_count
            {
                capnp_data.reborrow().get_origin_nodes_uuids().unwrap().set(j as u32, json_data["data"]["originNodes"][j].as_str().unwrap());
                capnp_data.reborrow().get_origin_nodes_travel_times().unwrap().set(j as u32, json_data["data"]["originNodesTravelTimes"][j].as_i64().unwrap() as i16);
                capnp_data.reborrow().get_origin_nodes_distances().unwrap().set(j as u32, json_data["data"]["originNodesDistances"][j].as_i64().unwrap() as i16);
            }

            // remove originNodes and associates:
            json_data["data"]["originNodes"].take();
            json_data["data"]["originNodesTravelTimes"].take();
            json_data["data"]["originNodesDistances"].take();
        }

        if json_data.get("data") != None && json_data["data"].is_object() && json_data["data"].get("destinationNodes") != None && json_data["data"]["destinationNodes"].is_array()
        {
            let nodes_count = json_data["data"]["destinationNodes"].as_array().unwrap().len();
            capnp_data.reborrow().init_destination_nodes_uuids(nodes_count as u32);
            capnp_data.reborrow().init_destination_nodes_travel_times(nodes_count as u32);
            capnp_data.reborrow().init_destination_nodes_distances(nodes_count as u32);
            for j in 0..nodes_count
            {
                capnp_data.reborrow().get_destination_nodes_uuids().unwrap().set(j as u32, json_data["data"]["destinationNodes"][j].as_str().unwrap());
                capnp_data.reborrow().get_destination_nodes_travel_times().unwrap().set(j as u32, json_data["data"]["destinationNodesTravelTimes"][j].as_i64().unwrap() as i16);
                capnp_data.reborrow().get_destination_nodes_distances().unwrap().set(j as u32, json_data["data"]["destinationNodesDistances"][j].as_i64().unwrap() as i16);
            }

            // remove destinationNodes and associates:
            json_data["data"]["destinationNodes"].take();
            json_data["data"]["destinationNodesTravelTimes"].take();
            json_data["data"]["destinationNodesDistances"].take();
        }

    }

    serialize_packed::write_message(file, &message)
}


pub fn read_collection(
    file: &mut std::fs::File,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_od_trips()?.len() as usize);

    for capnp_object in capnp_collection.get_od_trips()?.iter() {
        
        let mut data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?.to_str()?).unwrap();
        let origin_latitude  = (capnp_object.get_origin_latitude() as f64)/1000000.0;
        let origin_longitude = (capnp_object.get_origin_longitude() as f64)/1000000.0;
        let destination_latitude  = (capnp_object.get_destination_latitude() as f64)/1000000.0;
        let destination_longitude = (capnp_object.get_destination_longitude() as f64)/1000000.0;

        if capnp_object.has_origin_nodes_uuids()
        {
            let mut origin_nodes_uuids : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_origin_nodes_uuids()?.len() as usize);
            for origin_node_uuid in capnp_object.get_origin_nodes_uuids()?.iter() {
                origin_nodes_uuids.push(json!(origin_node_uuid.unwrap().to_str()?));
            }
            data_attributes["originNodes"] = json!(origin_nodes_uuids);

            let mut origin_nodes_travel_times : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_origin_nodes_travel_times()?.len() as usize);
            for origin_node_travel_time in capnp_object.get_origin_nodes_travel_times()?.iter() {
                origin_nodes_travel_times.push(json!(origin_node_travel_time));
            }
            data_attributes["originNodesTravelTimes"] = json!(origin_nodes_travel_times);

            let mut origin_nodes_distances : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_origin_nodes_distances()?.len() as usize);
            for origin_node_distance in capnp_object.get_origin_nodes_distances()?.iter() {
                origin_nodes_distances.push(json!(origin_node_distance));
            }
            data_attributes["originNodesDistances"] = json!(origin_nodes_distances);
        }

        if capnp_object.has_destination_nodes_uuids()
        {
            let mut destination_nodes_uuids : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_destination_nodes_uuids()?.len() as usize);
            for destination_node_uuid in capnp_object.get_destination_nodes_uuids()?.iter() {
                destination_nodes_uuids.push(json!(destination_node_uuid.unwrap().to_str()?));
            }
            data_attributes["destinationNodes"] = json!(destination_nodes_uuids);

            let mut destination_nodes_travel_times : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_destination_nodes_travel_times()?.len() as usize);
            for destination_node_travel_time in capnp_object.get_destination_nodes_travel_times()?.iter() {
                destination_nodes_travel_times.push(json!(destination_node_travel_time));
            }
            data_attributes["destinationNodesTravelTimes"] = json!(destination_nodes_travel_times);

            let mut destination_nodes_distances : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_destination_nodes_distances()?.len() as usize);
            for destination_node_distance in capnp_object.get_destination_nodes_distances()?.iter() {
                destination_nodes_distances.push(json!(destination_node_distance));
            }
            data_attributes["destinationNodesDistances"] = json!(destination_nodes_distances);
        }

        let object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?.to_str()?,
            "integer_id": capnp_object.get_id(),
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?.to_str()?),
            "person_id": empty_str_to_json_null(capnp_object.get_person_uuid()?.to_str()?),
            "household_id": empty_str_to_json_null(capnp_object.get_household_uuid()?.to_str()?),
            "data_source_id": empty_str_to_json_null(capnp_object.get_data_source_uuid()?.to_str()?),
            "mode": crate::enum_mappings::mode_to_str(&capnp_object.get_mode()?),
            "origin_activity": crate::enum_mappings::activity_to_str(&capnp_object.get_origin_activity()?),
            "destination_activity": crate::enum_mappings::activity_to_str(&capnp_object.get_destination_activity()?),
            "expansion_factor": minus_one_f64_to_null(((capnp_object.get_expansion_factor() as f64)*100000.0).round() / 100000.0), // we must round to 5 decimals so we don't get numbers like 2.10000000345454 for n input value of 2.1
            "departure_time_seconds": minus_one_i64_to_null(capnp_object.get_departure_time_seconds() as i64),
            "arrival_time_seconds": minus_one_i64_to_null(capnp_object.get_arrival_time_seconds() as i64),
            "walking_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_walking_travel_time_seconds() as i64),
            "cycling_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_cycling_travel_time_seconds() as i64),
            "driving_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_driving_travel_time_seconds() as i64),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "data": data_attributes,
            "origin_geography": {
                "type": "Point",
                "coordinates": [origin_longitude, origin_latitude]
            },
            "destination_geography": {
                "type": "Point",
                "coordinates": [destination_longitude, destination_latitude]
            }
        });

        collection_json_vec.push(object_json);

    }

    let collection_json = json!({
        "odTrips": serde_json::Value::Array(collection_json_vec)
    });

    Ok(collection_json)

}
