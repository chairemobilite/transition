/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

#[cfg(test)]
mod tests {

    use crate::routers;
    use std::path::{Path};
    use std::fs;
    use rouille::Request;
    use pretty_assertions::{assert_eq};

    #[test]
    fn od_trip_collections() {

        let config: serde_json::Value = json!({
            "project_cache_directory_path": fs::canonicalize(Path::new("test")).unwrap(),
            "project_shortname"           : "test",
            "data_source_uuid"            : "1234-5678"
        });

        let data = r##"
            {
                "data_source_uuid": "1234-5678",
                "odTrips": [
                    {
                        "id": "1234-1234",
                        "integer_id": 23,
                        "is_frozen": true,
                        "internal_id": "h21",
                        "data_source_id": "4567-8910",
                        "person_id": "123-456",
                        "household_id": "8910-4567",
                        "departure_time_seconds": 54412,
                        "arrival_time_seconds": 54612,
                        "origin_activity": "workUsual",
                        "destination_activity": "home",
                        "mode": "transit",
                        "expansion_factor": 23.1,
                        "walking_travel_time_seconds": 2345,
                        "cycling_travel_time_seconds": 1234,
                        "driving_travel_time_seconds": 988,
                        "origin_geography": {
                            "type": "Point",
                            "coordinates": [-73.45, 45.47]
                        },
                        "destination_geography": {
                            "type": "Point",
                            "coordinates": [-73.100115, 45.102445]
                        },
                        "data": {
                            "foo": "bar",
                            "originNodes": ["abc", "def", "efg"],
                            "originNodesTravelTimes": [234, 567, 8910],
                            "originNodesDistances": [1243, 3453, 9455],
                            "destinationNodes": ["bbc", "eef", "ffg"],
                            "destinationNodesTravelTimes": [891, 781, 681],
                            "destinationNodesDistances": [466, 566, 666]
                        }
                    },
                    {
                        "integer_id": 24,
                        "id": "2345-2345",
                        "is_frozen": null,
                        "origin_geography": {
                            "type": "Point",
                            "coordinates": [-73.20, 45.20]
                        },
                        "destination_geography": {
                            "type": "Point",
                            "coordinates": [-73, 46]
                        }
                    }
                ]
            }
            "##;

            let compare_data = r##"
            {
                "odTrips": [
                    {
                        "id": "1234-1234",
                        "integer_id": 23,
                        "is_frozen": true,
                        "internal_id": "h21",
                        "data_source_id": "4567-8910",
                        "person_id": "123-456",
                        "household_id": "8910-4567",
                        "departure_time_seconds": 54412,
                        "arrival_time_seconds": 54612,
                        "origin_activity": "workUsual",
                        "destination_activity": "home",
                        "mode": "transit",
                        "expansion_factor": 23.1,
                        "walking_travel_time_seconds": 2345,
                        "cycling_travel_time_seconds": 1234,
                        "driving_travel_time_seconds": 988,
                        "origin_geography": {
                            "type": "Point",
                            "coordinates": [-73.45, 45.47]
                        },
                        "destination_geography": {
                            "type": "Point",
                            "coordinates": [-73.100115, 45.102445]
                        },
                        "data": {
                            "foo": "bar",
                            "originNodes": ["abc", "def", "efg"],
                            "originNodesTravelTimes": [234, 567, 8910],
                            "originNodesDistances": [1243, 3453, 9455],
                            "destinationNodes": ["bbc", "eef", "ffg"],
                            "destinationNodesTravelTimes": [891, 781, 681],
                            "destinationNodesDistances": [466, 566, 666]
                        }
                    },
                    {
                        "id": "2345-2345",
                        "is_frozen": null,
                        "internal_id": null,
                        "integer_id": 24,
                        "data_source_id": null,
                        "data": {},
                        "person_id": null,
                        "household_id": null,
                        "departure_time_seconds": null,
                        "arrival_time_seconds": null,
                        "origin_activity": "none",
                        "destination_activity": "none",
                        "mode": "none",
                        "expansion_factor": null,
                        "walking_travel_time_seconds": null,
                        "cycling_travel_time_seconds": null,
                        "driving_travel_time_seconds": null,
                        "origin_geography": {
                            "type": "Point",
                            "coordinates": [-73.20, 45.20]
                        },
                        "destination_geography": {
                            "type": "Point",
                            "coordinates": [-73.0, 46.0]
                        }

                    }
                ]
            }
            "##;
        
        let json_compare_data : serde_json::Value = serde_json::from_str(compare_data).unwrap();
        
        let request = Request::fake_http(
            "POST",
            "/odTrips",
            vec![(
                "Content-Type".to_owned(),
                "application/json; charset=utf-8".to_owned(),
            )],
            data.as_bytes().to_vec(),
        );

        let response = routers::write_collection_route(
            "odTrips",
            "odTrips",
            &config,
            &transition_capnp_data::serialization::od_trip_collection::write_collection,
            &request,
        );

        assert_eq!(response.status_code, 200);

        let response = routers::read_collection_route(
            "odTrips",
            "odTrips",
            &config,
            &transition_capnp_data::serialization::od_trip_collection::read_collection,
        );

        let (mut res_data, _) = response.data.into_reader_and_size();
        let mut buffer = String::new();
        res_data.read_to_string(&mut buffer).unwrap();
        let json_response : serde_json::Value = serde_json::from_str(buffer.as_str()).unwrap();

        assert_eq!(response.status_code, 200);
        assert_eq!(json_response["data"]["odTrips"], json_compare_data["odTrips"]);

    }
}
