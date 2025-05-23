/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import Collapsible from 'react-collapsible';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Service from 'transition-common/lib/services/service/Service';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import DocumentationTooltip from '../../parts/DocumentationTooltip';
import MathJax from 'react-mathjax';
import TransitServiceLinesDetail from '../service/TransitServiceLinesDetail';

interface ScheduleButtonProps extends WithTranslation {
    service: Service;
    selectedService?: Service;
}

const TransitServiceButton: React.FunctionComponent<ScheduleButtonProps> = (props: ScheduleButtonProps) => {
    const [detailsOpened, setDetailsOpened] = React.useState(false);
    const serviceIsSelected =
        (props.selectedService && props.selectedService.getId() === props.service.getId()) || false;

    const onSelect: React.MouseEventHandler = (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        props.service.startEditing();
        serviceLocator.selectedObjectsManager.setSelection('service', [props.service]);
    };

    const onDelete: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        await props.service.delete(serviceLocator.socketEventManager);

        if (serviceIsSelected) {
            serviceLocator.selectedObjectsManager.deselect('service');
        }
        serviceLocator.collectionManager.refresh('services');
    };

    const onDuplicate: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        serviceLocator.socketEventManager.emit(
            'transitServices.duplicate',
            [props.service.getId()],
            { newServiceSuffix: props.t('main:copy') },
            async (response: Status.Status<string[]>) => {
                if (Status.isStatusOk(response)) {
                    await serviceLocator.collectionManager
                        .get('services')
                        .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
                    serviceLocator.collectionManager.refresh('services');
                } else {
                    console.error(response.error); // todo: better error handling
                }
            }
        );
    };

    const service = props.service;
    const isFrozen = service.isFrozen();
    const serviceId = service.getId();

    const hasScheduledLines = service.hasScheduledLines();
    const scheduledLineCount = hasScheduledLines ? service.scheduledLineIds().length : 0;

    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const serviceWeekdays: string[] = [];
    let serviceWeekdaysStr = '';
    for (let i = 0, count = weekdays.length; i < count; i++) {
        if (service.attributes[weekdays[i]] === true) {
            serviceWeekdays.push(props.t(`main:dateTime:weekdaysAbbr:${weekdays[i]}`));
        }
    }
    if (serviceWeekdays.length > 0) {
        serviceWeekdaysStr += ` (${serviceWeekdays.join(', ')})`;
    }
    if (service.get('start_date') && service.get('end_date')) {
        serviceWeekdaysStr += ` [${service.get('start_date')} -> ${service.get('end_date')}]`;
    } else if (service.get('start_date')) {
        serviceWeekdaysStr += ` [${service.get('start_date')} -> ...]`;
    }

    return (
        <React.Fragment>
            <Button
                key={serviceId}
                isSelected={serviceIsSelected}
                onSelect={{ handler: onSelect }}
                onDuplicate={{ handler: onDuplicate, altText: props.t('transit:transitService:DuplicateService') }}
                onDelete={
                    !isFrozen && !serviceIsSelected
                        ? {
                            handler: onDelete,
                            message: hasScheduledLines
                                ? props.t('transit:transitService:ConfirmDeleteWithSchedule')
                                : props.t('transit:transitService:ConfirmDelete'),
                            altText: props.t('transit:transitService:Delete')
                        }
                        : undefined
                }
                flushActionButtons={scheduledLineCount === 0}
            >
                <ButtonCell alignment="left">
                    <span className="_circle-button" style={{ backgroundColor: service.attributes.color }}></span>
                </ButtonCell>
                {isFrozen && (
                    <ButtonCell alignment="left">
                        <img
                            className="_icon-alone"
                            src={'/dist/images/icons/interface/lock_white.svg'}
                            alt={props.t('main:Locked')}
                        />
                    </ButtonCell>
                )}
                <ButtonCell alignment="left">
                    {service.get('name') as string}
                    {serviceWeekdaysStr}
                </ButtonCell>
            </Button>
            {scheduledLineCount > 0 && (
                <div className="tr__form-services-panel-lines-list">
                    <Button
                        key={`lines${props.service.getId()}`}
                        isSelected={serviceIsSelected}
                        flushActionButtons={false}
                    >
                        <DocumentationTooltip dataTooltipId="line-tooltip" documentationLabel="line" />
                        <Collapsible
                            lazyRender={true}
                            trigger={
                                <MathJax.Provider>
                                    {scheduledLineCount > 1
                                        ? props.t('transit:transitService:nLines', { n: scheduledLineCount })
                                        : props.t('transit:transitService:oneLine')}
                                    &nbsp;
                                    <span>
                                        <MathJax.Node inline formula={'L'} data-tooltip-id="line-tooltip" />
                                    </span>
                                </MathJax.Provider>
                            }
                            transitionTime={200}
                            onOpen={() => setDetailsOpened(true)}
                            onClose={() => setDetailsOpened(false)}
                        >
                            {detailsOpened && <TransitServiceLinesDetail service={props.service} />}
                        </Collapsible>
                    </Button>
                </div>
            )}
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(TransitServiceButton);
