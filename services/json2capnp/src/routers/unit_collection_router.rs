/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::unitCollection_capnp::unit_collection as collection;
//use crate::my_error::MyError;
use capnp::serialize_packed;
use serde_json;
use std::io::BufReader;
use crate::utils::{ 
    required_string, 
    optional_string_json_null_to_empty_str as optional_string, 
    json_boolean_to_i8, 
    empty_str_to_json_null, 
    i8_to_json_boolean,
    minus_one_f64_to_null,
    json_value_or_null_to_i64_or_minus_one,
    json_value_or_null_to_f64_or_minus_one,
    minus_one_i64_to_null
};

pub fn write_collection(
    json: &serde_json::Value,
    file: &mut std::fs::File,
    _: &serde_json::Value,
) -> ::std::result::Result<(), capnp::Error> {
    let mut message = ::capnp::message::Builder::new_default();

    let json_objects = &json["units"];

    let count: usize = json_objects.as_array().unwrap().len();
    let collection_capnp = message.init_root::<collection::Builder>();
    let mut capnp = collection_capnp.init_units(count as u32);

    for i in 0..count {
        let json_data = &json_objects[i];
        let mut capnp_data = capnp.reborrow().get(i as u32);
        capnp_data.set_uuid(&required_string(json_data.get("id"))); // required
        capnp_data.set_id(json_data.get("integer_id").unwrap().as_i64().unwrap() as i32); // required
        capnp_data.set_internal_id(&optional_string(json_data.get("internal_id")));
        capnp_data.set_agency_uuid(&optional_string(json_data.get("agency_id")));
        capnp_data.set_garage_uuid(&optional_string(json_data.get("garage_id")));
        capnp_data.set_line_uuid(&optional_string(json_data.get("line_id")));
        capnp_data.set_mode(&optional_string(json_data.get("mode")));
        capnp_data.set_manufacturer(&optional_string(json_data.get("manufacturer")));
        capnp_data.set_model(&optional_string(json_data.get("model")));
        capnp_data.set_license_number(&optional_string(json_data.get("license_number")));
        capnp_data.set_serial_number(&optional_string(json_data.get("serial_number")));
        capnp_data.set_capacity_seated(json_value_or_null_to_i64_or_minus_one(&json_data.get("capacity_seated").unwrap_or(&json!(null))) as i16);
        capnp_data.set_capacity_standing(json_value_or_null_to_i64_or_minus_one(&json_data.get("capacity_standing").unwrap_or(&json!(null))) as i16);
        capnp_data.set_number_of_vehicles(json_value_or_null_to_i64_or_minus_one(&json_data.get("number_of_vehicles").unwrap_or(&json!(null))) as i16);
        capnp_data.set_number_of_doors(json_value_or_null_to_i64_or_minus_one(&json_data.get("number_of_doors").unwrap_or(&json!(null))) as i16);
        capnp_data.set_number_of_door_channels(json_value_or_null_to_i64_or_minus_one(&json_data.get("number_of_door_channels").unwrap_or(&json!(null))) as i16);
        capnp_data.set_length_mm(json_value_or_null_to_f64_or_minus_one(&json_data.get("length_mm").unwrap_or(&json!(null))) as f32);
        capnp_data.set_width_mm(json_value_or_null_to_f64_or_minus_one(&json_data.get("width_mm").unwrap_or(&json!(null))) as f32);
        capnp_data.set_color(&optional_string(json_data.get("color")));
        capnp_data.set_data(&json_data.get("data").unwrap_or(&json!({})).to_string().as_str());
        capnp_data.set_is_frozen(json_boolean_to_i8(json_data.get("is_frozen").unwrap_or(&json!(null))));
        capnp_data.set_is_enabled(json_boolean_to_i8(json_data.get("is_enabled").unwrap_or(&json!(null))));
    }

    serialize_packed::write_message(file, &message)
}


