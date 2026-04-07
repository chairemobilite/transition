/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import ScrollableDropdown from './ScrollableDropdown';

const SECONDS_CHOICES = Array.from({ length: 60 }, (_, i) => ({
    value: i,
    label: i < 10 ? '0' + i : String(i)
}));

type TimeInputProps = {
    seconds: number;
    onChange: (newSeconds: number) => void;
    readOnly?: boolean;
};

const TimeInput: React.FunctionComponent<TimeInputProps> = ({ seconds, onChange, readOnly = false }) => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;

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

    if (readOnly) {
        return (
            <span className="time-input readonly">
                <strong>{mins}</strong>
                <span className="time-input-unit">min</span>
                <strong>{secs < 10 ? '0' + secs : secs}</strong>
                <span className="time-input-unit">sec</span>
            </span>
        );
    }

    return (
        <span className="time-input">
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
                className="time-input-minutes"
            />
            <span className="time-input-unit">min</span>
            <ScrollableDropdown
                value={secs}
                choices={SECONDS_CHOICES}
                onSelect={(val) => onChange(mins * 60 + val)}
            />
            <span className="time-input-unit">sec</span>
        </span>
    );
};

export default TimeInput;
