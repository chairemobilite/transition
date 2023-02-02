const CONSTANTS = {
    /**
     * This is the EPSG:4326 projection, WGS84 World Geodetic System, used in
     * the geojson format and throughout the application https://epsg.io/4326
     * */
    geographicCoordinateSystem: {
        srid: 4326,
        label: 'WGS84 EPSG:4326 (latitude/longitude)',
        value: '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees'
    }
};

export default CONSTANTS;
