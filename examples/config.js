module.exports = {

    projectShortname: 'demo_transition',
    projectDirectory: `${__dirname}/runtime/`,
    auth: {
      localLogin: {
        // Whether users can create an account. If false, the register page will not be available. Defaults to true
        allowRegistration: true,
        // This will send an email to confirm the user's email address. Email send needs to be configured. By default, users can register and directly login.
        // confirmEmail: true,
        // Whether to allow users to reset their password. If false, the forgot password page will not be available. By default the page is not present
        // forgotPasswordPage: false,
        // Whether to allow users to login with a username. If false, the username field will not be displayed on the login page. Defaults to true
        // registerWithEmailOnly?: boolean;
        // What type of confirmation is required for the email. Can be 'confirmByAdmin' | 'confirmByUser'. Defaults to 'confirmByUser'
        // confirmEmailStrategy: 'confirmByUser';
      }
      // Transition does not support any other login method than localLogin
    },
    // Maximum number of parallel calculation. Used in tasks to start the calculator with this number of threads. By default, the number of calculators is set to the number of CPUs on the server
    // maxParallelCalculators: 2,

    // @deprecated: Use the cacheAllScenarios in the 'routing.transit.engines.trRouting' configuration instead
    // trRoutingCacheAllScenarios: false,
    // Configuration for the trRouting services. Single is for the single calculation instance (from the UI and public API), while batch is for the batch calculation instance, for tasks
    // routing: {
    //   transit: {
    //     defaultEngine: 'trRouting',
    //     engines: {
    //       trRouting: {
    //         single: {
    //           port: 4000,
    //           // Enable caching of connections for all scenarios in trRouting. Will use more memory
    //           cacheAllScenarios: false,
    //           debug: false,
    //           logs: { maxFileSizeKB: 5120, nbFiles: 3 }
    //         },
    //         batch: {
    //           port: 14000,
    //           // Enable caching of connections for all scenarios in trRouting. Will use more memory and may not be necessary for batch calculations as currently there's only one scenario per task
    //           cacheAllScenarios: false,
    //           debug: false,
    //           logs: { maxFileSizeKB: 5120, nbFiles: 3 }
    //         }
    //       }
    //     }
    //   },
    //   // Configuration for simple routing modes, using OSRM-like engines 
    //   driving: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { 
    //         port: 7000, // Port used to access OSRM, either locally or remotely
    //         host: null, // If set to null, localhost will be used. Ignored if autoStart set to true
    //         autoStart: true, // If true, a local instance of OSRM will be started
    //         enabled: true // If true, this mode will be configured, otherwise will be left out
    //       }
    //     }
    //   },
    //   cycling: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 8000, host: null, autoStart: true, enabled: true }
    //     }
    //   },
    //   walking: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 5001, host: null, autoStart: true, enabled: true }
    //     }
    //   },
    //   bus_suburb: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 7110, host: null, autoStart: true, enabled: true }
    //     }
    //   },
    //   bus_urban: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 7120, host: null, autoStart: true, enabled: true }
    //     }
    //   },
    //   rail: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 9000, host: null, autoStart: false, enabled: false }
    //     }
    //   },
    //   tram: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 9100, host: null, autoStart: false, enabled: false }
    //     }
    //   },
    //   tram_train: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 9200, host: null, autoStart: false, enabled: false }
    //     }
    //   },
    //   metro: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 9300, host: null, autoStart: false, enabled: false }
    //     }
    //   },
    //   monorail: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 9400, host: null, autoStart: false, enabled: false }
    //     }
    //   },
    //   cable_car: {
    //     defaultEngine: 'osrmRouting',
    //     engines: {
    //       osrmRouting: { port: 9500, host: null, autoStart: false, enabled: false }
    //     }
    //   },
    // },
  
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

    // Enable/Disable sections of the application
    // sections: {
    //     simulations: {
    //         enabled: true
    //    },
    //    routing: {
    //        enabled: false
    //    },
    //},
  
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
  
