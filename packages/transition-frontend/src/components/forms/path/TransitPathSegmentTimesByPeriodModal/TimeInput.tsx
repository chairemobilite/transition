/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import { snapSeconds } from 'transition-common/lib/services/path/PathSegmentTimeUtils';

const SECONDS_CHOICES = [
    { value: '0', label: '00' },
    { value: '5', label: '05' },
    { value: '10', label: '10' },
    { value: '15', label: '15' },
    { value: '20', label: '20' },
    { value: '25', label: '25' },
    { value: '30', label: '30' },
    { value: '35', label: '35' },
    { value: '40', label: '40' },
    { value: '45', label: '45' },
    { value: '50', label: '50' },
    { value: '55', label: '55' }
];

type TimeInputProps = {
    seconds: number;
    onChange: (newSeconds: number) => void;
    readOnly?: boolean;
};

const TimeInput: React.FunctionComponent<TimeInputProps> = ({ seconds, onChange, readOnly = false }) => {
    const mins = Math.floor(seconds / 60);
    const secs = snapSeconds(seconds % 60);

    const [minsText, setMinsText] = React.useState<string>(String(mins));
    const [isFocused, setIsFocused] = React.useState(false);

    // Sync display when value changes externally (not while user is typing)
    React.useEffect(() => {
        if (!isFocused) {
            setMinsText(String(mins));
        }
    }, [mins, isFocused]);

    const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw !== '' && !/^\d+$/.test(raw)) return;
        setMinsText(raw);
        const val = parseInt(raw, 10);
        if (!isNaN(val) && val >= 0) {
            onChange(val * 60 + secs);
        }
    };

    const handleMinutesBlur = () => {
        setIsFocused(false);
        const val = parseInt(minsText, 10);
        if (isNaN(val) || val < 0) {
            setMinsText(String(mins));
        } else {
            setMinsText(String(val));
        }
    };

    const handleSecondsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = parseInt(e.target.value, 10);
        onChange(mins * 60 + val);
    };

    if (readOnly) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85em' }}>
                <strong>{mins}</strong>
                <span style={{ opacity: 0.6, fontSize: '0.8em' }}>min</span>
                <strong>{secs < 10 ? '0' + secs : secs}</strong>
                <span style={{ opacity: 0.6, fontSize: '0.8em' }}>sec</span>
            </span>
        );
    }

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <input
                type="text"
                inputMode="numeric"
                value={minsText}
                onChange={handleMinutesChange}
                onFocus={() => setIsFocused(true)}
                onBlur={handleMinutesBlur}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                    }
                }}
                style={{
                    width: '3em',
                    textAlign: 'center',
                    fontSize: '0.85em',
                    padding: '0.2rem',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'inherit',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px'
                }}
            />
            <span style={{ opacity: 0.6, fontSize: '0.8em' }}>min</span>
            <select
                value={String(secs)}
                onChange={handleSecondsChange}
                style={{
                    fontSize: '0.85em',
                    padding: '0.2rem',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'inherit',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px'
                }}
            >
                {SECONDS_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                        {c.label}
                    </option>
                ))}
            </select>
            <span style={{ opacity: 0.6, fontSize: '0.8em' }}>sec</span>
        </span>
    );
};

export default TimeInput;
