/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::nodeCollection_capnp::node_collection as collection;
use capnp::serialize_packed;
use serde_json;
use std::io::BufReader;
use geojson::GeoJson;
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

pub fn write_collection(
    json: &serde_json::Value,
    file: &mut std::fs::File,
) -> ::std::result::Result<(), capnp::Error> {
    let mut message = ::capnp::message::Builder::new_default();
    
    let geojson_data : GeoJson = GeoJson::from_json_value((json["nodes"]).clone()).unwrap();

    match geojson_data {
        geojson::GeoJson::FeatureCollection(feature_collection) => {

            let features_count = feature_collection.features.len();
            let collection_capnp = message.init_root::<collection::Builder>();
            let mut capnp = collection_capnp.init_nodes(features_count as u32);
            for i in 0..features_count {
                let feature        = &feature_collection.features[i];
                let mut capnp_data = capnp.reborrow().get(i as u32);
                let mut properties = feature.properties.clone().unwrap();

                let geojson_value = feature.geometry.to_owned().unwrap().value;
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

                capnp_data.set_uuid(&required_string(properties.get("id"))); // required
                capnp_data.set_id(properties.get("integer_id").unwrap().as_u64().unwrap() as u32); // required
                capnp_data.set_station_uuid(optional_string(properties.get("station_id")));
                capnp_data.set_internal_id(optional_string(properties.get("internal_id")));
                capnp_data.set_code(optional_string(properties.get("code")));
                capnp_data.set_name(optional_string(properties.get("name")));
                capnp_data.set_color(optional_string(properties.get("color")));
                capnp_data.set_description(optional_string(properties.get("description")));
                capnp_data.set_routing_radius_meters(json_value_or_null_to_i64_or_minus_one(&properties.get("routing_radius_meters").unwrap_or(&json!(null))) as i16);
                capnp_data.set_default_dwell_time_seconds(json_value_or_null_to_i64_or_minus_one(&properties.get("default_dwell_time_seconds").unwrap_or(&json!(null))) as i16);

                if properties.get("data") != None && properties["data"].is_object() && properties["data"].get("transferableNodes") != None && properties["data"]["transferableNodes"].is_object() // remove transferable nodes data from collection
                {
                    properties["data"]["transferableNodes"].take();
                }

                capnp_data.set_data(&properties.get("data").unwrap_or(&json!({})).to_string().as_str());
                capnp_data.set_is_frozen(json_boolean_to_i8(&properties.get("is_frozen").unwrap_or(&json!(null))));
                capnp_data.set_is_enabled(json_boolean_to_i8(&properties.get("is_enabled").unwrap_or(&json!(null))));
                capnp_data.set_latitude(latitude);
                capnp_data.set_longitude(longitude);

            }
            serialize_packed::write_message(file, &message)
        },
        _ => {
            Err(capnp::Error::failed(String::from("Nodes geojson is invalid, empty or not a FeatureCollection")))
        }
    }

}


pub fn read_collection(
    file: &mut std::fs::File,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_nodes()?.len() as usize);

    for capnp_object in capnp_collection.get_nodes()?.iter() {
        
        let integer_id = capnp_object.get_id() as u32;
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?.to_str()?).unwrap();
        let latitude  = (capnp_object.get_latitude() as f64)/1000000.0;
        let longitude = (capnp_object.get_longitude() as f64)/1000000.0;
        let properties_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?.to_str()?,
            "integer_id": integer_id,
            "station_id": empty_str_to_json_null(capnp_object.get_station_uuid()?.to_str()?),
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?.to_str()?),
            "code": empty_str_to_json_null(capnp_object.get_code()?.to_str()?),
            "name": empty_str_to_json_null(capnp_object.get_name()?.to_str()?),
            "color": empty_str_to_json_null(capnp_object.get_color()?.to_str()?),
            "description": empty_str_to_json_null(capnp_object.get_description()?.to_str()?),
            "routing_radius_meters": minus_one_i64_to_null(capnp_object.get_routing_radius_meters() as i64),
            "default_dwell_time_seconds": minus_one_i64_to_null(capnp_object.get_default_dwell_time_seconds() as i64),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "is_enabled": i8_to_json_boolean(capnp_object.get_is_enabled()),
            "data": data_attributes
        });

        let mut geojson = json!({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [longitude, latitude]
            }
        });

        geojson["id"]         = json!(integer_id);
        geojson["properties"] = properties_json;

        collection_json_vec.push(geojson);

    }

    Ok(json!({
        "nodes": {
            "type": "FeatureCollection",
            "features": serde_json::Value::Array(collection_json_vec)
        }
    }))

}

