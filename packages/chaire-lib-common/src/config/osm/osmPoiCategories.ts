/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import educationCollegeUniversity from './osmPoiWeightCategories/educationCollegeUniversity';
import educationKindergarten from './osmPoiWeightCategories/educationKindergarten';
import educationOtherSchool from './osmPoiWeightCategories/educationOtherSchool';
import educationSchool from './osmPoiWeightCategories/educationSchool';
import emergencyPoliceStation from './osmPoiWeightCategories/emergencyPoliceStation';
import emergencyFireStation from './osmPoiWeightCategories/emergencyFireStation';
import emergencyAmbulanceStation from './osmPoiWeightCategories/emergencyAmbulanceStation';
import farm from './osmPoiWeightCategories/farm';
import funeral from './osmPoiWeightCategories/funeral';
import hairdresserBeautyShop from './osmPoiWeightCategories/hairdresserBeautyShop';
import healthcareClinicHighVolume from './osmPoiWeightCategories/healthcareClinicHighVolume';
import healthcareClinicLowVolume from './osmPoiWeightCategories/healthcareClinicLowVolume';
import healthcareHospital from './osmPoiWeightCategories/healthcareHospital';
import industrial from './osmPoiWeightCategories/industrial';
import industrialCraft from './osmPoiWeightCategories/industrialCraft';
import industrialDepot from './osmPoiWeightCategories/industrialDepot';
import industrialLogistics from './osmPoiWeightCategories/industrialLogistics';
import industrialQuarry from './osmPoiWeightCategories/industrialQuarry';
import industrialRecyclingCenter from './osmPoiWeightCategories/industrialRecyclingCenter';
import leisureAquarium from './osmPoiWeightCategories/leisureAquarium';
import leisureBar from './osmPoiWeightCategories/leisureBar';
import leisureCamping from './osmPoiWeightCategories/leisureCamping';
import leisureCommunityCenter from './osmPoiWeightCategories/leisureCommunityCenter';
import leisureDogPark from './osmPoiWeightCategories/leisureDogPark';
import leisureFitnessCenter from './osmPoiWeightCategories/leisureFitnessCenter';
import leisureGolf from './osmPoiWeightCategories/leisureGolf';
import leisureHotel from './osmPoiWeightCategories/leisureHotel';
import leisureHorseRiding from './osmPoiWeightCategories/leisureHorseRiding';
import leisureLibrary from './osmPoiWeightCategories/leisureLibrary';
import leisureMarina from './osmPoiWeightCategories/leisureMarina';
import leisureMuseum from './osmPoiWeightCategories/leisureMuseum';
import leisurePark from './osmPoiWeightCategories/leisurePark';
import leisureParkPavilion from './osmPoiWeightCategories/leisureParkPavilion';
import leisureParkPlayground from './osmPoiWeightCategories/leisureParkPlayground';
import leisureSportCenter from './osmPoiWeightCategories/leisureSportCenter';
import leisureSportPitch from './osmPoiWeightCategories/leisureSportPitch';
import leisureStadium from './osmPoiWeightCategories/leisureStadium';
import leisureSummerCamp from './osmPoiWeightCategories/leisureSummerCamp';
import leisureThemePark from './osmPoiWeightCategories/leisureThemePark';
import officeGovernment from './osmPoiWeightCategories/officeGovernment';
import officeResearch from './osmPoiWeightCategories/officeResearch';
import officeWithNoClients from './osmPoiWeightCategories/officeWithNoClients';
import officeWithSomeClients from './osmPoiWeightCategories/officeWithSomeClients';
import religionCemetery from './osmPoiWeightCategories/religionCemetery';
import religionPlaceOfWorship from './osmPoiWeightCategories/religionPlaceOfWorship';
import restaurant from './osmPoiWeightCategories/restaurant';
import restaurantCafe from './osmPoiWeightCategories/restaurantCafe';
import restaurantFastFood from './osmPoiWeightCategories/restaurantFastFood';
import shopBank from './osmPoiWeightCategories/shopBank';
import shopCarDealership from './osmPoiWeightCategories/shopCarDealership';
import shopCarRepair from './osmPoiWeightCategories/shopCarRepair';
import shopConvenience from './osmPoiWeightCategories/shopConvenience';
import shopDepartmentStore from './osmPoiWeightCategories/shopDepartmentStore';
import shopFood from './osmPoiWeightCategories/shopFood';
import shopFuel from './osmPoiWeightCategories/shopFuel';
import shopHardwareDIY from './osmPoiWeightCategories/shopHardwareDIY';
import shopLowClients from './osmPoiWeightCategories/shopLowClients';
import shopMediumClients from './osmPoiWeightCategories/shopMediumClients';
import shopPharmacy from './osmPoiWeightCategories/shopPharmacy';
import shopPostOffice from './osmPoiWeightCategories/shopPostOffice';
import shopSupermarket from './osmPoiWeightCategories/shopSupermarket';
import shopStationery from './osmPoiWeightCategories/shopStationery';
import socialFacility from './osmPoiWeightCategories/socialFacility';
import utility from './osmPoiWeightCategories/utility';
import { OsmRawQueryOr } from '../../tasks/dataImport/data/dataOsmRaw';
import { POIWeightCategory } from './POIWeightCategoryType';

