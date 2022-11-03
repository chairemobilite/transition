/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::node_capnp::{node};
//use crate::my_error::MyError;
use std::fs::File;
use std::path::Path;
//use std::fs;
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
    json_value_or_null_to_i64_or_minus_one,
    minus_one_i64_to_null
};

pub fn write_object(
    cache_directory_path: &str,
    json: &serde_json::Value,
    _: &serde_json::Value,
) -> ::std::result::Result<(), capnp::Error> {

    let mut message = ::capnp::message::Builder::new_default();

    let mut json_object = json["node"].clone();
    let object_uuid = match json_object.get("id") {
        Some(json_object_id) => {
            json_object_id.as_str().unwrap()
        },
        // TODO: deal with empty or invalid uuids here with custom error:
        None => {
            ""
        }
    };

    // TODO: deal with empty or invalid uuids here with custom error:
    /*if (object_uuid == "")
    {
        Err(MyError::new("node uuid is invalid or empty"))
    }*/

    let object_file_path_name = format!("{}/node_{}.capnpbin", cache_directory_path, object_uuid);
    let path = Path::new(&object_file_path_name);

    let file_check = File::create(&path);

    let file = file_check.unwrap();

    /* TODO: deal with error when creating object file using uuid */
    
    let mut capnp_data = message.init_root::<node::Builder>();

    let geometry = geojson::Geometry::from_json_value(json_object["geography"].clone());
    let geojson_value = geometry.unwrap().value;

    let latitude;
    let longitude;
    match geojson_value {
        GeojsonValue::Point(point) => {
            longitude = (point[0] * 1000000.0).round() as i32;
            latitude  = (point[1] * 1000000.0).round() as i32;
        },
        _ => {
            longitude = -1;
            latitude  = -1;
        }
    }

    capnp_data.set_uuid(&required_string(json_object.get("id"))); // required
    capnp_data.set_station_uuid(optional_string(json_object.get("station_id")));
    capnp_data.set_internal_id(optional_string(json_object.get("internal_id")));
    capnp_data.set_code(optional_string(json_object.get("code")));
    capnp_data.set_name(optional_string(json_object.get("name")));
    capnp_data.set_color(optional_string(json_object.get("color")));
    capnp_data.set_description(optional_string(json_object.get("description")));
    capnp_data.set_routing_radius_meters(json_value_or_null_to_i64_or_minus_one(&json_object.get("routing_radius_meters").unwrap_or(&json!(null))) as i16);
    capnp_data.set_default_dwell_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_object.get("default_dwell_time_seconds").unwrap_or(&json!(null))) as i16);
    capnp_data.set_data(&json_object.get("data").unwrap_or(&json!({})).to_string().as_str());
    capnp_data.set_is_frozen(json_boolean_to_i8(&json_object.get("is_frozen").unwrap_or(&json!(null))));
    capnp_data.set_is_enabled(json_boolean_to_i8(&json_object.get("is_enabled").unwrap_or(&json!(null))));
    capnp_data.set_latitude(latitude);
    capnp_data.set_longitude(longitude);

    if !json_object.get("integer_id").unwrap_or(&json!(null)).is_null() { // only save transferable node if the node has an integer id, otherwise, we get null indexes
        capnp_data.set_id(json_object.get("integer_id").unwrap().as_u64().unwrap() as u32); // required

        if json_object.get("data") != None && json_object["data"].is_object() && json_object["data"].get("transferableNodes") != None && json_object["data"]["transferableNodes"].is_object() && json_object["data"]["transferableNodes"].get("nodesIds") != None && json_object["data"]["transferableNodes"]["nodesIds"].is_array()
        {
            let transferable_nodes_count = json_object["data"]["transferableNodes"]["nodesIds"].as_array().unwrap().len();
            capnp_data.reborrow().init_transferable_nodes_uuids(transferable_nodes_count as u32);
            capnp_data.reborrow().init_transferable_nodes_travel_times(transferable_nodes_count as u32);
            capnp_data.reborrow().init_transferable_nodes_distances(transferable_nodes_count as u32);

            for j in 0..transferable_nodes_count
            {
                capnp_data.reborrow().get_transferable_nodes_uuids().unwrap().set(j as u32, json_object["data"]["transferableNodes"]["nodesIds"][j].as_str().unwrap());
                capnp_data.reborrow().get_transferable_nodes_travel_times().unwrap().set(j as u32, json_object["data"]["transferableNodes"]["walkingTravelTimesSeconds"][j].as_i64().unwrap_or(-1) as i16);
                capnp_data.reborrow().get_transferable_nodes_distances().unwrap().set(j as u32, json_object["data"]["transferableNodes"]["walkingDistancesMeters"][j].as_i64().unwrap_or(-1) as i16);
            }

            // remove transferableNodes and associates:
            json_object["data"]["transferableNodes"]["nodesIds"].take();
            json_object["data"]["transferableNodes"]["walkingTravelTimesSeconds"].take();
            json_object["data"]["transferableNodes"]["walkingDistancesMeters"].take();
        }
    }

    serialize_packed::write_message(file, &message)

}


