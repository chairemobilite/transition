/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use rouille;
use serde_json::json;
use std::error::Error;
use std::fs::File;
use std::path::Path;
use std::fs;

pub mod od_trip_collection_router;
pub mod node_router;
pub mod node_collection_router;
pub mod line_router;
pub mod line_collection_router;
pub mod person_collection_router;
pub mod household_collection_router;
pub mod data_source_collection_router;
pub mod agency_collection_router;
pub mod path_collection_router;
pub mod place_collection_router;
pub mod garage_collection_router;
pub mod unit_collection_router;
pub mod service_collection_router;
pub mod scenario_collection_router;
pub mod zone_collection_router;

fn failed_response(cache_name: &str, error: &dyn Error) -> rouille::Response {

    let json = json!({
        "status"   : "fail",
        "cacheName": cache_name,
        "error"    : error.to_string()
    });

    let data = serde_json::to_string(&json).unwrap();

    rouille::Response {
        status_code: 200,
        headers    : vec![("Content-Type".into(), "application/json; charset=utf-8".into())],
        data       : rouille::ResponseBody::from_data(data),
        upgrade    : None
    }

}

fn success_response(cache_name: &str, json_data: Option<&serde_json::Value>) -> rouille::Response {
    
    let mut json = json!({
        "status"   : "success",
        "cacheName": cache_name
    });

    match json_data {
        Some(json_value) => {
            json["data"] = json_value.clone();
        }

        _ => ()
    }

    rouille::Response {
        status_code: 200,
        headers    : vec![("Content-Type".into(), "application/json; charset=utf-8".into())],
        data       : rouille::ResponseBody::from_string(json.to_string()),
        upgrade    : None
    }

}

pub fn write_collection_route(collection_name: &str, cache_file_name: &str, config: &serde_json::Value, write_fn: &dyn Fn(&serde_json::Value, &mut std::fs::File, &serde_json::Value) -> ::std::result::Result<(), capnp::Error>, request: &rouille::Request) -> rouille::Response {

    let json : serde_json::Value   = try_or_400!(rouille::input::json_input(request));
    let json_cache_directory_path  = json.get("cache_directory_path").unwrap_or(&serde_json::Value::Null);
    let json_data_source_uuid      = json.get("data_source_uuid").unwrap_or(&serde_json::Value::Null);

    let cache_directory_path;

    if json_cache_directory_path.is_null() // no custom path
    {
        if !json_data_source_uuid.is_null()
        {
            cache_directory_path = format!("{}/dataSources/{}", config["project_cache_directory_path"].as_str().unwrap(), json_data_source_uuid.as_str().unwrap());
        }
        else
        {
            cache_directory_path = format!("{}", config["project_cache_directory_path"].as_str().unwrap());
        }
        println!("cache_directory_path: {}", cache_directory_path);
    }
    else
    {
        if !json_data_source_uuid.is_null()
        {
            cache_directory_path = format!("{}/dataSources/{}/{}", config["project_cache_directory_path"].as_str().unwrap(), json_data_source_uuid.as_str().unwrap(), json_cache_directory_path.as_str().unwrap(), );
        }
        else
        {
            cache_directory_path = format!("{}/{}", config["project_cache_directory_path"].as_str().unwrap(), json_cache_directory_path.as_str().unwrap());
        }
        println!("cache_directory_path_custom: {}", cache_directory_path);
    }


    let directory_path = Path::new(&cache_directory_path);
    let absolute_directory_path = String::from(directory_path.to_str().unwrap());
    let create_directories = fs::create_dir_all(&absolute_directory_path);
    match create_directories {
        Ok(()) => {},
        Err(error) => {
            println!("{}", error);
        }
    }

    let collection_file_path_name;
    
    if cache_file_name == "households" || cache_file_name == "persons" || cache_file_name == "odTrips" {
        collection_file_path_name = format!("{}/{}.capnpbin", absolute_directory_path, cache_file_name);
        println!("{}", collection_file_path_name);
    } else {
        collection_file_path_name = format!("{}/{}.capnpbin", absolute_directory_path, cache_file_name);
    }
    let absolute_path = Path::new(&collection_file_path_name);
    //println!("collection_file_path_name: {}", collection_file_path_name);
    let file = File::create(&absolute_path);

    if file.is_ok()
    {
        match &write_fn(&json, &mut file.unwrap(), config) {
            Err(error) => return failed_response(collection_name, error),
            Ok(()) => return success_response(collection_name, None)
        }
    }
    else
    {
        failed_response(collection_name, &file.unwrap_err())
    }

}

