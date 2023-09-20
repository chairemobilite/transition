/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons/faExchangeAlt';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

export interface ODCoordinatesComponentProps extends WithTranslation {
    originGeojson?: GeoJSON.Feature<GeoJSON.Point>;
    destinationGeojson?: GeoJSON.Feature<GeoJSON.Point>;
    onUpdateOD: (
        originCoordinates?: GeoJSON.Position,
        destinationCoordinates?: GeoJSON.Position,
        shouldCalculate?: boolean
    ) => void;
}

interface ODCoordinatesComponentState {
    originLat?: number;
    originLon?: number;
    destinationLat?: number;
    destinationLon?: number;
    externalUpdate: number;
}

class ODCoordinatesComponent extends React.Component<ODCoordinatesComponentProps, ODCoordinatesComponentState> {
    constructor(props: ODCoordinatesComponentProps) {
        super(props);
        this.state = {
            originLat: props.originGeojson?.geometry.coordinates[1],
            originLon: props.originGeojson?.geometry.coordinates[0],
            destinationLat: props.destinationGeojson?.geometry.coordinates[1],
            destinationLon: props.destinationGeojson?.geometry.coordinates[0],
            externalUpdate: 0
        };
    }

    private updateOrigin = (lon?: number, lat?: number, shouldCalculate?: boolean) => {
        const originCoord = lon !== undefined && lat !== undefined ? [lon, lat] : undefined;
        const destCoord =
            this.state.destinationLon !== undefined && this.state.destinationLat !== undefined
                ? [this.state.destinationLon, this.state.destinationLat]
                : undefined;
        this.props.onUpdateOD(originCoord, destCoord, shouldCalculate);
    };

    private updateDestination = (lon?: number, lat?: number, shouldCalculate?: boolean) => {
        const destCoord = lon !== undefined && lat !== undefined ? [lon, lat] : undefined;
        const originCoord =
            this.state.originLon !== undefined && this.state.originLat !== undefined
                ? [this.state.originLon, this.state.originLat]
                : undefined;
        this.props.onUpdateOD(originCoord, destCoord, shouldCalculate);
    };

    onDragOrigin = (coordinates: GeoJSON.Position) => {
        this.setState({
            originLat: coordinates[1],
            originLon: coordinates[0],
            externalUpdate: this.state.externalUpdate + 1
        });
        this.updateOrigin(coordinates[0], coordinates[1], false);
    };

    onDragDestination = (coordinates: GeoJSON.Position) => {
        this.setState({
            destinationLat: coordinates[1],
            destinationLon: coordinates[0],
            externalUpdate: this.state.externalUpdate + 1
        });
        this.updateDestination(coordinates[0], coordinates[1], false);
    };

    onUpdateOrigin = (coordinates: GeoJSON.Position) => {
        this.setState({
            originLat: coordinates[1],
            originLon: coordinates[0],
            externalUpdate: this.state.externalUpdate + 1
        });
        this.updateOrigin(coordinates[0], coordinates[1], true);
    };

    onUpdateDestination = (coordinates: GeoJSON.Position) => {
        this.setState({
            destinationLat: coordinates[1],
            destinationLon: coordinates[0],
            externalUpdate: this.state.externalUpdate + 1
        });
        this.updateDestination(coordinates[0], coordinates[1], true);
    };

