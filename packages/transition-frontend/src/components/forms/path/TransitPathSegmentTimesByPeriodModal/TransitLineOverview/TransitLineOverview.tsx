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

import SegmentLines from './SegmentLines';
import NodeDots from './NodeDots';

// Width per node slot in the full grid (px)
const NODE_SLOT_WIDTH = 130;

type TransitLineOverviewProps = {
    nodeLabels: string[];
    activeSegmentIndex: number;
    onSegmentClick: (index: number) => void;
};

/**
 * Horizontal schematic of the path's line for the segment-times modal: stop nodes drawn as
 * dots (NodeDots) connected by segment lines (SegmentLines), laid out on a CSS grid. When the
 * line has more nodes than fit, it becomes a horizontal carousel (scroll arrows + auto-scroll
 * to the active segment). Lets the user pick which segment to edit by clicking a node or segment.
 */
const TransitLineOverview: React.FunctionComponent<TransitLineOverviewProps> = ({
    nodeLabels,
    activeSegmentIndex,
    onSegmentClick
}) => {
    const nodeCount = nodeLabels.length;
    const segmentCount = nodeCount - 1;

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

        const segLeft = activeSegmentIndex * slotWidth;
        const segRight = (activeSegmentIndex + 2) * slotWidth;
        if (segLeft < viewLeft) scrollToNode(activeSegmentIndex);
        else if (segRight > viewRight) scrollToNode(Math.max(0, activeSegmentIndex + 2 - viewportNodes));
    }, [activeSegmentIndex, needsCarousel, viewportNodes]);

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

    const dotRow = 1;
    const labelRow = 2;

    const nodeToCol = (absIdx: number) => 2 * absIdx + 1;

    if (nodeCount === 0) return null;

    return (
        <div ref={outerRef} className="overview">
            {needsCarousel && (
                <button
                    type="button"
                    onClick={handleScrollLeft}
                    className="overview-nav-btn"
                    style={{
                        color: atStart ? 'rgba(255,255,255,0.2)' : '#fff',
                        cursor: atStart ? 'default' : 'pointer',
                        visibility: atStart ? 'hidden' : 'visible'
                    }}
                >
                    <FontAwesomeIcon icon={faChevronLeft} className="overview-nav-icon" />
                </button>
            )}

            <div ref={scrollRef} className="overview-scroll-area">
                <div className="overview-grid" style={{ gridTemplateColumns, width: gridWidth + 'px' }}>
                    <NodeDots
                        nodeLabels={nodeLabels}
                        activeSegmentIndex={activeSegmentIndex}
                        onSegmentClick={onSegmentClick}
                        nodeToCol={nodeToCol}
                        dotRow={dotRow}
                        labelRow={labelRow}
                    />

                    <SegmentLines
                        segmentCount={segmentCount}
                        activeSegmentIndex={activeSegmentIndex}
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
                    type="button"
                    onClick={handleScrollRight}
                    className="overview-nav-btn"
                    style={{
                        color: atEnd ? 'rgba(255,255,255,0.2)' : '#fff',
                        cursor: atEnd ? 'default' : 'pointer',
                        visibility: atEnd ? 'hidden' : 'visible'
                    }}
                >
                    <FontAwesomeIcon icon={faChevronRight} className="overview-nav-icon" />
                </button>
            )}
        </div>
    );
};

export default React.memo(TransitLineOverview);
