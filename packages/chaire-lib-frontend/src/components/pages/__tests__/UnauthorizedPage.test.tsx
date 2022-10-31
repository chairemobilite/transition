/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { mount } from 'enzyme';
import UnauthorizedPage from '../UnauthorizedPage';

test('Should correctly render Unauthorized page', () =>{
    const wrapper = mount(<BrowserRouter><UnauthorizedPage /></BrowserRouter>);
    expect(wrapper).toMatchSnapshot();
});
