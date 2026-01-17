/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import maplibregl from 'maplibre-gl';

/**
 * Class that keeps track of the popups currently displaying on the map (there
 * can be many). It allows different locations in the code to
 * activate/deactivate given popups without having to have/keep a reference to
 * it.
 *
 * TODO: Make this class map-implementation independent. At least as a first
 * step, the addPopup could send an html element instead of a popup object.
 *
 * @class MapPopupManager
 */
class MapPopupManager {
    private map: maplibregl.Map | undefined;
    private _popupsByName: { [key: string]: maplibregl.Popup } = {};

    // TODO Make map mandatory
    constructor(map?: maplibregl.Map | undefined) {
        this.map = map;
        this._popupsByName = {};
    }

    setMap(map: maplibregl.Map) {
        this.map = map;
    }

    addPopup(popupName: string, popup: maplibregl.Popup) {
        if (!this._popupsByName[popupName] && this.map) {
            popup.addTo(this.map);
        }
        this._popupsByName[popupName] = popup;
    }

    removePopup(popupName: string) {
        if (this._popupsByName[popupName]) {
            this._popupsByName[popupName].remove();
        }
        delete this._popupsByName[popupName];
    }

    removeAllPopups() {
        for (const popupName in this._popupsByName) {
            this.removePopup(popupName);
        }
    }
}

export default MapPopupManager;
