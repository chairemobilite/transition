/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import MathJax from 'react-mathjax';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import { getDefinitionFromServer } from '../../services/definitions/DefinitionsService';
import { Dictionary } from 'lodash';
import { Tooltip } from 'react-tooltip';

interface DocumentationTooltipProps extends WithTranslation {
    dataTooltipId: string; // Attaches to the html elements with the 'data-tooltip-id' property of the same value.
    documentationLabel: string; // The label of the info we want to fetch from the Latex files.
}

// This component will fetch and display info from Latex files on the server when hovering over an element it is attached to.
// To use, give the HTML element you want to attach it to the 'data-tooltip-id' property, setting it to a unique value.
// Then, place the DocumentationTooltip component close to it in the html, giving the same value to the 'dataTooltipId' prop,
// and setting the 'documentationLabel' prop to the label of the definition we want to fetch in the Latex files.
const DocumentationTooltip: React.FunctionComponent<DocumentationTooltipProps> = (props: DocumentationTooltipProps) => {
    const [definition, setDefinition] = React.useState({ fr: '', en: '' } as Dictionary<any>);

    const [gotError, setGotError] = React.useState(false);

    React.useEffect(() => {
        getDefinitionFromServer(props.documentationLabel, setDefinition, setGotError);
    }, []);

    if (gotError) {
        return (
            <Tooltip
                id={props.dataTooltipId}
                openOnClick={true}
                closeEvents={{ mouseleave: true }}
                style={{ maxWidth: '90%', zIndex: 100, color: 'rgb(255, 50, 50)' }}
                opacity={1}
            >
                <div>{props.t('transit:documentationTooltip:errors:DefinitionNotFound')}</div>
            </Tooltip>
        );
    } else {
        return (
            <Tooltip
                id={props.dataTooltipId}
                openOnClick={true}
                closeEvents={{ mouseleave: true }}
                style={{ maxWidth: '90%', zIndex: 100 }}
                opacity={1}
            >
                {definition.fr === '' ? (
                    <LoadingPage />
                ) : (
                    <MathJax.Provider>
                        <h3>{definition[props.i18n.language]?.title}</h3>
                        <p>
                            {props.t('transit:documentationTooltip:Symbol')}:{' '}
                            <MathJax.Node inline formula={definition[props.i18n.language]?.symbol} />
                        </p>
                        {definition[props.i18n.language]?.unit !== '-' && (
                            <p>
                                {props.t('transit:documentationTooltip:Unit')}:{' '}
                                <MathJax.Node inline formula={definition[props.i18n.language]?.unit} />
                            </p>
                        )}
                        {definition[props.i18n.language]?.formula !== '-' && (
                            <p>
                                {props.t('transit:documentationTooltip:Expression')}:{' '}
                                <MathJax.Node inline formula={definition[props.i18n.language]?.formula} />
                            </p>
                        )}
                        <p>
                            {props.t('transit:documentationTooltip:Description')}: {definition[props.i18n.language]?.description}
                        </p>
                    </MathJax.Provider>
                )}
            </Tooltip>
        );
    }
};

export default withTranslation(['transit'])(DocumentationTooltip);
