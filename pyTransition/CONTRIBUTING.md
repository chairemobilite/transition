# Contributing to pyTransition

pyTransition is a Python package designed to interact with the public API of the open-source transit planning application Transition, developed by the Chaire Mobilité research group of Polytechnique Montréal. It is an evolving platform.

## How can I contribute

There are many ways to contribute to the development of pyTransition. Here's a few.

### Asking a question

You can use the [issue tracker](https://github.com/chairemobilite/transition/issues) of this GitHub project to ask a question. You can label it as a `question`. Before asking, make sure a similar question has not been asked before.

### Reporting bugs

If you use pyTransition and encounter a bug, first make sure a similar issue has not been reported already. If not, you can file an issue in this project. Please provide all information required to reproduce the bug, and state the actual and expected behavior. Screenshots can greatly help visualize the issue.

### Requesting features and ideas

If there's something you would like to see in pyTransition, no matter how big or small a change it may seem, you may start a discussion in the issue tracker [here](https://github.com/chairemobilite/transition/issues). Members of the community can join in the discussion.

### Developing the platform

If you want to start getting involved in the development of the pyTransition package, a good idea is to contact the current development team, through an issue describing the bug you want to fix or the feature you want to implement.

Read the following sections for the coding guidelines.

## Coding guidelines

We use the [Black Pep 8 code formatter](https://pypi.org/project/black/) to automatically format the code files.

## Testing

Unit tests are ran using `pytest` in the root directory, which runs the complete test suite.
