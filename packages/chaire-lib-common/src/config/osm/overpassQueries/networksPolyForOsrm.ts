/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export default `<osm-script output="OUTPUT" output-config="" timeout="1800">
    <union into="_">
        <query into="_" type="way">
            <has-kv k="highway" modv="" v=""/>
            <polygon-query bounds="BOUNDARY"/>
        </query>
        <recurse type="way-node"/>
        <recurse type="relation-node"/>
        <recurse type="relation-way"/>
        <query into="_" type="way">
            <has-kv k="railway" modv="" v=""/>
            <polygon-query bounds="BOUNDARY"/>
        </query>
        <recurse type="way-node"/>
        <recurse type="relation-node"/>
        <recurse type="relation-way"/>
        <query into="_" type="way">
            <has-kv k="man_made" modv="" v="pier"/>
            <polygon-query bounds="BOUNDARY"/>
        </query>
        <recurse type="way-node"/>
        <recurse type="relation-node"/>
        <recurse type="relation-way"/>
        <query into="_" type="way">
            <has-kv k="leisure" modv="" v="track"/>
            <polygon-query bounds="BOUNDARY"/>
        </query>
        <recurse type="way-node"/>
        <recurse type="relation-node"/>
        <recurse type="relation-way"/>
    </union>
    <print e="" from="_" geometry="skeleton" ids="yes" limit="" mode="meta" n="" order="id" s="" w=""/>
    <recurse from="_" into="_" type="down"/>
</osm-script>`;
