/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import MapboxGL from 'mapbox-gl';
import { WithTranslation } from 'react-i18next';
import defaultPreferences from 'chaire-lib-common/lib/config/defaultPreferences.config';

// Create a map controls dropdown menu with a gear icon
class MapControlsMenu {
    private container!: HTMLElement;
    private map!: MapboxGL.Map | undefined;
    private defaultCenter: [number, number];
    private defaultZoom: number;
    private button!: HTMLButtonElement;
    private dropdown!: HTMLDivElement;
    private isOpen: boolean = false;
    private t: WithTranslation['t'];
    private documentClickListener!: (e: MouseEvent) => void;
    constructor(t: WithTranslation['t']) {
        this.defaultCenter = defaultPreferences.map.center;
        this.defaultZoom = defaultPreferences.map.zoom;
        this.t = t;
    }

    onAdd(map: MapboxGL.Map) {
        this.map = map;

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group tr__map-controls';

        // Create toggle button with gear icon
        this.button = document.createElement('button');
        this.button.className = 'mapboxgl-ctrl-icon tr__map-controls-button';
        this.button.type = 'button';
        this.button.title = this.t('main:map.controls.title');
        this.button.setAttribute('aria-label', this.t('main:map.controls.title'));
        this.button.innerHTML = '<i class="fa fa-cog" aria-hidden="true"></i>';

        // Create dropdown menu (initially hidden)
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'tr__map-controls-dropdown';
        this.dropdown.style.display = 'none';

        // Add reset view button to dropdown
        const resetButton = document.createElement('button');
        resetButton.className = 'tr__map-controls-dropdown-item';
        resetButton.textContent = this.t('main:map.controls.resetView');
        resetButton.onclick = (e) => {
            e.stopPropagation();
            this.map?.flyTo({
                center: this.defaultCenter,
                zoom: this.defaultZoom
            });
            this.toggleDropdown();
        };

        // Add elements to DOM
        this.dropdown.appendChild(resetButton);
        this.container.appendChild(this.button);
        this.container.appendChild(this.dropdown);

        // Add click handler for toggle button
        this.button.onclick = () => {
            this.toggleDropdown();
        };

        // Close dropdown when clicking outside
        this.documentClickListener = (e: MouseEvent) => {
            if (this.isOpen && !this.container.contains(e.target as Node)) {
                this.toggleDropdown();
            }
        };
        document.addEventListener('click', this.documentClickListener);

        return this.container;
    }

    toggleDropdown() {
        this.isOpen = !this.isOpen;
        this.dropdown.style.display = this.isOpen ? 'block' : 'none';
    }

    onRemove() {
        this.container.parentNode?.removeChild(this.container);
        document.removeEventListener('click', this.documentClickListener);
        this.map = undefined;
    }
}

export default MapControlsMenu;
