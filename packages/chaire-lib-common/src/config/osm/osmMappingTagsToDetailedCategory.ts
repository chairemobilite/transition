/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/*
Methodology:

√ 1. Separate by osm data type (node, way or relation)
√ 2. Convert relations of buildings and areas into multipolygons -> GeoJSON.MultiPolygon
3. Convert to these three categories:
    - nodes with tags (single point) -> GeoJSON.Point
    - buildings (closed ways with building tag) -> GeoJSON.Polygon
    - areas (closed ways without building tag) -> GeoJSON.Polygon
4. Parse and analyze nodes:
    4a. Get category and detailed category for each
    4b. For each node, find if inside or on the boundary of a building
        - yes, inside a building: find building entrance and snap to nearest entrance (by priority: shop -> main) -> SAVE
            - add a flag to building: has_inside_nodes = true
            - if no valid entrance found inside or on the building boundary: ERROR
        - no, continue
    4c. For each non saved node, find distance to nearest routable way (highway) (osrm nearest):
        - if 20 meters or less, snap to nearest routable way
        - if more than 20 meters: ERROR
5. Parse and analyze buildings:
    5a. Get category and detailed category for each
    5b. For each building with has_inside_nodes !== true (buildings with no saved nodes inside)
        - find main building entrance (by priority: shop -> main)
            - if more than one shop or main entrance: WARNING/ERROR, there should not be more than one shop or main entrance for a building with no nodes inside
            - if no entrance: ERROR
            - else snap to selected entrance and SAVE
    5c. For each building with has_inside_nodes === true (building with at least one saved node inside)
        - if building=commercial or building=industrial or building=retail or shop=mall and no matched tags to category or detailed category: ignore
        - else find main building entrance (by priority: shop -> main)
            - if more than one shop or main entrance: WARNING/ERROR, there should not be more than one shop or main entrance for a building
            - if no entrance: ERROR
            - else snap to selected entrance and SAVE
6. Parse and analyze areas:
    6a. Get category and detailed category for each
    6b. For each area:
        - if school/college/university: find matching building and main entrance and snap on main entrance
        - if healthcare/hospital: find matching building and main entrance and snap on main entrance
        - else if park: find pavilion building inside and main/yes entrance and snap on entrance
        - else if park without pavilion building: ignore for now (TODO: analyze access with entrances/gates/connected points and/or centroid)
        - else if playground or sport pitch: find first connection point and snap on it (TODO: analyze access with entrances/gates/connected points and/or centroid)
            - if no connection and area <= 10000 sq m: use centroid
            - else: ERROR
        - else, use the building method (5)


*/

