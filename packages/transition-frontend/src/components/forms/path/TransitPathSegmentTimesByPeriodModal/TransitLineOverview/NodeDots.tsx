/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import type { EditMode } from 'transition-common/lib/services/path/PathSegmentTimeUtils';

type NodeDotsProps = {
    nodeLabels: string[];
    activeSegmentIndex: number;
    editMode: EditMode;
    onSegmentClick: (index: number) => void;
    nodeToCol: (nodeIndex: number) => number;
    dotRow: number;
    labelRow: number;
};

const NodeDots: React.FunctionComponent<NodeDotsProps> = ({
    nodeLabels,
    activeSegmentIndex,
    editMode,
    onSegmentClick,
    nodeToCol,
    dotRow,
    labelRow
}) => {
    const nodeCount = nodeLabels.length;

    const isNodeActiveSegment = (idx: number) =>
        editMode === 'segment' && (idx === activeSegmentIndex || idx === activeSegmentIndex + 1);

    const isFirstOrLast = (idx: number) => idx === 0 || idx === nodeCount - 1;

    const getNodeColor = (idx: number): string => {
        if (isNodeActiveSegment(idx)) return '#4fc3f7';
        if (isFirstOrLast(idx)) return 'rgba(255,255,255,0.8)';
        return 'rgba(255,255,255,0.5)';
    };

    const getDotSize = (idx: number, isActive: boolean): number => {
        if (isFirstOrLast(idx)) return 32;
        return isActive ? 12 : 8;
    };

    return (
        <>
            {/* Node dots */}
            {nodeLabels.map((label, idx) => {
                const isActive = isNodeActiveSegment(idx);
                const size = getDotSize(idx, isActive);
                return (
                    <div
                        key={`dot-${idx}`}
                        data-testid={`overview-node-${idx}`}
                        style={{
                            gridColumn: nodeToCol(idx),
                            gridRow: dotRow,
                            justifySelf: 'center',
                            width: size,
                            height: size,
                            borderRadius: '50%',
                            background: getNodeColor(idx),
                            border: isFirstOrLast(idx)
                                ? '3px solid #fff'
                                : isActive
                                    ? '2px solid #fff'
                                    : '1px solid rgba(255,255,255,0.3)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onClick={() => {
                            if (idx < nodeCount - 1) onSegmentClick(idx);
                            else if (idx > 0) onSegmentClick(idx - 1);
                        }}
                        title={label}
                    />
                );
            })}

            {/* Node labels (diagonal) */}
            {nodeLabels.map((label, idx) => (
                <div
                    key={`label-${idx}`}
                    style={{
                        gridColumn: nodeToCol(idx),
                        gridRow: labelRow,
                        justifySelf: 'center',
                        position: 'relative',
                        height: '110px'
                    }}
                >
                    <span
                        title={label}
                        style={{
                            position: 'absolute',
                            left: '15px',
                            transformOrigin: 'top left',
                            transform: 'rotate(45deg)',
                            fontSize: '0.55em',
                            whiteSpace: 'wrap',
                            maxWidth: '120px',
                            minWidth: '120px',
                            lineHeight: 1.2,
                            color: getNodeColor(idx),
                            transition: 'color 0.2s'
                        }}
                    >
                        {label}
                    </span>
                </div>
            ))}
        </>
    );
};

export default NodeDots;
