/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { UserDefinedConfigSchema } from '../../../utils/userDefinedConfig';
import { TransitNetworkDesignAlgorithm } from '../../networkDesign/transit/TransitNetworkDesignAlgorithm';

export type AlgorithmStubOptions = {
    numericOption: number;
    stringOption: string;
    booleanOption?: boolean;
}

export class TransitNetworkDesignAlgorithmStub implements TransitNetworkDesignAlgorithm {

    constructor(private options: AlgorithmStubOptions) {

    }

    run = async () => {
        console.log('options', this.options);
        return true;
    };

}

export class SimulationAlgorithmDescriptorStub implements UserDefinedConfigSchema<AlgorithmStubOptions> {
    
    getTranslatableName = () => "string"

    getFields = () => ({ 
        numericOption: { i18nName: 'numOption', type: 'number' as const, validate: (value: number) => value > 0 }, 
        stringOption: { i18nName: 'stringOption', type: 'string' as const }, 
        booleanOption: { i18nName: 'boolOption', type: 'boolean' as const } 
    });

    validateFields = (options: Partial<AlgorithmStubOptions>) => {
        let valid = true;
        let errors: string[] = [];
        if (options.stringOption === undefined) {
            valid = false;
            errors.push('StringOptionMandatory');
        }
        return { valid, errors };
    }
    
}
