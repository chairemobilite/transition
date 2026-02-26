/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import type { EditMode } from 'transition-common/lib/services/path/PathSegmentTimeUtils';

type SegmentLinesProps = {
    segmentCount: number;
    activeSegmentIndex: number;
    editMode: EditMode;
    onSegmentClick: (index: number) => void;
    hoveredSegmentIndex: number | null;
    onHoverChange: (index: number | null) => void;
    nodeToCol: (nodeIndex: number) => number;
    dotRow: number;
};

const SegmentLines: React.FunctionComponent<SegmentLinesProps> = ({
    segmentCount,
    activeSegmentIndex,
    editMode,
    onSegmentClick,
    hoveredSegmentIndex,
    onHoverChange,
    nodeToCol,
    dotRow
}) => {
    const getSegColor = (idx: number): string => {
        if (editMode === 'segment' && idx === activeSegmentIndex) return '#4fc3f7';
        return 'rgba(255,255,255,0.3)';
    };

    return (
        <>
            {Array.from({ length: segmentCount }, (_, idx) => {
                const isActive = editMode === 'segment' && idx === activeSegmentIndex;
                return (
                    <div
                        key={`seg-${idx}`}
                        data-testid={`overview-seg-${idx}`}
                        onClick={() => onSegmentClick(idx)}
                        onMouseEnter={() => onHoverChange(idx)}
                        onMouseLeave={() => onHoverChange(null)}
                        style={{
                            gridColumn: nodeToCol(idx) + 1,
                            gridRow: dotRow,
                            cursor: 'pointer',
                            padding: '8px 0',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                height: isActive ? 4 : hoveredSegmentIndex === idx ? 4 : 2,
                                background: getSegColor(idx),
                                borderRadius: 2,
                                transition: 'all 0.2s'
                            }}
                        />
                    </div>
                );
            })}
        </>
    );
};

export default SegmentLines;
