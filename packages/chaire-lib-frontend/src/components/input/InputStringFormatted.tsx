/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { default as InputString, InputStringProps } from './InputString';

export type InputStringFormattedProps = InputStringProps & {
    /**
     * Converts the string input to the proper value type. If the input is not
     * valid, it should return null
     *
     * @memberof InputStringFormattedProps
     */
    stringToValue: (str: string) => any | null;
    /**
     * Converts the value to a string.
     *
     * @memberof InputStringFormattedProps
     */
    valueToString: (value: any) => string;
    value?: any;
    /**
     * Since this is an uncontrolled component, but it can still be changed by
     * the parent, the key is used by the parent to tell the component to update
     * the value. New props will not have effect on the value shown unless the
     * key is changed. It is a suggested pattern for components that should be
     * uncontrolled but whose value can also be updated by parent.
     */
    key?: string;
};

type InputStringFormattedState = {
    value: any;
    strValue: string;
};

/**
 * This is a wrapper to the input string widget, handling value conversion
 * to/from string as the user types input. This is an uncontrolled component,
 * that will send value back to the caller only when the entered string
 * validates. If the entered string is empty, null is returned. New props will
 * not have effect on the value shown unless the key is changed. It is a
 * suggested pattern for components that should be uncontrolled but whose value
 * can also be updated by parent
 */
export class InputStringFormatted extends React.Component<InputStringFormattedProps, InputStringFormattedState> {
    constructor(props: InputStringFormattedProps) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.state = {
            strValue: props.value ? props.valueToString(props.value) : '',
            value: props.value
        };
    }

    handleChange(newValue) {
        // Handle invalid values first
        if (!newValue.valid) {
            if (this.props.onValueUpdated) {
                this.props.onValueUpdated({ value: null, valid: false });
            } else if (this.props.onValueChange) {
                this.props.onValueChange(null);
            }
            this.setState({ strValue: newValue.value });
            return;
        }

        // Try to convert the formatted value for further validation
        const result = this.props.stringToValue(newValue.value);
        if (result !== null) {
            if (this.props.onValueUpdated) {
                this.props.onValueUpdated({ value: result, valid: true });
            } else if (this.props.onValueChange) {
                this.props.onValueChange(result);
            }
            this.setState({ strValue: newValue.value, value: result });
        } else if (newValue.value === '') {
            // Send null on empty strings
            if (this.props.onValueUpdated) {
                this.props.onValueUpdated({ value: null, valid: true });
            } else if (this.props.onValueChange) {
                this.props.onValueChange(null);
            }
            this.setState({ strValue: newValue.value, value: null });
        } else {
            if (this.props.onValueUpdated) {
                this.props.onValueUpdated({ value: null, valid: false });
            }
            this.setState({ strValue: newValue.value });
        }
    }

    render(): React.ReactNode {
        const { onValueUpdated, onValueChange, stringToValue, valueToString, value, ...inputProps } = this.props;
        return <InputString onValueUpdated={this.handleChange} value={this.state.strValue} {...inputProps} />;
    }
}

export default InputStringFormatted;
