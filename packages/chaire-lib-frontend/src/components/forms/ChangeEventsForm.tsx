/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import { GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';

export interface ChangeEventsState<T extends GenericObject<any>> {
    object: T;
    // TODO tahini: There must be a way to type this... later...
    formValues: { [key: string]: any };
}

export abstract class ChangeEventsForm<P, S extends ChangeEventsState<any>> extends React.Component<P, S> {
    private _invalidFields: { [key: string]: boolean } = {};

    constructor(props: P) {
        super(props);

        this.onValueChange = this.onValueChange.bind(this);
        this.onFormFieldChange = this.onFormFieldChange.bind(this);
    }

    protected onValueChange(path: string, newValue: { value: any; valid?: boolean } = { value: null, valid: true }) {
        this.onFormFieldChange(path, newValue);
        if (newValue.valid || newValue.valid === undefined) {
            // TODO tahini: This code is here for objectWithHistory. The form could be responsible for history, but then we miss other stuff, like the path geojson that is part of the object... That would have to be handled. The object should be updated only when the user asks for it imho (that will make for easier cancellation as well)
            const stateObject = this.state.object;
            stateObject.set(path, newValue.value);
            if (typeof stateObject.validate === 'function') {
                stateObject.validate();
            }
            this.setState({ object: stateObject });
        }
    }

    protected onFormFieldChange(
        path: string,
        newValue: { value: any; valid?: boolean } = { value: null, valid: true }
    ) {
        this.setState({ formValues: { ...this.state.formValues, [path]: newValue.value } });
        if (newValue.valid !== undefined && !newValue.valid) {
            this._invalidFields[path] = true;
        } else {
            this._invalidFields[path] = false;
        }
    }

    protected resetInvalidFields() {
        this._invalidFields = {};
    }

    protected getInvalidFields(): { [key: string]: boolean } {
        return this._invalidFields;
    }

    protected hasInvalidFields(): boolean {
        return Object.keys(this._invalidFields).filter((key) => this._invalidFields[key]).length > 0;
    }
}

export default ChangeEventsForm;
