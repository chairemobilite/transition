/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::line_capnp::{line};
//use crate::my_error::MyError;
use std::fs::File;
use std::path::Path;
//use std::fs;
use capnp::serialize_packed;
use serde_json;
use std::io::BufReader;
use crate::utils::{ 
    required_string, 
    optional_string_json_null_to_empty_str as optional_string, 
    json_boolean_to_i8, 
    empty_str_to_json_null, 
    i8_to_json_boolean,
    json_value_or_null_to_i64_or_minus_one,
    json_value_or_null_to_f64_or_minus_one,
    minus_one_i64_to_null,
    minus_one_f64_to_null,
    time_str_to_seconds_since_midnight,
    seconds_since_midnight_to_time_str
};

pub fn write_object(
    cache_directory_path: &str,
    json: &serde_json::Value,
) -> ::std::result::Result<(), capnp::Error> {

    let mut message = ::capnp::message::Builder::new_default();

    let json_object = &json["line"];
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
        Err(MyError::new("line uuid is invalid or empty"))
    }*/

    let object_file_path_name = format!("{}/line_{}.capnpbin", cache_directory_path, object_uuid);
    let path = Path::new(&object_file_path_name);

    let file_check = File::create(&path);

    let file = file_check.unwrap();

    /* TODO: deal with error when creating object file using uuid */
    
    let mut capnp_data = message.init_root::<line::Builder>();

    capnp_data.set_uuid(&required_string(json_object.get("id")));
    capnp_data.set_agency_uuid(&required_string(json_object.get("agency_id")));
    capnp_data.set_shortname(&optional_string(json_object.get("shortname")));
    capnp_data.set_longname(&optional_string(json_object.get("longname")));
    capnp_data.set_internal_id(&optional_string(json_object.get("internal_id")));
    capnp_data.set_category(&optional_string(json_object.get("category")));
    capnp_data.set_mode(&optional_string(json_object.get("mode")));
    capnp_data.set_color(&optional_string(json_object.get("color")));
    capnp_data.set_description(&optional_string(json_object.get("description")));
    capnp_data.set_data(&json_object.get("data").unwrap_or(&json!({})).to_string().as_str());
    capnp_data.set_is_frozen(json_boolean_to_i8(json_object.get("is_frozen").unwrap_or(&json!(null))));
    capnp_data.set_is_enabled(json_boolean_to_i8(json_object.get("is_enabled").unwrap_or(&json!(null))));
    capnp_data.set_is_autonomous(json_boolean_to_i8(json_object.get("is_autonomous").unwrap_or(&json!(null))));
    capnp_data.set_allow_same_line_transfers(json_boolean_to_i8(json_object.get("allow_same_line_transfers").unwrap_or(&json!(null))));

    let schedules_json : std::collections::HashMap<String, serde_json::Value> = serde_json::from_str(&json_object.get("scheduleByServiceId").unwrap_or(&json!({})).to_string().as_str()).unwrap();
    let count_schedules : usize = schedules_json.keys().len();

    let mut capnp_schedules = capnp_data.reborrow().init_schedules(count_schedules as u32);

    let mut i : u32 = 0;
    for (_ /* service_id */, json_data) in &schedules_json
    {

        let mut capnp_schedule_data = capnp_schedules.reborrow().get(i as u32);
        
        capnp_schedule_data.set_uuid(&required_string(json_data.get("id")));
        capnp_schedule_data.set_service_uuid(&required_string(json_data.get("service_id")));
        capnp_schedule_data.set_periods_group_shortname(&optional_string(json_data.get("periods_group_shortname")));
        capnp_schedule_data.set_allow_seconds_based_schedules(json_boolean_to_i8(json_data.get("allow_seconds_based_schedules").unwrap_or(&json!(null))));
        capnp_schedule_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
  
        let count_periods: usize = json_data["periods"].as_array().unwrap().len();
        let mut capnp_periods    = capnp_schedule_data.init_periods(count_periods as u32);
        let periods_json         = &json_data["periods"];
    
        for j in 0..count_periods
        {
            let json_data             = &periods_json[j];
            let mut capnp_period_data = capnp_periods.reborrow().get(j as u32);
            let mut custom_start_at_seconds : i32 = -1;
            let custom_start_at_str = json_data.get("custom_start_at_str").unwrap_or(&json!(null));
            if !custom_start_at_str.is_null()
            {
                let custom_start_at_seconds_option = time_str_to_seconds_since_midnight(custom_start_at_str.as_str().unwrap());
                if custom_start_at_seconds_option != None {
                    custom_start_at_seconds = custom_start_at_seconds_option.unwrap() as i32;
                }
            }
            let mut custom_end_at_seconds : i32 = -1;
            let custom_end_at_str = json_data.get("custom_end_at_str").unwrap_or(&json!(null));
            if !custom_end_at_str.is_null()
            {
                let custom_end_at_seconds_option = time_str_to_seconds_since_midnight(custom_end_at_str.as_str().unwrap());
                if custom_end_at_seconds_option != None {
                    custom_end_at_seconds = custom_end_at_seconds_option.unwrap() as i32;
                }
            }

            capnp_period_data.set_period_shortname(&optional_string(json_data.get("period_shortname")));
            capnp_period_data.set_outbound_path_uuid(&optional_string(json_data.get("outbound_path_id")));
            capnp_period_data.set_inbound_path_uuid(&optional_string(json_data.get("inbound_path_id")));
            capnp_period_data.set_custom_start_at_seconds(custom_start_at_seconds);
            capnp_period_data.set_custom_end_at_seconds(custom_end_at_seconds);
            capnp_period_data.set_start_at_seconds((json_value_or_null_to_f64_or_minus_one(&json_data.get("start_at_hour").unwrap()) * 3600.0) as i32);
            capnp_period_data.set_end_at_seconds((json_value_or_null_to_f64_or_minus_one(&json_data.get("end_at_hour").unwrap()) * 3600.0) as i32);
            capnp_period_data.set_interval_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("interval_seconds").unwrap_or(&json!(null))) as i16);
            capnp_period_data.set_number_of_units(json_value_or_null_to_i64_or_minus_one(&json_data.get("number_of_units").unwrap_or(&json!(null))) as i16);
            capnp_period_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
            capnp_period_data.set_uuid(&optional_string(json_data.get("id"))); // period.id is required in the db. However, in the genetic algorithm, we don't need it.

            let count_trips: usize = json_data.get("trips").unwrap_or(&json!([])).as_array().unwrap().len();
            let mut capnp_trips    = capnp_period_data.init_trips(count_trips as u32);
            let trips_json         = &json_data["trips"];

            for k in 0..count_trips
            {
                let json_data           = &trips_json[k];
                let mut capnp_trip_data = capnp_trips.reborrow().get(k as u32);

                capnp_trip_data.set_uuid(&required_string(json_data.get("id")));
                capnp_trip_data.set_path_uuid(&required_string(json_data.get("path_id")));
                capnp_trip_data.set_departure_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("departure_time_seconds").unwrap_or(&json!(null))) as i32);
                capnp_trip_data.set_arrival_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("arrival_time_seconds").unwrap_or(&json!(null))) as i32);
                capnp_trip_data.set_block_uuid(&optional_string(json_data.get("block_id")));
                capnp_trip_data.set_total_capacity(json_value_or_null_to_i64_or_minus_one(&json_data.get("total_capacity").unwrap_or(&json!(null))) as i16);
                capnp_trip_data.set_seated_capacity(json_value_or_null_to_i64_or_minus_one(&json_data.get("seated_capacity").unwrap_or(&json!(null))) as i16);
                capnp_trip_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));

                let nodes_arrival_time_seconds = json_data.get("node_arrival_times_seconds").unwrap().as_array();
                if nodes_arrival_time_seconds != None {
                    let nodes_arrival_time_seconds = nodes_arrival_time_seconds.unwrap();
                    let nodes_count: usize = nodes_arrival_time_seconds.len();

                    capnp_trip_data.reborrow().init_node_arrival_times_seconds(nodes_count as u32);
                    for l in 0..nodes_count
                    {
                        capnp_trip_data.reborrow().get_node_arrival_times_seconds().unwrap().set(l as u32, json_value_or_null_to_i64_or_minus_one(&nodes_arrival_time_seconds[l]) as i32);
                    }
                }
                else
                {
                    capnp_trip_data.reborrow().init_node_arrival_times_seconds(0);
                }

                let nodes_departure_time_seconds = json_data.get("node_departure_times_seconds").unwrap().as_array();
                if nodes_departure_time_seconds != None {
                    let nodes_departure_time_seconds = nodes_departure_time_seconds.unwrap();
                    let nodes_count: usize = nodes_departure_time_seconds.len();

                    capnp_trip_data.reborrow().init_node_departure_times_seconds(nodes_count as u32);
                    for l in 0..nodes_count
                    {
                        capnp_trip_data.reborrow().get_node_departure_times_seconds().unwrap().set(l as u32, json_value_or_null_to_i64_or_minus_one(&nodes_departure_time_seconds[l]) as i32);
                    }
                }
                else
                {
                    capnp_trip_data.reborrow().init_node_departure_times_seconds(0);
                }

                let nodes_can_board = json_data.get("nodes_can_board").unwrap().as_array();
                if nodes_can_board != None {
                    let nodes_can_board = nodes_can_board.unwrap();
                    let nodes_count: usize = nodes_can_board.len();

                    capnp_trip_data.reborrow().init_nodes_can_board(nodes_count as u32);
                    for l in 0..nodes_count
                    {
                        capnp_trip_data.reborrow().get_nodes_can_board().unwrap().set(l as u32, crate::utils::json_boolean_to_i8(&nodes_can_board[l]));
                    }
                }
                else
                {
                    capnp_trip_data.reborrow().init_nodes_can_board(0);
                }

                let nodes_can_unboard = json_data.get("nodes_can_unboard").unwrap().as_array();
                if nodes_can_unboard != None {
                    let nodes_can_unboard = nodes_can_unboard.unwrap();
                    let nodes_count: usize = nodes_can_unboard.len();

                    capnp_trip_data.reborrow().init_nodes_can_unboard(nodes_count as u32);
                    for l in 0..nodes_count
                    {
                        capnp_trip_data.reborrow().get_nodes_can_unboard().unwrap().set(l as u32, crate::utils::json_boolean_to_i8(&nodes_can_unboard[l]));
                    }
                }
                else
                {
                    capnp_trip_data.reborrow().init_nodes_can_unboard(0);
                }

            }

        }
        i += 1;

    }

    serialize_packed::write_message(file, &message)

}


