/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';

export type ErrorProps = WithTranslation & {
    key: string;
};

type ErrorState = {
    hasError: boolean;
    error?: Error;
    info?: React.ErrorInfo;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren<ErrorProps>, ErrorState> {
    constructor(props: React.PropsWithChildren<ErrorProps>) {
        super(props);
        this.state = { hasError: false };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        // Display fallback UI
        this.setState({ hasError: true, error: error, info: info });
        console.log('An exception occurred in a react component', error, info);
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div className="tr__panel">
                    <h1>{this.props.t('main:errors:ExceptionOnPage')}</h1>
                    <h3>{this.props.t('main:errors:ShowExceptionForCopy')}</h3>
                    <Collapsible trigger={this.props.t('main:errors:Exception')} open={false} transitionTime={100}>
                        <div className="tr__exception">
                            <span>{this.state.error && this.state.error.message}</span>
                            <span>{this.state.info && this.state.info.componentStack}</span>
                        </div>
                    </Collapsible>
                </div>
            );
        }
        return this.props.children;
    }
}

export default withTranslation('main')(ErrorBoundary);
