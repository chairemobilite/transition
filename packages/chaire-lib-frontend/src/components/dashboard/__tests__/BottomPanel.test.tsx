/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { render } from '@testing-library/react';

import BottomPanel from '../BottomPanel';

const contributions = [
    {
        id: 'testBottomPanel',
        section: 'test',
        placement: 'bottomPanel' as const,
        create: (_props: any) => <div>test</div>
    },
    {
        id: 'mainBottomPanel',
        placement: 'bottomPanel' as const,
        create: (_props: any) => <div>Should always be there</div>
    },
    {
        id: 'fooBottomPanel',
        section: 'foo',
        placement: 'bottomPanel' as const,
        create: (props: any) => <div {...props}>Foo section, with props</div>
    }
];

test('One active section with contribution', () => {
    const { container } = render(<BottomPanel
        activeSection = 'test'
        contributions = {contributions}
    />);
    expect(container).toMatchSnapshot();
});

test('One active section with contribution and props', () => {
    const { container } = render(<BottomPanel
        activeSection = 'foo'
        contributions = {contributions}
    />);
    expect(container).toMatchSnapshot();
});

test('active section without contribution', () => {
    const { container } = render(<BottomPanel
        activeSection = 'bar'
        contributions = {contributions}
    />);
    expect(container).toMatchSnapshot();
});

test('Active section change', () => {
    const { rerender, container } = render(<BottomPanel
        activeSection = 'test'
        contributions = {contributions}
    />);
    expect(container).toMatchSnapshot();
    rerender(<BottomPanel
        activeSection = 'other' // there is no contributions for activeSection other, so it should not display the activeSection
        contributions = {contributions}
    />);
    expect(container).toMatchSnapshot();
});
