/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export default `<osm-script output="OUTPUT" output-config="" timeout="240">
    <union into="_">
        <query into="_" type="way">
            <polygon-query bounds="BOUNDARY"/>
        </query>
        <query into="_" type="relation">
            <polygon-query bounds="BOUNDARY"/>
        </query>
    </union>
    <print e="" from="_" geometry="full" ids="yes" limit="" mode="body" n="" order="id" s="" w=""/>
</osm-script>`;
