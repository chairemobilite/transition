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
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';

export interface TransitNetworkDesignParametersComponentProps {
    attributes: TransitNetworkDesignParameters;
    disabled: boolean;
    onValueChange: (path: keyof TransitNetworkDesignParameters, newValue: { value: any; valid?: boolean }) => void;
}

const TransitNetworkDesignParametersComponent: React.FunctionComponent<TransitNetworkDesignParametersComponentProps> = (
    props: TransitNetworkDesignParametersComponentProps
) => {
    const { t } = useTranslation(['transit', 'main']);

    const [agencyCollection, setAgencyCollection] = React.useState<AgencyCollection | undefined>(
        serviceLocator.collectionManager.get('agencies')
    );
    const [serviceCollection, setServiceCollection] = React.useState<ServiceCollection | undefined>(
        serviceLocator.collectionManager.get('services')
    );

    const onServiceCollectionUpdate = () => {
        setServiceCollection(serviceLocator.collectionManager.get('services'));
    };
    const onAgencyCollectionUpdate = () => {
        setAgencyCollection(serviceLocator.collectionManager.get('agencies'));
    };

    React.useEffect(() => {
        serviceLocator.eventManager.on('collection.update.services', onServiceCollectionUpdate);
        serviceLocator.eventManager.on('collection.update.agencies', onAgencyCollectionUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.scenarios', onServiceCollectionUpdate);
            serviceLocator.eventManager.on('collection.update.agencies', onAgencyCollectionUpdate);
        };
    }, []);

    const serviceChoices = React.useMemo(
        () =>
            serviceCollection?.getFeatures().map((service: Service) => ({
                value: service.getId(),
                label: service.attributes.name || service.getId()
            })) || [],
        [serviceCollection]
    );
    const agencyChoices = React.useMemo(
        () =>
            agencyCollection?.getFeatures().map((agency: Agency) => ({
                value: agency.getId(),
                label: agency.toString()
            })) || [],
        [agencyCollection]
    );
    const simulatedAgencies = props.attributes.simulatedAgencies || [];
    const lineChoices = simulatedAgencies.flatMap((agencyId: string) => {
        const agency: Agency | undefined = agencyCollection?.getById(agencyId);
        if (!agency) {
            return [];
        }
        const lines = agency.getLines();
        return lines.map((line: Line) => ({
            value: line.getId(),
            label: line.toString()
        }));
    });

    if (!agencyCollection || !serviceCollection) {
        return <LoadingPage />;
    }

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
                    t={t}
                />
            </InputWrapper>
            <InputWrapper twoColumns={false} label={t('transit:simulation:KeepLines')}>
                <InputMultiselect
                    id={'formFieldTransitNetworkDesignParametersKeepLines'}
                    disabled={props.disabled}
                    value={props.attributes.linesToKeep}
                    onValueChange={(e) => props.onValueChange('linesToKeep', { value: e.target.value })}
                    choices={lineChoices}
                    t={t}
                />
            </InputWrapper>
            <InputWrapper twoColumns={false} label={t('transit:simulation:NonSimulatedServices')}>
                <InputMultiselect
                    id={'formFieldTransitNetworkDesignParametersNonSimulatedServices'}
                    disabled={props.disabled}
                    value={props.attributes.nonSimulatedServices}
                    onValueChange={(e) => props.onValueChange('nonSimulatedServices', { value: e.target.value })}
                    choices={serviceChoices}
                    t={t}
                />
            </InputWrapper>
        </React.Fragment>
    );
};

export default TransitNetworkDesignParametersComponent;
