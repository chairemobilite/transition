/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import maplibregl from 'maplibre-gl';
import { WithTranslation } from 'react-i18next';

/**
 * MapLibre GL control for switching between base map and aerial imagery tiles
 */
class LayerSwitcherControl implements maplibregl.IControl {
    private container!: HTMLElement;
    private map!: maplibregl.Map | undefined;
    private button!: HTMLButtonElement;
    private dropdown!: HTMLDivElement;
    private isOpen: boolean = false;
    private t: WithTranslation['t'];
    private documentClickListener!: (e: MouseEvent) => void;
    private onLayerChange: (layerType: 'osm' | 'aerial') => void;
    private getCurrentLayer: () => 'osm' | 'aerial';
    private aerialTilesUrl: string | undefined;
    private minZoom: number;
    private maxZoom: number;

    constructor(
        t: WithTranslation['t'],
        onLayerChange: (layerType: 'osm' | 'aerial') => void,
        getCurrentLayer: () => 'osm' | 'aerial',
        aerialTilesUrl: string | undefined,
        minZoom: number,
        maxZoom: number
    ) {
        this.t = t;
        this.onLayerChange = onLayerChange;
        this.getCurrentLayer = getCurrentLayer;
        this.aerialTilesUrl = aerialTilesUrl;
        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
    }

    onAdd(map: maplibregl.Map): HTMLElement {
        this.map = map;

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        // Create toggle button with layers icon
        this.button = document.createElement('button');
        this.button.className = 'maplibregl-ctrl-icon maplibregl-ctrl-layer-switcher';
        this.button.type = 'button';
        this.button.title = this.t('main:map.controls.layerSelect');
        this.button.setAttribute('aria-label', this.t('main:map.controls.layerSelect'));

        // Use Font Awesome icon (same style as other controls)
        this.button.innerHTML = '<span class="maplibregl-ctrl-icon" aria-hidden="true"></span>';

        // Add the SVG icon inline for the layers icon
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 20 20');
        icon.setAttribute('width', '20');
        icon.setAttribute('height', '20');
        icon.style.display = 'block';
        icon.style.width = '100%';
        icon.style.height = '100%';
        icon.innerHTML = `
            <path d="M10 3L2 7l8 4 8-4-8-4zM2 11l8 4 8-4M2 15l8 4 8-4" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="1.5" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"/>
        `;
        this.button.querySelector('span')?.appendChild(icon);

        // Create dropdown menu (initially hidden)
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'maplibregl-ctrl-layer-switcher-dropdown';
        this.dropdown.style.display = 'none';
        this.dropdown.style.position = 'absolute';
        this.dropdown.style.right = '0';
        this.dropdown.style.top = '40px';
        this.dropdown.style.background = '#fff';
        this.dropdown.style.borderRadius = '4px';
        this.dropdown.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.1)';
        this.dropdown.style.minWidth = '200px';
        this.dropdown.style.zIndex = '1';

        // Add OSM option
        const osmOption = this.createOption(
            'osm',
            this.t('main:map.controls.osm'),
            'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/osm.png'
        );
        this.dropdown.appendChild(osmOption);

        // Add aerial option
        const aerialOption = this.createOption(
            'aerial',
            this.t('main:map.controls.aerial'),
            null // Will use emoji/icon instead
        );
        this.dropdown.appendChild(aerialOption);

        // Add elements to container
        this.container.appendChild(this.button);
        this.container.appendChild(this.dropdown);

        // Add click handler for toggle button
        this.button.onclick = (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        };

        // Close dropdown when clicking outside
        this.documentClickListener = (e: MouseEvent) => {
            if (this.isOpen && !this.container.contains(e.target as Node)) {
                this.toggleDropdown();
            }
        };
        document.addEventListener('click', this.documentClickListener);

        // Update visibility and state based on zoom level
        this.updateVisibility();
        this.updateAerialOptionState();
        this.map.on('zoom', () => {
            this.updateVisibility();
            this.updateAerialOptionState();
        });

