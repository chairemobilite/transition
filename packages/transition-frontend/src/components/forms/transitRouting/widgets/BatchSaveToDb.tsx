/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _toString from 'lodash.tostring';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitOdDemandFromCsvAttributes } from 'transition-common/lib/services/transitDemand/TransitOdDemandFromCsv';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import { _toBool } from 'chaire-lib-common/lib/utils/LodashExtensions';
import DataSourceCollection from 'chaire-lib-common/lib/services/dataSource/DataSourceCollection';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';

export interface BatchAttributesSelectionComponentProps extends WithTranslation {
    attributes: TransitOdDemandFromCsvAttributes;
    defaultDataSourceName: string;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
}

export interface SaveToDbChoiceComponentProps extends WithTranslation {
    saveToDb: { type: 'new'; dataSourceName: string } | { type: 'overwrite'; dataSourceId: string };
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
}

const SaveToDbChoiceComponent: React.FunctionComponent<SaveToDbChoiceComponentProps> = (
    props: SaveToDbChoiceComponentProps
) => {
    const [dsUpdate, setDsUpdate] = React.useState(0);

    React.useEffect(() => {
        const onNodeCollectionUpdate = () => {
            setDsUpdate(dsUpdate + 1);
        };

        serviceLocator.eventManager.on('collection.update.dataSources', onNodeCollectionUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.dataSources', onNodeCollectionUpdate);
        };
    }, []);

    const dataSources = React.useMemo(() => {
        const dataSourceCollection: DataSourceCollection = serviceLocator.collectionManager.get('dataSources');
        const odTripsDs = dataSourceCollection.getByAttribute('type', 'odTrips');
        return odTripsDs.map((dataSource) => ({
            value: dataSource.id,
            label: dataSource.toString()
        }));
    }, [dsUpdate]);

    const actionChoices = [
        {
            value: 'new'
        },
        {
            value: 'overwrite'
        }
    ];

    const onSaveActionValueChange = (e) => {
        const newAction = e.target.value;

        props.onValueChange('saveToDb', {
            value:
                newAction === 'new'
                    ? { type: 'new', dataSourceName: '' }
                    : { type: 'overwrite', dataSourceId: dataSources.length > 0 ? dataSources[0].value : '' }
        });
    };

    const onNewDataSourceNameChange = (value: { value: string }) => {
        props.onValueChange('saveToDb', { value: { type: 'new', dataSourceName: value.value } });
    };

    const onDataSourceSelected = (value: string) => {
        props.onValueChange('saveToDb', { value: { type: 'overwrite', dataSourceId: value } });
    };

    const subQuestionWidget =
        props.saveToDb.type === 'new' ? (
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:transitRouting:NewDataSource')}</label>
                <InputString
                    id={'formBatchRoutingSaveToDbAction_newDsName'}
                    value={props.saveToDb.dataSourceName}
                    onValueUpdated={onNewDataSourceNameChange}
                />
            </div>
        ) : (
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:transitRouting:OverwriteDataSource')}</label>
                <InputSelect
                    choices={dataSources}
                    disabled={false}
                    id={'formBatchRoutingSaveToDbAction_selectDs'}
                    value={props.saveToDb.dataSourceId}
                    onValueChange={(e) => onDataSourceSelected(e.target.value)}
                    noBlank={true}
                />
            </div>
        );

    return (
        <React.Fragment>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:transitRouting:DataSource')}</label>
                <InputRadio
                    choices={actionChoices}
                    disabled={false}
                    id={'formBatchRoutingSaveToDbAction'}
                    value={props.saveToDb.type}
                    onValueChange={onSaveActionValueChange}
                    localePrefix={'transit:transitRouting:SaveToDbChoice'}
                    t={props.t}
                />
            </div>
            {subQuestionWidget}
        </React.Fragment>
    );
};

const SaveToDbChoiceComponentTranslated = withTranslation(['transit', 'main'])(SaveToDbChoiceComponent);

const BatchSaveToDbComponent: React.FunctionComponent<BatchAttributesSelectionComponentProps> = (
    props: BatchAttributesSelectionComponentProps
) => {
    return (
        <React.Fragment>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:transitRouting:SaveOdPairsToDb')}</label>
                <InputRadio
                    id={'formBatchRoutingSaveToDbActionYesNo'}
                    value={props.attributes.saveToDb !== false}
                    sameLine={true}
                    disabled={false}
                    choices={[
                        {
                            value: true
                        },
                        {
                            value: false
                        }
                    ]}
                    localePrefix="transit:transitRouting"
                    t={props.t}
                    isBoolean={true}
                    onValueChange={(e) =>
                        props.onValueChange('saveToDb', {
                            value:
                                _toBool(e.target.value) === true
                                    ? { type: 'new', dataSourceName: props.defaultDataSourceName }
                                    : false
                        })
                    }
                />
            </div>
            {props.attributes.saveToDb !== false && props.attributes.saveToDb !== undefined && (
                <SaveToDbChoiceComponentTranslated
                    saveToDb={props.attributes.saveToDb || false}
                    onValueChange={props.onValueChange}
                />
            )}
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(BatchSaveToDbComponent);
