/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use rouille::Request;
use rouille::Response;
use std::fs;
use std::io;
use std::path::Path;
use std::env;

#[macro_use]
extern crate rouille;

#[macro_use]
extern crate serde_json;

mod enum_mappings;
mod routers;
mod utils;

include!("./capnp/include.rs");

fn main() {

    let args: Vec<String> = env::args().collect();

    let port: u16;
    let cache_directory: Option<String>;

    // TODO Handle command line arguments with --argName [argValue]
    match args.len() {
        1 => {
            println!("no argument, using default port 2000");
            port = 2000;
            cache_directory = None;
        },
        2 => {
            println!("using port in arguments: {}", &args[1]);
            port = args[1].parse().unwrap();
            cache_directory = None;
        },
        3 => {
            println!("using port and relative path in arguments: {}, {}", &args[1], &args[2]);
            port = args[1].parse().unwrap();
            cache_directory = Some(args[2].parse().unwrap());
        },
        _ => {
            println!("too many arguments, using default port 2000");
            port = 2000;
            cache_directory = None;
        }
    }

    println!("Starting json2capnp server...");

    // TODO For now, the project cache directory must be set on the command line. It can come from config when config is json or yml (#415)
    let project_shortname = "default";
    let project_cache_directory_path_str = cache_directory.unwrap_or_else(|| { panic!("Cache directory must be set on the command line (eg cargo run -- 2000 path/to/cache/dir)") } );
    println!("Using {} as cache directory",
        project_cache_directory_path_str
    );
             
    let project_cache_directory_path =
        fs::canonicalize(Path::new(&project_cache_directory_path_str)).expect("Cache directory does not exist");
    
    println!(
        "Port {} | Using project {}",
        port,
        project_shortname
    );

    let handle_request = move |request: &Request| -> Response {
        
        // setup config:
        let mut config: serde_json::Value = json!({
            "project_cache_directory_path": project_cache_directory_path.to_str().unwrap(),
            "custom_subdirectory_path"    : json!(null),
            "project_shortname"           : json!(project_shortname),
            "data_source_uuid"            : json!(null)
        });

        match &request.get_param("cache_directory_path") {
            Some(cache_directory_path) => {
                println!("request cache_directory_path {}", cache_directory_path);
                config["custom_subdirectory_path"] = json!(format!("{}", cache_directory_path));
            },
            _ => {}
        }

        match &request.get_param("data_source_uuid") {
            Some(data_source_uuid) => {
                println!("request data_source_uuid {}", data_source_uuid);
                config["data_source_uuid"] = json!(format!("{}", data_source_uuid));
            },
            _ => {}
        }

        let object_uuid = match &request.get_param("uuid") {
            Some(uuid) => {
                uuid.to_owned()
            },
            _ => String::from("").to_owned()
        };

        rouille::log(&request, io::stdout(), || {
            router!(request,
              (GET) (/) => {
                // When viewing the home page, we return an HTML document described below.
                Response::text(format!("empty response"))
              },

              (POST) (/dataSources) => { routers::write_collection_route("dataSources", "dataSources", &config, &routers::data_source_collection_router::write_collection, request) },
              (POST) (/agencies)    => { routers::write_collection_route("agencies", "agencies", &config, &routers::agency_collection_router::write_collection, request) },
              (POST) (/garages)     => { routers::write_collection_route("garages", "garages", &config, &routers::garage_collection_router::write_collection, request) },
              (POST) (/paths)       => { routers::write_collection_route("paths", "paths", &config, &routers::path_collection_router::write_collection, request) },
              (POST) (/nodes)       => { routers::write_collection_route("nodes", "nodes", &config, &routers::node_collection_router::write_collection, request) },
              (POST) (/node)        => { routers::write_object_route("node", "nodes", &config, &routers::node_router::write_object, request) },
              (POST) (/households)  => { routers::write_collection_route("households", "households", &config, &routers::household_collection_router::write_collection, request) },
              (POST) (/lines)       => { routers::write_collection_route("lines", "lines", &config, &routers::line_collection_router::write_collection, request) },
              (POST) (/line)        => { routers::write_object_route("line", "lines", &config, &routers::line_router::write_object, request) },
              (POST) (/odTrips)     => { routers::write_collection_route("odTrips", "odTrips", &config, &routers::od_trip_collection_router::write_collection, request) },
              (POST) (/persons)     => { routers::write_collection_route("persons", "persons", &config, &routers::person_collection_router::write_collection, request) },
              (POST) (/places)      => { routers::write_collection_route("places", "places", &config, &routers::place_collection_router::write_collection, request) },
              (POST) (/scenarios)   => { routers::write_collection_route("scenarios", "scenarios", &config, &routers::scenario_collection_router::write_collection, request) },
              (POST) (/services)    => { routers::write_collection_route("services", "services", &config, &routers::service_collection_router::write_collection, request) },
              (POST) (/zones)       => { routers::write_collection_route("zones", "zones", &config, &routers::zone_collection_router::write_collection, request) },
              (POST) (/units)       => { routers::write_collection_route("units", "units", &config, &routers::unit_collection_router::write_collection, request) },

              (GET) (/dataSources) => { routers::read_collection_route("dataSources", "dataSources", &config, &routers::data_source_collection_router::read_collection) },
              (GET) (/agencies)    => { routers::read_collection_route("agencies", "agencies", &config, &routers::agency_collection_router::read_collection) },
              (GET) (/garages)     => { routers::read_collection_route("garages", "garages", &config, &routers::garage_collection_router::read_collection) },
              (GET) (/paths)       => { routers::read_collection_route("paths", "paths", &config, &routers::path_collection_router::read_collection) },
              (GET) (/nodes)       => { routers::read_collection_route("nodes", "nodes", &config, &routers::node_collection_router::read_collection) },
              (GET) (/node)        => { routers::read_object_route("node", &object_uuid, "nodes", &config, &routers::node_router::read_object) },
              (GET) (/households)  => { routers::read_collection_route("households", "households", &config, &routers::household_collection_router::read_collection) },
              (GET) (/lines)       => { routers::read_collection_route("lines", "lines", &config, &routers::line_collection_router::read_collection) },
              (GET) (/line)        => { routers::read_object_route("line", &object_uuid, "lines", &config, &routers::line_router::read_object) },
              (GET) (/odTrips)     => { routers::read_collection_route("odTrips", "odTrips", &config, &routers::od_trip_collection_router::read_collection) },
              (GET) (/persons)     => { routers::read_collection_route("persons", "persons", &config, &routers::person_collection_router::read_collection) },
              (GET) (/places)      => { routers::read_collection_route("places", "places", &config, &routers::place_collection_router::read_collection) },
              (GET) (/scenarios)   => { routers::read_collection_route("scenarios", "scenarios", &config, &routers::scenario_collection_router::read_collection) },
              (GET) (/services)    => { routers::read_collection_route("services", "services", &config, &routers::service_collection_router::read_collection) },
              (GET) (/zones)       => { routers::read_collection_route("zones", "zones", &config, &routers::zone_collection_router::read_collection) },
              (GET) (/units)       => { routers::read_collection_route("units", "units", &config, &routers::unit_collection_router::read_collection) },

              _ => rouille::Response::empty_404()
            )
        })
    };

    rouille::start_server(format!("0.0.0.0:{}", port), handle_request);
}
