/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
const fs = require('fs');
const path = require('path');
const webpack                 = require('webpack');
const MiniCssExtractPlugin    = require("mini-css-extract-plugin");
const CopyWebpackPlugin       = require('copy-webpack-plugin');
const HtmlWebpackPlugin       = require('html-webpack-plugin');
const { CleanWebpackPlugin }  = require("clean-webpack-plugin");
const CompressionPlugin       = require('compression-webpack-plugin');

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

require('dotenv').config({ path: path.join(__dirname, '../../..', '.env') });
const configuration = require('chaire-lib-backend/lib/config/server.config');
const config = configuration.default ? configuration.default : configuration;

module.exports = (env) => {
  console.log(`building js for project ${config.projectShortname}`);

  const isProduction = env === 'production';
  console.log('process.env.NODE_ENV', process.env.NODE_ENV);

  const projectDir = `../../../projects/${config.projectShortname}/`;
  const bundleOutputPath = path.join(__dirname, '..', '..', '..', 'public', 'dist', config.projectShortname);
  const languages = config.languages || ['fr', 'en'];
  const languagesFilter = `/${languages.join("|")}/`;

  const customStylesFilePath  = `${projectDir}styles/styles.scss`;
  const customLocalesFilePath = `${projectDir}locales`;
  const entryFileName =  './lib/app-transition.js';
  const entry                 = fs.existsSync('./'+customStylesFilePath) ? [entryFileName, './'+customStylesFilePath] : [entryFileName];
  const includeDirectories    = [
    path.join(__dirname, 'lib'),

    path.join(__dirname, 'lib', entryFileName),
    path.join(__dirname, '..', '..', '..', 'locales')
  ];

  includeDirectories.push(path.join(__dirname, '..', '..', '..', 'projects', config.projectShortname));


  return {

    mode: process.env.NODE_ENV,
    entry: entry,
    output: {
      path: bundleOutputPath,
      filename: isProduction ? `transition-${config.projectShortname}-bundle-${env}.[contenthash].js` : `transition-${config.projectShortname}-bundle-${env}.dev.js`,
      publicPath: '/dist/'
    },
    watchOptions: {
      ignored: ['node_modules/**'],
      aggregateTimeout: 600
    },
    module: {
      rules: [
        {
          loader: 'babel-loader',
          test: /\.js$/,
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']//,
          },
          include: includeDirectories
        },
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          loader: 'json-loader',
          test: /\.geojson$/,
          include: includeDirectories
        },
        {
          test: /\.(ttf|woff2|woff|eot|svg)$/,
          loader: 'url-loader',
          options: {
            limit: 100000
          }
        },
        {
          test: /\.glsl$/,
          loader: 'webpack-glsl-loader'
        },
        {
          test: /\.s?css$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                sourceMap: true//,
                //limit: 100000
              }
            },
            {
              loader: 'sass-loader',
              options: {
                //data: "$projectShortname: " + config.projectShortnames + ";",
                sourceMap: true,
                //limit: 100000
              }
            }
          ]
        },
        {
          test: /locales/,
          loader: '@alienfast/i18next-loader',
          options: {
            basenameAsNamespace: true,
            overrides: (fs.existsSync('./'+customLocalesFilePath) ? ['../'+customLocalesFilePath] : [])
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
        filename: path.join(`index-transition-${config.projectShortname}${env === 'test' ? `_${env}` : ''}.html`),
        template: path.join(__dirname, '..', '..', '..', 'public', 'transition.html'),
      }),
      new MiniCssExtractPlugin({
        filename: isProduction ? `transition-${config.projectShortname}-styles.[contenthash].css` : `transition-${config.projectShortname}-styles.dev.css`
      }),
      new webpack.DefinePlugin({
        'process.env': {
          'IS_BROWSER'                  : JSON.stringify(true),
          'HOST'                        : JSON.stringify(process.env.HOST),
          'TRROUTING_HOST'              : JSON.stringify(process.env.TRROUTING_HOST),
          'PROJECT_SOURCE'              : JSON.stringify(process.env.PROJECT_SOURCE),
          'NODE_ENV'                    : JSON.stringify(process.env.NODE_ENV),
          'IS_TESTING'                  : JSON.stringify(env === 'test'),
          'GOOGLE_API_KEY'              : JSON.stringify(process.env.GOOGLE_API_KEY),
          'MAPBOX_ACCESS_TOKEN'         : JSON.stringify(process.env.MAPBOX_ACCESS_TOKEN),
          'MAPBOX_USER_ID'              : JSON.stringify(process.env.MAPBOX_USER_ID || config.mapboxUserId),
          'MAPBOX_STYLE_ID'             : JSON.stringify(process.env.MAPBOX_STYLE_ID || config.mapboxStyleId),
          'CUSTOM_RASTER_TILES_XYZ_URL' : JSON.stringify(process.env.CUSTOM_RASTER_TILES_XYZ_URL || config.customRasterTilesXyzUrl),
          'CUSTOM_RASTER_TILES_MIN_ZOOM': JSON.stringify(process.env.CUSTOM_RASTER_TILES_MIN_ZOOM || config.customRasterTilesMinZoom),
          'CUSTOM_RASTER_TILES_MAX_ZOOM': JSON.stringify(process.env.CUSTOM_RASTER_TILES_MAX_ZOOM || config.customRasterTilesMaxZoom),
          'PROJECT_SAMPLE'              : JSON.stringify(process.env.PROJECT_SAMPLE),
          'GEONAMES_USERNAME'           : JSON.stringify(process.env.GEONAMES_USERNAME),
          'PHOTON_OSM_SEARCH_API_URL'   : JSON.stringify(process.env.PHOTON_OSM_SEARCH_API_URL)
        },
        '__CONFIG__': JSON.stringify({
            ...config
        })
      }),
      new webpack.optimize.AggressiveMergingPlugin(),//Merge chunks
      new CompressionPlugin({
        filename: "[path].gz[query]",
        algorithm: "gzip",
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
              from: "**/*",
              to: "",
              noErrorOnMissing: true
            },
            {
              context: path.join(__dirname, '..', '..', '..', 'projects', config.projectShortname, 'assets'),
              from: "**/*",
              to: "",
              noErrorOnMissing: true
            }
          ]
        }
      )
    ],
    resolve: {
      modules: ['node_modules'],
      extensions: ['.json', '.js', '.css', '.scss', '.ts', '.tsx'],
    },
    devtool: isProduction ? 'cheap-source-map' : 'eval-source-map',
    devServer: {
      contentBase: path.join(__dirname, '..', '..', '..', 'public'),
      historyApiFallback: true,
      publicPath: '/dist/' + config.projectShortname
    }
  };
};
