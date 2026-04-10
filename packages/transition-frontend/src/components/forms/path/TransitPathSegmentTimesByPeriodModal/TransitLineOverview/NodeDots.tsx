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
                        className="node-dot"
                        style={{
                            gridColumn: nodeToCol(idx),
                            gridRow: dotRow,
                            width: size,
                            height: size,
                            background: getNodeColor(idx),
                            border: isFirstOrLast(idx)
                                ? '3px solid #fff'
                                : isActive
                                    ? '2px solid #fff'
                                    : '1px solid rgba(255,255,255,0.3)'
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
                    className="node-label-wrapper"
                    style={{
                        gridColumn: nodeToCol(idx),
                        gridRow: labelRow
                    }}
                >
                    <span
                        title={label}
                        className="node-label"
                        style={{
                            color: getNodeColor(idx)
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
