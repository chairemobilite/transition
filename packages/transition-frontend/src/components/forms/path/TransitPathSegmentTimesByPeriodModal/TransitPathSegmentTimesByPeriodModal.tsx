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

const modalStyle: Modal.Styles = {
    content: {
        position: 'absolute',
        inset: '3vh 5vw',
        width: '90vw',
        maxWidth: '90vw',
        maxHeight: '94vh',
        background: 'rgba(0,0,0,0.9)',
        border: '5px solid rgba(255,255,255,0.5)',
        borderRadius: '2rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: 'none',
        left: '5vw',
        right: '5vw'
    },
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 500,
        overflow: 'hidden'
    }
};

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
        segments,
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
        getAverageTotal,
        getPeriodTotal,
        getCheckpointCurrentTotal,
        getCheckpointAverageTotal,
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
        hasLengthMismatch,
        saveError
    } = useSegmentTimesByPeriod({ path: props.path, onClose: props.onClose });

    if (segmentCount === 0) {
        return (
            <Modal
                isOpen={props.isOpen}
                onRequestClose={props.onClose}
                style={modalStyle}
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
            style={modalStyle}
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
                style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '1.3em',
                    cursor: 'pointer',
                    zIndex: 1
                }}
                aria-label="Close"
            >
                <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3 style={{ marginBottom: '0.5rem', flexShrink: 0 }}>{t('transit:transitPath:SegmentTimesByPeriod')}</h3>

            <div
                style={
                    {
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    } as React.CSSProperties
                }
            >
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
                    <p className="_orange" style={{ flexShrink: 0 }}>
                        {t('transit:transitPath:SegmentLengthMismatch')}
                    </p>
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
                    checkpoints={checkpoints}
                    activeCheckpointIndex={activeCheckpointIndex}
                    editMode={editMode}
                    onCheckpointClick={handleCheckpointClick}
                />

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        marginTop: '0.5rem'
                    }}
                >
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
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            background: '#4fc3f7',
                                            border: '3px solid #fff',
                                            flexShrink: 0
                                        }}
                                    />
                                    <div
                                        style={{
                                            flex: 1,
                                            height: 4,
                                            background: '#4fc3f7',
                                            borderRadius: 2,
                                            position: 'relative'
                                        }}
                                    >
                                        <span
                                            style={{
                                                position: 'absolute',
                                                top: '-1.3em',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                fontSize: '0.75em',
                                                whiteSpace: 'nowrap',
                                                color: 'rgba(255,255,255,0.6)'
                                            }}
                                        >
                                            {t('transit:transitPath:Segment')} {activeSegmentIndex + 1}/{segmentCount}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            background: '#4fc3f7',
                                            border: '3px solid #fff',
                                            flexShrink: 0
                                        }}
                                    />
                                </div>
                            </SegmentCarousel>

                            <SegmentPeriodTimesTable
                                averageSegmentSeconds={segments[activeSegmentIndex].travelTimeSeconds}
                                averageTotal={getAverageTotal()}
                                periods={periods}
                                language={i18n.language}
                                locked={isSegmentInAnyCheckpoint(activeSegmentIndex)}
                                lockedMessage={t('transit:transitPath:SegmentLockedByCheckpoint')}
                                getTimeForPeriod={(periodShortname) =>
                                    getTimeForCell(activeSegmentIndex, periodShortname)
                                }
                                getPeriodTotal={getPeriodTotal}
                                onTimeChange={(periodShortname, newSec) =>
                                    handleCellChange(activeSegmentIndex, periodShortname, newSec)
                                }
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
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: '-1.3em',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        fontSize: '0.75em',
                                        whiteSpace: 'nowrap',
                                        color: 'rgba(255,255,255,0.6)'
                                    }}
                                >
                                    {t('transit:transitPath:Checkpoint')} {activeCheckpointIndex + 1}/
                                    {checkpoints.length} (
                                    {activeCheckpoint.toNodeIndex - activeCheckpoint.fromNodeIndex}{' '}
                                    {t('transit:transitPath:Segments').toLowerCase()})
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            background: '#ff9800',
                                            border: '3px solid #fff',
                                            flexShrink: 0
                                        }}
                                    />
                                    {Array.from(
                                        {
                                            length: Math.min(
                                                activeCheckpoint.toNodeIndex - activeCheckpoint.fromNodeIndex - 1,
                                                30
                                            )
                                        },
                                        (_, i) => (
                                            <React.Fragment key={i}>
                                                <div
                                                    style={{
                                                        flex: 1,
                                                        height: 3,
                                                        background: '#ff9800',
                                                        borderRadius: 2
                                                    }}
                                                />
                                                <div
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: '#ff9800',
                                                        flexShrink: 0
                                                    }}
                                                />
                                            </React.Fragment>
                                        )
                                    )}
                                    <div style={{ flex: 1, height: 3, background: '#ff9800', borderRadius: 2 }} />
                                    <div
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            background: '#ff9800',
                                            border: '3px solid #fff',
                                            flexShrink: 0
                                        }}
                                    />
                                </div>
                            </SegmentCarousel>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginTop: '0.5rem',
                                    flexShrink: 0,
                                    justifyContent: 'flex-end'
                                }}
                            >
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
                                averageTotal={getCheckpointAverageTotal(activeCheckpoint)}
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

            <div className="tr__form-buttons-container _center" style={{ marginTop: '0.5rem', flexShrink: 0 }}>
                <Button color="green" label={t('main:Save')} onClick={handleSave} />
                <Button color="grey" label={t('main:Cancel')} onClick={props.onClose} />
            </div>
        </Modal>
    );
};

export default TransitPathSegmentTimesByPeriodModal;
