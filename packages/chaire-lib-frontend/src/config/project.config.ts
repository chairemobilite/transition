import config, {
    ProjectConfiguration,
    setProjectConfiguration
} from 'chaire-lib-common/lib/config/shared/project.config';
import * as Status from 'chaire-lib-common/lib/utils/Status';

export const fetchConfiguration = async (): Promise<boolean> => {
    try {
        const response = await fetch('/config');
        const responseStatus: Status.Status<ProjectConfiguration<unknown>> = await response.json();
        if (Status.isStatusOk(responseStatus)) {
            const configuration = Status.unwrap(responseStatus);
            setProjectConfiguration(configuration);
            return true;
        } else {
            console.log('Error getting configuration from server:', responseStatus.error);
            return false;
        }
    } catch (error) {
        console.log('Error getting configuration from server:', error);
        return false;
    }
};

export default config;
