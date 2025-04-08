/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::dataSource_capnp::data_source::Type as DataSourceType;
use crate::odTrip_capnp::od_trip::{Activity, Mode};

pub fn data_source_type(input: &str) -> DataSourceType {
    match input {
        "none"                                  => DataSourceType::None,
        "other"                                 => DataSourceType::Other,
        "gtfs"                                  => DataSourceType::Gtfs,
        "odTrips"                               => DataSourceType::OdTrips,
        "transitSmartCardData"                  => DataSourceType::TransitSmartCardData,
        "transitOperationalData"                => DataSourceType::TransitOperationalData,
        "taxiTransactions"                      => DataSourceType::TaxiTransactions,
        "carSharingTransactions"                => DataSourceType::CarSharingTransactions,
        "bikeSharingTransactions"               => DataSourceType::BikeSharingTransactions,
        "gpsTraces"                             => DataSourceType::GpsTraces,
        "streetSegmentSpeeds"                   => DataSourceType::StreetSegmentSpeeds,
        "zones"                                 => DataSourceType::Zones,
        "osmData"                               => DataSourceType::OsmData,
        "places"                                => DataSourceType::Places,
        "unknown"                               => DataSourceType::Unknown,
        _                                       => DataSourceType::None
    }
}

pub fn data_source_type_to_str(input: &DataSourceType) -> &str {
    match input {
        DataSourceType::None                    => "none",
        DataSourceType::Other                   => "other",
        DataSourceType::Gtfs                    => "gtfs",
        DataSourceType::OdTrips                 => "odTrips",
        DataSourceType::TransitSmartCardData    => "transitSmartCardData",
        DataSourceType::TransitOperationalData  => "transitOperationalData",
        DataSourceType::TaxiTransactions        => "taxiTransactions",
        DataSourceType::CarSharingTransactions  => "carSharingTransactions",
        DataSourceType::BikeSharingTransactions => "bikeSharingTransactions",
        DataSourceType::GpsTraces               => "gpsTraces",
        DataSourceType::StreetSegmentSpeeds     => "streetSegmentSpeeds",
        DataSourceType::Zones                   => "zones",
        DataSourceType::OsmData                 => "osmData",
        DataSourceType::Places                  => "places",
        DataSourceType::Unknown                 => "unknown"
    }
}

pub fn mode(input: &str) -> Mode {
    match input {
        "none"                                  => Mode::None,
        "walking"                               => Mode::Walking,
        "cycling"                               => Mode::Cycling,
        "carDriver"                             => Mode::CarDriver,
        "carPassenger"                          => Mode::CarPassenger,
        "motorcycle"                            => Mode::Motorcycle,
        "transit"                               => Mode::Transit,
        "paratransit"                           => Mode::Paratransit,
        "taxi"                                  => Mode::Taxi,
        "schoolBus"                             => Mode::SchoolBus,
        "otherBus"                              => Mode::OtherBus,
        "intercityBus"                          => Mode::IntercityBus,
        "intercityTrain"                        => Mode::IntercityTrain,
        "plane"                                 => Mode::Plane,
        "ferry"                                 => Mode::Ferry,
        "parkAndRide"                           => Mode::ParkAndRide,
        "kissAndRide"                           => Mode::KissAndRide,
        "bikeAndRide"                           => Mode::BikeAndRide,
        "multimodalOther"                       => Mode::MultimodalOther,
        "other"                                 => Mode::Other,
        "unknown"                               => Mode::Unknown,
        _                                       => Mode::None
    }
}

pub fn mode_to_str(input: &Mode) -> &str {
    match input {
        Mode::None                              => "none",
        Mode::Walking                           => "walking",
        Mode::Cycling                           => "cycling",
        Mode::CarDriver                         => "carDriver",
        Mode::CarPassenger                      => "carPassenger",
        Mode::Motorcycle                        => "motorcycle",
        Mode::Transit                           => "transit",
        Mode::Paratransit                       => "paratransit",
        Mode::Taxi                              => "taxi",
        Mode::SchoolBus                         => "schoolBus",
        Mode::OtherBus                          => "otherBus",
        Mode::IntercityBus                      => "intercityBus",
        Mode::IntercityTrain                    => "intercityTrain",
        Mode::Plane                             => "plane",
        Mode::Ferry                             => "ferry",
        Mode::ParkAndRide                       => "parkAndRide",
        Mode::KissAndRide                       => "kissAndRide",
        Mode::BikeAndRide                       => "bikeAndRide",
        Mode::MultimodalOther                   => "multimodalOther",
        Mode::Other                             => "other",
        Mode::Unknown                           => "unknown"
    }
}

pub fn activity(input: &str) -> Activity {
    match input {
        "none"                                  => Activity::None,
        "home"                                  => Activity::Home,
        "workUsual"                             => Activity::WorkUsual,
        "workNonUsual"                          => Activity::WorkNonUsual,
        "schoolUsual"                           => Activity::SchoolUsual,
        "schoolNonUsual"                        => Activity::SchoolNonUsual,
        "shopping"                              => Activity::Shopping,
        "leisure"                               => Activity::Leisure,
        "service"                               => Activity::Service,
        "secondaryHome"                         => Activity::SecondaryHome,
        "visitingFriends"                       => Activity::VisitingFriends,
        "dropSomeone"                           => Activity::DropSomeone,
        "fetchSomeone"                          => Activity::FetchSomeone,
        "restaurant"                            => Activity::Restaurant,
        "medical"                               => Activity::Medical,
        "worship"                               => Activity::Worship,
        "onTheRoad"                             => Activity::OnTheRoad,
        "other"                                 => Activity::Other,
        "unknown"                               => Activity::Unknown,
        _                                       => Activity::None
    }
}

pub fn activity_to_str(input: &Activity) -> &str {
    match input {
        Activity::None                          => "none",
        Activity::Home                          => "home",
        Activity::WorkUsual                     => "workUsual",
        Activity::WorkNonUsual                  => "workNonUsual",
        Activity::SchoolUsual                   => "schoolUsual",
        Activity::SchoolNonUsual                => "schoolNonUsual",
        Activity::Shopping                      => "shopping",
        Activity::Leisure                       => "leisure",
        Activity::Service                       => "service",
        Activity::SecondaryHome                 => "secondaryHome",
        Activity::VisitingFriends               => "visitingFriends",
        Activity::DropSomeone                   => "dropSomeone",
        Activity::FetchSomeone                  => "fetchSomeone",
        Activity::Restaurant                    => "restaurant",
        Activity::Medical                       => "medical",
        Activity::Worship                       => "worship",
        Activity::OnTheRoad                     => "onTheRoad",
        Activity::Other                         => "other",
        Activity::Unknown                       => "unknown"
    }
}
