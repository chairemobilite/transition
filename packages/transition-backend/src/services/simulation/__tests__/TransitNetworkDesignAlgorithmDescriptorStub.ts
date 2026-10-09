/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitNetworkDesignAlgorithm } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import { UserDefinedConfigSchema } from 'transition-common/lib/utils/userDefinedConfig';

type AlgorithmStubOptions = {
    numericOption: number;
    stringOption: string;
    booleanOption?: boolean;
}

export class SimulationAlgorithmStub implements TransitNetworkDesignAlgorithm {

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

    validateFields = (fields: Partial<AlgorithmStubOptions>) => {
        let valid = true;
        let errors: string[] = [];
        if (fields.stringOption === undefined) {
            valid = false;
            errors.push('StringOptionMandatory');
        }
        return { valid, errors };
    }
    
}
