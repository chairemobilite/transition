/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

type SegmentLinesProps = {
    segmentCount: number;
    activeSegmentIndex: number;
    onSegmentClick: (index: number) => void;
    hoveredSegmentIndex: number | null;
    onHoverChange: (index: number | null) => void;
    nodeToCol: (nodeIndex: number) => number;
    dotRow: number;
};

/**
 * Renders the connecting line between each pair of consecutive nodes (one line per segment),
 * as a clickable/hoverable hitbox. The active segment's line is drawn thicker and highlighted.
 * Clicking a line selects that segment.
 */
const SegmentLines: React.FunctionComponent<SegmentLinesProps> = ({
    segmentCount,
    activeSegmentIndex,
    onSegmentClick,
    hoveredSegmentIndex,
    onHoverChange,
    nodeToCol,
    dotRow
}) => {
    const getSegColor = (idx: number): string => {
        if (idx === activeSegmentIndex) return '#4fc3f7';
        return 'rgba(255,255,255,0.3)';
    };

    return (
        <>
            {Array.from({ length: segmentCount }, (_, idx) => {
                const isActive = idx === activeSegmentIndex;
                return (
                    <div
                        key={`seg-${idx}`}
                        className="segment-line-hitbox"
                        data-testid={`overview-seg-${idx}`}
                        onClick={() => onSegmentClick(idx)}
                        onMouseEnter={() => onHoverChange(idx)}
                        onMouseLeave={() => onHoverChange(null)}
                        style={{
                            gridColumn: nodeToCol(idx) + 1,
                            gridRow: dotRow
                        }}
                    >
                        <div
                            className="segment-line"
                            style={{
                                height: isActive ? 4 : hoveredSegmentIndex === idx ? 4 : 2,
                                background: getSegColor(idx)
                            }}
                        />
                    </div>
                );
            })}
        </>
    );
};

export default SegmentLines;
