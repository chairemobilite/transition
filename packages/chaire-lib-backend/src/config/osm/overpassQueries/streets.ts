/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// this will every vehicle highways (ignoring footpaths and cycleways)
// timeout is set to 10 seconds to avoid long waiting times, because
// the main usage for streets is to get street names around a node to suggest nameing the node.
// We may add a timeout parameter to the function in the future.
export default `<osm-script output="json" output-config="" timeout="10">
    <union into="_">
        <query into="_" type="way">
            <has-kv k="highway" modv="" regv="^(residential|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|service|motorway|motorway_link|pedestrian|living_street|unclassified|bus_guideway|busway)$"/>
            <polygon-query bounds="BOUNDARY"/>
        </query>
    </union>
    <print e="" from="_" geometry="full" ids="yes" limit="" mode="body" n="" order="id" s="" w=""/>
</osm-script>`;
