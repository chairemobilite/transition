/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { BrowserRouter } from 'react-router';
import { render } from '@testing-library/react';
import UnauthorizedPage from '../UnauthorizedPage';

test('Should correctly render Unauthorized page', () =>{
    const { container } = render(<BrowserRouter><UnauthorizedPage /></BrowserRouter>);
    expect(container).toMatchSnapshot();
});
