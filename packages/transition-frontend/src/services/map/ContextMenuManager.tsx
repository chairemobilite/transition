import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { TFunction } from 'i18next';

export interface ContextMenuItem {
    key?: string;
    title: string;
    onClick: () => void;
    onHover?: () => void;
}

export class ContextMenuManager {
    private root: Root | undefined;
    private elementId: string;
    private t: TFunction;

    constructor(elementId: string, t: TFunction) {
        this.elementId = elementId;
        this.t = t;
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
            <ul>
                {elements.map((element) => (
                    <li
                        key={element.key ? element.key : element.title}
                        style={{ display: 'block', padding: '5px' }}
                        onClick={() => {
                            element.onClick();
                            this.hide();
                        }}
                        onMouseOver={() => element.onHover && element.onHover()}
                    >
                        {this.t(element.title)}
                    </li>
                ))}
            </ul>
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
