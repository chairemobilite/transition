/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { setWorkerUrl } from 'maplibre-gl';

// MapLibre 6 ships the tile worker as ESM only. Webpack emits it as its own asset
// when it sees this URL. The call has to run before the first Map is constructed,
// otherwise vector tiles never load.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
