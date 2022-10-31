/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
type expressionType = { latexExpression: string; translatableString: string; unit?: string };
const pathStatsFormula: { [key: string]: string | expressionType } = {
    q: 'q',
    s: 's',
    S: 'S',
    l: 'l',
    'q_uniq ': 'q_{uniq}',
    q_multi: 'q_{multi}',
    's_uniq ': 's_{uniq}',
    s_multi: 's_{multi}',
    q_T: 'q_T',
    s_T: 's_T',
    'q\'_T': { latexExpression: 'q^{\\prime}_T', translatableString: 'variables:q\'_T' },
    'q\'\'_T': { latexExpression: 'q^{\\prime\\prime}_T', translatableString: 'variables:q\'\'_T' },
    's\'_T': 's^{\\prime}_T',
    's\'\'_T': 's^{\\prime\\prime}_T',
    q_t: 'q_t',
    s_t: 's_t',
    q_seq: 'q_{seq}',
    s_seq: 's_{seq}',
    c: 'c',

    G: 'G',
    N_u_G: '{N_u}_G',
    F: 'F',
    F_r: 'F_r',
    F_m: 'F_m',
    F_s: 'F_s',
    mu_F_u: '\\mu_{F_u}',
    mu_F_m: '\\mu_{F_m}',
    mu_F_r: '\\mu_{F_r}',
    mu_F_s: '\\mu_{F_s}',
    u: 'u',
    y: 'y',
    e: 'e',
    C_y: 'C_y',
    C_u: 'C_u',
    C_y_se: 'C_{y_{se}',
    C_y_st: 'C_{y_{st}',
    C_u_se: 'C_{u_{se}',
    C_u_st: 'C_{u_{st}',
    n_y: 'n_y',
    n_u: 'n_u',
    n_Bch_y: '{n_{Bch}}_y',
    n_Ach_y: '{n_{Ach}}_y',
    n_ABch_y: '{n_{ABch}}_y',
    n_ch_y: '{n_{ch}}_y',
    n_Bch_u: '{n_{Bch}}_u',
    n_Ach_u: '{n_{Ach}}_u',
    n_ABch_u: '{n_{ABch}}_u',
    n_ch_u: '{n_{ch}}_u',
    a_max: 'a_{max}',
    a_p: 'a_p',
    b_max: 'b_{max}',
    b_p: 'b_p',

    d_p: { latexExpression: 'd_p', translatableString: 'variables:d_p', unit: 'm' },
    n_q_p: { latexExpression: 'n_{q_p}', translatableString: 'variables:n_q_p' },
    n_s_p: 'n_{s_p}',
    d_l_min: { latexExpression: 'd_{l_{min}}', translatableString: 'variables:d_l_min', unit: 'm' },
    d_l_max: { latexExpression: 'd_{l_{max}}', translatableString: 'variables:d_l_max', unit: 'm' },
    d_l_avg: { latexExpression: '\\overline{d_l}', translatableString: 'variables:d_l_avg', unit: 'm' },
    d_l_med: { latexExpression: '\\widetilde{d_l}', translatableString: 'variables:d_l_med', unit: 'm' },
    T_o_p: { latexExpression: '{T_o}_p', translatableString: 'variables:T_o_p', unit: 'min' }
};

export default pathStatsFormula;
