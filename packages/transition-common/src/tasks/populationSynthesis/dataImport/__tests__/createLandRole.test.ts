/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { DataFileGeojson } from 'chaire-lib-common/lib/tasks/dataImport/data/dataGeojson';
import fs               from 'fs';
import { transformTranslate as turfTransformTranslate } from '@turf/turf';

class LandRoleClass extends DataFileGeojson {
    public getData(): GeoJSON.Feature[] {
        return super.getData();
    }
}

const geojsonFileManager = { readFileAbsolute: () => fs.readFileSync(__dirname + '/unit_test_ile_perrot_land_role2.geojson')};
const geojsonData = new LandRoleClass('unit_test_ile_perrot_land_role2', geojsonFileManager);

const LAND_VALUE_PERCENT_DIFF = 10;
const MAX_DISTANCE = 0.004;

// FIXME Keeping this file here for the sake of transparency and in case we need to generate unit test data again
test.skip('Anonymizing land role data', async () => {
    const features: any[] = geojsonData.getData();
    let count = 0;
    const randomLandValue = (originalValue) => {
        const diff = (Math.random() * (LAND_VALUE_PERCENT_DIFF  * 2) - LAND_VALUE_PERCENT_DIFF) / 100;
        return originalValue - Math.ceil(originalValue * diff / 100) * 100;
    }
    const movePoint = (point) => {
        const randomDistance = (Math.random() * MAX_DISTANCE);
        const randomAngle = (Math.random() * 360);
        return turfTransformTranslate(point, randomDistance, randomAngle);
    }
    const newFeatures = features.map(feature => {
        const landValue = randomLandValue(feature.properties.valeur_terrain);
        const buildingValue = randomLandValue(feature.properties.valeur_batiment);
        return { type: "Feature",
            properties: {
                "fid": count++,
                "role_annee": "2020",
                "num_civique_start": null,
                "lettre_civique_start": null,
                "num_civique_end": null,
                "lettre_civique_end": null,
                "rue": feature.properties.rue,
                "num_app": null,
                "code_type_batiment": "4715",
                "dist_front": 0.0,
                "superficie_terrain": 0.0,
                "nb_etages": feature.properties.nb_etages,
                "superficie_etages": 0.0,
                "type_batiment": null,
                "building:flats": feature.properties['building:flats'],
                "nb_chambres_locatives": feature.properties.nb_chambres_locatives,
                "nb_locaux_non_residentiels": feature.properties.nb_locaux_non_residentiels,
                "valeur_terrain": landValue,
                "valeur_batiment": buildingValue,
                "valeur_totale": landValue + buildingValue,
            },
            geometry: movePoint(feature.geometry)
        }
    });
    const newFeatureCollection = {
        type: "FeatureCollection",
        name: "unit_test_ile_perrot_land_role",
        features: newFeatures
    };

    fs.writeFileSync(__dirname + '/unit_test_land_role.geojson', JSON.stringify(newFeatureCollection, null, 2));
});

// FIXME Keeping this file here for the sake of transparency and in case we need to generate unit test data again
test.skip('OSM map data', async () => {
    const osmAllFileManager = { readFileAbsolute: () => fs.readFileSync(__dirname + '/export.geojson')};
    const osmAllGeojsonData = new LandRoleClass('export', osmAllFileManager);

    const osmCurrentFileManager = { readFileAbsolute: () => fs.readFileSync(__dirname + '/unit_test_osm_way_relation.geojson')};
    const osmCurrentGeojsonData = new LandRoleClass('unit_test_osm_way_relation', osmCurrentFileManager);

    const features: any[] = osmAllGeojsonData.getData();
    const currentFeatures: any[] = osmCurrentGeojsonData.getData();
    console.log("New features, current", features.length, currentFeatures.length);

    const newFeatures = features.filter(feature => !feature.id?.includes('node'));
    console.log("Filtered features", newFeatures.length);

    const newFeatureCollection = {
        type: "FeatureCollection",
        name: "unit_test_osm_way_relation.geojson",
        features: newFeatures
    };

    fs.writeFileSync(__dirname + '/unit_test_osm_way_relation.geojson', JSON.stringify(newFeatureCollection, null, 2));
});