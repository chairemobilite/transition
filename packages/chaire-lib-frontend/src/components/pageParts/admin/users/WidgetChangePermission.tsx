/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faCircle } from '@fortawesome/free-solid-svg-icons/faCircle';

import { InputCheckbox } from '../../../input/InputCheckbox';
import { Button } from '../../../input/Button';

interface WidgetChangePermissionProps extends WithTranslation {
    roles: string[];
    currentValues: { [key: string]: boolean };
    userUuid: string;
}

const WidgetChangePermission: React.FunctionComponent<WidgetChangePermissionProps> = (
    props: WidgetChangePermissionProps
) => {
    const [values, setValues] = React.useState(
        props.currentValues ? props.roles.filter((role) => props.currentValues[role] === true) : []
    );
    const [modified, setModified] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const fetchIdRef = React.useRef(0);

    // Function to fetch data from the server, with paging and filtering
    const updateCurrentUser = React.useCallback(async (values: string[]) => {
        // Give this fetch an ID
        const fetchId = ++fetchIdRef.current;

        // Set the loading state
        setLoading(true);

        // Recreate the permissions object
        const permissions = {};
        values.forEach((value) => (permissions[value] = true));

        try {
            const response = await fetch('/api/admin/updateUser', {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                method: 'POST',
                body: JSON.stringify({
                    uuid: props.userUuid,
                    permissions
                })
            });

            if (fetchId !== fetchIdRef.current) {
                // There was another query since, ignore
                return;
            }
            if (response.status === 200) {
                const jsonData = await response.json();
                if (jsonData.status === 'success') {
                    setModified(false);
                }
            }
            // TODO Handle any other status or return code, the data was not saved!
        } catch (error) {
            console.error(`Error updating user: ${error}`);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateValue = (value: string[]) => {
        setValues(value);
        setModified(true);
    };

    return (
        <>
            <InputCheckbox
                id={`userPermissions_${props.userUuid}`}
                value={values}
                choices={props.roles.map((role) => ({ value: role, label: props.t(`main:${role}`) }))}
                onValueChange={(e) => updateValue(e.target.value)}
            />
            {modified && (
                <Button
                    icon={loading ? faCircle : faCheckCircle}
                    iconClass="_icon-alone"
                    size="small"
                    label={props.t('admin:user:ApplyChanges')}
                    onClick={loading ? undefined : () => updateCurrentUser(values)}
                />
            )}
        </>
    );
};

export default withTranslation(['admin', 'main'])(WidgetChangePermission);
