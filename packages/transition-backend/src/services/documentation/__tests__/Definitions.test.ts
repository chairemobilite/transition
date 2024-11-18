/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as Definitions from '../Definitions';

const simpleLatex = 
    `\\begin{document}
    \\begin{longtable}{}
    \\hline
    \\makecell[r]{Définition \\\\ \\textit{Definition}} & \\makecell[c]{Symbole \\\\ \\textit{Symbol}} & \\makecell[c]{Unité \\\\ \\textit{Unit}} & \\makecell[c]{Expression \\ \\textit{Expression}} & \\makecell[l]{Description \\\\ \\textit{Description}} \\\\ 
    \\hline
    \\hline
    \\endhead
    \\label{node}
    \\makecell[r]{Noeud d'arrêt \\\\ \\textit{Stop node}} & \\[q\\] & - & - & Regroupement de panneaux et/ou de quais d'embarquement et de débarquement situés à proximité et étant considérés comme un lieu de transfert direct lorsque plusieurs lignes s'y rencontrent. Par exemple, lorsque plusieurs panneaux d'arrêts sont situés chaque coin d'une intersection, ils représentent un seul noeud d'arrêt. \\\\
    \\hline
    \\label{half_cycle_time}
    \\makecell[r]{Temps de demi-cycle \\\\ \\textit{Half-cycle time}} & \\[{T_c}_p\\] & \\[s\\] & \\[{T_o} + {t_t} \\] & Temps total entre le départ du terminus de départ et la fin du battement au terminus d'arrivée. \\\\
    \\hline
    \\end{longtable}
    \\end{document}
    `;

const mockReadFile = jest.spyOn(Definitions, 'readFile');
mockReadFile.mockReturnValue(simpleLatex);

test('Get definitions that exist', () => {
    const nodeDefinition = Definitions.getDefinitionInOneLanguage('fr', 'node');
    expect(nodeDefinition).toEqual({
        title: "Noeud d'arrêt",
        symbol: 'q',
        unit: '-',
        formula: '-',
        description: "Regroupement de panneaux et/ou de quais d'embarquement et de débarquement situés à proximité et étant considérés comme un lieu de transfert direct lorsque plusieurs lignes s'y rencontrent. Par exemple, lorsque plusieurs panneaux d'arrêts sont situés chaque coin d'une intersection, ils représentent un seul noeud d'arrêt."
    });

    const halfCycleTimeDefinition = Definitions.getDefinitionInOneLanguage('fr', 'half_cycle_time');
    expect(halfCycleTimeDefinition).toEqual({
        title: "Temps de demi-cycle",
        symbol: '{T_c}_{p}',
        unit: 's',
        formula: '{T_o}+{t_t}',
        description: "Temps total entre le départ du terminus de départ et la fin du battement au terminus d'arrivée."
    });
});

test('Get definition that does not exist', () => {
    expect(() => Definitions.getDefinitionInOneLanguage('fr', 'wrong_label')).toThrow("Could not find definition with label 'wrong_label'.")
});