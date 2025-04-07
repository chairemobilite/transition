/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use crate::dataSource_capnp::data_source::Type as DataSourceType;
use crate::household_capnp::household::{
    Category as HouseholdCategory, IncomeLevelGroup as HouseholdIncomeLevelGroup,
};
use crate::odTrip_capnp::od_trip::{Activity, Mode};
use crate::person_capnp::person::{AgeGroup, Gender, Occupation};

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

pub fn household_income_level_group(input: &str) -> HouseholdIncomeLevelGroup {
    match input {
        "none"                                  => HouseholdIncomeLevelGroup::None,
        "veryLow"                               => HouseholdIncomeLevelGroup::VeryLow,
        "low"                                   => HouseholdIncomeLevelGroup::Low,
        "medium"                                => HouseholdIncomeLevelGroup::Medium,
        "high"                                  => HouseholdIncomeLevelGroup::High,
        "veryHigh"                              => HouseholdIncomeLevelGroup::VeryHigh,
        "unknown"                               => HouseholdIncomeLevelGroup::Unknown,
        _                                       => HouseholdIncomeLevelGroup::None
    }
}

pub fn household_income_level_group_to_str(input: &HouseholdIncomeLevelGroup) -> &str {
    match input {
        HouseholdIncomeLevelGroup::None         => "none",
        HouseholdIncomeLevelGroup::VeryLow      => "veryLow",
        HouseholdIncomeLevelGroup::Low          => "low",
        HouseholdIncomeLevelGroup::Medium       => "medium",
        HouseholdIncomeLevelGroup::High         => "high",
        HouseholdIncomeLevelGroup::VeryHigh     => "veryHigh",
        HouseholdIncomeLevelGroup::Unknown      => "unknown"
    }
}

pub fn household_category(input: &str) -> HouseholdCategory {
    match input {
        "none"                                  => HouseholdCategory::None,
        "singlePerson"                          => HouseholdCategory::SinglePerson,
        "couple"                                => HouseholdCategory::Couple,
        "monoparentalFamily"                    => HouseholdCategory::MonoparentalFamily,
        "biparentalFamily"                      => HouseholdCategory::BiparentalFamily,
        "unknown"                               => HouseholdCategory::Unknown,
        "other"                                 => HouseholdCategory::Other,
        _                                       => HouseholdCategory::None
    }
}

pub fn household_category_to_str(input: &HouseholdCategory) -> &str {
    match input {
        HouseholdCategory::None                 => "none",
        HouseholdCategory::SinglePerson         => "singlePerson",
        HouseholdCategory::Couple               => "couple",
        HouseholdCategory::MonoparentalFamily   => "monoparentalFamily",
        HouseholdCategory::BiparentalFamily     => "biparentalFamily",
        HouseholdCategory::Unknown              => "unknown",
        HouseholdCategory::Other                => "other"
    }
}

pub fn occupation(input: &str) -> Occupation {
    match input {
        "none"                                  => Occupation::None,
        "fullTimeWorker"                        => Occupation::FullTimeWorker,
        "partTimeWorker"                        => Occupation::PartTimeWorker,
        "fullTimeStudent"                       => Occupation::FullTimeStudent,
        "partTimeStudent"                       => Occupation::PartTimeStudent,
        "workerAndStudent"                      => Occupation::WorkerAndStudent,
        "retired"                               => Occupation::Retired,
        "atHome"                                => Occupation::AtHome,
        "other"                                 => Occupation::Other,
        "nonApplicable"                         => Occupation::NonApplicable,
        "unknown"                               => Occupation::Unknown,
        _                                       => Occupation::None
    }
}

pub fn occupation_to_str(input: &Occupation) -> &str {
    match input {
        Occupation::None                        => "none",
        Occupation::FullTimeWorker              => "fullTimeWorker",
        Occupation::PartTimeWorker              => "partTimeWorker",
        Occupation::FullTimeStudent             => "fullTimeStudent",
        Occupation::PartTimeStudent             => "partTimeStudent",
        Occupation::WorkerAndStudent            => "workerAndStudent",
        Occupation::Retired                     => "retired",
        Occupation::AtHome                      => "atHome",
        Occupation::Other                       => "other",
        Occupation::NonApplicable               => "nonApplicable",
        Occupation::Unknown                     => "unknown"
    }
}

pub fn gender(input: &str) -> Gender {
    match input {
        "none"                                  => Gender::None,
        "female"                                => Gender::Female,
        "male"                                  => Gender::Male,
        "custom"                                => Gender::Custom,
        "unknown"                               => Gender::Unknown,
        _                                       => Gender::None
    }
}

pub fn gender_to_str(input: &Gender) -> &str {
    match input {
        Gender::None                            => "none",
        Gender::Female                          => "female",
        Gender::Male                            => "male",
        Gender::Custom                          => "custom",
        Gender::Unknown                         => "unknown"
    }
}

pub fn age_group(input: &str) -> AgeGroup {
    match input {
        "none"                                  => AgeGroup::None,
        "ag0004"                                => AgeGroup::Ag0004,
        "ag0509"                                => AgeGroup::Ag0509,
        "ag1014"                                => AgeGroup::Ag1014,
        "ag1519"                                => AgeGroup::Ag1519,
        "ag2024"                                => AgeGroup::Ag2024,
        "ag2529"                                => AgeGroup::Ag2529,
        "ag3034"                                => AgeGroup::Ag3034,
        "ag3539"                                => AgeGroup::Ag3539,
        "ag4044"                                => AgeGroup::Ag4044,
        "ag4549"                                => AgeGroup::Ag4549,
        "ag5054"                                => AgeGroup::Ag5054,
        "ag5559"                                => AgeGroup::Ag5559,
        "ag6064"                                => AgeGroup::Ag6064,
        "ag6569"                                => AgeGroup::Ag6569,
        "ag7074"                                => AgeGroup::Ag7074,
        "ag7579"                                => AgeGroup::Ag7579,
        "ag8084"                                => AgeGroup::Ag8084,
        "ag8589"                                => AgeGroup::Ag8589,
        "ag9094"                                => AgeGroup::Ag9094,
        "ag95plus"                              => AgeGroup::Ag95plus,
        "unknown"                               => AgeGroup::Unknown,
        _                                       => AgeGroup::None
    }
}

pub fn age_group_to_str(input: &AgeGroup) -> &str {
    match input {
        AgeGroup::None                          => "none",
        AgeGroup::Ag0004                        => "ag0004",
        AgeGroup::Ag0509                        => "ag0509",
        AgeGroup::Ag1014                        => "ag1014",
        AgeGroup::Ag1519                        => "ag1519",
        AgeGroup::Ag2024                        => "ag2024",
        AgeGroup::Ag2529                        => "ag2529",
        AgeGroup::Ag3034                        => "ag3034",
        AgeGroup::Ag3539                        => "ag3539",
        AgeGroup::Ag4044                        => "ag4044",
        AgeGroup::Ag4549                        => "ag4549",
        AgeGroup::Ag5054                        => "ag5054",
        AgeGroup::Ag5559                        => "ag5559",
        AgeGroup::Ag6064                        => "ag6064",
        AgeGroup::Ag6569                        => "ag6569",
        AgeGroup::Ag7074                        => "ag7074",
        AgeGroup::Ag7579                        => "ag7579",
        AgeGroup::Ag8084                        => "ag8084",
        AgeGroup::Ag8589                        => "ag8589",
        AgeGroup::Ag9094                        => "ag9094",
        AgeGroup::Ag95plus                      => "ag95plus",
        AgeGroup::Unknown                       => "unknown",
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
