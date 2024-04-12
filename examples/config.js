module.exports = {

    projectShortname: 'demo_transition',
    projectDirectory: `${__dirname}/runtime/`,
    auth: {
      localLogin: {
        allowRegistration: true,
        // This will send an email to confirm the user's email address. Email send needs to be configured. By default, users can register and directly login.
        // confirmEmail: true
      }
    },
    maxParallelCalculators: 2,
    
    // Maximum number of parallel calculation
    // TODO trRouting should support multi-threading so we shouldn't have to start multiple instances
    // maxParallelCalculators: 2,
  
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
        osrmRouting: {
            modes: {
                driving: {
                    // !!! Be careful: use your own server, since you may be blocked on the osrm demo server after too many queries
                    port     : 7000, // Port used to access OSRM, either locally or remotely
                    host     : null, // If set to null, localhost will be used. Ignored if autoStart set to true
                    autoStart: true, // If true, a local instance of OSRM will be started
                    enabled  : true  // If true, this mode will be configured, otherwise will be left out 
                },
                cycling: {
                    port     : 8000,
                    host : null,
                    autoStart: true,
                    enabled  : true
                },
                walking: {
                    port     : 5001,
                    host : null,
                    autoStart: true,
                    enabled  : true
                },
                bus_suburb: {
                    port     : 7110,
                    host : null,
                    autoStart: true,
                    enabled  : true
                },
                bus_urban: {
                    port     : 7120,
                    host : null,
                    autoStart: true,
                    enabled  : true
                },
                rail: {
                    port     : 9000,
                    host : null,
                    autoStart: false,
                    enabled  : false
                },
                tram: {
                    port     : 9100,
                    host : null,
                    autoStart: false,
                    enabled  : false
                },
                tram_train: {
                    port     : 9200,
                    host : null,
                    autoStart: false,
                    enabled  : false
                },
                metro: {
                    port     : 9300,
                    host : null,
                    autoStart: false,
                    enabled  : false
                },
                monorail: {
                    port     : 9400,
                    host : null,
                    autoStart: false,
                    enabled  : false
                },
                cable_car: {
                    port     : 9500,
                    host : null,
                    autoStart: false,
                    enabled  : false
                }
            }
      },
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
  