/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faCircle } from '@fortawesome/free-solid-svg-icons/faCircle';

import { InputCheckboxBoolean } from '../../../input/InputCheckbox';
import { Button } from '../../../input/Button';
import type { RootState } from '../../../../store/configureStore';

// Server route updating each flag. Each route updates only its flag.
const flagRoutes = {
    is_admin: '/api/admin/updateUserSetAdmin',
    is_confirmed: '/api/admin/updateUserSetConfirmed'
};

export type UserFlag = keyof typeof flagRoutes;

interface WidgetSetUserFlagProps {
    flag: UserFlag;
    value?: boolean | null;
    userUuid: string;
    userId: number;
}

/**
 * Checkbox to change a boolean flag of a user, with a button to apply the
 * change. The current user cannot change their own flags.
 */
const WidgetSetUserFlag: React.FunctionComponent<WidgetSetUserFlagProps> = ({
    flag,
    value: initialValue,
    userUuid,
    userId
}: WidgetSetUserFlagProps) => {
    const { t } = useTranslation(['admin', 'main']);
    const [value, setValue] = React.useState(initialValue === true);
    const [modified, setModified] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [saveError, setSaveError] = React.useState(false);
    const user = useSelector((state: RootState) => state.auth.user);
    const fetchIdRef = React.useRef(0);

    const saveValue = React.useCallback(
        async (newValue: boolean) => {
            // Give this fetch an ID
            const fetchId = ++fetchIdRef.current;
            setLoading(true);

            try {
                const response = await fetch(flagRoutes[flag], {
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    method: 'POST',
                    body: JSON.stringify({
                        uuid: userUuid,
                        [flag]: newValue
                    })
                });
                const jsonData = response.status === 200 ? await response.json() : undefined;
                if (fetchId !== fetchIdRef.current) {
                    // There was another query since, ignore
                    return;
                }
                const saved = jsonData?.status === 'success';
                if (!saved) {
                    console.error(`Error updating the ${flag} flag of user ${userUuid}: status ${response.status}`);
                }
                setModified(!saved);
                setSaveError(!saved);
            } catch (error) {
                console.error(`Error updating user: ${error}`);
                if (fetchId === fetchIdRef.current) {
                    setSaveError(true);
                }
            } finally {
                if (fetchId === fetchIdRef.current) {
                    setLoading(false);
                }
            }
        },
        [flag, userUuid]
    );

    const updateValue = (newValue: boolean) => {
        setValue(newValue);
        setModified(true);
        setSaveError(false);
    };

    // Do not allow users to change their own flags
    const disabled = user !== undefined && user !== null && user.id === userId;

    return (
        <div className="admin-user-flag">
            <InputCheckboxBoolean
                id={`user_${flag}_${userUuid}`}
                label={t('admin:user:FilterYes')}
                isChecked={value}
                defaultChecked={value}
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
                    onClick={loading ? undefined : () => saveValue(value)}
                />
            )}
            {saveError && <span className="_error">{t('admin:user:ErrorSaving')}</span>}
        </div>
    );
};

export default WidgetSetUserFlag;
