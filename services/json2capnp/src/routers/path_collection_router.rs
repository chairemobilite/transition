/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::pathCollection_capnp::path_collection as collection;
//use crate::my_error::MyError;
use capnp::serialize_packed;
use serde_json;
use std::io::BufReader;
use geojson::GeoJson;
use geobuf;
use protobuf::Message;

pub fn write_collection(
    json: &serde_json::Value,
    file: &mut std::fs::File,
) -> ::std::result::Result<(), capnp::Error> {
    let mut message = ::capnp::message::Builder::new_default();
    
    let geojson_data : GeoJson = GeoJson::from_json_value((json["paths"]).clone()).unwrap();

    match geojson_data {
        geojson::GeoJson::FeatureCollection(feature_collection) => {

            let features_count = feature_collection.features.len();
            let collection_capnp = message.init_root::<collection::Builder>();
            let mut capnp = collection_capnp.init_paths(features_count as u32);
            for i in 0..features_count {
                let feature        = &feature_collection.features[i];
                let mut capnp_data = capnp.reborrow().get(i as u32);
                let properties = feature.properties.as_ref().unwrap();
                println!("path_id {}", properties.get("id").unwrap().as_str().unwrap());
                capnp_data.set_uuid(properties.get("id").unwrap().as_str().unwrap()); // required
                capnp_data.set_id(properties.get("integer_id").unwrap().as_i64().unwrap() as i32); // required
                capnp_data.set_line_uuid(properties.get("line_id").unwrap().as_str().unwrap()); // required
                capnp_data.set_direction(&crate::utils::json_null_to_empty_str(&properties.get("direction").unwrap_or(&json!(null))));
                capnp_data.set_name(&crate::utils::json_null_to_empty_str(&properties.get("name").unwrap_or(&json!(null))));
                capnp_data.set_internal_id(&crate::utils::json_null_to_empty_str(&properties.get("internal_id").unwrap_or(&json!(null))));
                capnp_data.set_description(&crate::utils::json_null_to_empty_str(&properties.get("description").unwrap_or(&json!(null))));
                capnp_data.set_data(&properties.get("data").unwrap_or(&json!({})).to_string().as_str());
                capnp_data.set_is_frozen(crate::utils::json_boolean_to_i8(&properties.get("is_frozen").unwrap_or(&json!(null))));
                capnp_data.set_is_enabled(crate::utils::json_boolean_to_i8(&properties.get("is_enabled").unwrap_or(&json!(null))));

                if properties.get("nodes") != None
                {
                    let nodes_optional = properties.get("nodes").unwrap().as_array();
                    let nodes = nodes_optional.unwrap();
                    let nodes_count: usize = nodes.len();

                    capnp_data.reborrow().init_nodes_uuids(nodes_count as u32);
                    for j in 0..nodes_count
                    {
                        capnp_data.reborrow().get_nodes_uuids().unwrap().set(j as u32, nodes[j].as_str().unwrap());
                    }
                }
                else
                {
                    capnp_data.reborrow().init_nodes_uuids(0);
                }

                if properties.get("stops") != None
                {
                    let stops_optional = properties.get("stops").unwrap().as_array();
                    let stops = stops_optional.unwrap();
                    let stops_count: usize = stops.len();
                    capnp_data.reborrow().init_stops_uuids(stops_count as u32);
                    for j in 0..stops_count
                    {
                        capnp_data.reborrow().get_stops_uuids().unwrap().set(j as u32, stops[j].as_str().unwrap());
                    }
                }
                else
                {
                    capnp_data.reborrow().init_stops_uuids(0);
                }

                if properties.get("segments") != None
                {
                    let segments_optional = properties.get("segments").unwrap().as_array();
                    let segments = segments_optional.unwrap();
                    let segments_count: usize = segments.len();
                    capnp_data.reborrow().init_segments(segments_count as u32);
                    for j in 0..segments_count
                    {
                        capnp_data.reborrow().get_segments().unwrap().set(j as u32, segments[j].as_i64().unwrap() as i32);
                    }
                }
                else
                {
                    capnp_data.reborrow().init_segments(0);
                }

                let geojson_json = json!({
                    "type": "Feature",
                    "properties": {},
                    "geometry": feature.geometry.as_ref().unwrap()
                });
                let geobuf = geobuf::encode::Encoder::encode(&geojson_json, 6, 2).unwrap().write_to_bytes().unwrap();

                capnp_data.set_geography(&geobuf);
                //capnp_data.set_geography(&geojson_json["geometry"].to_string().as_str());

            }
            serialize_packed::write_message(file, &message)
        },
        _ => {
            Err(capnp::Error::failed(String::from("Paths geojson is invalid, empty or not a FeatureCollection")))
        }
    }

}


