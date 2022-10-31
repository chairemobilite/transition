/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/* Source: https://github.com/openstreetmap/iD and https://github.com/keithamus/jwerty */

/*
 * See https://github.com/keithamus/jwerty
 */

const modifierCodes = {
    // Shift key, ⇧
    '⇧': 16,
    shift: 16,
    // CTRL key, on Mac: ⌃
    '⌃': 17,
    ctrl: 17,
    // ALT key, on Mac: ⌥ (Alt)
    '⌥': 18,
    alt: 18,
    option: 18,
    // META, on Mac: ⌘ (CMD), on Windows (Win), on Linux (Super)
    '⌘': 91,
    meta: 91,
    cmd: 91,
    super: 91,
    win: 91
};

const modifierProperties = {
    16: 'shiftKey',
    17: 'ctrlKey',
    18: 'altKey',
    91: 'metaKey'
};

const keys = {
    // Backspace key, on Mac: ⌫ (Backspace)
    '⌫': 'Backspace',
    backspace: 'Backspace',
    // Tab Key, on Mac: ⇥ (Tab), on Windows ⇥⇥
    '⇥': 'Tab',
    '⇆': 'Tab',
    tab: 'Tab',
    // Return key, ↩
    '↩': 'Enter',
    return: 'Enter',
    enter: 'Enter',
    '⌅': 'Enter',
    // Pause/Break key
    pause: 'Pause',
    'pause-break': 'Pause',
    // Caps Lock key, ⇪
    '⇪': 'CapsLock',
    caps: 'CapsLock',
    'caps-lock': 'CapsLock',
    // Escape key, on Mac: ⎋, on Windows: Esc
    '⎋': ['Escape', 'Esc'],
    escape: ['Escape', 'Esc'],
    esc: ['Escape', 'Esc'],
    // Space key
    space: [' ', 'Spacebar'],
    // Page-Up key, or pgup, on Mac: ↖
    '↖': 'PageUp',
    pgup: 'PageUp',
    'page-up': 'PageUp',
    // Page-Down key, or pgdown, on Mac: ↘
    '↘': 'PageDown',
    pgdown: 'PageDown',
    'page-down': 'PageDown',
    // END key, on Mac: ⇟
    '⇟': 'End',
    end: 'End',
    // HOME key, on Mac: ⇞
    '⇞': 'Home',
    home: 'Home',
    // Insert key, or ins
    ins: 'Insert',
    insert: 'Insert',
    // Delete key, on Mac: ⌦ (Delete)
    '⌦': ['Delete', 'Del'],
    del: ['Delete', 'Del'],
    delete: ['Delete', 'Del'],
    // Left Arrow Key, or ←
    '←': ['ArrowLeft', 'Left'],
    left: ['ArrowLeft', 'Left'],
    'arrow-left': ['ArrowLeft', 'Left'],
    // Up Arrow Key, or ↑
    '↑': ['ArrowUp', 'Up'],
    up: ['ArrowUp', 'Up'],
    'arrow-up': ['ArrowUp', 'Up'],
    // Right Arrow Key, or →
    '→': ['ArrowRight', 'Right'],
    right: ['ArrowRight', 'Right'],
    'arrow-right': ['ArrowRight', 'Right'],
    // Up Arrow Key, or ↓
    '↓': ['ArrowDown', 'Down'],
    down: ['ArrowDown', 'Down'],
    'arrow-down': ['ArrowDown', 'Down'],
    // odities, stuff for backward compatibility (browsers and code):
    // Num-Multiply, or *
    '*': ['*', 'Multiply'],
    star: ['*', 'Multiply'],
    asterisk: ['*', 'Multiply'],
    multiply: ['*', 'Multiply'],
    // Num-Plus or +
    '+': ['+', 'Add'],
    plus: ['+', 'Add'],
    // Num-Subtract, or -
    '-': ['-', 'Subtract'],
    subtract: ['-', 'Subtract'],
    dash: ['-', 'Subtract'],
    // Semicolon
    semicolon: ';',
    // = or equals
    equals: '=',
    // Comma, or ,
    comma: ',',
    // Period, or ., or full-stop
    period: '.',
    'full-stop': '.',
    // Slash, or /, or forward-slash
    slash: '/',
    'forward-slash': '/',
    // Tick, or `, or back-quote
    tick: '`',
    'back-quote': '`',
    // Open bracket, or [
    'open-bracket': '[',
    // Back slash, or \
    'back-slash': '\\',
    // Close backet, or ]
    'close-bracket': ']',
    // Apostrophe, or Quote, or '
    quote: '\'',
    apostrophe: '\'',
    // NUMPAD 0-9
    'num-0': '0',
    'num-1': '1',
    'num-2': '2',
    'num-3': '3',
    'num-4': '4',
    'num-5': '5',
    'num-6': '6',
    'num-7': '7',
    'num-8': '8',
    'num-9': '9'
};

