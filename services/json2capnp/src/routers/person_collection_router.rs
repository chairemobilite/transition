/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::personCollection_capnp::person_collection as collection;
//use crate::my_error::MyError;
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
    _: &serde_json::Value,
) -> ::std::result::Result<(), capnp::Error> {
    let mut message = ::capnp::message::Builder::new_default();

    let json_objects = &json["persons"];

    let count: usize = json_objects.as_array().unwrap().len();
    let collection_capnp = message.init_root::<collection::Builder>();
    let mut capnp = collection_capnp.init_persons(count as u32);

    for i in 0..count {
        let mut json_data  = json_objects[i].clone();
        
        let mut capnp_data = capnp.reborrow().get(i as u32);

        if !json_data.get("usual_work_place_geography").unwrap_or(&json!(null)).is_null()
        {
            let usual_work_place_geometry = geojson::Geometry::from_json_value(json_data["usual_work_place_geography"].clone());
            let usual_work_place_geojson_value = usual_work_place_geometry.unwrap().value;
            let usual_work_place_latitude;
            let usual_work_place_longitude;
            match usual_work_place_geojson_value {
                GeojsonValue::Point(point) => {
                    usual_work_place_longitude = (point[0] * 1000000.0).round() as i32;
                    usual_work_place_latitude  = (point[1] * 1000000.0).round() as i32;
                },
                _ => {
                    usual_work_place_longitude = -1;
                    usual_work_place_latitude  = -1;
                }
            }
            capnp_data.set_usual_work_place_latitude(usual_work_place_latitude);
            capnp_data.set_usual_work_place_longitude(usual_work_place_longitude);
        }
        else
        {
            capnp_data.set_usual_work_place_latitude(-1);
            capnp_data.set_usual_work_place_longitude(-1);
        }

        if !json_data.get("usual_school_place_geography").unwrap_or(&json!(null)).is_null()
        {
            let usual_school_place_geometry = geojson::Geometry::from_json_value(json_data["usual_school_place_geography"].clone());
            let usual_school_place_geojson_value = usual_school_place_geometry.unwrap().value;
            let usual_school_place_latitude;
            let usual_school_place_longitude;
            match usual_school_place_geojson_value {
                GeojsonValue::Point(point) => {
                    usual_school_place_longitude = (point[0] * 1000000.0).round() as i32;
                    usual_school_place_latitude  = (point[1] * 1000000.0).round() as i32;
                },
                _ => {
                    usual_school_place_longitude = -1;
                    usual_school_place_latitude  = -1;
                }
            }
            capnp_data.set_usual_school_place_latitude(usual_school_place_latitude);
            capnp_data.set_usual_school_place_longitude(usual_school_place_longitude);
        }
        else
        {
            capnp_data.set_usual_school_place_latitude(-1);
            capnp_data.set_usual_school_place_longitude(-1);
        }
        
        capnp_data.set_uuid(&required_string(json_data.get("id")));
        capnp_data.set_household_uuid(&optional_string(json_data.get("household_id")));
        capnp_data.set_data_source_uuid(&optional_string(json_data.get("data_source_id")));
        capnp_data.set_id(json_data.get("integer_id").unwrap().as_u64().unwrap() as u32); // required
        capnp_data.set_internal_id(&optional_string(json_data.get("internal_id")));
        capnp_data.set_data(&json_data.get("data").unwrap_or(&json!({})).to_string().as_str());
        capnp_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
        capnp_data.set_expansion_factor(json_value_or_null_to_f64_or_minus_one(&json_data.get("expansion_factor").unwrap_or(&json!(null))) as f32);
        capnp_data.set_age(json_value_or_null_to_i64_or_minus_one(&json_data.get("age").unwrap_or(&json!(null))) as i16);
        capnp_data.set_driving_license_owner(json_boolean_to_i8(json_data.get("driving_license_owner").unwrap_or(&json!(null))));
        capnp_data.set_transit_pass_owner(json_boolean_to_i8(json_data.get("transit_pass_owner").unwrap_or(&json!(null))));
        capnp_data.set_occupation(crate::enum_mappings::occupation(&json_data["occupation"].as_str().unwrap_or("none")));
        capnp_data.set_gender(crate::enum_mappings::gender(&json_data["gender"].as_str().unwrap_or("none")));
        capnp_data.set_age_group(crate::enum_mappings::age_group(&json_data["age_group"].as_str().unwrap_or("none")));

        capnp_data.set_usual_work_place_walking_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("usual_work_place_walking_travel_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_usual_work_place_cycling_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("usual_work_place_cycling_travel_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_usual_work_place_driving_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("usual_work_place_driving_travel_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_usual_school_place_walking_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("usual_school_place_walking_travel_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_usual_school_place_cycling_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("usual_school_place_cycling_travel_time_seconds").unwrap_or(&json!(null))) as i32);
        capnp_data.set_usual_school_place_driving_travel_time_seconds(json_value_or_null_to_i64_or_minus_one(&json_data.get("usual_school_place_driving_travel_time_seconds").unwrap_or(&json!(null))) as i32);

        if json_data.get("data") != None && json_data["data"].is_object() && json_data["data"].get("usualWorkPlaceNodes") != None && json_data["data"]["usualWorkPlaceNodes"].is_array()
        {
            let nodes_count = json_data["data"]["usualWorkPlaceNodes"].as_array().unwrap().len();
            capnp_data.reborrow().init_usual_work_place_nodes_uuids(nodes_count as u32);
            capnp_data.reborrow().init_usual_work_place_nodes_travel_times(nodes_count as u32);
            capnp_data.reborrow().init_usual_work_place_nodes_distances(nodes_count as u32);
            for j in 0..nodes_count
            {
                capnp_data.reborrow().get_usual_work_place_nodes_uuids().unwrap().set(j as u32, json_data["data"]["usualWorkPlaceNodes"][j].as_str().unwrap());
                capnp_data.reborrow().get_usual_work_place_nodes_travel_times().unwrap().set(j as u32, json_data["data"]["usualWorkPlaceNodesTravelTimes"][j].as_i64().unwrap() as i16);
                capnp_data.reborrow().get_usual_work_place_nodes_distances().unwrap().set(j as u32, json_data["data"]["usualWorkPlaceNodesDistances"][j].as_i64().unwrap() as i16);
            }

            // remove usualWorkPlaceNodes and associates:
            json_data["data"]["usualWorkPlaceNodes"].take();
            json_data["data"]["usualWorkPlaceNodesTravelTimes"].take();
            json_data["data"]["usualWorkPlaceNodesDistances"].take();
        }

        if json_data.get("data") != None && json_data["data"].is_object() && json_data["data"].get("usualSchoolPlaceNodes") != None && json_data["data"]["usualSchoolPlaceNodes"].is_array()
        {
            let nodes_count = json_data["data"]["usualSchoolPlaceNodes"].as_array().unwrap().len();
            capnp_data.reborrow().init_usual_school_place_nodes_uuids(nodes_count as u32);
            capnp_data.reborrow().init_usual_school_place_nodes_travel_times(nodes_count as u32);
            capnp_data.reborrow().init_usual_school_place_nodes_distances(nodes_count as u32);
            for j in 0..nodes_count
            {
                capnp_data.reborrow().get_usual_school_place_nodes_uuids().unwrap().set(j as u32, json_data["data"]["usualSchoolPlaceNodes"][j].as_str().unwrap());
                capnp_data.reborrow().get_usual_school_place_nodes_travel_times().unwrap().set(j as u32, json_data["data"]["usualSchoolPlaceNodesTravelTimes"][j].as_i64().unwrap() as i16);
                capnp_data.reborrow().get_usual_school_place_nodes_distances().unwrap().set(j as u32, json_data["data"]["usualSchoolPlaceNodesDistances"][j].as_i64().unwrap() as i16);
            }

            // remove usualSchoolPlaceNodes and associates:
            json_data["data"]["usualSchoolPlaceNodes"].take();
            json_data["data"]["usualSchoolPlaceNodesTravelTimes"].take();
            json_data["data"]["usualSchoolPlaceNodesDistances"].take();
        }

    }

    serialize_packed::write_message(file, &message)
}


