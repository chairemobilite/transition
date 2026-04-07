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
import CheckpointPeriodTimesTable from './CheckpointPeriodTimesTable';

type TransitPathSegmentTimesByPeriodModalProps = {
    isOpen: boolean;
    path: Path;
    onClose: () => void;
};

const TransitPathSegmentTimesByPeriodModal: React.FunctionComponent<TransitPathSegmentTimesByPeriodModalProps> = (
    props
) => {
    const { t, i18n } = useTranslation('transit');

    const {
        segmentCount,
        periods,
        serviceChoices,
        nodeLabels,
        nodeChoices,
        selectedGroupIndex,
        setSelectedGroupIndex,
        noGrouping,
        setNoGrouping,
        activeSegmentIndex,
        editMode,
        checkpoints,
        activeCheckpointIndex,
        activeCheckpoint,
        newCheckpointFrom,
        newCheckpointTo,
        newCheckpointMaxTo,
        newCheckpointMinFrom,
        setNewCheckpointFrom,
        setNewCheckpointTo,
        getTimeForCell,
        handleCellChange,
        isSegmentInAnyCheckpoint,
        getStopTimeForSegment,
        setStopTimeForSegment,
        getDepartureTimeAtSegment,
        getArrivalTimeAfterSegment,
        getCheckpointCurrentTotal,
        getCheckpointTotalStopTime,
        getCheckpointTarget,
        setCheckpointTarget,
        handleDistribute,
        addCheckpoint,
        removeCheckpoint,
        goToPrevSegment,
        goToNextSegment,
        goToPrevCheckpoint,
        goToNextCheckpoint,
        handleSegmentClick,
        handleCheckpointClick,
        handleSave,
        hasLengthMismatch
    } = useSegmentTimesByPeriod({ path: props.path, language: i18n.language, onClose: props.onClose });

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
            <button
                onClick={props.onClose}
                className="close-btn"
                aria-label="Close"
            >
                <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3 className="title">{t('transit:transitPath:SegmentTimesByPeriod')}</h3>

            <div className="scrollable-body">
                <SegmentTimesToolbar
                    nodeChoices={nodeChoices}
                    newCheckpointFrom={newCheckpointFrom}
                    newCheckpointTo={newCheckpointTo}
                    newCheckpointMaxTo={newCheckpointMaxTo}
                    newCheckpointMinFrom={newCheckpointMinFrom}
                    segmentCount={segmentCount}
                    onNewCheckpointFromChange={setNewCheckpointFrom}
                    onNewCheckpointToChange={setNewCheckpointTo}
                    onAddCheckpoint={addCheckpoint}
                    selectedServiceId={selectedGroupIndex}
                    serviceChoices={serviceChoices}
                    onServiceChange={setSelectedGroupIndex}
                    noGrouping={noGrouping}
                    onNoGroupingChange={setNoGrouping}
                />

                {hasLengthMismatch() && (
                    <p className="_orange warning-msg">
                        {t('transit:transitPath:SegmentLengthMismatch')}
                    </p>
                )}

                {periods.length === 0 && (
                    <p className="_orange warning-msg">
                        {t('transit:transitPath:NoTripsGeneratedInfo')}
                    </p>
                )}

                <TransitLineOverview
                    nodeLabels={nodeLabels}
                    activeSegmentIndex={activeSegmentIndex}
                    onSegmentClick={handleSegmentClick}
                    checkpoints={checkpoints}
                    activeCheckpointIndex={activeCheckpointIndex}
                    editMode={editMode}
                    onCheckpointClick={handleCheckpointClick}
                />

                <div className="content-column">
                    {editMode === 'segment' && (
                        <>
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
                                isFirstSegment={activeSegmentIndex === 0}
                                periods={periods}
                                language={i18n.language}
                                locked={isSegmentInAnyCheckpoint(activeSegmentIndex)}
                                lockedMessage={t('transit:transitPath:SegmentLockedByCheckpoint')}
                                getTimeForPeriod={(periodShortname) => getTimeForCell(activeSegmentIndex, periodShortname)}
                                getStopTime={() => getStopTimeForSegment(activeSegmentIndex)}
                                onStopTimeChange={(newSec) => setStopTimeForSegment(activeSegmentIndex, newSec)}
                                getArrivalTimePrevSegment={(periodShortname) => activeSegmentIndex > 0 ? getArrivalTimeAfterSegment(activeSegmentIndex - 1, periodShortname) : 0}
                                getDepartureTime={(periodShortname) => getDepartureTimeAtSegment(activeSegmentIndex, periodShortname)}
                                getArrivalTime={(periodShortname) => getArrivalTimeAfterSegment(activeSegmentIndex, periodShortname)}
                                onTimeChange={(periodShortname, newSec) => handleCellChange(activeSegmentIndex, periodShortname, newSec)}
                            />
                        </>
                    )}

                    {editMode === 'checkpoint' && activeCheckpoint && (
                        <>
                            <SegmentCarousel
                                onPrevious={goToPrevCheckpoint}
                                onNext={goToNextCheckpoint}
                                hidePrevious={activeCheckpointIndex === 0}
                                hideNext={activeCheckpointIndex === checkpoints.length - 1}
                                startLabel={nodeLabels[activeCheckpoint.fromNodeIndex]}
                                endLabel={nodeLabels[activeCheckpoint.toNodeIndex]}
                            >
                                <span className="segment-viz-info">
                                    {t('transit:transitPath:Checkpoint')} {activeCheckpointIndex + 1}/
                                    {checkpoints.length} (
                                    {activeCheckpoint.toNodeIndex - activeCheckpoint.fromNodeIndex}{' '}
                                    {t('transit:transitPath:Segments').toLowerCase()})
                                </span>
                                <div className="segment-viz">
                                    <div className="segment-viz-endpoint checkpoint" />
                                    {Array.from(
                                        {
                                            length: Math.min(
                                                activeCheckpoint.toNodeIndex - activeCheckpoint.fromNodeIndex - 1,
                                                30
                                            )
                                        },
                                        (_, i) => (
                                            <React.Fragment key={i}>
                                                <div className="segment-viz-line checkpoint" />
                                                <div className="checkpoint-viz-midpoint" />
                                            </React.Fragment>
                                        )
                                    )}
                                    <div className="segment-viz-line checkpoint" />
                                    <div className="segment-viz-endpoint checkpoint" />
                                </div>
                            </SegmentCarousel>

                            <div className="checkpoint-actions">
                                <Button
                                    color="blue"
                                    label={t('transit:transitPath:DistributeToSegments')}
                                    onClick={() => handleDistribute(activeCheckpoint)}
                                />
                                <Button
                                    color="grey"
                                    label={t('transit:transitPath:RemoveCheckpoint')}
                                    onClick={() => removeCheckpoint(activeCheckpointIndex)}
                                />
                            </div>

                            <CheckpointPeriodTimesTable
                                totalStopTimeSeconds={getCheckpointTotalStopTime(activeCheckpoint)}
                                periods={periods}
                                language={i18n.language}
                                getCurrentTotal={(periodShortname) =>
                                    getCheckpointCurrentTotal(activeCheckpoint, periodShortname)
                                }
                                getTarget={(periodShortname) => getCheckpointTarget(activeCheckpoint, periodShortname)}
                                onTargetChange={(periodShortname, newSec) =>
                                    setCheckpointTarget(activeCheckpoint, periodShortname, newSec)
                                }
                            />
                        </>
                    )}
                </div>
            </div>

            <div className="tr__form-buttons-container _center footer">
                <Button color="green" label={t('main:Save')} onClick={handleSave} />
                <Button color="grey" label={t('main:Cancel')} onClick={props.onClose} />
            </div>
        </Modal>
    );
};

export default TransitPathSegmentTimesByPeriodModal;
