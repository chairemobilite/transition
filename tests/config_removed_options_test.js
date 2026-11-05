// Configuration file with local login options at the top level, which are no
// longer supported. Used to test that the server refuses this configuration.
module.exports = {
    projectShortname: 'unitTest',
    confirmEmail: true,
    confirmEmailStrategy: 'confirmByAdmin'
};
