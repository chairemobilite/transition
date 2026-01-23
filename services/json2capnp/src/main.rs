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

// Switch memory allocator to jemalloc on Linux x86_64
// The default allocator was keeping too much memory around between requests.
#[cfg(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu"))]
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

#[macro_use]
extern crate rouille;

#[macro_use]
extern crate serde_json;

mod routers;
use transition_capnp_data;

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

              (POST) (/dataSources) => { routers::write_collection_route("dataSources", "dataSources", &config, &transition_capnp_data::serialization::data_source_collection::write_collection, request) },
              (POST) (/agencies)    => { routers::write_collection_route("agencies", "agencies", &config, &transition_capnp_data::serialization::agency_collection::write_collection, request) },
              (POST) (/paths)       => { routers::write_collection_route("paths", "paths", &config, &transition_capnp_data::serialization::path_collection::write_collection, request) },
              (POST) (/nodes)       => { routers::write_collection_route("nodes", "nodes", &config, &transition_capnp_data::serialization::node_collection::write_collection, request) },
              (POST) (/node)        => { routers::write_object_route("node", "nodes", &config, &transition_capnp_data::serialization::node::write_object, request) },
              (POST) (/lines)       => { routers::write_collection_route("lines", "lines", &config, &transition_capnp_data::serialization::line_collection::write_collection, request) },
              (POST) (/line)        => { routers::write_object_route("line", "lines", &config, &transition_capnp_data::serialization::line::write_object, request) },
              (POST) (/odTrips)     => { routers::write_collection_route("odTrips", "odTrips", &config, &transition_capnp_data::serialization::od_trip_collection::write_collection, request) },
              (POST) (/places)      => { routers::write_collection_route("places", "places", &config, &transition_capnp_data::serialization::place_collection::write_collection, request) },
              (POST) (/scenarios)   => { routers::write_collection_route("scenarios", "scenarios", &config, &transition_capnp_data::serialization::scenario_collection::write_collection, request) },
              (POST) (/services)    => { routers::write_collection_route("services", "services", &config, &transition_capnp_data::serialization::service_collection::write_collection, request) },

              (GET) (/dataSources) => { routers::read_collection_route("dataSources", "dataSources", &config, &transition_capnp_data::serialization::data_source_collection::read_collection) },
              (GET) (/agencies)    => { routers::read_collection_route("agencies", "agencies", &config, &transition_capnp_data::serialization::agency_collection::read_collection) },
              (GET) (/paths)       => { routers::read_collection_route("paths", "paths", &config, &transition_capnp_data::serialization::path_collection::read_collection) },
              (GET) (/nodes)       => { routers::read_collection_route("nodes", "nodes", &config, &transition_capnp_data::serialization::node_collection::read_collection) },
              (GET) (/node)        => { routers::read_object_route("node", &object_uuid, "nodes", &config, &transition_capnp_data::serialization::node::read_object) },
              (GET) (/lines)       => { routers::read_collection_route("lines", "lines", &config, &transition_capnp_data::serialization::line_collection::read_collection) },
              (GET) (/line)        => { routers::read_object_route("line", &object_uuid, "lines", &config, &transition_capnp_data::serialization::line::read_object) },
              (GET) (/odTrips)     => { routers::read_collection_route("odTrips", "odTrips", &config, &transition_capnp_data::serialization::od_trip_collection::read_collection) },
              (GET) (/places)      => { routers::read_collection_route("places", "places", &config, &transition_capnp_data::serialization::place_collection::read_collection) },
              (GET) (/scenarios)   => { routers::read_collection_route("scenarios", "scenarios", &config, &transition_capnp_data::serialization::scenario_collection::read_collection) },
              (GET) (/services)    => { routers::read_collection_route("services", "services", &config, &transition_capnp_data::serialization::service_collection::read_collection) },

              _ => rouille::Response::empty_404()
            )
        })
    };

    rouille::start_server(format!("0.0.0.0:{}", port), handle_request);
}