pub fn read_object(
    object_uuid: &String,
    cache_directory_path: &str,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let object_file_path_name = format!("{}/line_{}.capnpbin", cache_directory_path, object_uuid);
    let path = Path::new(&object_file_path_name);
    let file = File::open(&path);
    
    let file = match file {
        Ok(f) => f,
        Err(e) => {
            println!("Error opening line file {}: {}", object_file_path_name, e);
            return Err(capnp::Error::failed(String::from("Cannot read line file")));
        }
    };

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_object = message_reader.get_root::<line::Reader>()?;
    
    let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
    let mut schedules   : serde_json::Value = json!({});

    if capnp_object.has_schedules()
    {
        for schedule in capnp_object.get_schedules()?.iter() {
            
            let mut schedule_json : serde_json::Value = json!({
                "id": schedule.get_uuid()?,
                "service_id": schedule.get_service_uuid()?,
                "periods_group_shortname": empty_str_to_json_null(schedule.get_periods_group_shortname()?),
                "allow_seconds_based_schedules": i8_to_json_boolean(schedule.get_allow_seconds_based_schedules()),
                "is_frozen": i8_to_json_boolean(schedule.get_is_frozen()),
                "line_id": capnp_object.get_uuid()?
            });

            if schedule.has_periods()
            {
                let mut periods : Vec<serde_json::Value> = Vec::with_capacity(schedule.get_periods()?.len() as usize);
                for period in schedule.get_periods()?.iter() {

                    let mut custom_start_at_str = String::from("");
                    if period.get_custom_start_at_seconds() >= 0
                    {
                        let custom_start_at_seconds = period.get_custom_start_at_seconds() as u32;
                        custom_start_at_str = seconds_since_midnight_to_time_str(&custom_start_at_seconds);
                    }

                    let mut custom_end_at_str = String::from("");
                    if period.get_custom_end_at_seconds() >= 0
                    {
                        let custom_end_at_seconds = period.get_custom_end_at_seconds() as u32;
                        custom_end_at_str = seconds_since_midnight_to_time_str(&custom_end_at_seconds);
                    }

                    let mut period_json : serde_json::Value = json!({
                        "period_shortname": empty_str_to_json_null(period.get_period_shortname()?),
                        "outbound_path_id": empty_str_to_json_null(period.get_outbound_path_uuid()?),
                        "inbound_path_id": empty_str_to_json_null(period.get_inbound_path_uuid()?),
                        "custom_start_at_str": empty_str_to_json_null(custom_start_at_str.as_str()),
                        "custom_end_at_str": empty_str_to_json_null(custom_end_at_str.as_str()),
                        "start_at_hour": minus_one_f64_to_null(period.get_start_at_seconds() as f64 / 3600.0),
                        "end_at_hour": minus_one_f64_to_null(period.get_end_at_seconds() as f64 / 3600.0),
                        "interval_seconds": minus_one_i64_to_null(period.get_interval_seconds() as i64),
                        "number_of_units": minus_one_i64_to_null(period.get_number_of_units() as i64),
                        "is_frozen": i8_to_json_boolean(period.get_is_frozen()),
                        "id": empty_str_to_json_null(period.get_uuid()?),
                        "schedule_id": schedule.get_uuid()?
                    });

                    if period.has_trips()
                    {
                        let mut trips : Vec<serde_json::Value> = Vec::with_capacity(period.get_trips()?.len() as usize);
                        for trip in period.get_trips()?.iter() {
                            let mut trip_json : serde_json::Value = json!({
                                "id": trip.get_uuid()?,
                                "path_id": trip.get_path_uuid()?,
                                "departure_time_seconds": minus_one_i64_to_null(trip.get_departure_time_seconds() as i64),
                                "arrival_time_seconds": minus_one_i64_to_null(trip.get_arrival_time_seconds() as i64),
                                "block_id": empty_str_to_json_null(trip.get_block_uuid()?),
                                "total_capacity": minus_one_i64_to_null(trip.get_total_capacity() as i64),
                                "seated_capacity": minus_one_i64_to_null(trip.get_seated_capacity() as i64),
                                "is_frozen": i8_to_json_boolean(period.get_is_frozen()),
                                "schedule_id": empty_str_to_json_null(schedule.get_uuid()?),
                                "schedule_period_id": empty_str_to_json_null(period.get_uuid()?)
                            });

                            if trip.has_node_arrival_times_seconds()
                            {
                                let mut node_arrival_times_seconds : Vec<serde_json::Value> = Vec::with_capacity(trip.get_node_arrival_times_seconds()?.len() as usize);
                                for node_arrival_time_seconds in trip.get_node_arrival_times_seconds()?.iter() {
                                    node_arrival_times_seconds.push(json!(minus_one_i64_to_null(node_arrival_time_seconds as i64)));
                                }
                                trip_json["node_arrival_times_seconds"] = json!(node_arrival_times_seconds);
                            }
                            if trip.has_node_departure_times_seconds()
                            {
                                let mut node_departure_times_seconds : Vec<serde_json::Value> = Vec::with_capacity(trip.get_node_departure_times_seconds()?.len() as usize);
                                for node_departure_time_seconds in trip.get_node_departure_times_seconds()?.iter() {
                                    node_departure_times_seconds.push(json!(minus_one_i64_to_null(node_departure_time_seconds as i64)));
                                }
                                trip_json["node_departure_times_seconds"] = json!(node_departure_times_seconds);
                            }
                            if trip.has_nodes_can_board()
                            {
                                let mut nodes_can_board : Vec<serde_json::Value> = Vec::with_capacity(trip.get_nodes_can_board()?.len() as usize);
                                for node_can_board in trip.get_nodes_can_board()?.iter() {
                                    nodes_can_board.push(json!(i8_to_json_boolean(node_can_board)));
                                }
                                trip_json["nodes_can_board"] = json!(nodes_can_board);
                            }
                            if trip.has_nodes_can_unboard()
                            {
                                let mut nodes_can_unboard : Vec<serde_json::Value> = Vec::with_capacity(trip.get_nodes_can_unboard()?.len() as usize);
                                for node_can_unboard in trip.get_nodes_can_unboard()?.iter() {
                                    nodes_can_unboard.push(json!(i8_to_json_boolean(node_can_unboard)));
                                }
                                trip_json["nodes_can_unboard"] = json!(nodes_can_unboard);
                            }

                            trips.push(trip_json);
                        }
                        period_json["trips"] = json!(trips);
                    }

                    periods.push(period_json);
                }
                schedule_json["periods"] = json!(periods);
            }

            schedules[schedule.get_service_uuid().unwrap()] = schedule_json;
        }
        
    }

    let object_json : serde_json::Value = json!({
        "id": capnp_object.get_uuid()?,
        "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?),
        "agency_id": capnp_object.get_agency_uuid()?,
        "shortname": capnp_object.get_shortname()?,
        "longname": empty_str_to_json_null(capnp_object.get_longname()?),
        "category": empty_str_to_json_null(capnp_object.get_category()?),
        "mode": capnp_object.get_mode()?,
        "color": empty_str_to_json_null(capnp_object.get_color()?),
        "description": empty_str_to_json_null(capnp_object.get_description()?),
        "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
        "is_enabled": i8_to_json_boolean(capnp_object.get_is_enabled()),
        "is_autonomous": i8_to_json_boolean(capnp_object.get_is_autonomous()),
        "allow_same_line_transfers": i8_to_json_boolean(capnp_object.get_allow_same_line_transfers()),
        "data": data_attributes,
        "scheduleByServiceId": schedules
    });

    let output_json = json!({
        "line": object_json
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
    fn line() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "line": {
                    "id": "bddc12af-6c9f-4048-a800-a79ee187401d",
                    "internal_id": "Demo",
                    "mode": "bus",
                    "category": "C",
                    "agency_id": "f4f2043b-11cb-42ab-8711-c8da071b27d5",
                    "shortname": "A",
                    "longname": "A",
                    "color": "#ff0000",
                    "is_enabled": true,
                    "description": null,
                    "data": {
                        "isNew": false,
                        "deadHeadTravelTimesBetweenPathsByPathId": {
                            "cb01fe06-e450-4e6d-991c-a6e843cf30db": {
                                "cb01fe06-e450-4e6d-991c-a6e843cf30db": 506,
                                "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b":0
                            },
                            "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b": {
                                "cb01fe06-e450-4e6d-991c-a6e843cf30db": 0,
                                "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b": 501
                            }
                        },
                        "_pathsChangeTimestamp": 1608137820125
                    },
                    "created_at": "2020-12-16T16:55:18.963Z",
                    "updated_at": "2020-12-16T17:01:40.545Z",
                    "is_autonomous": false,
                    "allow_same_line_transfers": false,
                    "is_frozen": null,
                    "path_ids": ["cb01fe06-e450-4e6d-991c-a6e843cf30db","e39e0b59-9af4-4cc0-ae7e-84f01e293f0b"],
                    "scheduleByServiceId": {
                        "a52a2402-9510-4c46-a0a9-f58930355c10": {
                            "id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                            "service_id": "a52a2402-9510-4c46-a0a9-f58930355c10",
                            "periods_group_shortname": "default",
                            "allow_seconds_based_schedules": false,
                            "is_frozen": null,
                            "periods": [
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "morning",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": "06:02:45",
                                    "custom_end_at_str": "15:00",
                                    "start_at_hour": 4,
                                    "end_at_hour": 6,
                                    "interval_seconds": null,
                                    "number_of_units": 2,
                                    "trips": [
                                        {
                                            "id": "6650ebc1-75c8-4ae6-abef-ce4dbc1c3a5f",
                                            "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                            "path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                            "departure_time_seconds": 14400,
                                            "arrival_time_seconds": 15272,
                                            "node_arrival_times_seconds": [null,14446,14517,14595,14650,14698,14798,14894,15005,15074,15193,15272],
                                            "node_departure_times_seconds": [14400,14466,14537,14615,14670,14718,14818,14914,15025,15094,15213,null],
                                            "nodes_can_board": [true,true,true,true,true,false,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,false,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity": 20
                                        },
                                        {
                                            "id": "dd1eec4b-4b88-4d75-82b0-2005707fc0bf",
                                            "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                            "path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                            "departure_time_seconds": 14413,
                                            "arrival_time_seconds": 15267,
                                            "node_arrival_times_seconds": [null,14471,14579,14661,14772,14854,14950,14997,15052,15142,15201,15267],
                                            "node_departure_times_seconds": [14413,14491,14599,14681,14792,14874,14970,15017,15072,15162,15221,null],
                                            "nodes_can_board": [true,true,true,true,true,true,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,true,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity": 20
                                        }
                                    ]
                                },
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee18bbbbb",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "am_peak",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id":"e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": "28:45",
                                    "start_at_hour": 6,
                                    "end_at_hour": 9.5,
                                    "interval_seconds": 900,
                                    "number_of_units": null,
                                    "trips": [
                                        {
                                            "id":"a1f5fbc9-f692-49f3-a00f-430e5075c25f",
                                            "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee18bbbbb",
                                            "path_id":"cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                            "departure_time_seconds": 21600,
                                            "arrival_time_seconds": 22472,
                                            "node_arrival_times_seconds": [null,21646,21717,21795,21850,21898,21998,22094,22205,22274,22393,22472],
                                            "node_departure_times_seconds": [21600,21666,21737,21815,21870,21918,22018,22114,22225,22294,22413,null],
                                            "nodes_can_board": [true,true,true,true,true,true,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,true,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity":20
                                        }
                                    ]
                                },
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee187cccc",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "night",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": null,
                                    "start_at_hour": 23,
                                    "end_at_hour": 28,
                                    "interval_seconds": null,
                                    "number_of_units": null,
                                    "trips": []
                                }
                            ],
                            "data": {
                                "isNew": false
                            }
                        }
                    }
                }
            }
        "##;

        let compare_data = r##"
            {
                "line": {
                    "id": "bddc12af-6c9f-4048-a800-a79ee187401d",
                    "internal_id": "Demo",
                    "mode": "bus",
                    "category": "C",
                    "agency_id": "f4f2043b-11cb-42ab-8711-c8da071b27d5",
                    "shortname": "A",
                    "longname": "A",
                    "color": "#ff0000",
                    "is_enabled": true,
                    "description": null,
                    "data": {
                        "isNew": false,
                        "deadHeadTravelTimesBetweenPathsByPathId": {
                            "cb01fe06-e450-4e6d-991c-a6e843cf30db": {
                                "cb01fe06-e450-4e6d-991c-a6e843cf30db": 506,
                                "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b":0
                            },
                            "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b": {
                                "cb01fe06-e450-4e6d-991c-a6e843cf30db": 0,
                                "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b": 501
                            }
                        },
                        "_pathsChangeTimestamp": 1608137820125
                    },
                    "is_autonomous": false,
                    "allow_same_line_transfers": false,
                    "is_frozen": null,
                    "scheduleByServiceId": {
                        "a52a2402-9510-4c46-a0a9-f58930355c10": {
                            "id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                            "line_id": "bddc12af-6c9f-4048-a800-a79ee187401d",
                            "service_id": "a52a2402-9510-4c46-a0a9-f58930355c10",
                            "periods_group_shortname": "default",
                            "allow_seconds_based_schedules": false,
                            "is_frozen": null,
                            "periods": [
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "morning",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": "06:02:45",
                                    "custom_end_at_str": "15:00",
                                    "start_at_hour": 4.0,
                                    "end_at_hour": 6.0,
                                    "interval_seconds": null,
                                    "number_of_units": 2,
                                    "is_frozen": null,
                                    "trips": [
                                        {
                                            "id": "6650ebc1-75c8-4ae6-abef-ce4dbc1c3a5f",
                                            "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                            "path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                            "departure_time_seconds": 14400,
                                            "arrival_time_seconds": 15272,
                                            "node_arrival_times_seconds": [null,14446,14517,14595,14650,14698,14798,14894,15005,15074,15193,15272],
                                            "node_departure_times_seconds": [14400,14466,14537,14615,14670,14718,14818,14914,15025,15094,15213,null],
                                            "nodes_can_board": [true,true,true,true,true,false,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,false,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity": 20,
                                            "is_frozen": null
                                        },
                                        {
                                            "id": "dd1eec4b-4b88-4d75-82b0-2005707fc0bf",
                                            "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee187aaaa",
                                            "path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                            "departure_time_seconds": 14413,
                                            "arrival_time_seconds": 15267,
                                            "node_arrival_times_seconds": [null,14471,14579,14661,14772,14854,14950,14997,15052,15142,15201,15267],
                                            "node_departure_times_seconds": [14413,14491,14599,14681,14792,14874,14970,15017,15072,15162,15221,null],
                                            "nodes_can_board": [true,true,true,true,true,true,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,true,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity": 20,
                                            "is_frozen": null
                                        }
                                    ]
                                },
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee18bbbbb",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "am_peak",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id":"e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": "28:45",
                                    "custom_end_at_str": null,
                                    "start_at_hour": 6.0,
                                    "end_at_hour": 9.5,
                                    "interval_seconds": 900,
                                    "number_of_units": null,
                                    "is_frozen": null,
                                    "trips": [
                                        {
                                            "id":"a1f5fbc9-f692-49f3-a00f-430e5075c25f",
                                            "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                            "schedule_period_id": "bddc12af-6c9f-4048-a800-a79ee18bbbbb",
                                            "path_id":"cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                            "departure_time_seconds": 21600,
                                            "arrival_time_seconds": 22472,
                                            "node_arrival_times_seconds": [null,21646,21717,21795,21850,21898,21998,22094,22205,22274,22393,22472],
                                            "node_departure_times_seconds": [21600,21666,21737,21815,21870,21918,22018,22114,22225,22294,22413,null],
                                            "nodes_can_board": [true,true,true,true,true,true,true,true,true,true,true,false],
                                            "nodes_can_unboard": [false,true,true,true,true,true,true,true,true,true,true,true],
                                            "block_id": null,
                                            "total_capacity": 50,
                                            "seated_capacity":20,
                                            "is_frozen": null
                                        }
                                    ]
                                },
                                {
                                    "id": "bddc12af-6c9f-4048-a800-a79ee187cccc",
                                    "schedule_id": "d36f377c-6691-4f70-8c0f-3f35d6958314",
                                    "period_shortname": "night",
                                    "outbound_path_id": "cb01fe06-e450-4e6d-991c-a6e843cf30db",
                                    "inbound_path_id": "e39e0b59-9af4-4cc0-ae7e-84f01e293f0b",
                                    "custom_start_at_str": null,
                                    "custom_end_at_str": null,
                                    "start_at_hour": 23.0,
                                    "end_at_hour": 28.0,
                                    "interval_seconds": null,
                                    "number_of_units": null,
                                    "trips": [],
                                    "is_frozen": null
                                }
                            ]
                        }
                    }
                }
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/line",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_object_route(
            "line",
            "lines",
            &config,
            &routers::line_router::write_object,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_object_route(
            "line",
            &String::from("bddc12af-6c9f-4048-a800-a79ee187401d"),
            "lines",
            &config,
            &routers::line_router::read_object,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["line"], json_compare_data["line"]);

        // Test non-existing line
        let response = routers::read_object_route(
            "line",
            &String::from("bddc12af-6c9f-4048-a800-aaaaaaaaaaaa"),
            "lines",
            &config,
            &routers::line_router::read_object,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        // TODO Return code should be 404 Not found
        assert_eq!(response.status_code, 200);
        assert!(json_response["data"].is_null());

    }
}
