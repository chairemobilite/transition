/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render } from '@testing-library/react';

import { UserDefinedConfigEditComponent } from '../OptionsDescriptorWidgets';
import { CsvFieldMappingDescriptor } from 'transition-common/lib/services/csv';
import { UserDefinedConfigSchema } from 'transition-common/lib/utils/userDefinedConfig';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	}),
    withTranslation: jest.fn().mockImplementation(() => (Component: any) => (props: any) => <Component {...props} t={(key: string) => key} />)
}));

jest.mock('../../csv/GenericCsvImportAndMappingForm', () => () => (
	<div data-testid="csv-mapping-form" />
));

type TestConfig = {
	stringField: string;
	booleanField: boolean;
	integerField: number;
	numberField: number;
	percentageField: number;
	secondsField: number;
	minutesField: number;
	hoursField: number;
	selectField: string;
	multiselectField: string[];
	csvField: unknown;
	nestedField: {
		nestedString: string;
		nestedNumber: number;
	};
};

const csvMappingDescriptors: CsvFieldMappingDescriptor[] = [
	{
		key: 'name',
		i18nLabel: 'CsvName',
		required: true,
		type: 'single'
	},
	{
		key: 'type',
		i18nLabel: 'CsvType',
		required: false,
		type: 'single'
	}
];

const mockSchema: UserDefinedConfigSchema<TestConfig> = {
	getTranslatableName: () => 'TestSchema',
	getFields: () => ({
		stringField: { type: 'string', i18nName: 'StringField', default: 'hello' },
		booleanField: { type: 'boolean', i18nName: 'BooleanField', default: true },
		integerField: { type: 'integer', i18nName: 'IntegerField', default: 3 },
		numberField: { type: 'number', i18nName: 'NumberField', default: 3.14 },
		percentageField: { type: 'percentage', i18nName: 'PercentageField', default: 0.2 },
		secondsField: { type: 'seconds', i18nName: 'SecondsField', default: 120 },
		minutesField: { type: 'seconds', i18nName: 'MinutesField', askAs: 'minutes', default: 300 }, // 5 minutes
		hoursField: { type: 'seconds', i18nName: 'HoursField', askAs: 'hours', default: 7200 }, // 2 hours
		selectField: {
			type: 'select',
			i18nName: 'SelectField',
			default: 'a',
			choices: () => [
				{ value: 'a', label: 'ChoiceA' },
				{ value: 'b', label: 'ChoiceB' }
			]
		},
		multiselectField: {
			type: 'multiselect',
			i18nName: 'MultiselectField',
			default: ['a'],
			choices: () => [
				{ value: 'a', label: 'ChoiceA' },
				{ value: 'b', label: 'ChoiceB' }
			]
		},
		csvField: {
			type: 'csvFile',
			i18nName: 'CsvField',
			importFileName: 'test.csv',
			mappingDescriptors: csvMappingDescriptors
		},
		nestedField: {
			type: 'nested',
			i18nName: 'NestedField',
			schema: {
				getTranslatableName: () => 'NestedSchema',
				getFields: () => ({
					nestedString: { type: 'string', i18nName: 'NestedString', default: 'nested' },
					nestedNumber: { type: 'number', i18nName: 'NestedNumber', default: 5 }
				}),
				validateFields: () => ({ valid: true })
			}
		}
	}),
	validateFields: () => ({ valid: true })
};

describe('UserDefinedConfigEditComponent', () => {
	test('renders all widget types with defaults', () => {
		const onUpdate = jest.fn();
		const { container } = render(
			<UserDefinedConfigEditComponent configSchema={mockSchema} value={{} as TestConfig} onUpdate={onUpdate} />
		);
		expect(container).toMatchSnapshot();
	});

	test('renders with provided values', () => {
		const onUpdate = jest.fn();
		const { container } = render(
			<UserDefinedConfigEditComponent
				configSchema={mockSchema}
				value={{
					stringField: 'custom',
					booleanField: false,
					integerField: 10,
					numberField: 2.71,
					percentageField: 0.75,
					secondsField: 60,
					minutesField: 180,
					hoursField: 3600,
					selectField: 'b',
					multiselectField: ['a', 'b'],
					csvField: undefined,
					nestedField: { nestedString: 'inner', nestedNumber: 9 }
				}}
				onUpdate={onUpdate}
			/>
		);
		expect(container).toMatchSnapshot();
	});
});