const allKeyCodes = {
    // Backspace key, on Mac: ⌫ (Backspace)
    '⌫': 8,
    backspace: 8,
    // Tab Key, on Mac: ⇥ (Tab), on Windows ⇥⇥
    '⇥': 9,
    '⇆': 9,
    tab: 9,
    // Return key, ↩
    '↩': 13,
    return: 13,
    enter: 13,
    '⌅': 13,
    // Pause/Break key
    pause: 19,
    'pause-break': 19,
    // Caps Lock key, ⇪
    '⇪': 20,
    caps: 20,
    'caps-lock': 20,
    // Escape key, on Mac: ⎋, on Windows: Esc
    '⎋': 27,
    escape: 27,
    esc: 27,
    // Space key
    space: 32,
    // Page-Up key, or pgup, on Mac: ↖
    '↖': 33,
    pgup: 33,
    'page-up': 33,
    // Page-Down key, or pgdown, on Mac: ↘
    '↘': 34,
    pgdown: 34,
    'page-down': 34,
    // END key, on Mac: ⇟
    '⇟': 35,
    end: 35,
    // HOME key, on Mac: ⇞
    '⇞': 36,
    home: 36,
    // Insert key, or ins
    ins: 45,
    insert: 45,
    // Delete key, on Mac: ⌦ (Delete)
    '⌦': 46,
    del: 46,
    delete: 46,
    // Left Arrow Key, or ←
    '←': 37,
    left: 37,
    'arrow-left': 37,
    // Up Arrow Key, or ↑
    '↑': 38,
    up: 38,
    'arrow-up': 38,
    // Right Arrow Key, or →
    '→': 39,
    right: 39,
    'arrow-right': 39,
    // Up Arrow Key, or ↓
    '↓': 40,
    down: 40,
    'arrow-down': 40,
    // odities, printing characters that come out wrong:
    // Firefox Equals
    ffequals: 61,
    // Num-Multiply, or *
    '*': 106,
    star: 106,
    asterisk: 106,
    multiply: 106,
    // Num-Plus or +
    '+': 107,
    plus: 107,
    // Num-Subtract, or -
    '-': 109,
    subtract: 109,
    // Firefox Plus
    ffplus: 171,
    // Firefox Minus
    ffminus: 173,
    // Semicolon
    ';': 186,
    semicolon: 186,
    // = or equals
    '=': 187,
    equals: 187,
    // Comma, or ,
    ',': 188,
    comma: 188,
    // Dash / Underscore key
    dash: 189,
    // Period, or ., or full-stop
    '.': 190,
    period: 190,
    'full-stop': 190,
    // Slash, or /, or forward-slash
    '/': 191,
    slash: 191,
    'forward-slash': 191,
    // Tick, or `, or back-quote
    '`': 192,
    tick: 192,
    'back-quote': 192,
    // Open bracket, or [
    '[': 219,
    'open-bracket': 219,
    // Back slash, or \
    '\\': 220,
    'back-slash': 220,
    // Close backet, or ]
    ']': 221,
    'close-bracket': 221,
    // Apostrophe, or Quote, or '
    '\'': 222,
    quote: 222,
    apostrophe: 222
};

// NUMPAD 0-9
let i = 95,
n = 0;
while (++i < 106) {
    allKeyCodes['num-' + n] = i;
    ++n;
}

// 0-9
i = 47;
n = 0;
while (++i < 58) {
    allKeyCodes[n] = i;
    ++n;
}

// F1-F25
i = 111;
n = 1;
while (++i < 136) {
    allKeyCodes['f' + n] = i;
    ++n;
}

// a-z
i = 64;
while (++i < 91) {
    allKeyCodes[String.fromCharCode(i).toLowerCase()] = i;
}

// WARNING! don't use meta key as a single modifier because of this: https://stackoverflow.com/a/57153300
// KeyboardManager is only for browsers (do not import in node/server)
// TODO: This class was copied from legacy workspace and not changed or reviewed at all (or almost). Is it still necessary? Does some package, or newer versions of React handle the behavior?
class KeyboardManager {
    private _keyPressed: { shift: boolean; ctrl: boolean; alt: boolean };
    private _keybindings: { [key: string]: any };
    private _downTargetTagName;

    constructor() {
        this._keyPressed = {
            shift: false,
            ctrl: false,
            alt: false //,
            //meta : false // don't use this see https://stackoverflow.com/a/57153300
        };
        this._keybindings = {};
        this._downTargetTagName = null;
    }

    keyIsPressed(key) {
        return this._keyPressed[key];
    }

    testBindings(event) {
        let didMatch = false;
        const bindings = Object.keys(this._keybindings).map((id) => this._keybindings[id]);
        let i, binding;

        // Most key shortcuts will accept either lower or uppercase ('h' or 'H'),
        // so we don't strictly match on the shift key, but we prioritize
        // shifted keybindings first, and fallback to unshifted only if no match.
        // (This lets us differentiate between '←'/'⇧←' or '⌘Z'/'⌘⇧Z')

        // priority match shifted keybindings first
        for (i = 0; i < bindings.length; i++) {
            binding = bindings[i];
            if (!binding.event.modifiers.shiftKey) continue; // no shift
            if (this.matches(event, binding, true)) {
                event.preventDefault();
                event.stopPropagation();
                binding.callback();
                didMatch = true;
            }
        }

        // then unshifted keybindings
        if (didMatch) return;
        for (i = 0; i < bindings.length; i++) {
            binding = bindings[i];
            if (binding.event.modifiers.shiftKey) continue; // shift
            if (this.matches(event, binding, false)) {
                event.preventDefault();
                event.stopPropagation();
                binding.callback();
            }
        }
    }

