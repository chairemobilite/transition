/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::garageCollection_capnp::garage_collection as collection;
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
    _: &serde_json::Value,
) -> ::std::result::Result<(), capnp::Error> {
    let mut message = ::capnp::message::Builder::new_default();
    
    let geojson_data : GeoJson = GeoJson::from_json_value((json["garages"]).clone()).unwrap();

    match geojson_data {
        geojson::GeoJson::FeatureCollection(feature_collection) => {

            let features_count = feature_collection.features.len();
            let collection_capnp = message.init_root::<collection::Builder>();
            let mut capnp = collection_capnp.init_garages(features_count as u32);
            for i in 0..features_count {
                let feature        = &feature_collection.features[i];
                let mut capnp_data = capnp.reborrow().get(i as u32);
                let properties = feature.properties.as_ref().unwrap();
                capnp_data.set_uuid(properties.get("id").unwrap().as_str().unwrap()); // required
                capnp_data.set_id(properties.get("integer_id").unwrap().as_i64().unwrap() as i32); // required
                capnp_data.set_agency_uuid(properties.get("agency_id").unwrap().as_str().unwrap()); // required
                capnp_data.set_name(&crate::utils::json_null_to_empty_str(&properties.get("name").unwrap_or(&json!(null))));
                capnp_data.set_color(&crate::utils::json_null_to_empty_str(&properties.get("color").unwrap_or(&json!(null))));
                capnp_data.set_internal_id(&crate::utils::json_null_to_empty_str(&properties.get("internal_id").unwrap_or(&json!(null))));
                capnp_data.set_description(&crate::utils::json_null_to_empty_str(&properties.get("description").unwrap_or(&json!(null))));
                capnp_data.set_data(&properties.get("data").unwrap_or(&json!({})).to_string().as_str());
                capnp_data.set_is_frozen(crate::utils::json_boolean_to_i8(&properties.get("is_frozen").unwrap_or(&json!(null))));
                capnp_data.set_is_enabled(crate::utils::json_boolean_to_i8(&properties.get("is_enabled").unwrap_or(&json!(null))));

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
            Err(capnp::Error::failed(String::from("Garages geojson is invalid, empty or not a FeatureCollection")))
        }
    }

}


pub fn read_collection(
    file: &mut std::fs::File,
    _ : &serde_json::Value//config: &serde_json::Value,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_garages()?.len() as usize);

    for capnp_object in capnp_collection.get_garages()?.iter() {
        
        let integer_id = capnp_object.get_id() as i32;
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
        let properties_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?,
            "integer_id": integer_id,
            "agency_id": capnp_object.get_agency_uuid()?,
            "internal_id": crate::utils::empty_str_to_json_null(capnp_object.get_internal_id()?),
            "name": crate::utils::empty_str_to_json_null(capnp_object.get_name()?),
            "description": crate::utils::empty_str_to_json_null(capnp_object.get_description()?),
            "color": crate::utils::empty_str_to_json_null(capnp_object.get_color()?),
            "is_frozen": crate::utils::i8_to_json_boolean(capnp_object.get_is_frozen()),
            "is_enabled": crate::utils::i8_to_json_boolean(capnp_object.get_is_enabled()),
            "data": data_attributes
        });

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
        "garages": {
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
    fn garage_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });

        let data = r##"
            {
                "garages": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Point",
                                "coordinates": [-72.963302,45.639486]
                            },
                            "id": 234,
                            "properties": {
                                "id": "515923f9-a768-49e5-81b6-8237d60a6125",
                                "data": {
                                    "isNew": false,
                                    "foo": "bar"
                                },
                                "name": "GarageName",
                                "color": "#1F1F1F",
                                "agency_id": "83269525-9100-45b3-b00b-67b5d5a3f12d",
                                "is_frozen": false,
                                "created_at": "2020-01-01T15:15:15.054321-04:00",
                                "integer_id": 234,
                                "is_enabled": true,
                                "updated_at": null,
                                "description": "description for garage",
                                "internal_id": "Garage1"
                            }
                        },
                        {
                            "type": "Feature",
                            "geometry": { 
                                "type": "Polygon",
                                "coordinates": [[[-76.963302,42.639486],[-75.963302,43.639486],[-74.963302,44.639486],[-76.963302,42.639486]]]
                            },
                            "id": 235,
                            "properties": {
                                "id": "615923f9-a768-49e5-81b6-8237d60a6125",
                                "agency_id": "73269525-9100-45b3-b00b-67b5d5a3f12d",
                                "integer_id": 235
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
                        "id": 234,
                        "properties": {
                            "id": "515923f9-a768-49e5-81b6-8237d60a6125",
                            "data": {
                                "isNew": false,
                                "foo": "bar"
                            },
                            "name": "GarageName",
                            "color": "#1F1F1F",
                            "agency_id": "83269525-9100-45b3-b00b-67b5d5a3f12d",
                            "is_frozen": false,
                            "integer_id": 234,
                            "is_enabled": true,
                            "description": "description for garage",
                            "internal_id": "Garage1"
                        }
                    },
                    {
                        "type": "Feature",
                        "geometry": { 
                            "type": "Polygon",
                            "coordinates": [[[-76.963302,42.639486],[-75.963302,43.639486],[-74.963302,44.639486],[-76.963302,42.639486]]]
                        },
                        "id": 235,
                        "properties": {
                            "id": "615923f9-a768-49e5-81b6-8237d60a6125",
                            "data": {},
                            "name": null,
                            "color": null,
                            "agency_id": "73269525-9100-45b3-b00b-67b5d5a3f12d",
                            "is_frozen": null,
                            "integer_id": 235,
                            "is_enabled": null,
                            "description": null,
                            "internal_id": null
                        }
                    }
                ]
            }
        "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/garages",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "garages",
            "garages",
            &config,
            &routers::garage_collection_router::write_collection,
            &request,
        );
        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "garages",
            "garages",
            &config,
            &routers::garage_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["garages"], json_compare_data);

    }
}
