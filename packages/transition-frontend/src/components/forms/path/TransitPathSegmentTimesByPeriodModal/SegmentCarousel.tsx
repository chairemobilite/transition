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

const arrowStyle = (side: 'left' | 'right', hidden: boolean): React.CSSProperties => ({
    position: 'absolute',
    [side]: '-2.5em',
    top: 10,
    transform: 'translateY(-50%)',
    fontSize: '1.2em',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '50%',
    width: '1.6em',
    height: '1.6em',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    visibility: hidden ? 'hidden' : 'visible'
});

const labelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.8em',
    fontWeight: 'bold',
    textAlign: 'center',
    whiteSpace: 'wrap',
    lineHeight: 1.2,
    width: '300px'
};

type SegmentCarouselProps = {
    onPrevious: () => void;
    onNext: () => void;
    hidePrevious: boolean;
    hideNext: boolean;
    startLabel: string;
    endLabel: string;
    children: React.ReactNode;
};

const SegmentCarousel: React.FunctionComponent<SegmentCarouselProps> = ({
    onPrevious,
    onNext,
    hidePrevious,
    hideNext,
    startLabel,
    endLabel,
    children
}) => {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '0.5rem 0',
                flexShrink: 0
            }}
        >
            <div style={{ width: '400px', flexShrink: 0, position: 'relative' }}>
                <button onClick={onPrevious} style={arrowStyle('left', hidePrevious)} aria-label="Previous">
                    <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: '0.7em' }} />
                </button>
                {children}
                <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '4px', minHeight: '2.5em' }}>
                    <div style={{ width: 20, flexShrink: 0, position: 'relative' }}>
                        <span style={labelStyle}>{startLabel}</span>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ width: 20, flexShrink: 0, position: 'relative' }}>
                        <span style={labelStyle}>{endLabel}</span>
                    </div>
                </div>
                <button onClick={onNext} style={arrowStyle('right', hideNext)} aria-label="Next">
                    <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '0.7em' }} />
                </button>
            </div>
        </div>
    );
};

export default SegmentCarousel;
