import config, {
    ProjectConfiguration,
    setProjectConfiguration
} from 'chaire-lib-common/lib/config/shared/project.config';
declare let __CONFIG__: ProjectConfiguration<unknown>;

const frontendConfig = __CONFIG__;
if (frontendConfig === undefined) {
    console.error('__CONFIG__ global variable is not set. Webpack should define it');
} else {
    setProjectConfiguration(frontendConfig);
}

export default config;
