/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { CirclePicker } from 'react-color';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

export type InputColorProps = {
    id: string;
    onValueChange: (e: any) => void;
    /** Hex string representing the default color. For example: #123456 */
    defaultColor: string;
    /** Hex string representing the color. For example: #123456 */
    value?: string;
};

type InputColorState = {
    displayColorPicker: boolean;
};

class InputColor extends React.Component<InputColorProps, InputColorState> {
    constructor(props: InputColorProps) {
        super(props);

        this.state = {
            displayColorPicker: false
        };

        this.handleColorChange = this.handleColorChange.bind(this);
        this.handleOpenColorPicker = this.handleOpenColorPicker.bind(this);
        this.handleCloseColorPicker = this.handleCloseColorPicker.bind(this);
    }

    handleOpenColorPicker(e: React.MouseEvent): void {
        e.preventDefault();
        this.setState({ displayColorPicker: true });
    }

    handleCloseColorPicker(): void {
        this.setState({ displayColorPicker: false });
    }

    handleColorChange(color, _e: React.MouseEvent): void {
        this.props.onValueChange({ target: { value: color.hex } });
    }

    render(): React.ReactNode {
        const color = !_isBlank(this.props.value) ? this.props.value : this.props.defaultColor;

        const popover = {
            position: 'absolute',
            zIndex: 2
        } as React.CSSProperties;

        const cover = {
            position: 'fixed',
            top: '0px',
            right: '0px',
            bottom: '0px',
            left: '0px'
        } as React.CSSProperties;

        return (
            <div className="_input _blank">
                <div
                    className="_circle-button _open-color-picker"
                    style={{ backgroundColor: color }}
                    onClick={this.handleOpenColorPicker}
                ></div>
                {this.state.displayColorPicker && (
                    <div style={popover}>
                        <div style={cover} onClick={this.handleCloseColorPicker} className="_close-color-picker" />
                        <div
                            className="_input-color"
                            style={{ backgroundColor: '#000000', border: 'none', padding: '0.5rem' }}
                        >
                            <CirclePicker /*disableAlpha={true}*/
                                circleSize={18}
                                circleSpacing={8}
                                color={color}
                                colors={Preferences.current.colorPicker.colors}
                                onChangeComplete={this.handleColorChange}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    }
}
export default InputColor;
