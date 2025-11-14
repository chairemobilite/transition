/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _toString from 'lodash/toString';
import { useTranslation } from 'react-i18next';

import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { TransitNetworkDesignParameters } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Service from 'transition-common/lib/services/service/Service';
import InputMultiselect from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import Agency from 'transition-common/lib/services/agency/Agency';
import Line from 'transition-common/lib/services/line/Line';


export interface TransitNetworkDesignParametersComponentProps {
    attributes: TransitNetworkDesignParameters;
    disabled: boolean;
    onValueChange: (path: keyof TransitNetworkDesignParameters, newValue: { value: any; valid?: boolean }) => void;
}

const TransitNetworkDesignParametersComponent: React.FunctionComponent<TransitNetworkDesignParametersComponentProps> = (
    props: TransitNetworkDesignParametersComponentProps
) => {
    const agencyCollection = serviceLocator.collectionManager.get('agencies');
    const serviceCollection = serviceLocator.collectionManager.get('services');
    const { t } = useTranslation(['transit', 'main']);

    const serviceChoices = serviceCollection.getFeatures().map((service: Service) => ({
        value: service.getId(),
        label: service.attributes.name || service.getId()
    }));
    const agencyChoices = agencyCollection.getFeatures().map((agency: Agency) => ({
        value: agency.getId(),
        label: agency.toString()
    }));
    const simulatedAgencies = props.attributes.simulatedAgencies || [];
    const lineChoices = simulatedAgencies.flatMap((agencyId: string) => {
        const agency: Agency = agencyCollection.getById(agencyId);
        const lines = agency.getLines();
        return lines.map((line: Line) => ({
            value: line.getId(),
            label: line.toString()
        }));
    });

    return (
        <React.Fragment>
            <InputWrapper smallInput={true} label={t('transit:simulation:NumberOfLinesMin')}>
                <InputStringFormatted
                    id={'formFieldTransitNetworkDesignParametersNbOfLinesMin'}
                    disabled={props.disabled}
                    value={props.attributes.numberOfLinesMin}
                    onValueUpdated={(value) => props.onValueChange('numberOfLinesMin', value)}
                    stringToValue={_toInteger}
                    valueToString={_toString}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper smallInput={true} label={t('transit:simulation:NumberOfLinesMax')}>
                <InputStringFormatted
                    id={'formFieldTransitNetworkDesignParametersNbOfLinesMax'}
                    disabled={props.disabled}
                    value={props.attributes.numberOfLinesMax}
                    onValueUpdated={(value) => props.onValueChange('numberOfLinesMax', value)}
                    stringToValue={_toInteger}
                    valueToString={_toString}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper smallInput={true} label={t('transit:simulation:MaxIntervalMinutes')}>
                <InputStringFormatted
                    id={'formFieldTransitNetworkDesignParametersMaxTimeBetweenPassages'}
                    disabled={props.disabled}
                    value={props.attributes.maxTimeBetweenPassages}
                    onValueUpdated={(value) => props.onValueChange('maxTimeBetweenPassages', value)}
                    stringToValue={_toInteger}
                    valueToString={_toString}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper smallInput={true} label={t('transit:simulation:MinIntervalMinutes')}>
                <InputStringFormatted
                    id={'formFieldTransitNetworkDesignParametersMinTimeBetweenPassages'}
                    disabled={props.disabled}
                    value={props.attributes.minTimeBetweenPassages}
                    onValueUpdated={(value) => props.onValueChange('minTimeBetweenPassages', value)}
                    stringToValue={_toInteger}
                    valueToString={_toString}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper smallInput={true} label={t('transit:simulation:VehiclesCount')}>
                <InputStringFormatted
                    id={'formFieldTransitNetworkDesignParametersNbOfVehicles'}
                    disabled={props.disabled}
                    value={props.attributes.nbOfVehicles}
                    onValueUpdated={(value) => props.onValueChange('nbOfVehicles', value)}
                    stringToValue={_toInteger}
                    valueToString={_toString}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper twoColumns={false} label={t('transit:simulation:LineSetAgencies')}>
                <InputMultiselect
                    id={'formFieldTransitNetworkDesignParametersSimulatedAgencies'}
                    disabled={props.disabled}
                    value={props.attributes.simulatedAgencies}
                    onValueChange={(e) => props.onValueChange('simulatedAgencies', { value: e.target.value })}
                    choices={agencyChoices}
                    t={props.t}
                />
            </InputWrapper>
            <InputWrapper twoColumns={false} label={t('transit:simulation:KeepLines')}>
                <InputMultiselect
                    id={'formFieldTransitNetworkDesignParametersKeepLines'}
                    disabled={props.disabled}
                    value={props.attributes.linesToKeep}
                    onValueChange={(e) => props.onValueChange('linesToKeep', { value: e.target.value })}
                    choices={lineChoices}
                    t={props.t}
                />
            </InputWrapper>
            <InputWrapper twoColumns={false} label={t('transit:simulation:NonSimulatedServices')}>
                <InputMultiselect
                    id={'formFieldTransitNetworkDesignParametersNonSimulatedServices'}
                    disabled={props.disabled}
                    value={props.attributes.nonSimulatedServices}
                    onValueChange={(e) => props.onValueChange('nonSimulatedServices', { value: e.target.value })}
                    choices={serviceChoices}
                    t={props.t}
                />
            </InputWrapper>
        </React.Fragment>
    );
};

export default TransitNetworkDesignParametersComponent;
