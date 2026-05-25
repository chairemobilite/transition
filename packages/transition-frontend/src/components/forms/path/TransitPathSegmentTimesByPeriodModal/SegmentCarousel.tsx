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
        <div className="carousel">
            <div className="carousel-inner">
                <button
                    type="button"
                    className="carousel-arrow left"
                    onClick={onPrevious}
                    style={{ visibility: hidePrevious ? 'hidden' : 'visible' }}
                >
                    <FontAwesomeIcon icon={faChevronLeft} className="carousel-arrow-icon" />
                </button>
                {children}
                <div className="carousel-labels">
                    <div className="carousel-label-anchor">
                        <span className="carousel-label-text">{startLabel}</span>
                    </div>
                    <div className="carousel-spacer" />
                    <div className="carousel-label-anchor">
                        <span className="carousel-label-text">{endLabel}</span>
                    </div>
                </div>
                <button
                    type="button"
                    className="carousel-arrow right"
                    onClick={onNext}
                    style={{ visibility: hideNext ? 'hidden' : 'visible' }}
                >
                    <FontAwesomeIcon icon={faChevronRight} className="carousel-arrow-icon" />
                </button>
            </div>
        </div>
    );
};

export default React.memo(SegmentCarousel);