        return this.container;
    }

    private updateAerialOptionState(): void {
        if (!this.map) return;

        const zoom = this.map.getZoom();
        const inRange = zoom >= this.minZoom && zoom <= this.maxZoom;

        // Find the aerial option
        const aerialOption = this.dropdown.querySelector('[data-layer-type="aerial"]') as HTMLElement;
        if (aerialOption) {
            const labelSpan = aerialOption.querySelector('span');
            if (inRange) {
                aerialOption.classList.remove('disabled');
                aerialOption.style.cursor = 'pointer';
                aerialOption.style.opacity = '1';
                if (labelSpan) {
                    labelSpan.style.color = '#333';
                }
            } else {
                aerialOption.classList.add('disabled');
                aerialOption.style.cursor = 'not-allowed';
                aerialOption.style.opacity = '0.5';
                if (labelSpan) {
                    labelSpan.style.color = '#999';
                }
            }
        }
    }

    private createOption(type: 'osm' | 'aerial', label: string, imageUrl: string | null): HTMLElement {
        const option = document.createElement('div');
        option.className = 'maplibregl-ctrl-layer-option';
        option.style.display = 'flex';
        option.style.alignItems = 'center';
        option.style.padding = '8px 12px';
        option.style.cursor = 'pointer';
        option.style.transition = 'background-color 0.2s';
        option.setAttribute('data-layer-type', type);

        // Add hover effect
        option.onmouseenter = () => {
            const isDisabled = option.classList.contains('disabled');
            if (!isDisabled) {
                option.style.backgroundColor = '#f5f5f5';
            }
        };
        option.onmouseleave = () => {
            const isActive = this.getCurrentLayer() === type;
            option.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent';
        };

        // Create icon container
        const iconContainer = document.createElement('div');
        iconContainer.style.width = '30px';
        iconContainer.style.height = '30px';
        iconContainer.style.marginRight = '10px';
        iconContainer.style.flexShrink = '0';

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = label;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '2px';
            iconContainer.appendChild(img);
        } else {
            // For aerial, use a colored box with satellite emoji
            iconContainer.style.backgroundColor = '#4a90e2';
            iconContainer.style.borderRadius = '2px';
            iconContainer.style.display = 'flex';
            iconContainer.style.alignItems = 'center';
            iconContainer.style.justifyContent = 'center';
            iconContainer.style.fontSize = '16px';
            iconContainer.textContent = '🛰️';
        }

        // Create label
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        labelSpan.style.color = '#333';
        labelSpan.style.fontSize = '14px';

        option.appendChild(iconContainer);
        option.appendChild(labelSpan);

        // Add click handler
        option.onclick = (e) => {
            e.stopPropagation();
            const isDisabled = option.classList.contains('disabled');
            if (!isDisabled) {
                this.onLayerChange(type);
                this.updateActiveState();
                this.toggleDropdown();
            }
        };

        return option;
    }

    private updateActiveState(): void {
        const currentLayer = this.getCurrentLayer();
        const options = this.dropdown.querySelectorAll('.maplibregl-ctrl-layer-option');

        options.forEach((option, index) => {
            const type = index === 0 ? 'osm' : 'aerial';
            const isActive = currentLayer === type;
            (option as HTMLElement).style.backgroundColor = isActive ? '#e8e8e8' : 'transparent';
        });
    }

    private updateVisibility(): void {
        // Always show the control if aerial tiles are configured
        // The auto-switching logic will handle zoom range restrictions
        if (!this.aerialTilesUrl) {
            this.container.style.display = 'none';
        } else {
            this.container.style.display = 'block';
        }
    }

    toggleDropdown(): void {
        this.isOpen = !this.isOpen;
        this.dropdown.style.display = this.isOpen ? 'block' : 'none';
        if (this.isOpen) {
            this.updateActiveState();
        }
    }

    onRemove(): void {
        if (this.map) {
            this.map.off('zoom', () => {
                this.updateVisibility();
                this.updateAerialOptionState();
            });
        }
        this.container.parentNode?.removeChild(this.container);
        document.removeEventListener('click', this.documentClickListener);
        this.map = undefined;
    }

    getDefaultPosition(): 'top-right' {
        return 'top-right';
    }
}

export default LayerSwitcherControl;