pub fn read_object(
    object_uuid: &String,
    cache_directory_path: &str,
    _ : &serde_json::Value//config: &serde_json::Value,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let object_file_path_name = format!("{}/node_{}.capnpbin", cache_directory_path, object_uuid);
    let path = Path::new(&object_file_path_name);
    let file = File::open(&path);
    
    let file = match file {
        Ok(f) => f,
        Err(e) => {
            println!("Error opening node file {}: {}", object_file_path_name, e);
            return Err(capnp::Error::failed(String::from("Cannot read node file")));
        }
    };

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_object = message_reader.get_root::<node::Reader>()?;
    
    let integer_id = capnp_object.get_id() as u32;
    let mut data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
    let latitude  = (capnp_object.get_latitude() as f64)/1000000.0;
    let longitude = (capnp_object.get_longitude() as f64)/1000000.0;

    if capnp_object.has_transferable_nodes_uuids()
    {
        data_attributes["transferableNodes"] = json!({
            "nodesIds": [],
            "walkingTravelTimesSeconds": [],
            "walkingDistancesMeters": []
        });
        let mut transferable_nodes_uuids : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_transferable_nodes_uuids()?.len() as usize);
        for transferable_node_uuid in capnp_object.get_transferable_nodes_uuids()?.iter() {
            transferable_nodes_uuids.push(json!(transferable_node_uuid.unwrap()));
        }
        data_attributes["transferableNodes"]["nodesIds"] = json!(transferable_nodes_uuids);

        let mut transferable_nodes_travel_times : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_transferable_nodes_travel_times()?.len() as usize);
        for transferable_node_travel_time in capnp_object.get_transferable_nodes_travel_times()?.iter() {
            transferable_nodes_travel_times.push(json!(transferable_node_travel_time));
        }
        data_attributes["transferableNodes"]["walkingTravelTimesSeconds"] = json!(transferable_nodes_travel_times);

        let mut transferable_nodes_distances : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_transferable_nodes_distances()?.len() as usize);
        for transferable_node_distance in capnp_object.get_transferable_nodes_distances()?.iter() {
            transferable_nodes_distances.push(json!(transferable_node_distance));
        }
        data_attributes["transferableNodes"]["walkingDistancesMeters"] = json!(transferable_nodes_distances);
    }

    let object_json : serde_json::Value = json!({
        "id": capnp_object.get_uuid()?,
        "integer_id": integer_id,
        "station_id": empty_str_to_json_null(capnp_object.get_station_uuid()?),
        "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?),
        "code": empty_str_to_json_null(capnp_object.get_code()?),
        "name": empty_str_to_json_null(capnp_object.get_name()?),
        "color": empty_str_to_json_null(capnp_object.get_color()?),
        "description": empty_str_to_json_null(capnp_object.get_description()?),
        "routing_radius_meters": minus_one_i64_to_null(capnp_object.get_routing_radius_meters() as i64),
        "default_dwell_time_seconds": minus_one_i64_to_null(capnp_object.get_default_dwell_time_seconds() as i64),
        "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
        "is_enabled": i8_to_json_boolean(capnp_object.get_is_enabled()),
        "geography": {
            "type": "Point",
            "coordinates": [longitude, latitude]
        },
        "data": data_attributes
    });

    let output_json = json!({
        "node": object_json
    });

    Ok(output_json)

}