export default {
    craft: {
        _default: 'craft'
    },
    office: {
        _default: 'office',
        medical: 'healthcare_other',
        government: 'government',
        construction: 'craft',
        graphic_design: 'craft',
        construction_company: 'craft',
        transport: 'office',
        water_utility: 'office',
        utility: 'office'
    },
    highway: {
        _default: null
    },
    shop: {
        _default: 'shop_other',
        bakery: 'shop_food',
        pastry: 'shop_food',
        coffee: 'shop_food',
        farm: 'shop_food',
        ice_cream: 'shop_food',
        mall: null,
        beauty: 'service_beauty',
        massage: 'service_beauty',
        funeral_directors: 'service_funeral',
        supermarket: 'shop_supermarket',
        grocery: 'shop_food',
        food: 'shop_food',
        butcher: 'shop_food',
        laundry: 'service_other',
        convenience: 'shop_convenience',
        car: 'shop_car',
        bicycle: 'shop_bicycle',
        car_repair: 'service_car_repair',
        clothes: 'shop_clothes',
        shoes: 'shop_clothes',
        hairdresser: 'service_hairdresser',
        department_store: 'shop_department_store',
        doityourself: 'shop_hardware',
        copyshop: 'service_other',
        dry_cleaning: 'service_other',
        tattoo: 'service_other',
        car_parts: 'service_car_repair',
        pest_control: 'service_other',
        greengrocer: 'shop_food',
        travel_agency: 'service_other',
        hardware: 'shop_hardware',
        garden_furniture: 'shop_hardware',
        beverages: 'shop_food',
        kitchen: 'shop_food',
        chocolate: 'shop_food',
        swimming_pool: 'shop_hardware',
        rental: 'service_other',
        locksmith: 'service_other',
        health_food: 'shop_food',
        money_lender: 'service_other',
        garden_centre: 'shop_hardware',
        storage_rental: 'service_storage',
        tea: 'shop_food',
        tailor: 'service_other'
    },
    tourism: {
        _default: 'tourism_tourism',
        apartment: 'tourism_rental',
        camp_site: 'tourism_camping',
        caravan_site: 'tourism_camping',
        camp_pitch: 'tourism_camping',
        guest_house: 'tourism_rental',
        chalet: 'tourism_rental',
        hostel: 'hotel',
        hotel: 'hotel',
        motel: 'hotel',
        picnic_site: 'leisure_park',
        artwork: 'leisure_art',
        viewpoint: 'leisure_other',
        wilderness_hut: 'tourism_rental'
    },
    healthcare: {
        _default: 'healthcare_other',
        pharmacy: 'shop_pharmacy',
        hospital: 'healthcare_hospital',
        dentist: 'healthcare_dentist',
        alternative: 'healthcare_alternative'
    },
    school: {
        primary: 'school_primary',
        secondary: 'school_secondary',
        _default: 'school_other'
    },
    amenity: {
        _default: null,
        bar: 'restaurant_bar',
        bbq: 'leisure_other',
        biergarten: 'restaurant_bar',
        cafe: 'restaurant_cafe',
        fast_food: 'restaurant_fast_food',
        food_court: 'restaurant_fast_food',
        ice_cream: 'restaurant_fast_food',
        pub: 'restaurant_bar',
        restaurant: 'restaurant_restaurant',
        college: 'school_college', // landuse, find main entrance on buildings
        university: 'school_university', // landuse, find main entrance on buildings
        driving_school: 'school_other',
        kindergarten: 'school_kindergarten',
        language_school: 'school_other',
        library: 'leisure_library',
        toy_library: 'leisure_library',
        music_school: 'school_other',
        bicycle_rental: 'service_rental',
        boat_rental: 'service_rental',
        boat_sharing: 'service_rental',
        bus_station: 'transit_bus_station',
        car_rental: 'service_rental',
        helicopter_rental: 'service_rental',
        car_sharing: 'service_rental',
        car_wash: 'service_car_wash',
        vehicle_inspection: 'service_other',
        ferry_terminal: 'transit_ferry_terminal',
        fuel: 'service_fuel',
        taxi: 'transport',
        atm: 'service_atm',
        bank: 'service_bank',
        bureau_de_change: 'service_bank',
        baby_hatch: 'healthcare_other',
        clinic: 'healthcare_clinic',
        dentist: 'healthcare_dentist',
        doctors: 'healthcare_clinic',
        hospital: 'healthcare_hospital', // landuse, find main entrance on buildings
        nursing_home: 'healthcare_other',
        pharmacy: 'shop_pharmacy',
        social_facility: 'social',
        veterinary: 'service_veterinary',
        arts_centre: 'leisure_art',
        brothel: 'leisure_adult',
        casino: 'leisure_adult',
        stripclub: 'leisure_adult',
        swingerclub: 'leisure_adult',
        cinema: 'leisure_cinema',
        community_centre: 'social',
        fountain: 'leisure_other',
        gambling: 'leisure_adult',
        nightclub: 'leisure_adult',
        love_hotel: 'leisure_adult',
        planetarium: 'leisure_other',
        public_bookcase: 'leisure_other',
        social_centre: 'social',
        studio: 'service_other',
        theatre: 'leisure_art',
        animal_boarding: 'leisure_other',
        animal_shelter: 'service_other',
        animal_training: 'service_other',
        baking_oven: 'service_other',
        childcare: 'school_kindergarten',
        conference_center: 'conference_center',
        events_venue: 'conference_center',
        courthouse: 'government',
        crematorium: 'service_funeral',
        dive_centre: 'leisure_swimming',
        embassy: 'government',
        fire_station: 'fire_station',
        grave_yard: 'religion',
        gym: 'leisure_gym',
        hunting_stand: null,
        internet_cafe: 'restaurant_cafe',
        kitchen: 'service_other',
        kneipp_water_cure: 'healthcare_alternative',
        marketplace: 'shop_food',
        monastery: 'religion',
        photo_booth: 'service_other',
        place_of_worship: 'religion',
        police: 'police_station',
        post_depot: 'service_postal',
        post_office: 'service_postal',
        prison: 'prison',
        public_bath: 'leisure_swimming',
        public_building: 'public',
        ranger_station: 'service_other',
        recycling: 'utility',
        sanitary_dump_station: 'utility',
        sauna: 'leisure_other',
        townhall: 'government',
        waste_disposal: 'utility',
        waste_transfer_station: 'utility',
        water_point: 'utility',
        mobile_money_agent: 'service_bank',
        swimming_pool: 'leisure_swimming',
        loading_dock: 'service_other',
        compressed_air: 'service_other',
        dojo: 'leisure_gym',
        animal_breeding: 'service_other',
        boat_storage: 'service_rental',
        game_feeding: 'leisure_other',
        lavoir: 'service_other',
        training: 'school_other',
        weighbridge: 'service_other',
        shop: 'shop_other',
        office: 'office',
        coworking_space: 'office',
        prep_school: 'school_other',
        stables: 'farm',
        reception_desk: 'service_other',
        mortuary: 'service_funeral',
        garages: 'utility',
        register_office: 'government',
        public_hall: 'public',
        research_institute: 'school_research',
        payment_centre: 'service_bank',
        camping: 'tourism_camping',
        customs: 'government',
        refugee_housing: 'social',
        spa: 'leisure_other',
        retirement_home: 'social',
        hookah_lounge: 'leisure_other',
        sanatorium: 'leisure_other',
        karaoke_box: 'leisure_other',
        workshop: 'service_other',
        social_club: 'social',
        polling_station: 'government',
        club: 'social',
        community_hall: 'social',
        public_service: 'public',
        dancing_school: 'school_other',
        music_venue: 'leisure_art',
        ski_school: 'school_other',
        temple: 'religion',
        funeral_home: 'service_funeral',
        ski_rental: 'service_rental',
        canteen: 'restaurant_fast_food',
        dressing_room: 'service_other',
        storage: 'service_storage',
        exhibition_centre: 'leisure_art',
        auditorium: 'leisure_art',
        concert_hall: 'leisure_art',
        greenhouse: 'farm',
        nursery: 'school_kindergarten',
        public_facility: 'public',
        healthcare: 'healthcare_other',
        luggage_locker: 'service_other',
        administration: 'government',
        border_control: 'government',
        market: 'shop_other',
        health_facility: 'healthcare_other',
        harbourmaster: 'service_other',
        scrapyard: 'service_car_repair',
        education: 'school_other',
        coast_guard: 'service_other',
        hospice: 'healthcare_other',
        warehouse: 'service_other',
        church: 'religion',
        self_storage: 'service_storage',
        youth_centre: 'social',
        archive: 'service_other',
        piano: 'leisure_art',
        financial_advice: 'service_bank',
        industrial: 'industrial',
        health_centre: 'healthcare_other',
        care_home: 'healthcare_other',
        community_center: 'social',
        car_repair: 'service_car_repair',
        public_office: 'government',
        garden: 'leisure_other',
        service: 'service_other',
        art_school: 'school_other',
        recreation_ground: 'leisure_playground'
    },
    building: {
        _default: null,
        hotel: 'hotel',
        commercial: 'shop_other', // only if nothing else inside
        kiosk: 'shop_other',
        office: 'office', // only if nothing else inside
        supermarket: 'shop_supermarket',
        warehouse: 'service_other', // only if nothing else inside
        cathedral: 'religion',
        chapel: 'religion',
        church: 'religion',
        mosque: 'religion',
        religious: 'religion',
        shrine: 'religion',
        temple: 'religion',
        synagogue: 'religion',
        bakehouse: 'service_other',
        civic: 'public',
        fire_station: 'fire_station',
        government: 'government',
        hospital: 'healthcare_hospital',
        public: 'public',
        toilets: null,
        train_station: 'transit_train_station',
        transportation: 'transport',
        barn: 'farm',
        conservatory: 'leisure_other',
        cowshed: 'farm',
        farm_auxiliary: 'farm',
        greenhouse: 'farm',
        stable: 'farm',
        sty: 'farm',
        grandstand: 'leisure_art',
        pavilion: 'leisure_park',
        riding_hall: 'leisure_sports',
        sports_hall: 'leisure_sports',
        stadium: 'leisure_sports',
        hangar: 'transport',
        garages: 'utility',
        service: 'utility',
        transformer_tower: 'utility',
        water_tower: 'utility',
        bunker: 'utility'
    },
    camping: {
        _default: null,
        reception: 'tourism_camping'
    },
    industrial: {
        _default: 'industrial',
        depot: 'utility',
        transport: 'transport'
    },
    emergency: {
        _default: null,
        ambulance_station: 'healthcare_other',
        lifeguard_base: 'healthcare_other'
    },
    telecom: {
        _default: null,
        data_center: 'industrial'
    },
    waterway: {
        _default: null,
        dock: 'utility',
        boatyard: 'service_other',
        fuel: 'service_fuel'
    },
    historic: {
        _default: 'tourism_tourism',
        wayside_chapel: 'religion',
        church: 'religion',
        monastery: 'religion',
        wayside_shrine: null,
        wayside_cross: null,
        boundary_stone: null
    },
    leisure: {
        _default: 'leisure_other',
        picnic_table: null,
        bleachers: null,
        common: 'leisure_other',
        slipway: 'leisure_other',
        playground: 'leisure_playground',
        swimming_pool: 'leisure_swimming',
        sports_centre: 'leisure_sports',
        fitness_centre: 'leisure_gym',
        ice_rink: 'leisure_sports',
        pitch: 'leisure_sports',
        park: 'leisure_park',
        dance: 'leisure_other',
        golf_course: 'leisure_golf',
        miniature_golf: 'leisure_sports',
        water_park: 'leisure_swimming',
        splash_pad: 'leisure_swimming',
        garden: 'leisure_other',
        amusement_arcade: 'leisure_other',
        stadium: 'leisure_sports',
        escape_game: 'leisure_other',
        track: 'leisure_sports',
        dog_park: 'leisure_park',
        marina: 'leisure_other',
        fitness_station: 'leisure_sports',
        paddling_pool: 'leisure_swimming',
        horse_riding: 'leisure_sports',
        recreation_ground: 'leisure_playground'
    },
    club: {
        sport: 'leisure_sports',
        shooting: 'leisure_sports',
        social: 'social'
    },
    man_made: {
        _default: null,
        lighthouse: 'utility',
        observatory: 'service_other',
        pumping_station: 'utility',
        telescope: 'service_other',
        watermill: 'utility',
        wastewater_plant: 'utility',
        water_works: 'utility',
        windmill: 'utility',
        works: 'industrial',
        monitoring_station: 'utility',
        communications_tower: 'utility',
        obelisk: 'tourism_tourism',
        petroleum_well: 'utility'
    },
    military: {
        _default: null,
        barracks: 'military',
        office: 'military',
        airfield: 'military',
        bunker: 'military',
        checkpoint: 'military',
        naval_base: 'military',
        obstacle_course: 'military',
        range: 'military',
        training_area: 'military'
    },
    power: {
        _default: null,
        plant: 'utility',
        substation: 'utility'
    },
    public_transport: {
        _default: null,
        station: 'transit_station'
    },
    railway: {
        _default: null,
        station: 'transit_train_station',
        roundhouse: 'utility',
        wash: 'utility',
        vehicle_depot: 'utility'
    },
    landuse: {
        _default: null,
        cemetery: 'religion',
        quarry: 'quarry',
        recreation_ground: 'leisure_playground',
        winter_sports: 'leisure_sports',
        landfill: 'landfill',
        depot: 'utility'
    },
    golf: {
        _default: null,
        clubhouse: 'leisure_golf'
    }
} as { [key: string]: { [key: string]: string | null } };
