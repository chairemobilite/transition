/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';

import type { Checkpoint, EditMode } from 'transition-common/lib/services/path/PathSegmentTimeUtils';
import CheckpointLines from './CheckpointLines';
import SegmentLines from './SegmentLines';
import NodeDots from './NodeDots';

// Width per node slot in the full grid (px)
const NODE_SLOT_WIDTH = 130;

type TransitLineOverviewProps = {
    nodeLabels: string[];
    activeSegmentIndex: number;
    onSegmentClick: (index: number) => void;
    checkpoints: Checkpoint[];
    activeCheckpointIndex: number;
    editMode: EditMode;
    onCheckpointClick: (index: number) => void;
};

const TransitLineOverview: React.FunctionComponent<TransitLineOverviewProps> = ({
    nodeLabels,
    activeSegmentIndex,
    onSegmentClick,
    checkpoints,
    activeCheckpointIndex,
    editMode,
    onCheckpointClick
}) => {
    const nodeCount = nodeLabels.length;
    const segmentCount = nodeCount - 1;
    if (nodeCount === 0) return null;

    const outerRef = React.useRef<HTMLDivElement>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const segmentSlotWidth = NODE_SLOT_WIDTH;
    const nodeSlotWidth = 20;
    const gridWidth = nodeCount * nodeSlotWidth + segmentCount * segmentSlotWidth + 80;

    const slotWidth = nodeSlotWidth + segmentSlotWidth;
    const [viewportNodes, setViewportNodes] = React.useState(nodeCount);
    React.useEffect(() => {
        const measure = () => {
            if (scrollRef.current) {
                const fits = Math.max(3, Math.floor(scrollRef.current.clientWidth / slotWidth));
                setViewportNodes(fits);
            } else if (outerRef.current) {
                const navSpace = 80;
                const fits = Math.max(3, Math.floor((outerRef.current.offsetWidth - navSpace) / slotWidth));
                setViewportNodes(fits);
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const needsCarousel = nodeCount > viewportNodes;
    const pageSize = Math.max(1, viewportNodes - 1);

    const [atStart, setAtStart] = React.useState(true);
    const [atEnd, setAtEnd] = React.useState(false);
    const [hoveredSegmentIndex, setHoveredSegmentIndex] = React.useState<number | null>(null);
    const [hoveredCheckpointIndex, setHoveredCheckpointIndex] = React.useState<number | null>(null);

    const updateScrollEdges = React.useCallback(() => {
        if (!scrollRef.current) return;
        const el = scrollRef.current;
        setAtStart(el.scrollLeft <= 1);
        setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    }, []);

    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateScrollEdges();
        el.addEventListener('scroll', updateScrollEdges);
        return () => el.removeEventListener('scroll', updateScrollEdges);
    }, [updateScrollEdges]);

    const scrollToNode = (nodeIdx: number) => {
        if (!scrollRef.current) return;
        const targetX = nodeIdx * slotWidth;
        scrollRef.current.scrollTo({ left: targetX, behavior: 'smooth' });
    };

    React.useEffect(() => {
        if (!scrollRef.current || !needsCarousel) return;
        const el = scrollRef.current;
        const viewLeft = el.scrollLeft;
        const viewRight = viewLeft + el.clientWidth;

        if (editMode === 'segment') {
            const segLeft = activeSegmentIndex * slotWidth;
            const segRight = (activeSegmentIndex + 2) * slotWidth;
            if (segLeft < viewLeft) scrollToNode(activeSegmentIndex);
            else if (segRight > viewRight) scrollToNode(Math.max(0, activeSegmentIndex + 2 - viewportNodes));
        } else if (editMode === 'checkpoint' && checkpoints[activeCheckpointIndex]) {
            const checkpoint = checkpoints[activeCheckpointIndex];
            const checkpointRight = (checkpoint.toNodeIndex + 1) * slotWidth;
            if (checkpointRight > viewRight) {
                scrollToNode(Math.max(0, checkpoint.toNodeIndex + 1 - viewportNodes));
            } else {
                const checkpointLeft = checkpoint.fromNodeIndex * slotWidth;
                if (checkpointLeft < viewLeft) scrollToNode(Math.max(0, checkpoint.toNodeIndex + 1 - viewportNodes));
            }
        }
    }, [activeSegmentIndex, activeCheckpointIndex, editMode, needsCarousel, viewportNodes]);

    const handleScrollLeft = () => {
        if (!scrollRef.current) return;
        const currentNode = Math.round(scrollRef.current.scrollLeft / slotWidth);
        scrollToNode(Math.max(0, currentNode - pageSize));
    };

    const handleScrollRight = () => {
        if (!scrollRef.current) return;
        const currentNode = Math.round(scrollRef.current.scrollLeft / slotWidth);
        scrollToNode(Math.min(nodeCount - viewportNodes, currentNode + pageSize));
    };

    const gridTemplateColumns = Array.from({ length: 2 * segmentCount + 1 }, (_, i) =>
        i % 2 === 0 ? `${nodeSlotWidth}px` : `${segmentSlotWidth}px`
    ).join(' ');

    const hasCheckpoints = checkpoints.length > 0;
    const cpRow = hasCheckpoints ? 1 : 0;
    const dotRow = cpRow + 1;
    const labelRow = cpRow + 2;

    const nodeToCol = (absIdx: number) => 2 * absIdx + 1;

    const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
        fontSize: '1.2em',
        background: 'none',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '50%',
        width: '1.6em',
        height: '1.6em',
        color: disabled ? 'rgba(255,255,255,0.2)' : '#fff',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    });

    return (
        <div
            ref={outerRef}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem', flexShrink: 0, padding: '0.5rem 0' }}
        >
            {needsCarousel && (
                <button
                    onClick={handleScrollLeft}
                    style={{ ...navBtnStyle(false), visibility: atStart ? 'hidden' : 'visible' }}
                    aria-label="Scroll overview left"
                >
                    <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: '0.7em' }} />
                </button>
            )}

            <div
                ref={scrollRef}
                style={
                    {
                        flex: 1,
                        overflowX: 'scroll',
                        overflowY: 'hidden',
                        minWidth: 0,
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    } as React.CSSProperties
                }
            >
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns,
                        width: `${gridWidth}px`,
                        alignItems: 'center',
                        rowGap: '2px',
                        paddingLeft: '16px'
                    }}
                >
                    {hasCheckpoints && (
                        <CheckpointLines
                            checkpoints={checkpoints}
                            activeCheckpointIndex={activeCheckpointIndex}
                            editMode={editMode}
                            onCheckpointClick={onCheckpointClick}
                            hoveredCheckpointIndex={hoveredCheckpointIndex}
                            onHoverChange={setHoveredCheckpointIndex}
                            nodeToCol={nodeToCol}
                        />
                    )}

                    <NodeDots
                        nodeLabels={nodeLabels}
                        activeSegmentIndex={activeSegmentIndex}
                        editMode={editMode}
                        onSegmentClick={onSegmentClick}
                        nodeToCol={nodeToCol}
                        dotRow={dotRow}
                        labelRow={labelRow}
                    />

                    <SegmentLines
                        segmentCount={segmentCount}
                        activeSegmentIndex={activeSegmentIndex}
                        editMode={editMode}
                        onSegmentClick={onSegmentClick}
                        hoveredSegmentIndex={hoveredSegmentIndex}
                        onHoverChange={setHoveredSegmentIndex}
                        nodeToCol={nodeToCol}
                        dotRow={dotRow}
                    />
                </div>
            </div>

            {needsCarousel && (
                <button
                    onClick={handleScrollRight}
                    style={{ ...navBtnStyle(false), visibility: atEnd ? 'hidden' : 'visible' }}
                    aria-label="Scroll overview right"
                >
                    <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '0.7em' }} />
                </button>
            )}
        </div>
    );
};

export default TransitLineOverview;
