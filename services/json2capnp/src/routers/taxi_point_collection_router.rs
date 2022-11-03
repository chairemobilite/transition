/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

/*use serde_json;
use crate::taxiPointCollection_capnp::{taxi_point_collection as collection};
use capnp::serialize_packed;
//use crate::my_error::MyError;
//use uuid::Uuid;
use std::path::{Path};
use std::io::Read;
use std::io::prelude::*;
*/
/*
taxiId                      @1  :UInt32; # includes vehicle, driver and permit # pk 1
operatorId                  @2  :UInt16; # pk 2
timestamp                   @3  :UInt32; # utc # pk 3
status                      @4  :Status;
latitude                    @5  :Int32; # divide by 1000000 to get float
longitude                   @6  :Int32; # divide by 1000000 to get float
speed                       @7  :Int16;
azimuth                     @8  :Int16;
device                      @9  :Device;
*/

/*
pub fn write_collection(json: &serde_json::Value, file: &mut std::fs::File, config: &serde_json::Value) -> ::std::result::Result<(), capnp::Error> {
  
  println!("receiving data...");

  // read taxi ids mapping from json project file, or create it if not exists:
  let taxi_ids_mapping_json_file_path_str = format!("{}/taxi_ids_mapping.json", config["project_directory_path"].as_str().unwrap());
  let taxi_ids_mapping_json_file_path     = Path::new(&taxi_ids_mapping_json_file_path_str);
  
  let taxi_ids_mapping_json_file_path_exists = taxi_ids_mapping_json_file_path.exists();

  let mut taxi_ids_mapping_json_file = match taxi_ids_mapping_json_file_path_exists {
    true  => std::fs::File::open(&taxi_ids_mapping_json_file_path),
    false => std::fs::File::create(&taxi_ids_mapping_json_file_path)
  }.unwrap();

  let mut taxi_ids_mapping: serde_json::Value;
  if taxi_ids_mapping_json_file_path_exists
  {
    println!("reading taxi ids mapping json file");
    let mut taxi_ids_mapping_str = String::new();
    taxi_ids_mapping_json_file.read_to_string(&mut taxi_ids_mapping_str);
    taxi_ids_mapping = serde_json::from_str(&taxi_ids_mapping_str).unwrap();
  }
  else
  {
    println!("writing taxi ids mapping json file");
    taxi_ids_mapping_json_file.write_all("{}".as_bytes());
    taxi_ids_mapping = json!({});
  }

  // repeat for operator_id



  /*if (!json.as_map().contains_key("items"))
  {
    return Err( std::io::Error::new(
      std::io::ErrorKind::InvalidData,
      MyError::new(&String::from("missing items key in json data"))
    ))
  }*/

  
  let mut message = ::capnp::message::Builder::new_default();

  let count_root_items: usize = json.as_array().unwrap().len();
  

  let mut flatten_items = std::vec::Vec::new();

  for i in 0..count_root_items
  {
    let json_items = &json[i]["items"].as_array().unwrap();
    for j in 0..json_items.len()
    {
      flatten_items.push(&json_items[j]);
    }
  }

  let count: usize = flatten_items.len();

  println!("received {} taxi points", count);
  let collection_capnp = message.init_root::<collection::Builder>();
  let mut capnp        = collection_capnp.init_taxi_points(count as u32);

  for i in 0..count
  {
    let json_data = &flatten_items[i];
    let mut capnp_data = capnp.reborrow().get(i as u32);

    //Uuid::new_v4();

    /*capnp_data.set_uuid(&json_data["id"].to_string());
    capnp_data.set_type(crate::enum_mappings::data_source_type(&json_data["type"].to_string()));
    capnp_data.set_shortname(&crate::utils::string_or_null_to_empty_string(&json_data["shortname"].to_string()));
    capnp_data.set_name(&crate::utils::string_or_null_to_empty_string(&json_data["name"].to_string()));
    capnp_data.set_description(&crate::utils::string_or_null_to_empty_string(&json_data["description"].to_string()));
    capnp_data.set_data(&crate::utils::string_or_null_to_empty_string(&json_data["data"].to_string()));
    capnp_data.set_is_frozen(crate::utils::json_boolean_to_i8(&json_data["is_frozen"]));*/
  }

  serialize_packed::write_message(file, &message)

}
*/