pub fn read_collection(
    file: &mut std::fs::File,
    _ : &serde_json::Value//config: &serde_json::Value,
) -> ::std::result::Result<serde_json::Value, capnp::Error> {

    let message_reader   = serialize_packed::read_message(BufReader::new(file), ::capnp::message::ReaderOptions::new())?;
    let capnp_collection = message_reader.get_root::<collection::Reader>()?;
    
    let mut collection_json_vec : Vec<serde_json::Value> = Vec::with_capacity(capnp_collection.get_units()?.len() as usize);

    for capnp_object in capnp_collection.get_units()?.iter() {
        
        let data_attributes : serde_json::Value = serde_json::from_str(capnp_object.get_data()?).unwrap();
        let integer_id = capnp_object.get_id() as i32;
        let object_json : serde_json::Value = json!({
            "id": capnp_object.get_uuid()?,
            "internal_id": empty_str_to_json_null(capnp_object.get_internal_id()?),
            "integer_id": integer_id,
            "agency_id": empty_str_to_json_null(capnp_object.get_agency_uuid()?),
            "garage_id": empty_str_to_json_null(capnp_object.get_garage_uuid()?),
            "line_id": empty_str_to_json_null(capnp_object.get_line_uuid()?),
            "mode": empty_str_to_json_null(capnp_object.get_mode()?),
            "manufacturer": empty_str_to_json_null(capnp_object.get_manufacturer()?),
            "model": empty_str_to_json_null(capnp_object.get_model()?),
            "license_number": empty_str_to_json_null(capnp_object.get_license_number()?),
            "serial_number": empty_str_to_json_null(capnp_object.get_serial_number()?),
            "capacity_seated": minus_one_i64_to_null(capnp_object.get_capacity_seated() as i64),
            "capacity_standing": minus_one_i64_to_null(capnp_object.get_capacity_standing() as i64),
            "number_of_vehicles": minus_one_i64_to_null(capnp_object.get_number_of_vehicles() as i64),
            "number_of_doors": minus_one_i64_to_null(capnp_object.get_number_of_doors() as i64),
            "number_of_door_channels": minus_one_i64_to_null(capnp_object.get_number_of_door_channels() as i64),
            "length_mm": minus_one_f64_to_null(((capnp_object.get_length_mm() as f64)*100000.0).round() / 100000.0), // we must round to 5 decimals so we don't get numbers like 2.10000000345454 for n input value of 2.1
            "width_mm": minus_one_f64_to_null(((capnp_object.get_width_mm() as f64)*100000.0).round() / 100000.0), // we must round to 5 decimals so we don't get numbers like 2.10000000345454 for n input value of 2.1
            "color": empty_str_to_json_null(capnp_object.get_color()?),
            "is_frozen": i8_to_json_boolean(capnp_object.get_is_frozen()),
            "is_enabled": i8_to_json_boolean(capnp_object.get_is_enabled()),
            "data": data_attributes
        });

        collection_json_vec.push(object_json);

    }

    let collection_json = json!({
        "units": serde_json::Value::Array(collection_json_vec)
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
    fn unit_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test"
        });
        
        let data = r##"
            {
                "units": [
                    {
                        "id": "1234-1234",
                        "integer_id": 22,
                        "is_enabled": null,
                        "is_frozen": true,
                        "internal_id": "iid",
                        "color": "#FFFFFF",
                        "agency_id": "999-999",
                        "garage_id": "888-999",
                        "line_id": "777-999",
                        "mode": "bus",
                        "manufacturer": "busMaker",
                        "model": "busModel",
                        "license_number": "A12345",
                        "serial_number": "654fdsd876234",
                        "capacity_seated": 24,
                        "capacity_standing": 31,
                        "number_of_vehicles": 1,
                        "number_of_doors": 2,
                        "number_of_door_channels": 3,
                        "length_mm": 254.78,
                        "width_mm": 798,
                        "data": {
                            "foo": "bar"
                        }
                    },
                    {
                        "id": "2345-2345",
                        "integer_id": 23
                    },
                    {
                        "id": "2345-2346",
                        "integer_id": 24,
                        "is_enabled": true,
                        "is_frozen": false,
                        "data": {}
                    }
                ]
            }
            "##;

            let compare_data = r##"
            {
                "units": [
                    {
                        "id": "1234-1234",
                        "integer_id": 22,
                        "is_enabled": null,
                        "is_frozen": true,
                        "internal_id": "iid",
                        "color": "#FFFFFF",
                        "agency_id": "999-999",
                        "garage_id": "888-999",
                        "line_id": "777-999",
                        "mode": "bus",
                        "manufacturer": "busMaker",
                        "model": "busModel",
                        "license_number": "A12345",
                        "serial_number": "654fdsd876234",
                        "capacity_seated": 24,
                        "capacity_standing": 31,
                        "number_of_vehicles": 1,
                        "number_of_doors": 2,
                        "number_of_door_channels": 3,
                        "length_mm": 254.78,
                        "width_mm": 798.0,
                        "data": {
                            "foo": "bar"
                        }
                    },
                    {
                        "id": "2345-2345",
                        "integer_id": 23,
                        "is_enabled": null,
                        "is_frozen": null,
                        "internal_id": null,
                        "color": null,
                        "agency_id": null,
                        "garage_id": null,
                        "line_id": null,
                        "mode": null,
                        "manufacturer": null,
                        "model": null,
                        "license_number": null,
                        "serial_number": null,
                        "capacity_seated": null,
                        "capacity_standing": null,
                        "number_of_vehicles": null,
                        "number_of_doors": null,
                        "number_of_door_channels": null,
                        "length_mm": null,
                        "width_mm": null,
                        "data": {}
                    },
                    {
                        "id": "2345-2346",
                        "integer_id": 24,
                        "is_enabled": true,
                        "is_frozen": false,
                        "internal_id": null,
                        "color": null,
                        "agency_id": null,
                        "garage_id": null,
                        "line_id": null,
                        "mode": null,
                        "manufacturer": null,
                        "model": null,
                        "license_number": null,
                        "serial_number": null,
                        "capacity_seated": null,
                        "capacity_standing": null,
                        "number_of_vehicles": null,
                        "number_of_doors": null,
                        "number_of_door_channels": null,
                        "length_mm": null,
                        "width_mm": null,
                        "data": {}
                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();

        let request = Request::fake_http(
            "POST",
            "/units",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "units",
            "units",
            &config,
            &routers::unit_collection_router::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "units",
            "units",
            &config,
            &routers::unit_collection_router::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["units"], json_compare_data["units"]);

    }
}
