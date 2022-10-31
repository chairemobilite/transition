/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { create } from 'react-test-renderer';
import { mount } from 'enzyme';

import BottomPanel from '../BottomPanel';

const contributions = [
    { id: 'testBottomPanel', section: 'test', placement: 'bottomPanel' as const, create: (props) => <div>test</div> },
    { id: 'mainBottomPanel', placement: 'bottomPanel' as const, create: (props) => <div>Should always be there</div>},
    { id: 'fooBottomPanel', section: 'foo', placement: 'bottomPanel' as const, create: (props) => <div {...props}>Foo section, with props</div>}
];

test('One active section with contribution', () => {
    const bottomPanel = create(<BottomPanel
        activeSection = 'test'
        contributions = {contributions}
    />)
        .toJSON();
    expect(bottomPanel).toMatchSnapshot();
});

test('One active section with contribution and props', () => {
    const bottomPanel = create(<BottomPanel
        activeSection = 'foo'
        contributions = {contributions}
    />)
        .toJSON();
    expect(bottomPanel).toMatchSnapshot();
});

test('active section without contribution', () => {
    const bottomPanel = create(<BottomPanel
        activeSection = 'bar'
        contributions = {contributions}
    />)
        .toJSON();
    expect(bottomPanel).toMatchSnapshot();
});

test('Active section change', () => {
    const bottomPanel = mount(<BottomPanel
        activeSection = 'test'
        contributions = {contributions}
    />);
    expect(bottomPanel).toMatchSnapshot();
    bottomPanel.setProps({activeSection: 'other', contributions });
    expect(bottomPanel).toMatchSnapshot();
});