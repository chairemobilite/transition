/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { createRef, useEffect, useState } from 'react';

// This components provides a resizable split panel.
// Code largely comes from https://blog.theodo.com/2020/11/react-resizeable-split-panels/
// No need for a props and state about the width of the rightmost component
// because we use flexbox to adjust its width.

interface SplitViewProps {
    left?: React.ReactElement;
    right?: React.ReactElement;
    initialLeftWith: string;
    minLeftWidth?: number;
}

export const SplitView: React.FunctionComponent<SplitViewProps> = ({ left, right, initialLeftWith, minLeftWidth }) => {
    const [leftWidth, setLeftWidth] = useState<number | undefined>();
    const [separatorXPosition, setSeparatorXPosition] = useState<number | undefined>();
    const [dragging, setDragging] = useState(false);

    const splitPaneRef = createRef<HTMLDivElement>();
    const leftRef = createRef<HTMLDivElement>();

    const onMouseDown = (e: React.MouseEvent) => {
        setSeparatorXPosition(e.clientX);
        setDragging(true);
    };

    const onTouchStart = (e: React.TouchEvent) => {
        setSeparatorXPosition(e.touches[0].clientX);
        setDragging(true);
    };

    const onMove = (clientX: number) => {
        if (dragging && leftWidth && separatorXPosition) {
            const newLeftWidth = leftWidth + clientX - separatorXPosition;
            setSeparatorXPosition(clientX);

            if (minLeftWidth) {
                if (newLeftWidth < minLeftWidth) {
                    setLeftWidth(minLeftWidth);
                    return;
                }

                if (splitPaneRef.current) {
                    const splitPaneWidth = splitPaneRef.current.clientWidth;

                    if (newLeftWidth > splitPaneWidth - minLeftWidth) {
                        setLeftWidth(splitPaneWidth - minLeftWidth);
                        return;
                    }
                }
            }

            setLeftWidth(newLeftWidth);
        }
    };

    const onMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        onMove(e.clientX);
    };

    const onMouseUp = () => {
        setDragging(false);
    };

    React.useEffect(() => {
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    });

    useEffect(() => {
        if (leftRef.current) {
            // As soon as we get the ref, we can get the actual width *in pixels* of the div.
            // We must do this since we can't do calculations with relative widths given as percentages.
            if (!leftWidth) {
                setLeftWidth(leftRef.current.clientWidth);
                return;
            }
            leftRef.current.style.width = `${leftWidth}px`;
        }
    }, [leftRef, leftWidth, setLeftWidth]);

    return (
        <div className={'tr__resizable-split-view'} ref={splitPaneRef}>
            {/* Hide contents when dragging. This reduces flickering since react does not have to redraw at every width change. */}
            <div
                className="tr__resizable-split-view-left-panel"
                ref={leftRef}
                style={{ visibility: !dragging ? 'visible' : 'hidden', width: initialLeftWith }}
            >
                {left}
            </div>
            <div
                className="tr__resizable-split-view-divider-hitbox"
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onTouchEnd={onMouseUp}
            >
                <div className="tr__resizable-split-view-divider" />
            </div>
            <div className="tr__resizable-split-view-right-panel">{right}</div>
        </div>
    );
};

export default SplitView;
