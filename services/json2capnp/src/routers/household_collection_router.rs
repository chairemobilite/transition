/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::householdCollection_capnp::household_collection as collection;
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

    let json_objects = &json["households"];

    let count: usize = json_objects.as_array().unwrap().len();
    let collection_capnp = message.init_root::<collection::Builder>();
    let mut capnp = collection_capnp.init_households(count as u32);

    for i in 0..count {
        let mut json_data = json_objects[i].clone();

        let geometry = geojson::Geometry::from_json_value(json_data["home_geography"].clone());
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

        let mut capnp_data = capnp.reborrow().get(i as u32);
        capnp_data.set_uuid(&required_string(json_data.get("id")));
        capnp_data.set_id(json_data.get("integer_id").unwrap().as_u64().unwrap() as u32); // required
        capnp_data.set_data_source_uuid(&optional_string(json_data.get("data_source_id")));
        capnp_data.set_size(json_value_or_null_to_i64_or_minus_one(&json_data.get("size").unwrap_or(&json!(null))) as i8);
        capnp_data.set_internal_id(&optional_string(json_data.get("internal_id")));
        capnp_data.set_data(&json_data.get("data").unwrap_or(&json!({})).to_string().as_str());
        capnp_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));

        capnp_data.set_income_level_group(crate::enum_mappings::household_income_level_group(&json_data["income_level_group"].as_str().unwrap_or("none")));
        capnp_data.set_category(crate::enum_mappings::household_category(&json_data["category"].as_str().unwrap_or("none")));
        capnp_data.set_income_level(json_value_or_null_to_i64_or_minus_one(&json_data.get("income_level").unwrap_or(&json!(null))) as i32);
        capnp_data.set_car_number(json_value_or_null_to_i64_or_minus_one(&json_data.get("car_number").unwrap_or(&json!(null))) as i8);
        capnp_data.set_expansion_factor(json_value_or_null_to_f64_or_minus_one(&json_data.get("expansion_factor").unwrap_or(&json!(null))) as f32);
        capnp_data.set_home_latitude(latitude);
        capnp_data.set_home_longitude(longitude);

        if json_data.get("data") != None && json_data["data"].is_object() && json_data["data"].get("homeNodes") != None && json_data["data"]["homeNodes"].is_array()
        {
            let nodes_count = json_data["data"]["homeNodes"].as_array().unwrap().len();
            capnp_data.reborrow().init_home_nodes_uuids(nodes_count as u32);
            capnp_data.reborrow().init_home_nodes_travel_times(nodes_count as u32);
            capnp_data.reborrow().init_home_nodes_distances(nodes_count as u32);
            for j in 0..nodes_count
            {
                capnp_data.reborrow().get_home_nodes_uuids().unwrap().set(j as u32, json_data["data"]["homeNodes"][j].as_str().unwrap());
                capnp_data.reborrow().get_home_nodes_travel_times().unwrap().set(j as u32, json_data["data"]["homeNodesTravelTimes"][j].as_i64().unwrap() as i16);
                capnp_data.reborrow().get_home_nodes_distances().unwrap().set(j as u32, json_data["data"]["homeNodesDistances"][j].as_i64().unwrap() as i16);
            }

             // remove homeNodes and associates:
            json_data["data"]["homeNodes"].take();
            json_data["data"]["homeNodesTravelTimes"].take();
            json_data["data"]["homeNodesDistances"].take();
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
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_households()?.len() as usize);

    for capnp_object in capnp_collection.get_households()?.iter() {
        
        let mut data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
        let latitude  = (capnp_object.get_home_latitude() as f64)/1000000.0;
        let longitude = (capnp_object.get_home_longitude() as f64)/1000000.0;

        if capnp_object.has_home_nodes_uuids()
        {
            let mut home_nodes_uuids : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_home_nodes_uuids()?.len() as usize);
            for home_node_uuid in capnp_object.get_home_nodes_uuids()?.iter() {
                home_nodes_uuids.push(json!(home_node_uuid.unwrap()));
            }
            data_attributes["homeNodes"] = json!(home_nodes_uuids);

            let mut home_nodes_travel_times : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_home_nodes_travel_times()?.len() as usize);
            for home_node_travel_time in capnp_object.get_home_nodes_travel_times()?.iter() {
                home_nodes_travel_times.push(json!(home_node_travel_time));
            }
            data_attributes["homeNodesTravelTimes"] = json!(home_nodes_travel_times);

            let mut home_nodes_distances : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_home_nodes_distances()?.len() as usize);
            for home_node_distance in capnp_object.get_home_nodes_distances()?.iter() {
                home_nodes_distances.push(json!(home_node_distance));
            }
            data_attributes["homeNodesDistances"] = json!(home_nodes_distances);
        }

        let object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?,
            "integer_id": capnp_object.get_id(),
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?),
            "data_source_id": empty_str_to_json_null(capnp_object.get_data_source_uuid()?),
            "size": minus_one_i64_to_null(capnp_object.get_size() as i64),
            "income_level_group": crate::enum_mappings::household_income_level_group_to_str(&capnp_object.get_income_level_group()?),
            "category": crate::enum_mappings::household_category_to_str(&capnp_object.get_category()?),
            "income_level": minus_one_i64_to_null(capnp_object.get_income_level() as i64),
            "car_number": minus_one_i64_to_null(capnp_object.get_car_number() as i64),
            "expansion_factor": minus_one_f64_to_null(((capnp_object.get_expansion_factor() as f64)*100000.0).round() / 100000.0), // we must round to 5 decimals so we don't get numbers like 2.10000000345454 for n input value of 2.1
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "data": data_attributes,
            "home_geography": {
                "type": "Point",
                "coordinates": [longitude, latitude]
            }
        });

        collection_json_vec.push(object_json);

    }

    let collection_json = json!({
        "households": serde_json::Value::Array(collection_json_vec)
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
    fn household_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test",
            "data_source_uuid"            : "4567-8910"
        });

        let data = r##"
            {
                "data_source_uuid": "4567-8910",
                "households": [
                    {
                        "id": "1234-1234",
                        "is_frozen": true,
                        "integer_id": 1234,
                        "internal_id": "h21",
                        "data_source_id": "4567-8910",
                        "size": 4,
                        "income_level_group": "veryLow",
                        "category": "monoparentalFamily",
                        "income_level": 235000,
                        "car_number": 2,
                        "expansion_factor": 23.3,
                        "home_geography": {
                            "type": "Point",
                            "coordinates": [-73.45, 45.47]
                        },
                        "data": {
                            "foo": "bar",
                            "homeNodes": ["abc", "def", "efg"],
                            "homeNodesTravelTimes": [234, 567, 8910],
                            "homeNodesDistances": [1243, 3453, 9455]
                        }
                    },
                    {
                        "id": "2345-2345",
                        "integer_id": 5678,
                        "is_frozen": null,
                        "home_geography": {
                            "type": "Point",
                            "coordinates": [-73.20, 45.20]
                        }
                    },
                    {
                        "type": null,
                        "integer_id": 9101112,
                        "id": "2345-2345",
                        "is_frozen": false,
                        "home_geography": {
                            "type": "Point",
                            "coordinates": [-73.75, 45.78]
                        },
                        "data": {}
                    }
                ]
            }
            "##;

            let compare_data = r##"
            {
                "data_source_uuid": "4567-8910",
                "households": [
                    {
                        "id": "1234-1234",
                        "integer_id": 1234,
                        "is_frozen": true,
                        "internal_id": "h21",
                        "data_source_id": "4567-8910",
                        "size": 4,
                        "income_level_group": "veryLow",
                        "category": "monoparentalFamily",
                        "income_level": 235000,
                        "car_number": 2,
                        "expansion_factor": 23.3,
                        "home_geography": {
                            "type": "Point",
                            "coordinates": [-73.45, 45.47]
                        },
                        "data": {
                            "foo": "bar",
                            "homeNodes": ["abc", "def", "efg"],
                            "homeNodesTravelTimes": [234, 567, 8910],
                            "homeNodesDistances": [1243, 3453, 9455]
                        }
                    },
                    {
                        "id": "2345-2345",
                        "integer_id": 5678,
                        "is_frozen": null,
                        "internal_id": null,
                        "data_source_id": null,
                        "size": null,
                        "income_level_group": "none",
                        "category": "none",
                        "income_level": null,
                        "car_number": null,
                        "expansion_factor": null,
                        "data": {},
                        "home_geography": {
                            "type": "Point",
                            "coordinates": [-73.20, 45.20]
                        }
                    },
                    {
                        "id": "2345-2345",
                        "integer_id": 9101112,
                        "is_frozen": false,
                        "internal_id": null,
                        "data_source_id": null,
                        "size": null,
                        "income_level_group": "none",
                        "category": "none",
                        "income_level": null,
                        "car_number": null,
                        "expansion_factor": null,
                        "home_geography": {
                            "type": "Point",
                            "coordinates": [-73.75, 45.78]
                        },
                        "data": {}
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();
        
        let request = Request::fake_http(
            "POST",
            "/households",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "households",
            "households",
            &config,
            &routers::household_collection_router::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "households",
            "households",
            &config,
            &routers::household_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["households"], json_compare_data["households"]);

    }
}