pub fn read_collection_route(collection_name: &str, cache_file_name: &str, config: &serde_json::Value, read_fn: &dyn Fn(&mut std::fs::File, &serde_json::Value) -> ::std::result::Result<serde_json::Value, capnp::Error>) -> rouille::Response {

    let custom_subdirectory_path  = config.get("custom_subdirectory_path").unwrap_or(&serde_json::Value::Null);
    let data_source_uuid          = config.get("data_source_uuid").unwrap_or(&serde_json::Value::Null);

    let cache_directory_path;

    if custom_subdirectory_path.is_null() // no custom path
    {
        if !data_source_uuid.is_null()
        {
            cache_directory_path = format!("{}/dataSources/{}", config["project_cache_directory_path"].as_str().unwrap(), data_source_uuid.as_str().unwrap());
        }
        else
        {
            cache_directory_path = format!("{}", config["project_cache_directory_path"].as_str().unwrap());
        }
        //println!("cache_directory_path: {}", cache_directory_path);
    }
    else
    {
        if !data_source_uuid.is_null()
        {
            cache_directory_path = format!("{}/dataSources/{}/{}", config["project_cache_directory_path"].as_str().unwrap(), data_source_uuid.as_str().unwrap(), custom_subdirectory_path.as_str().unwrap());
        }
        else
        {
            cache_directory_path = format!("{}/{}", config["project_cache_directory_path"].as_str().unwrap(), custom_subdirectory_path.as_str().unwrap());
        }
        //println!("cache_directory_path_custom: {}", cache_directory_path);
    }


    let directory_path = Path::new(&cache_directory_path);
    let absolute_directory_path = String::from(directory_path.to_str().unwrap());
    let create_directories = fs::create_dir_all(&absolute_directory_path);
    match create_directories {
        Ok(()) => {},
        Err(error) => {
            println!("{}", error);
        }
    }

    let collection_file_path_name;
    if cache_file_name == "households" || cache_file_name == "persons" || cache_file_name == "odTrips" {
        collection_file_path_name = format!("{}/{}.capnpbin", absolute_directory_path, cache_file_name);
    } else {
        collection_file_path_name = format!("{}/{}.capnpbin", absolute_directory_path, cache_file_name);
    }
    let path = Path::new(&collection_file_path_name);
    //println!("collection_file_path_name: {}", collection_file_path_name);
    let absolute_path = String::from(path.to_str().unwrap());
    let file = File::open(&absolute_path);

    if file.is_ok()
    {
        match &read_fn(&mut file.unwrap(), config) {
            Err(error) => return failed_response(collection_name, error),
            Ok(json_value) => return success_response(collection_name, Some(&json_value))
        }
    }
    else
    {
        failed_response(collection_name, &file.unwrap_err())
    }

}


pub fn write_object_route(collection_name: &str, subdirectory: &str, config: &serde_json::Value, write_fn: &dyn Fn(&str, &serde_json::Value, &serde_json::Value) -> ::std::result::Result<(), capnp::Error>, request: &rouille::Request) -> rouille::Response {

    let json : serde_json::Value   = try_or_400!(rouille::input::json_input(request));
    let json_cache_directory_path  = json.get("cache_directory_path").unwrap_or(&serde_json::Value::Null);
    let json_data_source_uuid      = json.get("data_source_uuid").unwrap_or(&serde_json::Value::Null);

    let cache_directory_path;

    if json_cache_directory_path.is_null() // no custom path
    {
        if !json_data_source_uuid.is_null()
        {
            cache_directory_path = format!("{}/dataSources/{}/{}", config["project_cache_directory_path"].as_str().unwrap(), json_data_source_uuid.as_str().unwrap(), subdirectory);
        }
        else
        {
            cache_directory_path = format!("{}/{}", config["project_cache_directory_path"].as_str().unwrap(), subdirectory);
        }
        //println!("cache_directory_path: {}", cache_directory_path);
    }
    else
    {
        if !json_data_source_uuid.is_null()
        {
            cache_directory_path = format!("{}/dataSources/{}/{}", config["project_cache_directory_path"].as_str().unwrap(), json_data_source_uuid.as_str().unwrap(), json_cache_directory_path.as_str().unwrap(), );
        }
        else
        {
            cache_directory_path = format!("{}/{}", config["project_cache_directory_path"].as_str().unwrap(), json_cache_directory_path.as_str().unwrap());
        }
        //println!("cache_directory_path_custom: {}", cache_directory_path);
    }

    let path = Path::new(&cache_directory_path);
    let create_directories = fs::create_dir_all(&path);
    match create_directories {
        Ok(()) => {},
        Err(error) => {
            println!("{}", error);
        }
    }
    
    let absolute_path = String::from(path.to_str().unwrap());
    match &write_fn(&absolute_path.as_str(), &json, config) {
        Err(error) => return failed_response(collection_name, error),
        Ok(()) => return success_response(collection_name, None)
    }

}

pub fn read_object_route(object_name: &str, object_uuid: &String, subdirectory: &str, config: &serde_json::Value, read_fn: &dyn Fn(&String, &str, &serde_json::Value) -> ::std::result::Result<serde_json::Value, capnp::Error>) -> rouille::Response {

    let custom_subdirectory_path  = config.get("custom_subdirectory_path").unwrap_or(&serde_json::Value::Null);
    let data_source_uuid          = config.get("data_source_uuid").unwrap_or(&serde_json::Value::Null);

    let cache_directory_path;


    if custom_subdirectory_path.is_null() // no custom path
    {
        if !data_source_uuid.is_null()
        {
            cache_directory_path = format!("{}/dataSources/{}/{}", config["project_cache_directory_path"].as_str().unwrap(), data_source_uuid.as_str().unwrap(), subdirectory);
        }
        else
        {
            cache_directory_path = format!("{}/{}", config["project_cache_directory_path"].as_str().unwrap(), subdirectory);
        }
        //println!("cache_directory_path: {}", cache_directory_path);
    }
    else
    {
        if !data_source_uuid.is_null()
        {
            cache_directory_path = format!("{}/dataSources/{}/{}", config["project_cache_directory_path"].as_str().unwrap(), data_source_uuid.as_str().unwrap(), custom_subdirectory_path.as_str().unwrap());
        }
        else
        {
            cache_directory_path = format!("{}/{}", config["project_cache_directory_path"].as_str().unwrap(), custom_subdirectory_path.as_str().unwrap());
        }
        //println!("cache_directory_path_custom: {}", cache_directory_path);
    }

    let path = Path::new(&cache_directory_path);
    let absolute_path = String::from(path.to_str().unwrap());
    println!("absolute_path: {}", absolute_path);

    match &read_fn(object_uuid, &absolute_path.as_str(), config) {
        Err(error) => return failed_response(object_name, error),
        Ok(json_value) => return success_response(object_name, Some(&json_value))
    }

}
