/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _toString from 'lodash/toString';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';

interface AccessibilityMapCoordinatesComponentProps {
    locationGeojson?: GeoJSON.Feature<GeoJSON.Point>;
    onUpdateCoordinates: (coordinates?: GeoJSON.Position, checkIfHasLocation?: boolean) => void;
    id: string;
}

interface AccessibilityMapCoordinatesComponentState {
    lat?: number;
    lon?: number;
    externalUpdate: number;
}

const AccessibilityMapCoordinatesComponent: React.FunctionComponent<AccessibilityMapCoordinatesComponentProps> = (
    props: AccessibilityMapCoordinatesComponentProps
) => {
    const { t } = useTranslation(['transit']);

    const [state, setState] = React.useState<AccessibilityMapCoordinatesComponentState>({
        lat: props.locationGeojson?.geometry.coordinates[1],
        lon: props.locationGeojson?.geometry.coordinates[0],
        externalUpdate: 0
    });

    const updateLocation = (lon?: number, lat?: number, checkIfHasLocation: boolean = false) => {
        const coord = lon !== undefined && lat !== undefined ? [lon, lat] : undefined;
        props.onUpdateCoordinates(coord, checkIfHasLocation);
    };

    React.useEffect(() => {
        const onDragLocation = (coordinates: GeoJSON.Position, updateLocation1: boolean = true) => {
            setState(({}) => ({
                lat: coordinates[1],
                lon: coordinates[0],
                externalUpdate: state.externalUpdate + 1
            }));
            updateLocation(coordinates[0], coordinates[1], true);
        };

        const onClickedOnMap = (coordinates: GeoJSON.Position, updateLocation1: boolean = true) => {
            setState(({}) => ({
                lat: coordinates[1],
                lon: coordinates[0],
                externalUpdate: state.externalUpdate + 1
            }));
            updateLocation(coordinates[0], coordinates[1]);
        };

        serviceLocator.eventManager.on('routing.transitAccessibilityMap.dragLocation', onDragLocation);
        serviceLocator.eventManager.on('routing.transitAccessibilityMap.clickedOnMap', onClickedOnMap);
        return () => {
            serviceLocator.eventManager.off('routing.transitAccessibilityMap.dragLocation', onDragLocation);
            serviceLocator.eventManager.off('routing.transitAccessibilityMap.clickedOnMap', onClickedOnMap);
        };
    }, [updateLocation]);

    return (
        <React.Fragment>
            <InputWrapper label={t('transit:transitRouting:Latitude')}>
                <InputStringFormatted
                    id={`${props.id}Latitude`}
                    key={`od${state.externalUpdate}`}
                    value={state.lat}
                    stringToValue={parseFloat}
                    valueToString={_toString}
                    onValueUpdated={(newValue) => {
                        if (newValue.valid) {
                            const value = Number.isNaN(newValue.value) ? undefined : newValue.value;
                            setState(({ lon, externalUpdate }) => ({
                                lat: value,
                                lon,
                                externalUpdate
                            }));
                            updateLocation(state.lon, value);
                        }
                    }}
                    pattern="-?[0-9]{1,3}(\.[0-9]+)?"
                />
            </InputWrapper>
            <InputWrapper label={t('transit:transitRouting:Longitude')}>
                <InputStringFormatted
                    id={`${props.id}Longitude`}
                    value={state.lon}
                    key={`od${state.externalUpdate}`}
                    stringToValue={parseFloat}
                    valueToString={_toString}
                    onValueUpdated={(newValue) => {
                        if (newValue.valid) {
                            const value = Number.isNaN(newValue.value) ? undefined : newValue.value;
                            setState(({ lat, externalUpdate }) => ({
                                lat,
                                lon: value,
                                externalUpdate
                            }));
                            updateLocation(value, state.lat);
                        }
                    }}
                    pattern="-?[0-9]{1,3}(\.[0-9]+)?"
                />
            </InputWrapper>
        </React.Fragment>
    );
};

export default AccessibilityMapCoordinatesComponent;
