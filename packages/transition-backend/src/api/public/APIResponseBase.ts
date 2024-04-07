/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

export default abstract class APIResponseBase<ResponseType, InputType = ResponseType> {
    private response: ResponseType;

    constructor(input: InputType) {
        this.response = this.createResponse(input);
    }

    protected abstract createResponse(input: InputType): ResponseType;

    getResponse(): ResponseType {
        return structuredClone(this.response);
    }
}
