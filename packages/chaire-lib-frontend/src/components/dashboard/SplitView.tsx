/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { createRef, useEffect, useState } from 'react';

// This components provides a resizable split panel.
// Code largely comes from https://blog.theodo.com/2020/11/react-resizeable-split-panels/
// No need for props and state about the width of the rightmost component
// because we use flexbox to adjust its width.

interface SplitViewProps {
    left?: React.ReactElement;
    right?: React.ReactElement;
    leftViewID?: string;
    initialLeftWidth: string;
    minLeftWidth?: number;
    hideLeftViewWhenResizing?: boolean;
    hideRightViewWhenResizing?: boolean;
}

/**
 * Allows displaying two components side-by-side with a movable divider in the middle to adjust the widths.
 * @param leftViewID This is used when switching component positions. If we don't have a unique ID, we can't know when to change the width of the left-view to the width of the previously right-view.
 * @returns
 */
export const SplitView: React.FunctionComponent<SplitViewProps> = ({
    left,
    right,
    leftViewID,
    initialLeftWidth,
    hideLeftViewWhenResizing,
    hideRightViewWhenResizing,
    minLeftWidth
}) => {
    const [leftWidth, setLeftWidth] = useState<number | undefined>();
    const [_leftViewID, _setLeftViewID] = useState<string | undefined>(leftViewID);
    const [separatorXPosition, setSeparatorXPosition] = useState<number | undefined>();
    const [dragging, setDragging] = useState(false);

    const splitPaneRef = createRef<HTMLDivElement>();
    const leftRef = createRef<HTMLDivElement>();
    const rightRef = createRef<HTMLDivElement>();

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

    useEffect(() => {
        console.log(leftViewID, _leftViewID);
        if (_leftViewID !== leftViewID && leftRef.current && rightRef.current) {
            // We now know that the views have been switched (L went to R)
            // and thus we can exchange the widths of their DIVs.
            setLeftWidth(rightRef.current.offsetWidth);
            _setLeftViewID(leftViewID);
        }
    }, [leftViewID]);

    return (
        <div className={'tr__resizable-split-view'} ref={splitPaneRef}>
            {/* Hide contents when dragging. This reduces flickering since react does not have to redraw at every width change. */}
            <div
                className="tr__resizable-split-view-left-panel"
                ref={leftRef}
                style={{
                    visibility: hideLeftViewWhenResizing && dragging ? 'hidden' : 'visible',
                    width: initialLeftWidth
                }}
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
            <div
                className="tr__resizable-split-view-right-panel"
                ref={rightRef}
                style={{ visibility: hideRightViewWhenResizing && dragging ? 'hidden' : 'visible' }}
            >
                {right}
            </div>
        </div>
    );
};

export default SplitView;
