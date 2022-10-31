/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
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
    // eslint-disable-next-line @typescript-eslint/ban-types
    const TestComponent: React.FunctionComponent<{}> = () => {
        throw new Error("This is an exception");
    };

    const errorBoundary = create(<ErrorBoundary
        key={testLabel}>
            <TestComponent/>
        </ErrorBoundary>)
        .toJSON();
    expect(errorBoundary).toMatchSnapshot();

});
