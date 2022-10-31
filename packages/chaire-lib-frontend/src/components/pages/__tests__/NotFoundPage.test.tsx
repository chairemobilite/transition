/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { mount } from 'enzyme';
import NotFoundPage from '../NotFoundPage';

test('Should correctly render NotFound page', () =>{
    const wrapper = mount(<BrowserRouter><NotFoundPage /></BrowserRouter>);
    expect(wrapper).toMatchSnapshot();
});
