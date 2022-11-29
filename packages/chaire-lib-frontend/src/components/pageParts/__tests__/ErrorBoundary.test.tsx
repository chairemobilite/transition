/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import { mount } from 'enzyme';
import ErrorBoundary from '../ErrorBoundary';

const testLabel = "Test";

test('Normal boundary', () => {
    const errorBoundary = create(<ErrorBoundary
        key={testLabel}>
            <input id="test"/>
        </ErrorBoundary>)
        .toJSON();
    expect(errorBoundary).toMatchSnapshot();
});

test('Boundary with error', () => {
    const errorMessage = 'This is an exception';
    // eslint-disable-next-line @typescript-eslint/ban-types
    const TestComponent: React.FunctionComponent<{}> = () => {
        throw new Error(errorMessage);
    };

    const errorBoundary = mount(<ErrorBoundary
        key={testLabel}>
            <TestComponent/>
        </ErrorBoundary>);
    // Make sure expected components are there
    const collapsible = errorBoundary.find('.Collapsible');
    expect(collapsible).toHaveLength(1);

    const trException = errorBoundary.find('.tr__exception');
    expect(trException).toHaveLength(1);

    // The trException's content should be the exception thrown
    const children = trException.children();
    expect(children.length).toEqual(2);
    expect(trException.childAt(0).text()).toEqual(errorMessage);
    expect(trException.childAt(1).text()).toContain("TestComponent");
});