/*
aeroway=terminal
*/

export const poiIgnoredQueries: OsmRawQueryOr[] = [
    /* tmp */
    {
        tags: {
            building: 'commercial'
        }
    },

    /* end tmp */
    {
        tags: {
            tourism: 'viewpoint'
        }
    },
    {
        tags: {
            amenity: 'taxi'
        }
    },
    {
        tags: {
            leisure: 'slipway'
        }
    },
    {
        tags: {
            leisure: 'nature_reserve'
        }
    },
    {
        tags: {
            amenity: 'loading_dock'
        }
    },
    {
        tags: {
            shop: 'vacant'
        }
    },
    {
        tags: {
            shop: 'mall'
        }
    },
    {
        tags: {
            amenity: 'atm' // TODO: ignore until we find a way to ignore them from floor area calculation
        }
    },
    {
        tags: {
            leisure: 'golf_course' // TODO: ignore, but we need to check if golf=clubhouse is there, otherwise, we need to keep the golf course area
        }
    },
    {
        tags: {
            amenity: 'camping' // TODO: ignore, but we need to check if camping=reception is there, otherwise, we need to keep the camping area
        }
    },
    {
        tags: {
            tourism: 'camp_site' // TODO: ignore, but we need to check if camping=reception is there, otherwise, we need to keep the camping area
        }
    },
    {
        tags: {
            tourism: 'caravan_site' // TODO: ignore, but we need to check if camping=reception is there, otherwise, we need to keep the camping area
        }
    }
];

export const poiWeightCategories: { [key: string]: POIWeightCategory } = {
    educationCollegeUniversity,
    educationKindergarten,
    educationOtherSchool,
    educationSchool,
    emergencyPoliceStation,
    emergencyFireStation,
    emergencyAmbulanceStation,
    farm,
    funeral,
    hairdresserBeautyShop,
    healthcareClinicHighVolume,
    healthcareClinicLowVolume,
    healthcareHospital,
    industrial,
    industrialCraft,
    industrialDepot,
    industrialLogistics,
    industrialQuarry,
    industrialRecyclingCenter,
    leisureAquarium,
    leisureBar,
    leisureCamping,
    leisureCommunityCenter,
    leisureDogPark,
    leisureFitnessCenter,
    leisureGolf,
    leisureHotel,
    leisureHorseRiding,
    leisureLibrary,
    leisureMarina,
    leisureMuseum,
    leisurePark,
    leisureParkPavilion,
    leisureParkPlayground,
    leisureSportCenter,
    leisureSportPitch,
    leisureStadium,
    leisureSummerCamp,
    leisureThemePark,
    officeGovernment,
    officeResearch,
    officeWithNoClients,
    officeWithSomeClients,
    religionCemetery,
    religionPlaceOfWorship,
    restaurant,
    restaurantCafe,
    restaurantFastFood,
    shopBank,
    shopCarDealership,
    shopCarRepair,
    shopConvenience,
    shopDepartmentStore,
    shopFood,
    shopFuel,
    shopHardwareDIY,
    shopLowClients,
    shopMediumClients,
    shopPharmacy,
    shopPostOffice,
    shopStationery,
    shopSupermarket,
    socialFacility,
    utility
};
