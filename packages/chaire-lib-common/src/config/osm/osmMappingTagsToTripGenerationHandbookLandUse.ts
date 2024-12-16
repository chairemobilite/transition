/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { sqFeetToSqMeters } from '../../utils/PhysicsUtils';

/*
Reference: Trip Generation Manual (TGM) updated May '2022': '(11th edition): https://itetripgen.org/'
Each number/key in landUseCodesByMainCategory (21, 22, 30, 90, 110...) represents a US land use code from the Trip Generation Manual
*/

const landUseCodesByMainCategory = {
    'Port and Terminal': {
        '21': 'Commercial Airport',
        '22': 'General Aviation Airport',
        '30': 'Intermodal Truck Terminal',
        '90': 'Park-and-Ride Lot with Bus or Light Rail Service'
    },
    Industrial: {
        '110': 'General Light Industrial',
        '130': 'Industrial Park',
        '140': 'Manufacturing',
        '150': 'Warehousing',
        '151': 'Mini-Warehouse',
        '154': 'High-Cube Transload and Short-Term Storage Warehouse',
        '155': 'High-Cube Fulfillment Center Warehouse',
        '156': 'High-Cube Parcel Hub Warehouse',
        '157': 'High-Cube Cold Storage Warehouse',
        '160': 'Data Center',
        '170': 'Utility',
        '180': 'Specialty Trade Contractor',
        '190': 'Marijuana Cultivation and Processing Facility'
    },
    Residential: {
        '210': 'Single-Family Detached Housing',
        '215': 'Single-Family Attached Housing',
        '220': 'Multifamily Housing (Low-Rise)',
        '221': 'Multifamily Housing (Mid-Rise)',
        '222': 'Multifamily Housing (High-Rise)',
        '223': 'Affordable Housing',
        '225': 'Off-Campus Student Apartment (Low-Rise)',
        '226': 'Off-Campus Student Apartment (Mid-Rise)',
        '227': 'Off-Campus Student Apartment (High-Rise)',
        '230': 'Low-Rise Residential with Ground-Floor Commercial',
        '231': 'Mid-Rise Residential with Ground-Floor Commercial',
        '232': 'High-Rise Residential with Ground-Floor Commercial',
        '240': 'Mobile Home Park',
        '251': 'Senior Adult Housing—Single-Family',
        '252': 'Senior Adult Housing—Multifamily',
        '253': 'Congregate Care Facility',
        '254': 'Assisted Living',
        '255': 'Continuing Care Retirement Community',
        '260': 'Recreational Homes',
        '265': 'Timeshare',
        '270': 'Residential Planned Unit Development'
    },
    Lodging: {
        '310': 'Hotel',
        '311': 'All Suites Hotel',
        '312': 'Business Hotel',
        '320': 'Motel',
        '330': 'Resort Hotel'
    },
    Recreational: {
        '411': 'Public Park',
        '416': 'Campground/Recreational Vehicle Park',
        '420': 'Marina',
        '430': 'Golf Course',
        '431': 'Miniature Golf Course',
        '432': 'Golf Driving Range',
        '433': 'Batting Cages',
        '434': 'Rock Climbing Gym',
        '435': 'Multipurpose Recreational Facility',
        '436': 'Trampoline Park',
        '437': 'Bowling Alley',
        '440': 'Adult Cabaret',
        '445': 'Movie Theater',
        '452': 'Horse Racetrack',
        '453': 'Automobile Racetrack',
        '454': 'Dog Racetrack',
        '462': 'Professional Baseball Stadium',
        '465': 'Ice Skating Rink',
        '466': 'Snow Ski Area',
        '470': 'Bingo Hall',
        '473': 'Casino',
        '480': 'Amusement Park',
        '482': 'Water Slide Park',
        '488': 'Soccer Complex',
        '490': 'Tennis Courts',
        '491': 'Racquet/Tennis Club',
        '492': 'Health/Fitness Club',
        '493': 'Athletic Club',
        '495': 'Recreational Community Center'
    },
    Institutional: {
        '501': 'Military Base',
        '520': 'Elementary School',
        '522': 'Middle School/Junior High School',
        '525': 'High School',
        '528': 'School District Office',
        '530': 'Private School (K-8)',
        '532': 'Private School (K-12)',
        '534': 'Private High School',
        '536': 'Charter Elementary School',
        '538': 'Charter School (K-12)',
        '540': 'Junior/Community College',
        '550': 'University/College',
        '560': 'Church',
        '561': 'Synagogue',
        '562': 'Mosque',
        '565': 'Day Care Center',
        '566': 'Cemetery',
        '571': 'Adult Detention Facility',
        '575': 'Fire and Rescue Station',
        '580': 'Museum',
        '590': 'Library'
    },
    Medical: {
        '610': 'Hospital',
        '620': 'Nursing Home',
        '630': 'Clinic',
        '640': 'Animal Hospital/Veterinary Clinic',
        '650': 'Free-Standing Emergency Room'
    },
    Office: {
        '710': 'General Office Building',
        '712': 'Small Office Building',
        '714': 'Corporate Headquarters Building',
        '715': 'Single Tenant Office Building',
        '720': 'Medical-Dental Office Building',
        '730': 'Government Office Building',
        '731': 'State Motor Vehicles Department',
        '732': 'United States Post Office',
        '750': 'Office Park',
        '760': 'Research and Development Center',
        '770': 'Business Park'
    },
    Retail: {
        '810': 'Tractor Supply Store',
        '811': 'Construction Equipment Rental Store',
        '812': 'Building Materials and Lumber Store',
        '813': 'Free-Standing Discount Superstore',
        '814': 'Variety Store',
        '815': 'Free-Standing Discount Store',
        '816': 'Hardware/Paint Store',
        '817': 'Nursery (Garden Center)',
        '818': 'Nursery (Wholesale)',
        '820': 'Shopping Center (>150k)',
        '821': 'Shopping Plaza (40-150k)',
        '822': 'Strip Retail Plaza (<40k)',
        '823': 'Factory Outlet Center',
        '840': 'Automobile Sales (New)',
        '841': 'Automobile Sales (Used)',
        '842': 'Recreational Vehicle Sales',
        '843': 'Automobile Parts Sales',
        '848': 'Tire Store',
        '849': 'Tire Superstore',
        '850': 'Supermarket',
        '851': 'Convenience Store',
        '857': 'Discount Club',
        '858': 'Farmers Market',
        '860': 'Wholesale Market',
        '861': 'Sporting Goods Superstore',
        '862': 'Home Improvement Superstore',
        '863': 'Electronics Superstore',
        '864': 'Toy/Children\'s Superstore',
        '865': 'Baby Superstore',
        '866': 'Pet Supply Superstore',
        '867': 'Office Supply Superstore',
        '868': 'Book Superstore',
        '869': 'Discount Home Furnishing Superstore',
        '872': 'Bed and Linen Superstore',
        '875': 'Department Store',
        '876': 'Apparel Store',
        '879': 'Arts and Crafts Store',
        '880': 'Pharmacy/Drugstore without Drive-Through Window',
        '881': 'Pharmacy/Drugstore with Drive-Through Window',
        '882': 'Marijuana Dispensary',
        '890': 'Furniture Store',
        '895': 'Beverage Container Recycling Depot',
        '897': 'Medical Equipment Store',
        '899': 'Liquor Store'
    },
    Services: {
        '911': 'Walk-in Bank',
        '912': 'Drive-in Bank',
        '918': 'Hair Salon',
        '920': 'Copy, Print, and Express Ship Store',
        '926': 'Food Cart Pod',
        '930': 'Fast Casual Restaurant',
        '931': 'Fine Dining Restaurant',
        '932': 'High-Turnover (Sit-Down) Restaurant',
        '933': 'Fast-Food Restaurant without Drive-Through Window',
        '934': 'Fast-Food Restaurant with Drive-Through Window',
        '935': 'Fast-Food Restaurant with Drive-Through Window and No Indoor Seating',
        '936': 'Coffee/Donut Shop without Drive-Through Window',
        '937': 'Coffee/Donut Shop with Drive-Through Window',
        '938': 'Coffee/Donut Shop with Drive-Through Window and No Indoor Seating',
        '941': 'Quick Lubrication Vehicle Shop',
        '942': 'Automobile Care Center',
        '943': 'Automobile Parts and Service Center',
        '944': 'Gasoline/Service Station',
        '945': 'Convenience Store/Gas Station',
        '947': 'Self-Service Car Wash',
        '948': 'Automated Car Wash',
        '949': 'Car Wash and Detail Center',
        '950': 'Truck Stop',
        '970': 'Wine Tasting Room',
        '971': 'Brewery Tap Room',
        '975': 'Drinking Place'
    }
};

