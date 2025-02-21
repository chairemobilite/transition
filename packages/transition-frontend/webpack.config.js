/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
require('chaire-lib-backend/lib/config/dotenv.config');

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

const configuration = require('chaire-lib-backend/lib/config/server.config');
// Extract from the config all options that we should not send to the frontend.
// The `{ ...config }` will be sent to the frontend
// TODO This won't be necessary once we have frontend and backend configuration separated
const { trRoutingCacheAllScenarios, routing, ...config } = configuration.default ? configuration.default : configuration;

// Public directory from which files are served
const publicDirectory = path.join(__dirname, '..', '..', 'public');
const bundleOutputPath = path.join(publicDirectory, 'dist', config.projectShortname);
// Local path where locales are stored
const localeDirectory = path.join(__dirname, '..', '..', 'locales');
const entryFileName = './lib/app-transition.js';

module.exports = (env) => {
    console.log(`building js for project ${config.projectShortname}`);
    console.log('process.env.NODE_ENV', process.env.NODE_ENV);

    const isProduction = process.env.NODE_ENV === 'production';

    // Make sure all builds have different names if not a production bundle
    const bundleFileName = isProduction ? `transition-${config.projectShortname}-bundle-${process.env.NODE_ENV}.[contenthash].js` : `transition-${config.projectShortname}-bundle-${process.env.NODE_ENV}.dev.js`;
    const styleFileName = isProduction ? `transition-${config.projectShortname}-styles.[contenthash].css` : `transition-${config.projectShortname}-styles.dev.css`;
    // HTML main file name
    const htmlFileName = path.join(`index-${config.projectShortname}.html`);

    const languages = config.languages || ['fr', 'en'];
    const languagesFilter = `/${languages.join('|')}/`;

    // TODO Custom styles and locales should be set in config (#419, #420)
    const customStylesFilePath = `${config.projectDir}/styles/styles.scss`;
    const customLocalesFilePath = `${config.projectDir}/locales`;
    const entry = fs.existsSync('./' + customStylesFilePath) ? [entryFileName, './' + customStylesFilePath] : [entryFileName];
    const includeDirectories = [
        path.join(__dirname, 'lib'),

        path.join(__dirname, 'lib', entryFileName),
        localeDirectory
    ];

    return {
        // Controls which information to display (see https://webpack.js.org/configuration/stats/)
        stats: {
            errorDetails: true,
            children: true,
        },
        node: {
            // global will be deprecated at next major release, see where it is being used
            global: 'warn'
        },
        mode: process.env.NODE_ENV,
        entry,
        output: {
            path: bundleOutputPath,
            filename: bundleFileName,
            publicPath: '/dist/'
        },
        watchOptions: {
            ignored: ['node_modules/**'],
            aggregateTimeout: 600
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    use: 'json-loader',
                    test: /\.geojson$/,
                    include: includeDirectories
                },
                {
                    test: /\.(ttf|woff2|woff|eot|svg)$/,
                    type: 'asset'
                },
                {
                    test: /\.glsl$/,
                    use: 'ts-shader-loader'
                },
                {
                    test: /\.s?css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: {
                                sourceMap: true
                            }
                        },
                        {
                            loader: 'sass-loader',
                            options: {
                                sourceMap: true
                            }
                        }
                    ]
                },
                {
                    test: /locales/,
                    loader: '@alienfast/i18next-loader',
                    options: {
                        basenameAsNamespace: true,
                        overrides: (fs.existsSync('./' + customLocalesFilePath) ? ['../' + customLocalesFilePath] : [])
                    }
                }
            ]
        },
        plugins: [
            new CleanWebpackPlugin({
                dry: !isProduction,
                verbose: true,
                cleanAfterEveryBuildPatterns: ['**/*', '!images/**', '!*.html'],
            }),
            new HtmlWebpackPlugin({
                filename: htmlFileName,
                template: path.join(publicDirectory, 'index.html'),
            }),
            new MiniCssExtractPlugin({
                filename: styleFileName
            }),
            new webpack.DefinePlugin({
                'process.env': {
                    'IS_BROWSER': JSON.stringify(true),
                    'HOST': JSON.stringify(process.env.HOST),
                    'TRROUTING_HOST': JSON.stringify(process.env.TRROUTING_HOST),
                    'PROJECT_SOURCE': JSON.stringify(process.env.PROJECT_SOURCE),
                    'IS_TESTING': JSON.stringify(process.env.NODE_ENV === 'test'),
                    'GOOGLE_API_KEY': JSON.stringify(process.env.GOOGLE_API_KEY),
                    'CUSTOM_RASTER_TILES_XYZ_URL': JSON.stringify(process.env.CUSTOM_RASTER_TILES_XYZ_URL || config.customRasterTilesXyzUrl),
                    'CUSTOM_RASTER_TILES_MIN_ZOOM': JSON.stringify(process.env.CUSTOM_RASTER_TILES_MIN_ZOOM || config.customRasterTilesMinZoom),
                    'CUSTOM_RASTER_TILES_MAX_ZOOM': JSON.stringify(process.env.CUSTOM_RASTER_TILES_MAX_ZOOM || config.customRasterTilesMaxZoom),
                    'CUSTOM_RASTER_TILES_TILE_SIZE': JSON.stringify(process.env.CUSTOM_RASTER_TILES_TILE_SIZE || config.customRasterTilesTileSize),
                    'CUSTOM_RASTER_TILES_TILE_OPACITY': JSON.stringify(process.env.CUSTOM_RASTER_TILES_TILE_OPACITY || config.customRasterTilesTileOpacity),
                    'CUSTOM_VECTOR_TILES_STYLE_URL': JSON.stringify(process.env.CUSTOM_VECTOR_TILES_STYLE_URL || config.customVectorTilesStyleUrl),
                    'CUSTOM_VECTOR_TILES_OPACITY': JSON.stringify(process.env.CUSTOM_VECTOR_TILES_OPACITY || config.customVectorTilesOpacity)
                },
                '__CONFIG__': JSON.stringify({
                    ...config
                })
            }),
            new webpack.optimize.AggressiveMergingPlugin(),//Merge chunks
            new CompressionPlugin({
                filename: '[path][base].gz[query]',
                algorithm: 'gzip',
                test: /\.js$|\.css$/,
                threshold: 0,
                minRatio: 0.8
            }),
            new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, new RegExp(languagesFilter)),
            new webpack.ContextReplacementPlugin(/date\-fns[\/\\]/, new RegExp(languagesFilter)),
            new CopyWebpackPlugin(
                {
                    patterns: [
                        {
                            context: path.join(__dirname, 'lib', 'assets'),
                            from: '**/*',
                            to: '',
                            noErrorOnMissing: true
                        }
                    ]
                }
            )
        ],
        resolve: {
            mainFields: ['browser', 'main', 'module'],
            modules: ['node_modules'],
            extensions: ['.json', '.js', '.ts', '.tsx'],
            fallback: { path: false },
        },
        devtool: isProduction ? 'cheap-source-map' : 'eval-source-map',
        devServer: {
            contentBase: publicDirectory,
            historyApiFallback: true,
            publicPath: '/dist/' + config.projectShortname
        }
    };
};
