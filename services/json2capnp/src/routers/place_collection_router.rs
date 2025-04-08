/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::placeCollection_capnp::place_collection as collection;
//use crate::my_error::MyError;
use capnp::serialize_packed;
use serde_json;
use std::io::BufReader;
use geojson::{Value as GeojsonValue};
use geojson::GeoJson;
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

    let geojson_data : GeoJson = GeoJson::from_json_value((json["places"]).clone()).unwrap();

    match geojson_data {
        geojson::GeoJson::FeatureCollection(feature_collection) => {

            let features_count = feature_collection.features.len();
            let collection_capnp = message.init_root::<collection::Builder>();
            let mut capnp = collection_capnp.init_places(features_count as u32);

            for i in 0..features_count {
                let feature = &feature_collection.features[i];

                let mut capnp_data = capnp.reborrow().get(i as u32);
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
                let mut properties = feature.properties.clone().unwrap();

                capnp_data.set_uuid(&required_string(properties.get("id")));
                capnp_data.set_data_source_uuid(&optional_string(properties.get("data_source_id")));
                capnp_data.set_id(properties.get("integer_id").unwrap().as_u64().unwrap() as u32); // required
                capnp_data.set_internal_id(&optional_string(properties.get("internal_id")));
                capnp_data.set_shortname(&optional_string(properties.get("shortname")));
                capnp_data.set_name(&optional_string(properties.get("name")));
                capnp_data.set_description(&optional_string(properties.get("description")));
                capnp_data.set_data(&properties.get("data").unwrap_or(&json!({})).to_string().as_str());
                capnp_data.set_is_frozen(json_boolean_to_i8(properties.get("is_frozen").unwrap_or(&json!(null))));
                capnp_data.set_latitude(latitude);
                capnp_data.set_longitude(longitude);
            
                if properties.get("data") != None && properties["data"].is_object() && properties["data"].get("nodes") != None && properties["data"]["nodes"].is_array()
                {
                    let nodes_count = properties["data"]["nodes"].as_array().unwrap().len();
                    capnp_data.reborrow().init_nodes_uuids(nodes_count as u32);
                    capnp_data.reborrow().init_nodes_travel_times(nodes_count as u32);
                    capnp_data.reborrow().init_nodes_distances(nodes_count as u32);
                    for j in 0..nodes_count
                    {
                        capnp_data.reborrow().get_nodes_uuids().unwrap().set(j as u32, properties["data"]["nodes"][j].as_str().unwrap());
                        capnp_data.reborrow().get_nodes_travel_times().unwrap().set(j as u32, properties["data"]["nodesTravelTimes"][j].as_i64().unwrap() as i16);
                        capnp_data.reborrow().get_nodes_distances().unwrap().set(j as u32, properties["data"]["nodesDistances"][j].as_i64().unwrap() as i16);
                    }
                
                    // remove nodes and associates:
                    properties["data"]["nodes"].take();
                    properties["data"]["nodesTravelTimes"].take();
                    properties["data"]["nodesDistances"].take();
                }
            }
            
            serialize_packed::write_message(file, &message)
        },
        _ => {
            Err(capnp::Error::failed(String::from("Zones geojson is invalid, empty or not a FeatureCollection")))
        }
    }

}


pub fn read_collection(
    file: &mut std::fs::File,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_places()?.len() as usize);

    for capnp_object in capnp_collection.get_places()?.iter() {
        
        let mut data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
        
        let latitude  = (capnp_object.get_latitude() as f64)/1000000.0;
        let longitude = (capnp_object.get_longitude() as f64)/1000000.0;

        if capnp_object.has_nodes_uuids()
        {
            let mut nodes_uuids : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_nodes_uuids()?.len() as usize);
            for node_uuid in capnp_object.get_nodes_uuids()?.iter() {
                nodes_uuids.push(json!(node_uuid.unwrap()));
            }
            data_attributes["nodes"] = json!(nodes_uuids);

            let mut nodes_travel_times : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_nodes_travel_times()?.len() as usize);
            for node_travel_time in capnp_object.get_nodes_travel_times()?.iter() {
                nodes_travel_times.push(json!(node_travel_time));
            }
            data_attributes["nodesTravelTimes"] = json!(nodes_travel_times);

            let mut nodes_distances : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_nodes_distances()?.len() as usize);
            for node_distance in capnp_object.get_nodes_distances()?.iter() {
                nodes_distances.push(json!(node_distance));
            }
            data_attributes["nodesDistances"] = json!(nodes_distances);
        }

        let integer_id = capnp_object.get_id() as u32;

        let properties_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?,
            "integer_id": integer_id,
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?),
            "shortname": empty_str_to_json_null(capnp_object.get_shortname()?),
            "name": empty_str_to_json_null(capnp_object.get_name()?),
            "description": empty_str_to_json_null(capnp_object.get_description()?),
            "data_source_id": empty_str_to_json_null(capnp_object.get_data_source_uuid()?),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
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
        "places": {
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
    fn place_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test",
            "data_source_uuid"            : "1234-5678"
        });

        let data = r##"
            {
                "data_source_uuid": "1234-5678",
                "places": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-72.963302,45.639486]
                            },
                            "id": 1234,
                            "properties": {
                                "id": "1234-1234",
                                "integer_id": 1234,
                                "is_frozen": true,
                                "internal_id": "iid",
                                "data_source_id": "4567-8910",
                                "shortname": "place",
                                "name": "Place",
                                "description": "desc.",
                                "data": {
                                    "foo": "bar",
                                    "nodes": ["abc", "def", "efg"],
                                    "nodesTravelTimes": [234, 567, 8910],
                                    "nodesDistances": [1243, 3453, 9455]
                                }
                            }
                            
                        },
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-75.45785, 44.45577]
                            },
                            "id": 1245,
                            "properties": {
                                "integer_id": 1245,
                                "id": "2345-2345",
                                "is_frozen": null
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
                        "id": 1234,
                        "properties": {
                            "id": "1234-1234",
                            "integer_id": 1234,
                            "is_frozen": true,
                            "internal_id": "iid",
                            "data_source_id": "4567-8910",
                            "shortname": "place",
                            "name": "Place",
                            "description": "desc.",
                            "data": {
                                "foo": "bar",
                                "nodes": ["abc", "def", "efg"],
                                "nodesTravelTimes": [234, 567, 8910],
                                "nodesDistances": [1243, 3453, 9455]
                            }
                        }

                    },
                    {
                        "type": "Feature",
                        "geometry": { 
                            "type": "Point",
                            "coordinates": [-75.45785, 44.45577]
                        },
                        "id": 1245,
                        "properties": {
                            "id": "2345-2345",
                            "is_frozen": null,
                            "internal_id": null,
                            "integer_id": 1245,
                            "data_source_id": null,
                            "data": {},
                            "shortname": null,
                            "name": null,
                            "description": null
                        }
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();
        
        let request = Request::fake_http(
            "POST",
            "/places",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "places",
            "places",
            &config,
            &routers::place_collection_router::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "places",
            "places",
            &config,
            &routers::place_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["places"], json_compare_data);

    }
}