#[cfg(test)]
mod tests {

    use pretty_assertions::{assert_eq};
    use crate::routers;
    use std::path::{Path};
    use std::fs;
    use rouille::Request;

    #[test]
    fn node() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "node": {
                    "id": "cddc12af-6c9f-4048-a800-a79ee187401d",
                    "internal_id": "Stop internal id",
                    "integer_id": 77,
                    "name": "Stop name",
                    "code": "Stop code",
                    "color": "#ffff00",
                    "is_enabled": true,
                    "description": null,
                    "station_id": null,
                    "geography": {
                        "type": "Point",
                        "coordinates": [-73.70, 45.40]
                    },
                    "data": {
                        "isNew": false,
                        "transferableNodes": {
                            "nodesIds": ["addc12af-6c9f-4048-a800-a79ee187401d","bddc12af-6c9f-4048-a800-a79ee187401d","dddc12af-6c9f-4048-a800-a79ee187401d","eddc12af-6c9f-4048-a800-a79ee187401d"],
                            "walkingTravelTimesSeconds": [234,233,555,0],
                            "walkingDistancesMeters": [444,555,666,0]
                        }
                    },
                    "created_at": "2020-12-16T16:55:18.963Z",
                    "updated_at": "2020-12-16T17:01:40.545Z",
                    "routing_radius_meters": 50,
                    "default_dwell_time_seconds": 25,
                    "is_frozen": null
                }
            }
        "##;

        let compare_data = r##"
            {
                "node": {
                    "id": "cddc12af-6c9f-4048-a800-a79ee187401d",
                    "internal_id": "Stop internal id",
                    "integer_id": 77,
                    "name": "Stop name",
                    "code": "Stop code",
                    "color": "#ffff00",
                    "is_enabled": true,
                    "description": null,
                    "station_id": null,
                    "geography": {
                        "type": "Point",
                        "coordinates": [-73.70, 45.40]
                    },
                    "data": {
                        "isNew": false,
                        "transferableNodes": {
                            "nodesIds": ["addc12af-6c9f-4048-a800-a79ee187401d","bddc12af-6c9f-4048-a800-a79ee187401d","dddc12af-6c9f-4048-a800-a79ee187401d","eddc12af-6c9f-4048-a800-a79ee187401d"],
                            "walkingTravelTimesSeconds": [234,233,555,0],
                            "walkingDistancesMeters": [444,555,666,0]
                        }
                    },
                    "routing_radius_meters": 50,
                    "default_dwell_time_seconds": 25,
                    "is_frozen": null
                }
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/node",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_object_route(
            "node",
            "nodes",
            &config,
            &routers::node_router::write_object,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_object_route(
            "node",
            &String::from("cddc12af-6c9f-4048-a800-a79ee187401d"),
            "nodes",
            &config,
            &routers::node_router::read_object,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["node"], json_compare_data["node"]);

        // Test unexisting node
        let response = routers::read_object_route(
            "node",
            &String::from("cddc12af-6c9f-4048-a800-aaaaaaaaaaaa"),
            "nodes",
            &config,
            &routers::node_router::read_object,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        // TODO Response code should be 404 not found
        assert_eq!(response.status_code, 200);
        assert!(json_response["data"].is_null());

    }
}