    originDestinationToGeojson = (): GeoJSON.FeatureCollection<GeoJSON.Point> => {
        const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
        if (this.hasOrigin(this.state)) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [this.state.originLon, this.state.originLat] },
                properties: {}
            });
        }
        if (this.hasDestination(this.state)) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [this.state.destinationLon, this.state.destinationLat] },
                properties: {}
            });
        }
        return {
            type: 'FeatureCollection',
            features
        };
    };

    hasOrigin = (
        state: ODCoordinatesComponentState
    ): state is { originLat: number; originLon: number; externalUpdate: number } => {
        return this.state.originLat !== undefined && this.state.originLon !== undefined;
    };

    hasDestination = (
        state: ODCoordinatesComponentState
    ): state is { destinationLat: number; destinationLon: number; externalUpdate: number } => {
        return this.state.destinationLat !== undefined && this.state.destinationLon !== undefined;
    };

    reverseOD = () => {
        const currentState = { ...this.state };
        this.setState({
            originLat: currentState.destinationLat,
            originLon: currentState.destinationLon,
            destinationLat: currentState.originLat,
            destinationLon: currentState.originLon,
            externalUpdate: this.state.externalUpdate + 1
        });
        const originCoord =
            this.state.destinationLon !== undefined && this.state.destinationLat !== undefined
                ? [this.state.destinationLon, this.state.destinationLat]
                : undefined;
        const destCoord =
            this.state.originLon !== undefined && this.state.originLat !== undefined
                ? [this.state.originLon, this.state.originLat]
                : undefined;
        this.props.onUpdateOD(originCoord, destCoord, true);
    };

    onClickedOnMap = (coordinates: GeoJSON.Position, isOrigin: boolean) => {
        if ((!this.hasOrigin(this.state) && isOrigin !== false) || isOrigin) {
            this.setState({
                originLat: coordinates[1],
                originLon: coordinates[0],
                externalUpdate: this.state.externalUpdate + 1
            });
            this.updateOrigin(coordinates[0], coordinates[1]);
            serviceLocator.eventManager.emit('map.updateLayer', 'routingPoints', this.originDestinationToGeojson());
        } else {
            this.setState({
                destinationLat: coordinates[1],
                destinationLon: coordinates[0],
                externalUpdate: this.state.externalUpdate + 1
            });
            this.updateDestination(coordinates[0], coordinates[1]);
            serviceLocator.eventManager.emit('map.updateLayer', 'routingPoints', this.originDestinationToGeojson());
        }
    };

    componentDidMount() {
        serviceLocator.eventManager.on('routing.transit.dragOrigin', this.onDragOrigin);
        serviceLocator.eventManager.on('routing.transit.dragDestination', this.onDragDestination);
        serviceLocator.eventManager.on('routing.transit.updateOrigin', this.onUpdateOrigin);
        serviceLocator.eventManager.on('routing.transit.updateDestination', this.onUpdateDestination);
        serviceLocator.eventManager.on('routing.transit.clickedOnMap', this.onClickedOnMap);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('routing.transit.dragOrigin', this.onDragOrigin);
        serviceLocator.eventManager.off('routing.transit.dragDestination', this.onDragDestination);
        serviceLocator.eventManager.off('routing.transit.updateOrigin', this.onUpdateOrigin);
        serviceLocator.eventManager.off('routing.transit.updateDestination', this.onUpdateDestination);
        serviceLocator.eventManager.off('routing.transit.clickedOnMap', this.onClickedOnMap);
    }

    render() {
        return (
            <React.Fragment>
                <InputWrapper label={this.props.t('transit:transitRouting:OriginLatitude')}>
                    <InputStringFormatted
                        id={'formFieldTransitRoutingOriginLatitude'}
                        key={`od${this.state.externalUpdate}`}
                        value={this.state.originLat}
                        stringToValue={parseFloat}
                        valueToString={_toString}
                        onValueUpdated={(newValue) => {
                            if (newValue.valid) {
                                const value = Number.isNaN(newValue.value) ? undefined : newValue.value;
                                this.setState({ originLat: value });
                                this.updateOrigin(this.state.originLon, value);
                            }
                        }}
                        pattern="-?[0-9]{1,3}(\.[0-9]+)?"
                    />
                </InputWrapper>
                <InputWrapper label={this.props.t('transit:transitRouting:OriginLongitude')}>
                    <InputStringFormatted
                        id={'formFieldTransitRoutingOriginLongitude'}
                        value={this.state.originLon}
                        key={`od${this.state.externalUpdate}`}
                        stringToValue={parseFloat}
                        valueToString={_toString}
                        onValueUpdated={(newValue) => {
                            if (newValue.valid) {
                                const value = Number.isNaN(newValue.value) ? undefined : newValue.value;
                                this.setState({ originLon: value });
                                this.updateOrigin(value, this.state.originLat);
                            }
                        }}
                        pattern="-?[0-9]{1,3}(\.[0-9]+)?"
                    />
                </InputWrapper>
                {this.hasOrigin(this.state) && this.hasDestination(this.state) && (
                    <div className="tr__form-buttons-container">
                        <Button
                            size="small"
                            icon={faExchangeAlt}
                            iconClass="_icon"
                            color="blue"
                            label={this.props.t('transit:transitRouting:ReverseOD')}
                            onClick={this.reverseOD}
                        />
                    </div>
                )}
                <InputWrapper label={this.props.t('transit:transitRouting:DestinationLatitude')}>
                    <InputStringFormatted
                        id={'formFieldTransitRoutingDestinationLatitude'}
                        value={this.state.destinationLat}
                        key={`od${this.state.externalUpdate}`}
                        stringToValue={parseFloat}
                        valueToString={_toString}
                        onValueUpdated={(newValue) => {
                            if (newValue.valid) {
                                const value = Number.isNaN(newValue.value) ? undefined : newValue.value;
                                this.setState({ destinationLat: value });
                                this.updateDestination(this.state.destinationLon, value);
                            }
                        }}
                        pattern="-?[0-9]{1,3}(\.[0-9]+)?"
                    />
                </InputWrapper>
                <InputWrapper label={this.props.t('transit:transitRouting:DestinationLongitude')}>
                    <InputStringFormatted
                        id={'formFieldTransitRoutingDestinationLongitude'}
                        value={this.state.destinationLon}
                        key={`od${this.state.externalUpdate}`}
                        stringToValue={parseFloat}
                        valueToString={_toString}
                        onValueUpdated={(newValue) => {
                            if (newValue.valid) {
                                const value = Number.isNaN(newValue.value) ? undefined : newValue.value;
                                this.setState({ destinationLon: value });
                                this.updateDestination(value, this.state.destinationLat);
                            }
                        }}
                        pattern="-?[0-9]{1,3}(\.[0-9]+)?"
                    />
                </InputWrapper>
            </React.Fragment>
        );
    }
}

export default withTranslation(['transit', 'main'])(ODCoordinatesComponent);
