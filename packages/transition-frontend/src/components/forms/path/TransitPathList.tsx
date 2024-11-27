/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import MathJax from 'react-mathjax';

import Path from 'transition-common/lib/services/path/Path';
import Line from 'transition-common/lib/services/line/Line';
import TransitPathButton from './TransitPathButton';
import ButtonList from '../../parts/ButtonList';
import DocumentationTooltip from '../../parts/DocumentationTooltip';

interface PathListProps extends WithTranslation {
    paths: Path[];
    line: Line;
    selectedPath?: Path;
    selectedSchedule: boolean;
}

const TransitPathList: React.FunctionComponent<PathListProps> = (props: PathListProps) => {
    return (
        <>
            <div className="tr__list-transit-paths-container">
                <h3>
                    <img
                        src={'/dist/images/icons/transit/path_white.svg'}
                        className="_icon"
                        alt={props.t('transit:transitPath:Paths')}
                    />{' '}
                    {props.t('transit:transitPath:List')}&nbsp;
                    <MathJax.Provider>
                        <MathJax.Node inline formula={'p'} data-tooltip-id="path-tooltip" />
                    </MathJax.Provider>
                </h3>
                <ButtonList key="paths">
                    {props.paths.map((path: Path) => (
                        <TransitPathButton
                            line={props.line}
                            key={path.id}
                            path={path}
                            selectedPath={props.selectedPath}
                            selectedSchedule={props.selectedSchedule}
                        />
                    ))}
                </ButtonList>
            </div>
            <DocumentationTooltip dataTooltipId="half-cycle-time-tooltip" documentationLabel="half_cycle_time" />
            <DocumentationTooltip dataTooltipId="path-tooltip" documentationLabel="path" />
        </>
    );
};

export default withTranslation('transit')(TransitPathList);
