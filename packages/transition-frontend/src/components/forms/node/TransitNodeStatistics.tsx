/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _uniq from 'lodash.uniq';
import { withTranslation, WithTranslation } from 'react-i18next';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import Node from 'transition-common/lib/services/nodes/Node';
import Line from 'transition-common/lib/services/line/Line';
import Path from 'transition-common/lib/services/path/Path';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

const SimpleRow: React.FunctionComponent<{ header: string; value?: string | number; isHeader?: boolean }> = ({
    header,
    value = '',
    isHeader = false
}) => {
    return (
        <tr>
            <th className={isHeader ? '_header' : ''}>{header}</th>
            <td>{value}</td>
        </tr>
    );
};

const SingleColumn: React.FunctionComponent<{ header: string; values?: string[] | number[]; isHeader?: boolean }> = ({
    header,
    values = []
}) => {
    const cellValues = values.map((value, index) => {
        return (
            <tr key={`cell${index}`}>
                <td>{value}</td>
            </tr>
        );
    });

    return (
        <React.Fragment>
            <tr key="cellHeader">
                <th className="_header">{header}</th>
            </tr>
            {cellValues}
        </React.Fragment>
    );
};

interface NodeStatsProps extends WithTranslation {
    node: Node;
    associatedPathIds: string[] | undefined;
    pathCollection: PathCollection;
}

const TransitNodeStatistics: React.FunctionComponent<NodeStatsProps> = (props: NodeStatsProps) => {
    const { associatedPathIds, pathCollection } = props;
    const associatedLineIds: string[] = [];
    const pathValues =
        associatedPathIds?.map((associatedPathId) => {
            const pathGeojson = pathCollection.getById(associatedPathId);
            if (pathGeojson) {
                const path = new Path(pathGeojson.properties, false, serviceLocator.collectionManager);
                const direction = path.getAttributes().direction;
                const line = path.getLine() as Line;
                associatedLineIds.push(line.getId());
                const agency = line.getAgency();
                if (agency && line) {
                    return `${agency.getAttributes().acronym} | ${line.getAttributes().shortname} | ${props.t(
                        `transit:transitPath:directions:${direction}`
                    )} • ${path.getShortenedId()}`;
                } else {
                    return path.getShortenedId();
                }
            } else {
                return associatedPathId;
            }
        }) || [];

    const countUniqLines = _uniq(associatedLineIds).length;

    return (
        <table className="_statistics">
            <tbody>
                <SingleColumn
                    header={`${props.t('transit:transitNode:AssociatedPaths')} • ${associatedPathIds?.length ||
                        0} ${props.t('transit:transitPath:paths')} • ${countUniqLines} ${props.t(
                        'transit:transitLine:lines'
                    )}`}
                    values={pathValues}
                />
            </tbody>
        </table>
    );
};

export default withTranslation(['transit'])(TransitNodeStatistics);
