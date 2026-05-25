/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from 'react-modal';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import Path from 'transition-common/lib/services/path/Path';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

import useSegmentTimesByPeriod from './useSegmentTimesByPeriod';
import TransitLineOverview from './TransitLineOverview/TransitLineOverview';
import SegmentTimesToolbar from './SegmentTimesToolbar';
import SegmentCarousel from './SegmentCarousel';
import SegmentPeriodTimesTable from './SegmentPeriodTimesTable';

type TransitPathSegmentTimesByPeriodModalProps = {
    isOpen: boolean;
    path: Path;
    onClose: () => void;
};

const TransitPathSegmentTimesByPeriodModal: React.FunctionComponent<TransitPathSegmentTimesByPeriodModalProps> = (
    props
) => {
    const { t } = useTranslation('transit');

    const { pathDisplay, serviceSelection, navigation, segmentEdit, save } = useSegmentTimesByPeriod({
        path: props.path,
        onClose: props.onClose
    });

    const { segmentCount, periods, nodeLabels } = pathDisplay;
    const { serviceChoices, selectedServiceIndex, setSelectedServiceIndex } = serviceSelection;
    const { activeSegmentIndex, goToPrevSegment, goToNextSegment, handleSegmentClick } = navigation;
    const { getTimeForCell, handleCellChange } = segmentEdit;
    const { handleSave, hasLengthMismatch, saveError } = save;

    if (segmentCount === 0) {
        return (
            <Modal
                isOpen={props.isOpen}
                onRequestClose={props.onClose}
                className="modal-segment-times"
                overlayClassName="modal-segment-times-overlay"
                contentLabel={t('transit:transitPath:SegmentTimesByPeriod')}
            >
                <h3>{t('transit:transitPath:SegmentTimesByPeriod')}</h3>
                <p className="_orange">{t('transit:transitPath:NoSegmentsAvailable')}</p>
                <div className="tr__form-buttons-container _center">
                    <Button color="grey" label={t('main:Cancel')} onClick={props.onClose} />
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={props.isOpen}
            onRequestClose={props.onClose}
            className="modal-segment-times"
            overlayClassName="modal-segment-times-overlay"
            contentLabel={t('transit:transitPath:SegmentTimesByPeriod')}
            onAfterOpen={() => {
                document.body.style.overflow = 'hidden';
            }}
            onAfterClose={() => {
                document.body.style.overflow = '';
            }}
        >
            <button type="button" onClick={props.onClose} className="close-btn">
                <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3 className="title">{t('transit:transitPath:SegmentTimesByPeriod')}</h3>

            <div className="scrollable-body">
                <SegmentTimesToolbar
                    selectedServiceId={selectedServiceIndex}
                    serviceChoices={serviceChoices}
                    onServiceChange={setSelectedServiceIndex}
                />

                {hasLengthMismatch() && (
                    <p className="_orange warning-msg">{t('transit:transitPath:SegmentLengthMismatch')}</p>
                )}

                {serviceChoices.length === 0 && (
                    <p className="_orange warning-msg">{t('transit:transitPath:NoServicesForPath')}</p>
                )}

                {serviceChoices.length > 0 && periods.length === 0 && (
                    <p className="_orange warning-msg">{t('transit:transitPath:NoTripsGeneratedInfo')}</p>
                )}

                <TransitLineOverview
                    nodeLabels={nodeLabels}
                    activeSegmentIndex={activeSegmentIndex}
                    onSegmentClick={handleSegmentClick}
                />

                <div className="content-column">
                    <SegmentCarousel
                        onPrevious={goToPrevSegment}
                        onNext={goToNextSegment}
                        hidePrevious={activeSegmentIndex === 0}
                        hideNext={activeSegmentIndex === segmentCount - 1}
                        startLabel={nodeLabels[activeSegmentIndex]}
                        endLabel={nodeLabels[activeSegmentIndex + 1]}
                    >
                        <div className="segment-viz">
                            <div className="segment-viz-endpoint segment" />
                            <div className="segment-viz-line segment">
                                <span className="segment-viz-info">
                                    {t('transit:transitPath:Segment')} {activeSegmentIndex + 1}/{segmentCount}
                                </span>
                            </div>
                            <div className="segment-viz-endpoint segment" />
                        </div>
                    </SegmentCarousel>

                    <SegmentPeriodTimesTable
                        periods={periods}
                        getTimeForPeriod={(periodShortname) => getTimeForCell(activeSegmentIndex, periodShortname)}
                        onTimeChange={(periodShortname, newSec) =>
                            handleCellChange(activeSegmentIndex, periodShortname, newSec)
                        }
                    />
                </div>
            </div>

            {saveError && <p className="_error _small">{saveError}</p>}
            <div className="tr__form-buttons-container _center footer">
                <Button color="green" label={t('main:Save')} onClick={handleSave} />
                <Button color="grey" label={t('main:Cancel')} onClick={props.onClose} />
            </div>
        </Modal>
    );
};

export default TransitPathSegmentTimesByPeriodModal;
