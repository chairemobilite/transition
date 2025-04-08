/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::nodeCollection_capnp::node_collection as collection;
//use crate::my_error::MyError;
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
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
        let latitude  = (capnp_object.get_latitude() as f64)/1000000.0;
        let longitude = (capnp_object.get_longitude() as f64)/1000000.0;
        let properties_json : serde_json::Value = json!({
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


#[cfg(test)]
mod tests {

    use crate::routers;
    use std::path::{Path};
    use std::fs;
    use rouille::Request;
    use pretty_assertions::{assert_eq};

    #[test]
    fn node_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "nodes": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-72.963302,45.639486]
                            },
                            "id": 456,
                            "properties": {
                                "id": "915923f9-a768-49e5-81b6-8237d60a6125",
                                "data": {
                                    "foo": "bar"
                                },
                                "station_id": "715923f9-a768-49e5-81b6-8237d60a6125",
                                "code": "034A",
                                "name": "NodeName",
                                "color": "#1A2F3D",
                                "is_frozen": false,
                                "created_at": "2020-01-01T15:15:15.054321-04:00",
                                "integer_id": 456,
                                "is_enabled": true,
                                "updated_at": null,
                                "description": "description for node",
                                "internal_id": "N98765",
                                "routing_radius_meters": 212,
                                "default_dwell_time_seconds": 18
                            }
                        }
                    ]
                }
            }
        "##;

        let compare_data = r##"
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": { 
                            "type": "Point",
                            "coordinates": [-72.963302,45.639486]
                        },
                        "id": 456,
                        "properties": {
                            "id": "915923f9-a768-49e5-81b6-8237d60a6125",
                            "data": {
                                "foo": "bar"
                            },
                            "station_id": "715923f9-a768-49e5-81b6-8237d60a6125",
                            "code": "034A",
                            "name": "NodeName",
                            "color": "#1A2F3D",
                            "is_frozen": false,
                            "integer_id": 456,
                            "is_enabled": true,
                            "description": "description for node",
                            "internal_id": "N98765",
                            "routing_radius_meters": 212,
                            "default_dwell_time_seconds": 18
                        }
                    }
                ]
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/nodes",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "nodes",
            "nodes",
            &config,
            &routers::node_collection_router::write_collection,
            &request,
        );
        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "nodes",
            "nodes",
            &config,
            &routers::node_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["nodes"], json_compare_data);





        let data = r##"
            {
                "nodes": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-72.963302,45.639486]
                            },
                            "id": 456,
                            "properties": {
                                "id": "915923f9-a768-49e5-81b6-8237d60a6125",
                                "integer_id": 456
                            }
                        }
                    ]
                }
            }
        "##;

        let compare_data = r##"
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": { 
                            "type": "Point",
                            "coordinates": [-72.963302,45.639486]
                        },
                        "id": 456,
                        "properties": {
                            "id": "915923f9-a768-49e5-81b6-8237d60a6125",
                            "data": {},
                            "station_id": null,
                            "code": null,
                            "name": null,
                            "color": null,
                            "is_frozen": null,
                            "integer_id": 456,
                            "is_enabled": null,
                            "description": null,
                            "internal_id": null,
                            "routing_radius_meters": null,
                            "default_dwell_time_seconds": null
                        }
                    }
                ]
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/nodes",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "nodes",
            "nodes",
            &config,
            &routers::node_collection_router::write_collection,
            &request,
        );
        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "nodes",
            "nodes",
            &config,
            &routers::node_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["nodes"], json_compare_data);

    }
}
