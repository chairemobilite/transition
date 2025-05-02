/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _toString from 'lodash/toString';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';

interface AccessibilityMapCoordinatesComponentProps extends WithTranslation {
    locationGeojson?: GeoJSON.Feature<GeoJSON.Point>;
    onUpdateCoordinates: (coordinates?: GeoJSON.Position, checkIfHasLocation?: boolean) => void;
    id: string;
}

interface AccessibilityMapCoordinatesComponentState {
    lat?: number;
    lon?: number;
    externalUpdate: number;
}

class AccessibilityMapCoordinatesComponent extends React.Component<
    AccessibilityMapCoordinatesComponentProps,
    AccessibilityMapCoordinatesComponentState
> {
    constructor(props: AccessibilityMapCoordinatesComponentProps) {
        super(props);
        this.state = {
            lat: props.locationGeojson?.geometry.coordinates[1],
            lon: props.locationGeojson?.geometry.coordinates[0],
            externalUpdate: 0
        };
    }

    private updateLocation = (lon?: number, lat?: number, checkIfHasLocation: boolean = false) => {
        const coord = lon !== undefined && lat !== undefined ? [lon, lat] : undefined;
        this.props.onUpdateCoordinates(coord, checkIfHasLocation);
    };

    onDragLocation = (coordinates: GeoJSON.Position) => {
        this.setState({
            lat: coordinates[1],
            lon: coordinates[0],
            externalUpdate: this.state.externalUpdate + 1
        });
        this.updateLocation(coordinates[0], coordinates[1], true);
    };

    onUpdateLocation = (coordinates: GeoJSON.Position) => {
        this.setState({
            lat: coordinates[1],
            lon: coordinates[0],
            externalUpdate: this.state.externalUpdate + 1
        });
        this.updateLocation(coordinates[0], coordinates[1]);
    };

    locationToGeojson = (): GeoJSON.FeatureCollection<GeoJSON.Point> => {
        const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
        if (this.hasCoordinates(this.state)) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [this.state.lon, this.state.lat] },
                properties: {}
            });
        }
        return {
            type: 'FeatureCollection',
            features
        };
    };

    hasCoordinates = (
        state: AccessibilityMapCoordinatesComponentState
    ): state is { lat: number; lon: number; externalUpdate: number } => {
        return this.state.lat !== undefined && this.state.lon !== undefined;
    };

    onClickedOnMap = (coordinates: GeoJSON.Position) => {
        this.setState({
            lat: coordinates[1],
            lon: coordinates[0],
            externalUpdate: this.state.externalUpdate + 1
        });
        this.updateLocation(coordinates[0], coordinates[1]);
    };

    componentDidMount() {
        serviceLocator.eventManager.on('routing.transitAccessibilityMap.dragLocation', this.onDragLocation);
        serviceLocator.eventManager.on('routing.transitAccessibilityMap.updateLocation', this.onUpdateLocation);
        serviceLocator.eventManager.on('routing.transitAccessibilityMap.clickedOnMap', this.onClickedOnMap);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('routing.transitAccessibilityMap.dragLocation', this.onDragLocation);
        serviceLocator.eventManager.off('routing.transitAccessibilityMap.updateLocation', this.onUpdateLocation);
        serviceLocator.eventManager.off('routing.transitAccessibilityMap.clickedOnMap', this.onClickedOnMap);
    }

    render() {
        return (
            <React.Fragment>
                <InputWrapper label={this.props.t('transit:transitRouting:Latitude')}>
                    <InputStringFormatted
                        id={`${this.props.id}Latitude`}
                        key={`od${this.state.externalUpdate}`}
                        value={this.state.lat}
                        stringToValue={parseFloat}
                        valueToString={_toString}
                        onValueUpdated={(newValue) => {
                            if (newValue.valid) {
                                const value = Number.isNaN(newValue.value) ? undefined : newValue.value;
                                this.setState({ lat: value });
                                this.updateLocation(this.state.lon, value);
                            }
                        }}
                        pattern="-?[0-9]{1,3}(\.[0-9]+)?"
                    />
                </InputWrapper>
                <InputWrapper label={this.props.t('transit:transitRouting:Longitude')}>
                    <InputStringFormatted
                        id={`${this.props.id}Longitude`}
                        value={this.state.lon}
                        key={`od${this.state.externalUpdate}`}
                        stringToValue={parseFloat}
                        valueToString={_toString}
                        onValueUpdated={(newValue) => {
                            if (newValue.valid) {
                                const value = Number.isNaN(newValue.value) ? undefined : newValue.value;
                                this.setState({ lon: value });
                                this.updateLocation(value, this.state.lat);
                            }
                        }}
                        pattern="-?[0-9]{1,3}(\.[0-9]+)?"
                    />
                </InputWrapper>
            </React.Fragment>
        );
    }
}

export default withTranslation('transit')(AccessibilityMapCoordinatesComponent);
