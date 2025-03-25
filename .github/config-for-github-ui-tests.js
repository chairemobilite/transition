// This config file is used to roll the UI tests during the github pipeline
// Since OSRM is not currently working on the github repo, we set Walking mode's autostart value to false 
module.exports = {
    projectShortname: 'demo_transition',
    projectDirectory: `${__dirname}/runtime/`,
    auth: {
      localLogin: {
        allowRegistration: true,
      }
    },
    routing: {
      walking: {
        defaultEngine: 'osrmRouting',
        engines: {
          osrmRouting: { port: 5001, host: null, autoStart: false, enabled: true }
        }
      },
    },
    mapDefaultCenter: {
      lat: 45.5092960,
      lon: -73.4769080
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
      fr: "Démo",
      en: "Demo"
    },
    defaultLocale: "fr",
    timezone: "America/Montreal",
    gtfs: {
      socketFileUploaderOptions: {
        uploadDirectory                : 'gtfs',
        fileExtension                  : 'zip',
        renamedFileNameWithoutExtension: 'import',
        acceptTypes                    : ['application/zip'],
        maxFileSizeMB                  : 256,
        chunckSizeMB                   : 10240000,
        overwriteExistingFile          : true
      }
    },
    defaultPreferences: {
      transit: {
        routing: {
          batch: {
            allowSavingOdTripsToDb: true
          }
        }
      }
    },
    tokenLifespanDays: 14
};
  
