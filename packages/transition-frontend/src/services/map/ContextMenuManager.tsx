/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import React, { useRef } from 'react';
import { Root, createRoot } from 'react-dom/client';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

export interface ContextMenuItem {
    key?: string;
    title: string;
    onClick: () => void;
    onHover?: () => void;
}

type ContextMenuProps = {
    elements: ContextMenuItem[];
    onHide: () => void;
};

const ContextMenu: React.FC<ContextMenuProps> = ({ elements, onHide }) => {
    const { t } = useTranslation(['transit', 'main']);
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                onHide();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef]);

    return (
        <div ref={wrapperRef}>
            <ul>
                {elements.map((element) => (
                    <li
                        key={element.key ? element.key : element.title}
                        style={{ display: 'block', padding: '5px' }}
                        onClick={() => {
                            element.onClick();
                            onHide();
                        }}
                        onMouseOver={() => element.onHover && element.onHover()}
                    >
                        {t(element.title)}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export class ContextMenuManager {
    private root: Root | undefined;
    private elementId: string;

    constructor(elementId: string) {
        this.elementId = elementId;
        this.initialize();
    }

    private initialize() {
        const element = document.getElementById(this.elementId);
        if (element) {
            this.root = createRoot(element);
            this.root.render(<React.Fragment />);
        }
    }

    public show(position: [number, number], elements: ContextMenuItem[]) {
        const element = document.getElementById(this.elementId);
        if (!element || !this.root) {
            return;
        }

        element.style.left = position[0] + 'px';
        element.style.top = position[1] + 'px';
        element.style.display = 'block';

        this.root.render(
            <ContextMenu
                elements={elements}
                onHide={() => {
                    this.hide();
                }}
            />
        );
    }

    public hide() {
        const element = document.getElementById(this.elementId);
        if (!element || !this.root) {
            return;
        }

        element.style.display = 'none';
        this.root.render(<React.Fragment />);
    }

    public destroy() {
        if (this.root) {
            this.root.unmount();
            this.root = undefined;
        }
    }
}
