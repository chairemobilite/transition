module.exports = {

    maxParallelCalculators: 1,
    projectDirectory: `${__dirname}/dir`,
    projectShortname: 'unitTest',
    extraServerField: 'foo',
    extraProjectField: '1234',
  
    allowRegistration: true,
  
    mapDefaultCenter: {
      lat: 45.503205,
      lon: -73.569417
    },
  
    languages: ['fr', 'en'],
    
    locales: {
      fr: 'fr-CA',
      en: 'en-CA'
    },
  
    languageNames: {
      fr: "Français",
      en: "English"
    },
  
    title: {
      fr: "Test",
      en: "Test"
    },
    
    defaultLocale: "fr",
    timezone: "America/Montreal",

};
