# Contributing to Transition

Transition is an open source platform for planification and simulation of transportation systems, focusing on, but not limited to, public transit. It has been developed by the Chaire Mobilité research group of Polytechnique Montréal. It is meant to help transport planning in general, to be used by either public or private actors. It is an evolving platform.

## How can I contribute

There are many ways to contribute to the development of Transition. Here's a few.

### Asking a question

You can use the [issue tracker](https://github.com/chairemobilite/transition/issues) of this GitHub project to ask a question. You can label it as a `question`. Before asking, make sure a similar question has not been asked before.

### Reporting bugs

If you use Transition and encounter a bug, first make sure a similar issue has not been reported already. If not, you can file an issue in this project. Please provide all information required to reproduce the bug, and state the actual and expected behavior. Screenshots can greatly help visualize the issue.

### Requesting features and ideas

If there's something you would like to see in Transition, no matter how big or small a change it may seem, you may start a discussion in the issue tracker [here](https://github.com/chairemobilite/transition/issues). Members of the community can join in the discussion.

### Translating

Transition uses the i18next node modules for managing translations. Translations files are located in the `locales` directory, in a folder called by the language prefix. To support a new language, copy the folder for one of the existing languages, and edit the texts in each .json file.

If using VScode, the [i18n Ally](https://github.com/lokalise/i18n-ally/) extension is a good tool to help with translations. The **i18n Ally** panel allows to see all translation keys and directly access its translations. And if editing the code, calling a `t` function (for translation), with a key, will show the available translations when hovering and allow to edit/add them.

### Developing the platform

If you want to start getting involved in the development of the application, a good idea is to contact the current development team, through an issue describing the bug you want to fix or the feature you want to implement. To get started, there are some easy issues to work on using the [complexity low (good first issue)](https://github.com/chairemobilite/transition/labels/complexity%20low%20%28good%20first%20issue%29) label.

Read the following sections for the coding guidelines.

## Coding guidelines

To ensure consistency throughout the code base, we use `prettier` and `eslint` to automatically format the code files. Since code formatting in javascript/typescript is opinionated, the coding rules are described in the configs/ directory. The base rules are taken from the [google GTS project](https://github.com/google/gts) and some were added.

To automatically format code files in a workspace, simply run `yarn format` before a commit.

Unfamiliar with the review process? Read [The ABC of a Pull Request](docs/ABC_of_pull_requests.md).

## Testing:

There are 2 types of tests: unit tests and sequential tests.

* Unit tests are run using `yarn test` and run the complete test suites for all the packages
* Sequential tests are integration tests that require a test database (different from the one used in the application, as it truncates all the tables at the end). They are run with `yarn test:sequential`. Before running those, the database needs to be setup with the following `yarn` commands:
  * `yarn setup-test`: Same as `yarn setup`, but for the TEST environment.
  * `yarn migrate-test`: Same as `yarn migrate`, but for the TEST environment.

## Debugging

The `.vscode/launch.json.example` file contains various vscode launch configuration that can be used to debug the server, the browsers or units tests. You can copy it in a `.vscode/launch.json` file and edit them for each developer's need and specific configuration.

## Inspecting the frontend bundle

Once in a while, developers should examine the size and content of the frontend bundle, to see if any low-hanging fruit optimization is possible. One possible way to do so is with the `webpack-bundle-analyzer` plugin. One can locally add the plugin as a dev dependency in the workspace doing the webpack `yarn add --dev webpack-bundle-analyzer`. And in the webpack.config.js file, add the following code:

```
[...]
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
[...]
return {
    [...]
    plugins: {
        new BundleAnalyzerPlugin(),
        [...]
    }
}
```