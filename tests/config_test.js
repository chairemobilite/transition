module.exports = {

    maxParallelCalculators: 3,
    projectDirectory: `${__dirname}/runtime/`,
    projectShortname: 'test',
  
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
      defaultSection: "test",
      // Change to the new osrm config. See issue #1137
      osrmRouting: {
          directoryPrefix: 'test',
          modes: {
            driving: {
                // set host to null when you want node to start osrm locally with the provided port
                // !!! Be careful: use your own server, since you may be blocked on the osrm demo server after too many queries
                port     : 7999, // set to null when using remote osrm server
                host : null, // set to null when using a remote osrm server
                autoStart: true,
                enabled  : true
            },
            cycling: {
                port     : 8999,
                host : null,
                autoStart: true,
                enabled  : false
            },
            walking: {
                port     : 5999,
                host : null,
                autoStart: true,
                enabled  : false
            },
            driving_congestion: {
                port     : 8899,
                host : null,
                autoStart: true,
                enabled  : false
            },
            bus_suburb: {
                port     : 7889,
                host : null,
                autoStart: true,
                enabled  : true
            },
            bus_urban: {
                port     : 7879,
                host : null,
                autoStart: true,
                enabled  : true
            },
            bus_congestion: {
                port     : 7869,
                host : null,
                autoStart: true,
                enabled  : false
            },
            rail: {
                port     : 9999,
                host : null,
                autoStart: false,
                enabled  : false
            },
            tram: {
                port     : 9199,
                host : null,
                autoStart: false,
                enabled  : false
            },
            tram_train: {
                port     : 9299,
                host : null,
                autoStart: false,
                enabled  : false
            },
            metro: {
                port     : 9399,
                host : null,
                autoStart: false,
                enabled  : false
            },
            monorail: {
                port     : 9499,
                host : null,
                autoStart: false,
                enabled  : false
            },
            cable_car: {
                port     : 9599,
                host : null,
                autoStart: false,
                enabled  : false
            }
          }
      }
    }
  
};
  