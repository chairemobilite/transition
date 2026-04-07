/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

type ScrollableDropdownProps = {
    value: number;
    choices: { value: number; label: string }[];
    onSelect: (value: number) => void;
    maxHeight?: string;
    width?: string;
};

const ScrollableDropdown: React.FunctionComponent<ScrollableDropdownProps> = ({
    value,
    choices,
    onSelect,
    maxHeight = '150px',
    width = '3.5em'
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const selectedLabel = choices.find((c) => c.value === value)?.label ?? String(value);

    return (
        <div ref={dropdownRef} className="scrollable-dropdown">
            <button
                type="button"
                className="scrollable-dropdown-trigger"
                onClick={() => setIsOpen(!isOpen)}
                style={{ width }}
            >
                {selectedLabel}
            </button>
            {isOpen && (
                <div
                    className="scrollable-dropdown-menu"
                    style={{ maxHeight, width }}
                >
                    {choices.map((c) => {
                        const isSelected = c.value === value;
                        return (
                        <div
                            key={c.value}
                            className={`scrollable-dropdown-item${isSelected ? ' selected' : ''}`}
                            onClick={() => {
                                onSelect(c.value);
                                setIsOpen(false);
                            }}
                        >
                            {c.label}
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ScrollableDropdown;
