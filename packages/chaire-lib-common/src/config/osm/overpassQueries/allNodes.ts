/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export default `<osm-script output="OUTPUT" output-config="" timeout="120">
    <union into="_">
        <polygon-query bounds="BOUNDARY"/>
        <recurse from="_" into="_" type="up"/>
    </union>
    <print e="" from="_" geometry="skeleton" ids="yes" limit="" mode="meta" n="" order="id" s="" w=""/>
</osm-script>`;