    matches(event, binding, testShift) {
        let isMatch = false;
        let tryKeyCode = true;

        // Prefer a match on `KeyboardEvent.key`
        if (
            !binding.event.modifiers.altKey &&
            !binding.event.modifiers.ctrlKey &&
            !binding.event.modifiers.metaKey &&
            event.key !== undefined
        ) {
            tryKeyCode = event.key.charCodeAt(0) > 255; // outside ISO-Latin-1
            isMatch = true;

            if (binding.event.key === undefined) {
                isMatch = false;
            } else if (Array.isArray(binding.event.key)) {
                if (
                    binding.event.key
                        .map((s) => {
                            return s.toLowerCase();
                        })
                        .indexOf(event.key.toLowerCase()) === -1
                )
                    isMatch = false;
            } else {
                if (event.key.toLowerCase() !== binding.event.key.toLowerCase()) isMatch = false;
            }
        }

        // Fallback match on `KeyboardEvent.keyCode`, can happen if:
        // - browser doesn't support `KeyboardEvent.key`
        // - `KeyboardEvent.key` is outside ISO-Latin-1 range (cyrillic?)
        if (!isMatch && tryKeyCode) {
            isMatch = event.keyCode === binding.event.keyCode;
        }

        if (!isMatch) return false;

        // test modifier keys
        //if (!(event.ctrlKey && event.altKey)) {  // if both are set, assume AltGr and skip it - #4096
        if (event.ctrlKey !== binding.event.modifiers.ctrlKey) return false;
        if (event.altKey !== binding.event.modifiers.altKey) return false;
        //}
        if (event.metaKey !== binding.event.modifiers.metaKey) return false;
        if (testShift && event.shiftKey !== binding.event.modifiers.shiftKey) return false;

        return true;
    }

    capture() {
        this.testBindings(true);
    }

    clear() {
        this._keybindings = {};
        return this;
    }

    // Remove one or more keycode bindings.
    off(keyCodes: string | string[]) {
        const uniqKeyCodes = typeof keyCodes === 'string' ? [keyCodes] : keyCodes;

        for (let i = 0, countI = uniqKeyCodes.length; i < countI; i++) {
            delete this._keybindings[uniqKeyCodes[i]];
        }

        return this;
    }

    // Add one or more keycode bindings.
    on(keyCodes: string | string[], callback) {
        if (typeof callback !== 'function') {
            return this.off(keyCodes);
        }

        const uniqKeyCodes = typeof keyCodes === 'string' ? [keyCodes] : keyCodes;

        for (let i = 0, countI = uniqKeyCodes.length; i < countI; i++) {
            const id = uniqKeyCodes[i];
            const binding = {
                id: id,
                callback: callback,
                event: {
                    key: undefined, // preferred
                    keyCode: 0, // fallback
                    modifiers: {
                        shift: false,
                        ctrlKey: false,
                        altKey: false,
                        metaKey: false
                    }
                }
            };

            if (this._keybindings[id]) {
                console.warn(`warning: KeyboardManager: duplicate keybinding for "${id}"`);
            }

            const matches = id.toLowerCase().match(/(?:(?:[^+⇧⌃⌥⌘])+|[⇧⌃⌥⌘]|\+\+|^\+$)/g) || [];
            for (let j = 0, countJ = matches.length; j < countJ; j++) {
                // Normalise matching errors
                if (matches[j] === '++') matches[j] = '+';

                if (matches[j] in modifierCodes) {
                    const modifier = modifierProperties[modifierCodes[matches[j]]];
                    binding.event.modifiers[modifier] = true;
                } else {
                    binding.event.key = keys[matches[j]] || matches[j];
                    if (matches[j] in allKeyCodes) {
                        binding.event.keyCode = keyCodes[matches[j]];
                    }
                }
            }

            this._keybindings[id] = binding;
        }

        return this;
    }

    keyDown(e) {
        this._keyPressed.ctrl = e.ctrlKey || e.key === 'Control';
        this._keyPressed.alt = e.altKey || e.key === 'Alt';
        this._keyPressed.shift = e.shiftKey || e.key === 'Shift';

        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            this._downTargetTagName = e.repeat ? this._downTargetTagName : e.target.tagName;
            return;
        }
        if (e.repeat) {
            return;
        }

        this._downTargetTagName = e.target.tagName;

        this.testBindings(e);
    }

    keyUp(e) {
        this._keyPressed.ctrl = e.ctrlKey;
        this._keyPressed.alt = e.altKey;
        this._keyPressed.shift = e.shiftKey;

        // dont trigger events if in a form input:
        if (
            this._downTargetTagName === e.target.tagName &&
            (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')
        ) {
            return;
        }
    }
}

// singleton:
const instance = new KeyboardManager();
export default instance;
