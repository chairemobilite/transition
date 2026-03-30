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
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width,
                    textAlign: 'center',
                    fontSize: '0.85em',
                    padding: '0.2rem',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'inherit',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                {selectedLabel}
            </button>
            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        zIndex: 200,
                        maxHeight,
                        overflowY: 'auto',
                        background: 'rgba(30,30,30,0.95)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '4px',
                        width
                    }}
                >
                    {choices.map((c) => (
                        <div
                            key={c.value}
                            onClick={() => {
                                onSelect(c.value);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '0.2rem 0.4rem',
                                cursor: 'pointer',
                                textAlign: 'center',
                                fontSize: '0.85em',
                                background: c.value === value ? 'rgba(255,255,255,0.2)' : 'transparent'
                            }}
                            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = c.value === value ? 'rgba(255,255,255,0.2)' : 'transparent'; }}
                        >
                            {c.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ScrollableDropdown;
