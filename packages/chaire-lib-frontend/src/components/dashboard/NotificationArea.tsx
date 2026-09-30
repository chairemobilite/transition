/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import Loader from 'react-spinners/ClockLoader';

import { Notification } from 'chaire-lib-common/lib/services/events/Notifications';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

type UiNotification = {
    type: 'progress' | 'error' | 'warning';
    color: string;
    message: string;
};

/** How long a warning stays on screen before it is cleared. */
const WARNING_HIDE_MS = 5000;

const NotificationArea: React.FC = () => {
    const { t } = useTranslation();
    // Keep the notifications received. If it is a progress and it is done, the notification will clear after a timeout
    const [notifications, setNotifications] = React.useState<{ [key: string]: UiNotification }>({});

    /**
     * Drop one notification from the latest state.
     * Reading that state inside the setter avoids restoring a message already dismissed.
     * @param {string} name Notification key
     */
    const removeNotification = (name: string) => {
        setNotifications((prev) => {
            if (prev[name] === undefined) {
                return prev;
            }
            const next = { ...prev };
            delete next[name];
            return next;
        });
    };

    const notificationListener = React.useCallback((notification: Notification): void => {
        if (notification.type === 'clearProgress') {
            removeNotification(notification.name);
            return;
        }

        const message = notification.message.map((text) => t(text)).join(': ');
        const uiNotification =
            notification.type === 'error'
                ? {
                    type: 'error' as const,
                    color: 'red',
                    message
                }
                : notification.type === 'warning'
                    ? {
                        type: 'warning' as const,
                        color: 'yellow',
                        message
                    }
                    : {
                        type: 'progress' as const,
                        color: notification.done ? 'green' : 'grey',
                        message
                    };
        // Functional update: a later progress event must not restore a warning already removed from state.
        setNotifications((prev) => ({
            ...prev,
            [notification.name]: uiNotification
        }));
        if (notification.type === 'progress' && notification.done) {
            setTimeout(() => removeNotification(notification.name), 1000);
        }
        if (notification.type === 'warning') {
            setTimeout(() => removeNotification(notification.name), WARNING_HIDE_MS);
        }
    }, []);

    React.useEffect(() => {
        serviceLocator.notificationService.addListener(notificationListener);
        return () => {
            serviceLocator.notificationService.removeListener(notificationListener);
        };
    });

    // TODO: Add an 'x' to remove a notification from the area manually.
    return (
        <div className="tr__top-menu-notifications">
            {Object.entries(notifications).map(([name, notification]) => (
                <div key={name} className="tr__flash-message-container">
                    {notification.type === 'progress' && <Loader size={16} color="#ffffff" />}
                    <p className={`_${notification.color}`}>{notification.message}</p>
                </div>
            ))}
        </div>
    );
};

export default NotificationArea;
