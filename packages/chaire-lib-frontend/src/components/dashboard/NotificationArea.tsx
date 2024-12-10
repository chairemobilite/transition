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
    type: 'progress' | 'error';
    color: string;
    message: string;
};

const NotificationArea: React.FC = () => {
    const { t } = useTranslation();
    // Keep the notifications received. If it is a progress and it is done, the notification will clear after a timeout
    const [notifications, setNotifications] = React.useState<{ [key: string]: UiNotification }>({});

    const hideNotification = (notificationName: string) => {
        if (notifications[notificationName]) {
            delete notifications[notificationName];
            setNotifications({ ...notifications });
        }
    };

    const updateNotification = (notificationName: string, notification: UiNotification) => {
        notifications[notificationName] = notification;
        setNotifications(Object.assign({}, notifications));
    };

    const notificationListener = React.useCallback((notification: Notification): void => {
        const hideNotificationTimeout = (notificationName: string) => {
            return setTimeout(hideNotification, 1000, notificationName);
        };

        const message = notification.message.map((text) => t(text)).join(': ');
        const uiNotification =
            notification.type === 'error'
                ? {
                    type: 'error' as const,
                    color: 'red',
                    message
                }
                : {
                    type: 'progress' as const,
                    color: notification.done ? 'green' : 'grey',
                    message
                };
        if (notification.type === 'progress' && notification.done) {
            hideNotificationTimeout(notification.name);
        }
        updateNotification(notification.name, uiNotification);
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
            {Object.values(notifications).map((notification: UiNotification) => (
                <div key={notification.message} className="tr__flash-message-container">
                    {notification.type === 'progress' && <Loader size={16} color="#ffffff" />}
                    <p className={`_${notification.color}`}>{notification.message}</p>
                </div>
            ))}
        </div>
    );
};

export default NotificationArea;