const sqFeetToSqMetersConstant = sqFeetToSqMeters(1);
const sqMetersToThousandSqFeet = 1 / (sqFeetToSqMetersConstant * 1000);
const avgVehicleOccupancy = 1.2;
const acresToThousandSqFeet = 1 / 43.56;
const tripRatio = 0.5; // we want only the number of trip destinations, not origins, and the Trip Generation Manual includes both entering and exiting trips.

// these function calculate the number of generated trips from the landuse weight (from TGM), the value count (floor area, number of employees, capacity, etc.)
// weight function for vehicle data in TGM
const weightCountVehicleFunction = function (
    weight,
    count,
    customAvgVehicleOccupancy = avgVehicleOccupancy,
    customTripRatio = tripRatio
) {
    return count && weight ? customTripRatio * customAvgVehicleOccupancy * count * weight : undefined;
};
// weight function for person data in TGM
const weightCountPersonFunction = function (weight, count, customTripRatio = tripRatio) {
    return count && weight ? customTripRatio * count * weight : undefined;
};
// some vehicle weights in the TGM are given in ln (logarithmic) functions:
const weightCountVehicleLogarithmicFunction = function (
    weight,
    count,
    constant,
    customAvgVehicleOccupancy = avgVehicleOccupancy,
    customTripRatio = tripRatio
) {
    return count && weight && constant
        ? customTripRatio * customAvgVehicleOccupancy * Math.pow(Math.E, weight * Math.log(count) + constant)
        : undefined;
};

// capacity: for hospitals or assisted living/hospices: number of beds, for hotels: number of rooms, for camping: number of sites, for residential (not used yet): number of flats, for marina: number of berths, for golf courses: number of holes
// this function input a TGM/US land use code and returns the function to use to generate the correct number of trips. TODO: deal with functions that returns undefined (not enough data in TGM or other problem)
// most TGM functions takes the number of employees or the floor area as input, but some also have custom capacities as input, like number of beds, number of rooms, etc.
type TripGenerationFunction = (
    floorAreaSqMeters: number | undefined,
    employeesCount: number | undefined,
    capacity: number | undefined
) => number | undefined; // returns the number of trips generated per day, taking only half, because the trip generation manual gives in and out trips.