pub fn read_collection(
    file: &mut std::fs::File,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_paths()?.len() as usize);

    for capnp_object in capnp_collection.get_paths()?.iter() {
        
        let integer_id = capnp_object.get_id() as i32;
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
        let mut properties_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?,
            "integer_id": integer_id,
            "line_id": capnp_object.get_line_uuid()?,
            "internal_id": crate::utils::empty_str_to_json_null(capnp_object.get_internal_id()?),
            "direction": crate::utils::empty_str_to_json_null(capnp_object.get_direction()?),
            "name": crate::utils::empty_str_to_json_null(capnp_object.get_name()?),
            "description": crate::utils::empty_str_to_json_null(capnp_object.get_description()?),
            "is_frozen": crate::utils::i8_to_json_boolean(capnp_object.get_is_frozen()),
            "is_enabled": crate::utils::i8_to_json_boolean(capnp_object.get_is_enabled()),
            "data": data_attributes
        });

        let mut nodes_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_nodes_uuids()?.len() as usize);
        for node_uuid in capnp_object.get_nodes_uuids()?.iter() {
            nodes_uuids_vec.push(json!(node_uuid.unwrap()));
        }
        properties_json["nodes"] = json!(nodes_uuids_vec);

        let mut stops_uuids_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_stops_uuids()?.len() as usize);
        for stop_uuid in capnp_object.get_stops_uuids()?.iter() {
            stops_uuids_vec.push(json!(stop_uuid.unwrap()));
        }
        properties_json["stops"] = json!(stops_uuids_vec);

        let mut segments_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_object.get_segments()?.len() as usize);
        for segment in capnp_object.get_segments()?.iter() {
            segments_vec.push(json!(segment));
        }
        properties_json["segments"] = json!(segments_vec);

        let mut geobuf_data = geobuf::geobuf_pb::Data::new();

        geobuf_data.merge_from_bytes(&capnp_object.get_geography().unwrap()).unwrap();
        let mut geojson : serde_json::Value = geobuf::decode::Decoder::decode(&geobuf_data).unwrap_or(json!({
            "geometry": null
        }));

        geojson["id"] = json!(integer_id);
        geojson["properties"] = properties_json;

        collection_json_vec.push(geojson);

    }

    Ok(json!({
        "paths": {
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
    fn path_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "paths": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "LineString",
                                "coordinates": [
                                    [-72.963302,45.639486],
                                    [-72.962992,45.639276],
                                    [-72.962526,45.639643],
                                    [-72.962265,45.639492],
                                    [-72.962158,45.639414],
                                    [-72.961906,45.639259],
                                    [-72.961848,45.639144],
                                    [-72.961792,45.639055],
                                    [-72.961789,45.639001],
                                    [-72.97436,45.63308],
                                    [-72.974538,45.633058],
                                    [-72.974768,45.633033],
                                    [-72.974984,45.633]
                                ]
                            },
                            "id": 234,
                            "properties": {
                                "id": "515923f9-a768-49e5-81b6-8237d60a6125",
                                "data": {
                                    "gtfs": {
                                        "shape_id": "A0000"
                                    },
                                    "isNew": false,
                                    "segments": [
                                        {
                                            "distanceMeters": 1700,
                                            "travelTimeSeconds": 120
                                        },
                                        {
                                            "distanceMeters": 300,
                                            "travelTimeSeconds": 60
                                        },
                                        {
                                            "distanceMeters": 388,
                                            "travelTimeSeconds": 0
                                        },
                                        {
                                            "distanceMeters": 411,
                                            "travelTimeSeconds": 60
                                        }
                                    ],
                                    "dwellTimeSeconds": [0,20,18,20,23],
                                    "layoverTimeSeconds": 180,
                                    "returnBackGeography": null,
                                    "totalDistanceMeters": 6939,
                                    "totalDwellTimeSeconds": 0,
                                    "birdDistanceBetweenTerminals": 0,
                                    "operatingSpeedMetersPerSecond": 8.9,
                                    "travelTimeWithoutDwellTimesSeconds": 780,
                                    "operatingTimeWithLayoverTimeSeconds": 960,
                                    "totalTravelTimeWithReturnBackSeconds": null,
                                    "operatingTimeWithoutLayoverTimeSeconds": 780,
                                    "operatingSpeedWithLayoverMetersPerSecond": 7.23,
                                    "averageSpeedWithoutDwellTimesMetersPerSecond": 8.9
                                },
                                "mode": "bus",
                                "name": "PathName",
                                "color": "#1F1F1F",
                                "nodes":[
                                    "02c36463-fca3-48dc-8722-c8d2cdf62ad1",
                                    "073709b9-38de-4092-9010-0c636d4e7031",
                                    "02d6f932-14ef-4405-97d6-fc1c6d55328c",
                                    "07de5ccb-0c2b-4f83-aedb-2d7d4000a107",
                                    "02f2a4a0-399f-4894-aaca-b687bcf00058"
                                ],
                                "line_id": "83269525-9100-45b3-b00b-67b5d5a3f12d",
                                "segments": [0,61,66,84],
                                "direction": "inbound",
                                "is_frozen": false,
                                "created_at": "2020-01-01T15:15:15.054321-04:00",
                                "integer_id": 234,
                                "is_enabled": true,
                                "updated_at": null,
                                "description": "description for path",
                                "internal_id": "A12345"
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
                            "type": "LineString",
                            "coordinates": [
                                [-72.963302,45.639486],
                                [-72.962992,45.639276],
                                [-72.962526,45.639643],
                                [-72.962265,45.639492],
                                [-72.962158,45.639414],
                                [-72.961906,45.639259],
                                [-72.961848,45.639144],
                                [-72.961792,45.639055],
                                [-72.961789,45.639001],
                                [-72.97436,45.63308],
                                [-72.974538,45.633058],
                                [-72.974768,45.633033],
                                [-72.974984,45.633]
                            ]
                        },
                        "id": 234,
                        "properties": {
                            "id": "515923f9-a768-49e5-81b6-8237d60a6125",
                            "data": {
                                "gtfs": {
                                    "shape_id": "A0000"
                                },
                                "isNew": false,
                                "segments": [
                                    {
                                        "distanceMeters": 1700,
                                        "travelTimeSeconds": 120
                                    },
                                    {
                                        "distanceMeters": 300,
                                        "travelTimeSeconds": 60
                                    },
                                    {
                                        "distanceMeters": 388,
                                        "travelTimeSeconds": 0
                                    },
                                    {
                                        "distanceMeters": 411,
                                        "travelTimeSeconds": 60
                                    }
                                ],
                                "dwellTimeSeconds": [0,20,18,20,23],
                                "layoverTimeSeconds": 180,
                                "returnBackGeography": null,
                                "totalDistanceMeters": 6939,
                                "totalDwellTimeSeconds": 0,
                                "birdDistanceBetweenTerminals": 0,
                                "operatingSpeedMetersPerSecond": 8.9,
                                "travelTimeWithoutDwellTimesSeconds": 780,
                                "operatingTimeWithLayoverTimeSeconds": 960,
                                "totalTravelTimeWithReturnBackSeconds": null,
                                "operatingTimeWithoutLayoverTimeSeconds": 780,
                                "operatingSpeedWithLayoverMetersPerSecond": 7.23,
                                "averageSpeedWithoutDwellTimesMetersPerSecond": 8.9
                            },
                            "name": "PathName",
                            "stops": [],
                            "nodes":[
                                "02c36463-fca3-48dc-8722-c8d2cdf62ad1",
                                "073709b9-38de-4092-9010-0c636d4e7031",
                                "02d6f932-14ef-4405-97d6-fc1c6d55328c",
                                "07de5ccb-0c2b-4f83-aedb-2d7d4000a107",
                                "02f2a4a0-399f-4894-aaca-b687bcf00058"
                            ],
                            "line_id": "83269525-9100-45b3-b00b-67b5d5a3f12d",
                            "segments": [0,61,66,84],
                            "direction": "inbound",
                            "is_frozen": false,
                            "integer_id": 234,
                            "is_enabled": true,
                            "description": "description for path",
                            "internal_id": "A12345"
                        }
                    }
                ]
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/paths",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "paths",
            "paths",
            &config,
            &routers::path_collection_router::write_collection,
            &request,
        );
        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "paths",
            "paths",
            &config,
            &routers::path_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["paths"], json_compare_data);

    }
}
