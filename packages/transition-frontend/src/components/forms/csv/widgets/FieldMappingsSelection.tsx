/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import * as FieldMappingWidgets from './FieldMappingWidgets';
import { CsvFieldMappingDescriptor, FileAndMappingAttributes } from 'transition-common/lib/services/csv';

export type SingleFieldMappingComponentProps = {
    mappingDescriptor: CsvFieldMappingDescriptor;
    currentMappings: Partial<FileAndMappingAttributes['fieldMappings']>;
    csvFieldChoices: choiceType[];
    onValueChange: (fieldName: string, value: { value: string }) => void;
};

const SingleFieldMappingComponent: React.FunctionComponent<SingleFieldMappingComponentProps> = (
    props: SingleFieldMappingComponentProps
) => {
    switch (props.mappingDescriptor.type) {
    case 'latLon': // Name as string, it is just informative to add the projection selection
        return (
            <FieldMappingWidgets.LatLonMappingSelectionWidget
                csvFieldChoices={props.csvFieldChoices}
                fieldName={props.mappingDescriptor.key}
                i18nlabel={props.mappingDescriptor.i18nLabel}
                currentLatValue={props.currentMappings[`${props.mappingDescriptor.key}Lat`]}
                currentLonValue={props.currentMappings[`${props.mappingDescriptor.key}Lon`]}
                onValueChange={props.onValueChange}
            />
        );
    case 'single':
        return (
            <FieldMappingWidgets.SingleMappingSelectionWidget
                csvFieldChoices={props.csvFieldChoices}
                fieldName={props.mappingDescriptor.key}
                i18nlabel={props.mappingDescriptor.i18nLabel}
                currentMappingValue={props.currentMappings[props.mappingDescriptor.key]}
                onValueChange={props.onValueChange}
            />
        );
    case 'routingTime':
        return (
            <FieldMappingWidgets.RoutingTimeMappingSelectionWidget
                csvFieldChoices={props.csvFieldChoices}
                fieldName={props.mappingDescriptor.key}
                i18nlabel={props.mappingDescriptor.i18nLabel}
                currentMappingValue={props.currentMappings[props.mappingDescriptor.key]}
                currentTimeType={props.currentMappings[`${props.mappingDescriptor.key}Type`] as any}
                currentTimeFormat={props.currentMappings[`${props.mappingDescriptor.key}Format`] as any}
                onValueChange={props.onValueChange}
            />
        );
    default:
        return null;
    }
};

export type FieldMappingsSelectionComponentProps = {
    mappingDescriptors: CsvFieldMappingDescriptor[];
    currentMappings: Partial<FileAndMappingAttributes['fieldMappings']>;
    csvFields: string[];
    onValueChange: (fieldName: string, value: { value: string }) => void;
};

const FieldMappingsSelectionComponent: React.FunctionComponent<FieldMappingsSelectionComponentProps> = (
    props: FieldMappingsSelectionComponentProps
) => {
    const shouldShowProjection = React.useMemo(() => {
        return props.mappingDescriptors.some((descriptor) => descriptor.type === 'latLon');
    }, [props.mappingDescriptors]);

    const csvFieldChoices = React.useMemo(() => {
        return props.csvFields.map((csvAttribute) => {
            return { label: csvAttribute, value: csvAttribute };
        });
    }, [props.csvFields]);

    return (
        <React.Fragment>
            {shouldShowProjection && (
                <FieldMappingWidgets.GeographicProjectionWidget
                    fieldName="projection"
                    i18nlabel="main:Projection"
                    currentMappingValue={props.currentMappings.projection}
                    onValueChange={props.onValueChange}
                />
            )}
            {props.mappingDescriptors.map((descriptor) => (
                <SingleFieldMappingComponent
                    key={descriptor.key}
                    mappingDescriptor={descriptor}
                    currentMappings={props.currentMappings}
                    csvFieldChoices={csvFieldChoices}
                    onValueChange={props.onValueChange}
                />
            ))}
        </React.Fragment>
    );
};

export default FieldMappingsSelectionComponent;
