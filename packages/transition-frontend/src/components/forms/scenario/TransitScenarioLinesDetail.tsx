/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _uniq from 'lodash.uniq';

import Scenario from 'transition-common/lib/services/scenario/Scenario';
import { PathAttributes } from 'transition-common/lib/services/path/Path';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from 'transition-common/lib/services/line/Line';
import Agency from 'transition-common/lib/services/agency/Agency';

export interface TransitScenarioLinesDetailProps extends WithTranslation {
    scenario: Scenario;
    paths: GeoJSON.FeatureCollection<GeoJSON.LineString, PathAttributes>;
}

const TransitScenarioLinesDetail: React.FunctionComponent<TransitScenarioLinesDetailProps> = (
    props: TransitScenarioLinesDetailProps
) => {
    // TODO Filter lines with include/exclude data from scenario
    const linesByAgency = React.useMemo(() => {
        const lineIds = _uniq(props.paths.features.map((path) => path.properties.line_id));
        const lines: Line[] = lineIds
            .map((lineId) => serviceLocator.collectionManager.get('lines')?.getById(lineId))
            .filter((line) => line !== undefined);
        lines.sort((lineA, lineB) => lineA.toString().localeCompare(lineB.toString()));
        const agencyIds = _uniq(lines.map((line) => line.attributes.agency_id));
        const agencies: Agency[] = agencyIds
            .map((agencyId) => serviceLocator.collectionManager.get('agencies')?.getById(agencyId))
            .filter((agency) => agency !== undefined);
        const linesByAgency: { [agencyId: string]: { name: string; lines: Line[] } } = {};
        agencies.forEach((agency) => (linesByAgency[agency.getId()] = { name: agency.attributes.acronym, lines: [] }));
        lines.forEach((line) => linesByAgency[line.attributes.agency_id].lines.push(line));
        return linesByAgency;
    }, [props.paths]);

    return (
        <table className="_statistics" key="ScenarioLinesDetail">
            <tbody>
                {Object.keys(linesByAgency).map((agencyId) => {
                    const agencyDetails = linesByAgency[agencyId];
                    return agencyDetails.lines.map((line, index) => (
                        <tr key={`${agencyId}_${line.getId()}`}>
                            <th>{index === 0 ? agencyDetails.name : ''}</th>
                            <td>{line.toString()}</td>
                        </tr>
                    ));
                })}
            </tbody>
        </table>
    );
};

export default withTranslation(['transit', 'main'])(TransitScenarioLinesDetail);
