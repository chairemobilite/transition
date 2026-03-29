/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import type { ResolvedCheckpoint, EditMode } from 'transition-common/lib/services/path/PathSegmentTimeUtils';

type CheckpointLinesProps = {
    checkpoints: ResolvedCheckpoint[];
    activeCheckpointIndex: number;
    editMode: EditMode;
    onCheckpointClick: (index: number) => void;
    hoveredCheckpointIndex: number | null;
    onHoverChange: (index: number | null) => void;
    nodeToCol: (nodeIndex: number) => number;
};

const CheckpointLines: React.FunctionComponent<CheckpointLinesProps> = ({
    checkpoints,
    activeCheckpointIndex,
    editMode,
    onCheckpointClick,
    hoveredCheckpointIndex,
    onHoverChange,
    nodeToCol
}) => {
    const activeCheckpoint = editMode === 'checkpoint' ? checkpoints[activeCheckpointIndex] : null;

    // Collect unique checkpoint boundary nodes
    const cpBoundaryNodes = new Set<number>();
    checkpoints.forEach((checkpoint) => {
        cpBoundaryNodes.add(checkpoint.fromNodeIndex);
        cpBoundaryNodes.add(checkpoint.toNodeIndex);
    });

    return (
        <>
            {/* Checkpoint lines */}
            {checkpoints.map((checkpoint, checkpointIndex) => {
                const colStart = nodeToCol(checkpoint.fromNodeIndex) + 1;
                const colEnd = nodeToCol(checkpoint.toNodeIndex);
                if (colStart >= colEnd) return null;
                const isActive = editMode === 'checkpoint' && checkpointIndex === activeCheckpointIndex;
                const color = isActive ? '#ff9800' : 'rgba(255, 152, 0, 0.5)';
                return (
                    <div
                        key={`cp-line-${checkpointIndex}`}
                        data-testid={`checkpoint-bar-${checkpointIndex}`}
                        onClick={() => onCheckpointClick(checkpointIndex)}
                        onMouseEnter={() => onHoverChange(checkpointIndex)}
                        onMouseLeave={() => onHoverChange(null)}
                        style={{
                            gridColumn: `${colStart} / ${colEnd}`,
                            gridRow: 1,
                            cursor: 'pointer',
                            padding: '8px 0',
                            minHeight: 20,
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                height: isActive ? 4 : hoveredCheckpointIndex === checkpointIndex ? 4 : 2,
                                background: color,
                                borderRadius: 1,
                                transition: 'all 0.2s'
                            }}
                        />
                    </div>
                );
            })}

            {/* Checkpoint boundary dots */}
            {Array.from(cpBoundaryNodes).map((nodeIdx) => {
                const isInActive =
                    activeCheckpoint !== null &&
                    (nodeIdx === activeCheckpoint.fromNodeIndex || nodeIdx === activeCheckpoint.toNodeIndex);
                const color = isInActive ? '#ff9800' : 'rgba(255, 152, 0, 0.5)';
                const size = isInActive ? 12 : 9;
                const matchingCheckpointIndex = checkpoints.findIndex(
                    (checkpoint) => checkpoint.fromNodeIndex === nodeIdx || checkpoint.toNodeIndex === nodeIdx
                );
                return (
                    <div
                        key={`cp-dot-${nodeIdx}`}
                        onClick={() => matchingCheckpointIndex >= 0 && onCheckpointClick(matchingCheckpointIndex)}
                        style={{
                            gridColumn: nodeToCol(nodeIdx),
                            gridRow: 1,
                            justifySelf: 'center',
                            alignSelf: 'center',
                            width: size,
                            height: size,
                            borderRadius: '50%',
                            background: color,
                            border: isInActive ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)',
                            cursor: 'pointer',
                            zIndex: 1,
                            transition: 'all 0.2s'
                        }}
                    />
                );
            })}
        </>
    );
};

export default CheckpointLines;
