/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faCircle } from '@fortawesome/free-solid-svg-icons/faCircle';

import { InputCheckboxBoolean } from '../../../input/InputCheckbox';
import { Button } from '../../../input/Button';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../store/configureStore';

interface WidgetSetAdminProps {
    isAdmin: boolean;
    userUuid: string;
    userId: number;
}

const WidgetSetAdmin: React.FunctionComponent<WidgetSetAdminProps> = (props: WidgetSetAdminProps) => {
    const { t } = useTranslation(['admin', 'main']);
    const [isAdmin, setIsAdmin] = React.useState(props.isAdmin === true ? true : false);
    const [modified, setModified] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const user = useSelector((state: RootState) => state.auth.user);
    const fetchIdRef = React.useRef(0);

    // Function to fetch data from the server, with paging and filtering
    const updateCurrentUser = React.useCallback(async (isAdmin: boolean) => {
        // Give this fetch an ID
        const fetchId = ++fetchIdRef.current;

        // Set the loading state
        setLoading(true);

        try {
            const response = await fetch('/api/admin/updateUserSetAdmin', {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                method: 'POST',
                body: JSON.stringify({
                    uuid: props.userUuid,
                    is_admin: isAdmin
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

    const updateValue = (value: boolean) => {
        setIsAdmin(value);
        setModified(true);
    };

    // Do not allow a user to set or unset admin for himself
    const disabled = user !== undefined && user !== null && user.id === props.userId;

    return (
        <>
            <InputCheckboxBoolean
                id={`userIsAdmin_${props.userUuid}`}
                isChecked={isAdmin}
                defaultChecked={isAdmin}
                disabled={disabled}
                onValueChange={(e: { target: { value: boolean } }) => updateValue(e.target.value)}
            />
            {modified && !disabled && (
                <Button
                    icon={loading ? faCircle : faCheckCircle}
                    iconClass="_icon-alone"
                    size="small"
                    label=""
                    title={t('admin:user:ApplyChanges')}
                    onClick={loading ? undefined : () => updateCurrentUser(isAdmin)}
                />
            )}
        </>
    );
};

export default WidgetSetAdmin;