const tripGenerationFunctionsByLandUseCode: { [key: string]: TripGenerationFunction } = {
    //TODO: Many functions here are unimplemented or have unused arguments.
    '21': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size: 1, not suitable, sample too low, 10.28/2 trips / employee
    '22': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size: 1, not suitable, sample too low, 14.94/2 trips / employee
    '30': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountPersonFunction(0.91 * 10, employeesCount)
            : floorAreaSqMeters
                ? weightCountPersonFunction(2.14 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 2, persons, peak hour (*10)
    '90': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // in parking spaces, not suitable

    '110': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleLogarithmicFunction(0.77, employeesCount, 2.15)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(4.87, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 37
    '130': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleLogarithmicFunction(0.68, employeesCount, 3.34)
            : floorAreaSqMeters
                ? weightCountVehicleLogarithmicFunction(0.52, floorAreaSqMeters * sqMetersToThousandSqFeet, 4.45)
                : undefined;
    }, // sample size: 27
    '140': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleLogarithmicFunction(0.89, employeesCount, 1.68)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(4.75, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 53
    '150': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleLogarithmicFunction(0.82, employeesCount, 2.33)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(1.71, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 31
    '151': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(1.45, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 16
    '154': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(1.4, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 91
    '155': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleLogarithmicFunction(0.77, employeesCount, 2.52)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(1.81, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 10
    '156': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(4.6, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 8
    '157': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(2.12, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5
    '160': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(0.99, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 2
    '170': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(3.85, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleLogarithmicFunction(0.74, floorAreaSqMeters * sqMetersToThousandSqFeet, 2.73)
                : undefined;
    }, // sample size: 13
    '180': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(3.63, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(9.82, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 20
    '190': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size: 1, not suitable, sample too low, 0.69/2 trips / thousand sq feet

    '310': function (_floorAreaSqMeters, employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(7.99, capacity)
            : employeesCount
                ? weightCountVehicleFunction(14.34, employeesCount)
                : undefined;
    }, // sample size: 5, capacity = number of rooms
    '311': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(4.4, capacity) : undefined;
    }, // sample size: 7, capacity = number of rooms
    '312': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(4.02, capacity) : undefined;
    }, // sample size: 10, capacity = number of rooms
    '320': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(3.35, capacity) : undefined;
    }, // sample size: 6, capacity = number of rooms
    '330': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // no data for whole day

    '411': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // inconsistent data and sample size too low
    '416': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(0.21, capacity) : undefined;
    }, // sample size: 4, capacity = number of campsites, no winter trips
    '420': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // inconsistent data and sample size too low, no winter trips
    '430': function (floorAreaSqMeters, _employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(30.38, capacity)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(3.74, (floorAreaSqMeters * acresToThousandSqFeet) / sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 4, capacity = number of holes, no winter trips, original area in acres, seems a bit high, but plausible
    '431': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low, no winter trips
    '432': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low, no winter trips
    '433': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low, no winter trips
    '434': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low, no winter trips
    '435': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(3.58 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 3, data for one peak hour multiplied by 10
    '436': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(1.5 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 3, data for one peak hour multiplied by 10
    '437': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '440': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '445': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '452': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '453': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '454': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '462': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? capacity : undefined;
    }, // sample size: 2, capacity = number of attendees
    '465': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(45.17, capacity) : undefined;
    }, // sample size: 3, capacity = number of rinks
    '466': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '470': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '473': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(388.18, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 4
    '480': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '482': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '488': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(71.33, capacity) : undefined;
    }, // sample size: 3, capacity = number of fields/pitches
    '490': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(30.32, capacity) : undefined;
    }, // sample size: 2, capacity = number of courts
    '491': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(27.71, capacity) : undefined;
    }, // sample size: 2, capacity = number of courts
    '492': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(1.31 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 6
    '493': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(3.16 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 2
    '495': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(28.82, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 4

    '501': function (_floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount ? weightCountVehicleFunction(0.39, employeesCount) : undefined;
    }, // sample size: 6
    '520': function (_floorAreaSqMeters, employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(2.27, capacity)
            : employeesCount
                ? weightCountVehicleFunction(22.5, employeesCount)
                : undefined;
    }, // sample size: 12-16, capacity = number of students
    '522': function (_floorAreaSqMeters, employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(2.1, capacity)
            : employeesCount
                ? weightCountVehicleFunction(23.41, employeesCount)
                : undefined;
    }, // sample size: 6-14, capacity = number of students
    '525': function (_floorAreaSqMeters, employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(1.94, capacity)
            : employeesCount
                ? weightCountVehicleFunction(21.95, employeesCount)
                : undefined;
    }, // sample size: 30-31, capacity = number of students
    '528': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(5.08, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(14.37, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 11
    '530': function (_floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount ? 0.5 * avgVehicleOccupancy * employeesCount * 8.86 : undefined;
    }, // sample size: 7
    '532': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '534': function (_floorAreaSqMeters, employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(2.17, capacity)
            : employeesCount
                ? weightCountVehicleFunction(15.12, employeesCount)
                : undefined;
    }, // sample size: 2-3, capacity = number of students
    '536': function (_floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount ? weightCountVehicleFunction(13.93, employeesCount) : undefined;
    }, // sample size: 5
    '538': function (_floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount ? weightCountVehicleFunction(13.75, employeesCount) : undefined;
    }, // sample size: 3
    '540': function (_floorAreaSqMeters, employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(1.15, capacity)
            : employeesCount
                ? weightCountVehicleFunction(14.61, employeesCount)
                : undefined;
    }, // sample size: 10-12, capacity = number of students
    '550': function (_floorAreaSqMeters, employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(1.56, capacity)
            : employeesCount
                ? weightCountVehicleFunction(8.89, employeesCount)
                : undefined;
    }, // sample size: 2-5, capacity = number of students
    '560': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(7.6, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5
    '561': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '562': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '565': function (_floorAreaSqMeters, employeesCount, capacity) {
        return capacity
            ? weightCountVehicleFunction(4.09, capacity)
            : employeesCount
                ? weightCountVehicleFunction(21.38, employeesCount)
                : undefined;
    }, // sample size: 14-28, capacity = number of children
    '566': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(51.75, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(6.02, (floorAreaSqMeters * acresToThousandSqFeet) / sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 5, original area in acres
    '571': function (_floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount ? weightCountVehicleFunction(3.04, employeesCount) : undefined;
    }, // sample size: 9
    '575': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(4.8, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 3
    '580': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '590': function (floorAreaSqMeters, employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(72.05, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : employeesCount
                ? weightCountVehicleFunction(55.64, employeesCount)
                : undefined;
    }, // sample size: 6

    '610': function (floorAreaSqMeters, employeesCount, capacity) {
        return employeesCount
            ? weightCountVehicleFunction(3.77, employeesCount)
            : capacity
                ? weightCountVehicleFunction(22.32, capacity)
                : floorAreaSqMeters
                    ? weightCountVehicleFunction(10.77, floorAreaSqMeters * sqMetersToThousandSqFeet)
                    : undefined;
    }, // sample size: 4-7, capacity = beds
    '620': function (floorAreaSqMeters, employeesCount, capacity) {
        return employeesCount
            ? weightCountVehicleFunction(3.31, employeesCount)
            : capacity
                ? weightCountVehicleFunction(3.06, capacity)
                : floorAreaSqMeters
                    ? weightCountVehicleFunction(6.75, floorAreaSqMeters * sqMetersToThousandSqFeet)
                    : undefined;
    }, // sample size: 3-9, capacity = beds
    '630': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(13.9, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(37.6, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 8-9
    '640': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(12.69, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(21.5, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 6
    '650': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(24.94, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 4

    '710': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleLogarithmicFunction(0.76, employeesCount, 2.74)
            : floorAreaSqMeters
                ? weightCountVehicleLogarithmicFunction(0.87, floorAreaSqMeters * sqMetersToThousandSqFeet, 3.05)
                : undefined;
    }, // sample size: 52-59
    '712': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(7.86, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(14.39, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 17-21
    '714': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(2.31, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(7.95, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 6-7
    '715': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(3.85, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(13.07, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 12
    '720': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(8.71, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(36.0, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 14-18
    '730': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(7.45, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(22.59, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 7
    '731': function (_floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount ? weightCountVehicleFunction(2.94 * 10, employeesCount) : undefined;
    }, // sample size: 2
    '732': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(25.4, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(103.94, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 7-8
    '750': function (floorAreaSqMeters, employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(11.07, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : employeesCount
                ? weightCountVehicleFunction(3.54, employeesCount)
                : undefined;
    }, // sample size: 2-10
    '760': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(3.37, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(11.08, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 20-22
    '770': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(4.04, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(12.44, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 12-16

    '810': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(1.4 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 7
    '811': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(0.99 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 3
    '812': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(25.77, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(17.05, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 13
    '813': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(50.52, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 72
    '814': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(63.66, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(95.59, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 29
    '815': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(53.87, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 21
    '816': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(27.69, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(8.07, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 4
    '817': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(21.83, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(68.1, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 10
    '818': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(0.3 * 10, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(2.41 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 6
    '820': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(37.01, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 108
    '821': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(67.52, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 7 (Without supermarket, with supermarket: weight = 94.49)
    '822': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(54.45, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 4
    '823': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(26.59, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 11
    '840': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(27.84, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 18
    '841': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(27.06, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 14
    '842': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(5.0, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5
    '843': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(54.57, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 14
    '848': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(27.69, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 13
    '849': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(20.37, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 12
    '850': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(93.84, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 22
    '851': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(762.28, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 8
    '857': function (floorAreaSqMeters, employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(42.46, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : employeesCount
                ? weightCountVehicleFunction(32.21, employeesCount)
                : undefined;
    }, // sample size: 10-20
    '858': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(
                174.9 * 10,
                (floorAreaSqMeters * acresToThousandSqFeet) / sqMetersToThousandSqFeet
            )
            : undefined;
    }, // sample size: 2, peak hour
    '860': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '861': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(23.78, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 8
    '862': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(30.74, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 19
    '863': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(41.05, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5
    '864': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(5.0 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 2, peak hour
    '865': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '866': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(3.55 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5, peak hour
    '867': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(2.77 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5, peak hour
    '868': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '869': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(20.0, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 8
    '872': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '875': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(22.88, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5
    '876': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '879': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '880': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(90.08, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 6
    '881': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(108.4, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 16
    '882': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(211.12, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 7
    '890': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(6.3, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 19
    '895': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(9.78, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 2
    '897': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '899': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(107.21, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5

    '911': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(5.27 * 10, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(12.13 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 3-8, peak hour
    '912': function (floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount
            ? weightCountVehicleFunction(32.73, employeesCount)
            : floorAreaSqMeters
                ? weightCountVehicleFunction(100.35, floorAreaSqMeters * sqMetersToThousandSqFeet)
                : undefined;
    }, // sample size: 19
    '918': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '920': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '926': function (_floorAreaSqMeters, _employeesCount, capacity) {
        return capacity ? weightCountVehicleFunction(6.16 * 10, capacity) : undefined;
    }, // sample size: 4, capacity: food carts, peak hour
    '930': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '931': function (floorAreaSqMeters, employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(83.84, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : employeesCount
                ? weightCountVehicleFunction(0.69 * 10, employeesCount)
                : undefined;
    }, // sample size: 3-10, peak hour for employee count
    '932': function (floorAreaSqMeters, employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(107.2, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : employeesCount
                ? weightCountVehicleFunction(21.26, employeesCount)
                : undefined;
    }, // sample size: 31-50
    '933': function (floorAreaSqMeters, employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(450.49, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : employeesCount
                ? weightCountVehicleFunction(54.81, employeesCount)
                : undefined;
    }, // sample size: 5-6
    '934': function (floorAreaSqMeters, employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(467.48, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : employeesCount
                ? weightCountVehicleFunction(44.52, employeesCount)
                : undefined;
    }, // sample size: 28-71
    '935': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '936': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(93.08 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 25
    '937': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(533.57, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 6
    '938': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '941': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '942': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(2.25 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 6, peak hour
    '943': function (floorAreaSqMeters, employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(16.6, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : employeesCount
                ? weightCountVehicleFunction(11.44, employeesCount)
                : undefined;
    }, // sample size: 27
    '944': function (_floorAreaSqMeters, employeesCount, _capacity) {
        return employeesCount ? weightCountVehicleFunction(275.78, employeesCount) : undefined;
    }, // sample size: 12
    '945': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // n/a, needs number of fueling positions
    '947': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '948': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '949': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // sample size too low
    '950': function (_floorAreaSqMeters, _employeesCount, _capacity) {
        return undefined;
    }, // n/a, needs number of fueling positions
    '970': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(45.96, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 5
    '971': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(61.69, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    }, // sample size: 2
    '975': function (floorAreaSqMeters, _employeesCount, _capacity) {
        return floorAreaSqMeters
            ? weightCountVehicleFunction(11.36 * 10, floorAreaSqMeters * sqMetersToThousandSqFeet)
            : undefined;
    } // sample size: 12, peak hour
};

const landUseCodes: { [key: string]: string } = {};
for (const mainCategory in landUseCodesByMainCategory) {
    for (const landuseCode in landUseCodesByMainCategory[mainCategory]) {
        landUseCodes[landuseCode] = landUseCodesByMainCategory[mainCategory][landuseCode];
    }
}

// this object will output an array of compatible land use codes for each osm POI tag:
// TODO: make this more robust and add more optional land use code when data in TGM is not available or not usable.
const landUseCodesByOsmTag = {
    craft: {
        _default: [110],
        builder: [110, 180],
        construction: [180, 712],
        metal_construction: [130, 140],
        hvac: [180],
        electrician: [180],
        carpenter: [180],
        cleaning: [180],
        printer: [110],
        electronics_repair: [180],
        plumber: [180],
        caterer: [180],
        gardener: [180],
        photographic_laboratory: [180],
        photographer: [180],
        roofer: [180],
        floorer: [180],
        shoemaker: [180],
        dressmaker: [110],
        signmaker: [110, 180],
        glaziery: [180],
        brewery: [971],
        hydraulics: [130],
        welder: [110, 180],
        automation: [130],
        clockmaker: [180],
        concrete: [180],
        cutting: [110],
        games: [110, 712],
        graphic_design: [110, 712],
        industrial_equipment: [130, 180],
        metal_works: [130, 140],
        plating: [130, 140],
        bookbinder: [110],
        snow_removal: [180],
        landscaping: [180],
        masonry: [180],
        mason: [180],
        security: [180],
        septic_system: [180],
        tool_repair: [180],
        web_design: [110, 712],
        telecom: [110, 712],
        trailers: [110],
        fiberglass: [180],
        garage_doors: [180],
        printing: [110],
        furniture: [180],
        adhesives: [180],
        pumps: [180],
        water_treatment: [180],
        asphalt: [110, 180],
        finger_printing: [180],
        waste_management: [130, 180],
        trophee: [110],
        trophees: [110],
        stamps: [110],
        sharpening: [180],
        canvas: [180],
        excavation: [180],
        handrails: [180],
        stairs: [180],
        design: [110, 712],
        cement: [180],
        environment: [180],
        land_surveyors: [712],
        land_surveyor: [712],
        coating: [180],
        sanitary: [180],
        weighting: [180],
        stained_glass: [180],
        fire_safety: [180],
        engines: [110],
        cranes: [180],
        electric_motors: [180],
        mini_motors_repair: [180],
        road_construction: [180],
        tabletops: [110],
        hardware: [816], // should be shop=hardware
        airplane_fuel: [180],
        screen_printer: [110],
        gutters: [180],
        motors: [110],
        fences: [180],
        boatbuilder: [110],
        beekeeper: [110],
        sawmill: [110],
        yes: [110]
    },

    office: {
        _default: [710, 712, 750, 770],
        educational_institution: [528],
        guide: [712],
        harbour_master: [420],
        medical: [630, 720],
        religion: [712],
        research: [760],
        government: [730],
        ngo: [712],
        quango: [712],
        political_party: [712],
        company: [714],
        accountant: [712],
        foundation: [712],
        financial_advisor: [712],
        notary: [712],
        consulting: [712],
        architect: [712],
        telecommunication: [710],
        newspaper: [710],
        estate_agent: [712],
        lawyer: [712],
        insurance: [710, 712],
        tax_advisor: [712],
        consultancy: [712],
        advertising_agency: [712],
        construction: [180, 712],
        hydraulics: [180, 712],
        graphic_design: [110, 712],
        it: [110, 712, 710],
        employment_agency: [712],
        coworking: [712],
        construction_company: [180, 712],
        association: [712],
        water_utility: [170, 712],
        transport: [30, 154, 155, 156, 157],
        urbanist: [712],
        charity: [712],
        financial: [712],
        finance: [710],
        bailiff: [712],
        electricity: [180, 712],
        energy_supplier: [710],
        distribution: [30, 154, 155, 156, 157],
        airlines: [710],
        airline: [710],
        gaz_cleaning: [180, 712],
        therapist: [630, 720],
        security: [180, 712],
        appraisal: [712],
        moving_company: [110, 712],
        moving: [110, 712],
        business_management: [700, 712],
        forestry: [110, 712],
        yes: [710, 712, 750, 770]
    },

    highway: {
        _default: [],
        services: [],
        rest_area: [],
        bus_stop: []
    },

    shop: {
        _default: [822],
        bakery: [936],
        pastry: [936],
        coffee: [936],
        farm: [858],
        ice_cream: [936],
        mall: [821], // malls should have separate shops with their entrances inside or on the building perimeter
        wholesale: [875],
        beauty: [918],
        massage: [918],
        medical_supply: [897],
        art: [879],
        craft: [879],
        games: [863],
        video_games: [863],
        video: [863],
        anime: [863],
        books: [868],
        funeral_directors: [495],
        religion: [879],
        supermarket: [850],
        butcher: [936],
        laundry: [110],
        convenience: [851, 945],
        outdoor: [861],
        bicycle: [861],
        car: [840],
        alcohol: [899],
        motorcycle: [840, 841],
        optician: [630, 720],
        car_repair: [942, 943],
        clothes: [876],
        interior_decoration: [816],
        shoes: [876],
        furniture: [869, 890],
        mobile_phone: [863],
        toys: [864],
        hairdresser: [918],
        department_store: [813, 875],
        doityourself: [812, 862],
        copyshop: [920],
        dry_cleaning: [918],
        tattoo: [918],
        variety_store: [814],
        car_parts: [843],
        florist: [814],
        pet_grooming: [918],
        computer: [863],
        pest_control: [180],
        pawnbroker: [814],
        sports: [861],
        bed: [872],
        bathroom_furnishing: [869, 890],
        houseware: [869],
        musical_instrument: [814],
        appliance: [890],
        greengrocer: [858],
        grocery: [851],
        food: [851],
        deli: [851],
        music: [814],
        jewelry: [180],
        gift: [814],
        travel_agency: [712],
        hardware: [816],
        stationery: [867],
        garden_furniture: [817],
        electronics: [863],
        lamps: [816],
        gas: [814],
        pet: [866],
        beverages: [936],
        tyres: [848, 849],
        kitchen: [816],
        chocolate: [936],
        fabric: [879],
        frame: [862],
        radiotechnics: [863],
        vacuum_cleaner: [816],
        swimming_pool: [862],
        paint: [816],
        rental: [811],
        wine: [970],
        carpet: [862],
        nutrition_supplements: [814],
        locksmith: [180],
        health_food: [814],
        mattress: [872],
        tiles: [862],
        money_lender: [911],
        windows: [862],
        lighting: [862],
        electrical: [862],
        garden_centre: [817, 818],
        beauty_care: [918],
        erotic: [814],
        storage_rental: [151],
        fireplace: [862],
        cannabis: [814],
        cleaning_products: [816],
        tea: [936],
        scuba_diving: [861],
        tailor: [110],
        cosmetics: [918],
        boat: [842],
        cheese: [936],
        motorcycle_repair: [942, 943],
        antiques: [879],
        flooring: [862],
        wheelchairs: [842],
        perfumery: [816],
        lawn_mower: [842],
        confectionery: [936],
        'e-cigarette': [814],
        baby_goods: [865],
        party: [814],
        second_hand: [814],
        farm_equipment: [810],
        caravan: [841],
        trade: [812],
        country_store: [814],
        hairdresser_supply: [814],
        massage_equipment: [814],
        distribution: [30, 157],
        fashion_accessories: [876],
        bag: [876],
        bags: [876],
        lottery: [814],
        fire_safety: [180],
        cleaning: [814],
        window_blind: [862],
        heating_equipment: [862],
        water: [814],
        hifi: [863],
        industrial_equipment: [812],
        model: [879],
        military_surplus: [814],
        trophy: [879],
        trophee: [879],
        trophees: [879],
        lifts: [812],
        agrarian: [810],
        barbecue: [862],
        printer_ink: [814],
        yes: [822],
        vacant: []
    },

    water: {
        lock: []
    },

    tourism: {
        _default: [580],
        aquarium: [480],
        artwork: [411],
        apartment: [],
        camp_site: [416],
        caravan_site: [416],
        camp_pitch: [],
        guest_house: [330],
        chalet: [330],
        gallery: [580],
        hostel: [330],
        hotel: [310, 311, 312],
        motel: [320],
        information: [], // see information: office
        museum: [580],
        picnic_site: [],
        theme_park: [480],
        viewpoint: [411],
        wilderness_hut: [416],
        zoo: [480],
        attraction: [580],
        yes: [580]
    },

    healthcare: {
        _default: [630, 720],
        pharmacy: [880, 881],
        clinic: [630, 720],
        doctor: [630, 720],
        hospital: [610],
        dentist: [630, 720],
        optometrist: [630],
        laboratory: [720],
        alternative: [630, 720],
        physiotherapist: [630, 720],
        psychotherapist: [630, 720],
        podiatrist: [630, 720],
        audiologist: [630, 720],
        hospice: [620],
        yes: [630, 720]
    },

    amenity: {
        _default: [],
        parking_entrance: [],
        bar: [975],
        bbq: [411],
        biergarten: [975],
        cafe: [936, 937, 938],
        fast_food: [933, 934, 935],
        food_court: [933, 934, 935],
        ice_cream: [936],
        pub: [975],
        restaurant: [930, 931],
        college: [550],
        driving_school: [712],
        kindergarten: [565],
        language_school: [712],
        library: [590],
        toy_library: [590],
        music_school: [712],
        theatre_school: [712],
        school: [520],
        university: [550],
        bicycle_rental: [861],
        boat_rental: [811],
        boat_sharing: [861],
        bus_station: [],
        car_rental: [841],
        helicopter_rental: [811],
        car_sharing: [],
        car_wash: [947, 948, 949],
        vehicle_inspection: [731],
        ferry_terminal: [712],
        fuel: [944],
        taxi: [],
        atm: [912],
        bank: [911, 912],
        bureau_de_change: [911],
        baby_hatch: [630],
        clinic: [630, 720],
        dentist: [630, 720],
        doctors: [630, 720],
        hospital: [610],
        nursing_home: [620],
        pharmacy: [880],
        social_facility: [495],
        veterinary: [640],
        arts_centre: [580],
        brothel: [320],
        casino: [473],
        cinema: [445],
        community_centre: [495],
        fountain: [411],
        gambling: [473],
        nightclub: [975],
        planetarium: [580],
        public_bookcase: [411],
        social_centre: [495],
        stripclub: [440],
        studio: [712],
        swingerclub: [440],
        theatre: [590, 445],
        animal_boarding: [454],
        animal_shelter: [712],
        animal_training: [712],
        baking_oven: [411],
        childcare: [565],
        conference_center: [435],
        courthouse: [730],
        crematorium: [110],
        dive_centre: [493],
        embassy: [730],
        fire_station: [575],
        firepit: [], // deprecated
        grave_yard: [],
        gym: [492], // deprecated
        hunting_stand: [],
        internet_cafe: [936],
        kitchen: [495],
        kneipp_water_cure: [918],
        marketplace: [858, 860],
        monastery: [560],
        photo_booth: [],
        place_of_worship: [560],
        police: [730],
        post_box: [],
        post_depot: [710, 154, 150],
        post_office: [732],
        prison: [571],
        public_bath: [435],
        public_building: [495], // deprecated
        ranger_station: [411],
        recycling: [],
        sanitary_dump_station: [],
        sauna: [918], // deprecated
        shelter: [],
        shower: [],
        telephone: [],
        toilets: [],
        private_toilet: [],
        townhall: [730],
        vending_machine: [],
        waste_basket: [],
        waste_disposal: [],
        waste_transfer_station: [],
        watering_place: [],
        water_point: [],
        parking: [],
        bench: [],
        parking_space: [],
        bicycle_parking: [],
        drinking_water: [],
        clock: [],
        motorcycle_parking: [],
        mobile_money_agent: [912],
        swimming_pool: [435],
        events_venue: [435],
        loading_dock: [],
        compressed_air: [],
        payment_terminal: [],
        dojo: [492],
        money_transfer: [911],
        animal_breeding: [110],
        boat_storage: [151],
        letter_box: [],
        game_feeding: [411],
        love_hotel: [320],
        lavoir: [435],
        training: [712],
        feeding_place: [],
        weighbridge: [712],
        shop: [814],
        ticket_validator: [],
        office: [750],
        smoking_area: [],
        coworking_space: [712],
        prep_school: [712],
        stables: [452],
        reception_desk: [712],
        trolley_bay: [],
        mortuary: [495],
        garages: [151],
        water: [], // wrong tag : mistake
        register_office: [712],
        car_pooling: [],
        public_hall: [435],
        research_institute: [760],
        payment_centre: [911, 912],
        camping: [416],
        customs: [730],
        table: [],
        refugee_housing: [320],
        spa: [918], // do not use: ambiguous
        retirement_home: [251],
        vacuum_cleaner: [],
        hookah_lounge: [933],
        sanatorium: [918], // do not use: ???
        karaoke_box: [975],
        workshop: [110],
        vehicle_ramp: [],
        social_club: [495],
        nameplate: [],
        polling_station: [730],
        club: [493, 491],
        community_hall: [495],
        picnic_table: [],
        public_service: [730],
        dancing_school: [712],
        music_venue: [495],
        ski_school: [466],
        temple: [560],
        funeral_home: [495],
        ski_rental: [466],
        canteen: [930],
        dressing_room: [],
        storage: [],
        exhibition_centre: [580],
        auditorium: [590],
        concert_hall: [590],
        greenhouse: [110],
        nursery: [817],
        public_facility: [495],
        healthcare: [630, 720],
        luggage_locker: [],
        boathouse: [],
        garage: [],
        administration: [730],
        border_control: [730],
        device_charging_station: [],
        market: [858],
        health_facility: [630, 720],
        construction: [180, 712],
        harbourmaster: [420],
        scrapyard: [110],
        education: [528],
        coast_guard: [712],
        hospice: [620],
        warehouse: [150, 154, 155, 156, 157],
        student_accommodation: [],
        church: [560],
        self_storage: [],
        youth_centre: [495],
        archive: [730],
        piano: [411],
        financial_advice: [712],
        industrial: [130, 140],
        health_centre: [630, 720],
        care_home: [255, 254],
        community_center: [495],
        car_repair: [942, 943],
        public_office: [730],
        garden: [411],
        service: [712],
        charging_station: [],
        art_school: [712],
        recreation_ground: [435],
        snow_disposal: [],
        proposed: [],
        fridge: [],
        refugee_site: [320],
        yes: [],
        vacant: []
    },

    building: {
        _default: [],
        apartments: [],
        bungalow: [],
        cabin: [],
        detached: [],
        dormitory: [],
        farm: [],
        ger: [],
        hotel: [],
        house: [],
        houseboat: [],
        residential: [],
        semidetached_house: [],
        static_caravan: [],
        terrace: [],
        commercial: [], // only if there is at least a shop/main entrance and no shop/craft/office... point inside
        industrial: [110, 140], // only if there is at least a shop/main entrance and no shop/craft/office... point inside
        kiosk: [926],
        office: [750], // only if there is at least a shop/main entrance and no shop/craft/office... point inside
        retail: [814, 875], // only if there is at least a shop/main entrance and no shop/craft/office... point inside
        supermarket: [850],
        warehouse: [150, 154, 155, 156, 157],
        cathedral: [560],
        chapel: [560],
        church: [560],
        mosque: [562],
        religious: [560],
        shrine: [560],
        temple: [560],
        synagogue: [561],
        bakehouse: [411],
        civic: [], // there should be POIs inside the building
        fire_station: [575],
        government: [730],
        hospital: [610],
        kindergarten: [565],
        public: [], // there should be POIs inside the building
        school: [520],
        toilets: [],
        train_station: [712],
        transportation: [30, 154, 155, 156, 157],
        college: [550],
        university: [550],
        barn: [], // land use code not suitable, too ambiguous
        conservatory: [580],
        cowshed: [], // land use code not suitable, too ambiguous
        farm_auxiliary: [], // land use code not suitable, too ambiguous
        greenhouse: [], // land use code not suitable, too ambiguous
        stable: [], // land use code not suitable, too ambiguous
        sty: [], // land use code not suitable, too ambiguous
        grandstand: [435],
        pavilion: [495],
        riding_hall: [452],
        sports_hall: [495],
        stadium: [462],
        hangar: [22],
        hut: [],
        shed: [],
        carport: [],
        garage: [],
        garages: [151],
        parking: [],
        digester: [150],
        service: [170],
        transformer_tower: [170],
        water_tower: [170],
        bunker: [],
        bridge: [],
        construction: [],
        roof: [],
        ruins: [],
        tower: [],
        abandoned: [],
        shelter: [],
        yes: []
    },

    camping: {
        reception: [416]
    },

    industrial: {
        _default: [],
        distributor: [30, 150, 154, 155, 156, 157],
        distribution: [30, 150, 154, 155, 156, 157],
        warehouse: [30, 150, 154, 155, 156, 157]
    },

    emergency: {
        _default: [],
        ambulance_station: [575],
        lifeguard: [712],
        lifeguard_base: [712],
        lifeguard_tower: [],
        lifeguard_platform: [],
        fire_hydrant: [],
        phone: [],
        no: []
    },

    geological: {
        palaeontological_site: []
    },

    telecom: {
        _default: [],
        data_center: [160],
        service_device: [170],
        exchange: [170]
    },

    waterway: {
        _default: [],
        dock: [],
        boatyard: [151],
        fuel: [712],
        dam: [],
        lock_gate: [712]
    },

    historic: {
        _default: [411],
        aqueduct: [411],
        battlefield: [411],
        cannon: [411],
        castle_wall: [411],
        city_gate: [411],
        citywalls: [411],
        archaeological_site: [411],
        memorial: [411],
        ruins: [411],
        monument: [411],
        pillory: [411],
        building: [411],
        castle: [411],
        bridge: [411],
        industrial: [411],
        ship: [411],
        tank: [411],
        tomb: [411],
        wreck: [411],
        railway_car: [411],
        aircraft: [411],
        tower: [411],
        heritage: [411],
        manor: [411],
        fort: [411],
        wayside_chapel: [411],
        church: [411],
        monastery: [411],
        farm: [411],
        wayside_shrine: [411],
        locomotive: [411],
        yes: [411]
    },

    information: {
        _default: [],
        office: [580, 712]
    },

    leisure: {
        _default: [411],
        bird_hide: [411],
        common: [411],
        firepit: [411],
        nature_reserve: [411],
        picnic_table: [],
        slipway: [411],
        playground: [411],
        swimming_pool: [411],
        sports_centre: [435],
        fitness_centre: [492],
        ice_rink: [411],
        fishing: [411],
        pitch: [490],
        park: [411],
        dance: [495],
        swimming_area: [411],
        golf_course: [430],
        miniature_golf: [431],
        water_park: [482],
        summer_camp: [411],
        garden: [411],
        amusement_arcade: [435],
        stadium: [465],
        escape_game: [435],
        track: [411],
        dog_park: [411],
        marina: [420],
        fitness_station: [411],
        paddling_pool: [411],
        bleachers: [],
        horse_riding: [452],
        recreation_ground: [435],
        splash_pad: [411],
        disc_golf_course: [432],
        beach_resort: [411],
        bowling_alley: [437],
        bandstand: [435]
    },

    club: {
        sport: [411],
        shooting: [411],
        social: [495]
    },

    man_made: {
        _default: [],
        lighthouse: [411],
        observatory: [580],
        pumping_station: [170],
        telescope: [580],
        watermill: [110],
        wastewater_plant: [130],
        water_works: [130],
        windmill: [110],
        works: [130, 140],
        storage_tank: [],
        tower: [],
        surveillance: [712],
        flagpole: [],
        street_cabinet: [],
        monitoring_station: [170],
        silo: [],
        bridge: [],
        pier: [],
        petroleum_well: [170],
        communications_tower: [170],
        obelisk: [411],
        dovecote: [],
        gasometer: [],
        kiln: [110],
        mineshaft: [],
        reservoir_covered: [],
        water_tower: [170],
        yes: []
    },

    military: {
        _default: [501],
        barracks: [501],
        office: [501],
        airfield: [501],
        bunker: [501],
        checkpoint: [501],
        naval_base: [501],
        training_area: [501],
        obstacle_course: [501],
        range: [501]
    },

    power: {
        _default: [],
        plant: [130],
        substation: [110],
        generator: [170]
    },

    public_transport: {
        _default: [],
        station: [712],
        stop_position: [],
        platform: []
    },

    railway: {
        _default: [],
        station: [712],
        turntable: [110],
        roundhouse: [110],
        wash: [110],
        vehicle_depot: [130],
        subway_entrance: [],
        stop: [],
        platform: []
    },

    landuse: {
        _default: [],
        quarry: [], // land use code not suitable, too large
        landfill: [], // land use code not suitable, too large
        cemetery: [566],
        allotments: [411],
        depot: [], // land use code not suitable, too large
        military: [], // land use code not suitable, too large
        recreation_ground: [435],
        religious: [], // there should be POIs inside
        winter_sports: [466],
        mine: [], // land use code not suitable, too large
        apiary: [],
        garden: [411],
        tourism: [411],
        leisure: [411]
    },

    golf: {
        _default: [430],
        clubhouse: [430]
    }
} as { [key: string]: { [key: string]: number[] } };

export { landUseCodesByMainCategory, landUseCodes, landUseCodesByOsmTag, tripGenerationFunctionsByLandUseCode };
