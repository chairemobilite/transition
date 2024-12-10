/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import ErrorBoundary from '../ErrorBoundary';

const testLabel = 'Test';

test('Normal boundary', () => {
    const { container } = render(<ErrorBoundary
        key={testLabel}>
        <input id="test"/>
    </ErrorBoundary>);
    expect(container).toMatchSnapshot();
});

test('Boundary with error', () => {
    const errorMessage = 'This is an exception';
    // eslint-disable-next-line @typescript-eslint/ban-types
    const TestComponent: React.FunctionComponent<{}> = () => {
        throw new Error(errorMessage);
    };

    const { container } = render(<ErrorBoundary
        key={testLabel}>
        <TestComponent/>
    </ErrorBoundary>);
    // Make sure expected components are there
    const collapsible = container.querySelector('.Collapsible');
    expect(collapsible).toBeTruthy();

    const trException = container.querySelector('.tr__exception');
    expect(trException).toBeTruthy();

    // The trException's content should be the exception thrown
    const children = trException?.children;
    expect(children?.length).toEqual(2);
    expect(children?.[0].textContent).toEqual(errorMessage);
    expect(children?.[1].textContent).toContain('TestComponent');
});