pub fn read_collection(
    file: &mut std::fs::File,
    _ : &serde_json::Value//config: &serde_json::Value,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_persons()?.len() as usize);

    for capnp_object in capnp_collection.get_persons()?.iter() {
        
        let mut data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();

        if capnp_object.has_usual_work_place_nodes_uuids()
        {
            let mut usual_work_place_nodes_uuids : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_usual_work_place_nodes_uuids()?.len() as usize);
            for usual_work_place_node_uuid in capnp_object.get_usual_work_place_nodes_uuids()?.iter() {
                usual_work_place_nodes_uuids.push(json!(usual_work_place_node_uuid.unwrap()));
            }
            data_attributes["usualWorkPlaceNodes"] = json!(usual_work_place_nodes_uuids);

            let mut usual_work_place_nodes_travel_times : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_usual_work_place_nodes_travel_times()?.len() as usize);
            for usual_work_place_node_travel_time in capnp_object.get_usual_work_place_nodes_travel_times()?.iter() {
                usual_work_place_nodes_travel_times.push(json!(usual_work_place_node_travel_time));
            }
            data_attributes["usualWorkPlaceNodesTravelTimes"] = json!(usual_work_place_nodes_travel_times);

            let mut usual_work_place_nodes_distances : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_usual_work_place_nodes_distances()?.len() as usize);
            for usual_work_place_node_distance in capnp_object.get_usual_work_place_nodes_distances()?.iter() {
                usual_work_place_nodes_distances.push(json!(usual_work_place_node_distance));
            }
            data_attributes["usualWorkPlaceNodesDistances"] = json!(usual_work_place_nodes_distances);
        }

        if capnp_object.has_usual_school_place_nodes_uuids()
        {
            let mut usual_school_place_nodes_uuids : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_usual_school_place_nodes_uuids()?.len() as usize);
            for usual_school_place_node_uuid in capnp_object.get_usual_school_place_nodes_uuids()?.iter() {
                usual_school_place_nodes_uuids.push(json!(usual_school_place_node_uuid.unwrap()));
            }
            data_attributes["usualSchoolPlaceNodes"] = json!(usual_school_place_nodes_uuids);

            let mut usual_school_place_nodes_travel_times : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_usual_school_place_nodes_travel_times()?.len() as usize);
            for usual_school_place_node_travel_time in capnp_object.get_usual_school_place_nodes_travel_times()?.iter() {
                usual_school_place_nodes_travel_times.push(json!(usual_school_place_node_travel_time));
            }
            data_attributes["usualSchoolPlaceNodesTravelTimes"] = json!(usual_school_place_nodes_travel_times);

            let mut usual_school_place_nodes_distances : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_usual_school_place_nodes_distances()?.len() as usize);
            for usual_school_place_node_distance in capnp_object.get_usual_school_place_nodes_distances()?.iter() {
                usual_school_place_nodes_distances.push(json!(usual_school_place_node_distance));
            }
            data_attributes["usualSchoolPlaceNodesDistances"] = json!(usual_school_place_nodes_distances);
        }

        let mut object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?,
            "integer_id": capnp_object.get_id(),
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?),
            "household_id": empty_str_to_json_null(capnp_object.get_household_uuid()?),
            "data_source_id": empty_str_to_json_null(capnp_object.get_data_source_uuid()?),
            "occupation": crate::enum_mappings::occupation_to_str(&capnp_object.get_occupation()?),
            "gender": crate::enum_mappings::gender_to_str(&capnp_object.get_gender()?),
            "age_group": crate::enum_mappings::age_group_to_str(&capnp_object.get_age_group()?),
            "expansion_factor": minus_one_f64_to_null(((capnp_object.get_expansion_factor() as f64)*100000.0).round() / 100000.0), // we must round to 5 decimals so we don't get numbers like 2.10000000345454 for n input value of 2.1
            "age": minus_one_i64_to_null(capnp_object.get_age() as i64),
            "driving_license_owner": i8_to_json_boolean(capnp_object.get_driving_license_owner()),
            "transit_pass_owner": i8_to_json_boolean(capnp_object.get_transit_pass_owner()),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "usual_work_place_walking_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_usual_work_place_walking_travel_time_seconds() as i64),
            "usual_work_place_cycling_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_usual_work_place_cycling_travel_time_seconds() as i64),
            "usual_work_place_driving_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_usual_work_place_driving_travel_time_seconds() as i64),
            "usual_school_place_walking_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_usual_school_place_walking_travel_time_seconds() as i64),
            "usual_school_place_cycling_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_usual_school_place_cycling_travel_time_seconds() as i64),
            "usual_school_place_driving_travel_time_seconds": minus_one_i64_to_null(capnp_object.get_usual_school_place_driving_travel_time_seconds() as i64),
            "data": data_attributes
        });

        if capnp_object.get_usual_work_place_latitude() != -1
        {
            let usual_work_place_latitude  = (capnp_object.get_usual_work_place_latitude() as f64)/1000000.0;
            let usual_work_place_longitude = (capnp_object.get_usual_work_place_longitude() as f64)/1000000.0;
            object_json["usual_work_place_geography"] = json!({
                "type": "Point",
                "coordinates": [usual_work_place_longitude, usual_work_place_latitude]
            });
        }
        else
        {
            object_json["usual_work_place_geography"] = json!(null);
        }
        if capnp_object.get_usual_school_place_latitude() != -1
        {
            let usual_school_place_latitude  = (capnp_object.get_usual_school_place_latitude() as f64)/1000000.0;
            let usual_school_place_longitude = (capnp_object.get_usual_school_place_longitude() as f64)/1000000.0;
            object_json["usual_school_place_geography"] = json!({
                "type": "Point",
                "coordinates": [usual_school_place_longitude, usual_school_place_latitude]
            });
        }
        else
        {
            object_json["usual_school_place_geography"] = json!(null);
        }

        collection_json_vec.push(object_json);

    }

    let collection_json = json!({
        "persons": serde_json::Value::Array(collection_json_vec)
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
    fn person_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test",
            "data_source_uuid"            : "1234-5678"
        });

        let data = r##"
            {
                "data_source_uuid": "1234-5678",
                "persons": [
                    {
                        "id": "1234-1234",
                        "integer_id": 123,
                        "is_frozen": true,
                        "internal_id": "h21",
                        "data_source_id": "4567-8910",
                        "household_id": "8910-4567",
                        "driving_license_owner": true,
                        "transit_pass_owner": true,
                        "age": 28,
                        "age_group": "ag2529",
                        "gender": "female",
                        "occupation": "fullTimeStudent",
                        "expansion_factor": 32.787,
                        "usual_work_place_geography": {
                            "type": "Point",
                            "coordinates": [-73.45, 45.47]
                        },
                        "usual_school_place_geography": {
                            "type": "Point",
                            "coordinates": [-73.100115, 45.102445]
                        },
                        "data": {
                            "foo": "bar",
                            "usualWorkPlaceNodes": ["abc", "def", "ghi"],
                            "usualWorkPlaceNodesTravelTimes": [234, 567, 8910],
                            "usualWorkPlaceNodesDistances": [1243, 3453, 9455],
                            "usualSchoolPlaceNodes": ["abcd", "defg", "ghil"],
                            "usualSchoolPlaceNodesTravelTimes": [891, 781, 681],
                            "usualSchoolPlaceNodesDistances": [466, 566, 666]
                        },
                        "usual_work_place_walking_travel_time_seconds": 212,
                        "usual_work_place_cycling_travel_time_seconds": 313,
                        "usual_work_place_driving_travel_time_seconds": 414,
                        "usual_school_place_walking_travel_time_seconds": 515,
                        "usual_school_place_cycling_travel_time_seconds": 616,
                        "usual_school_place_driving_travel_time_seconds": 717
                    },
                    {
                        "integer_id": 124,
                        "id": "2345-2345",
                        "is_frozen": null
                    }
                ]
            }
            "##;

            let compare_data = r##"
            {
                "persons": [
                    {
                        "id": "1234-1234",
                        "integer_id": 123,
                        "is_frozen": true,
                        "internal_id": "h21",
                        "data_source_id": "4567-8910",
                        "household_id": "8910-4567",
                        "driving_license_owner": true,
                        "transit_pass_owner": true,
                        "age": 28,
                        "age_group": "ag2529",
                        "gender": "female",
                        "occupation": "fullTimeStudent",
                        "expansion_factor": 32.787,
                        "usual_work_place_geography": {
                            "type": "Point",
                            "coordinates": [-73.45, 45.47]
                        },
                        "usual_school_place_geography": {
                            "type": "Point",
                            "coordinates": [-73.100115, 45.102445]
                        },
                        "data": {
                            "foo": "bar",
                            "usualWorkPlaceNodes": ["abc", "def", "ghi"],
                            "usualWorkPlaceNodesTravelTimes": [234, 567, 8910],
                            "usualWorkPlaceNodesDistances": [1243, 3453, 9455],
                            "usualSchoolPlaceNodes": ["abcd", "defg", "ghil"],
                            "usualSchoolPlaceNodesTravelTimes": [891, 781, 681],
                            "usualSchoolPlaceNodesDistances": [466, 566, 666]
                        },
                        "usual_work_place_walking_travel_time_seconds": 212,
                        "usual_work_place_cycling_travel_time_seconds": 313,
                        "usual_work_place_driving_travel_time_seconds": 414,
                        "usual_school_place_walking_travel_time_seconds": 515,
                        "usual_school_place_cycling_travel_time_seconds": 616,
                        "usual_school_place_driving_travel_time_seconds": 717
                    },
                    {
                        "id": "2345-2345",
                        "is_frozen": null,
                        "internal_id": null,
                        "integer_id": 124,
                        "data_source_id": null,
                        "data": {},
                        "household_id": null,
                        "age": null,
                        "driving_license_owner": null,
                        "transit_pass_owner": null,
                        "gender": "none",
                        "occupation": "none",
                        "age_group": "none",
                        "expansion_factor": null,
                        "usual_work_place_geography": null,
                        "usual_school_place_geography": null,
                        "usual_work_place_walking_travel_time_seconds": null,
                        "usual_work_place_cycling_travel_time_seconds": null,
                        "usual_work_place_driving_travel_time_seconds": null,
                        "usual_school_place_walking_travel_time_seconds": null,
                        "usual_school_place_cycling_travel_time_seconds": null,
                        "usual_school_place_driving_travel_time_seconds": null
                    }
                ]
            }
            "##;

        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/persons",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "persons",
            "persons",
            &config,
            &routers::person_collection_router::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "persons",
            "persons",
            &config,
            &routers::person_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["persons"], json_compare_data["persons"]);

    }
}




