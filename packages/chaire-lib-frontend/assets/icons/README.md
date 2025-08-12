# Open-source icons and interface elements

## Names and Paths

All icons are in svg format with empty/transparent background and are categorized by directory:
* Modes: transport modes icons (modes/)
* Activities: trip destination activities icons (activities/)
* Interface: interface icons (interface/) with subdirectories for specific application sections or kind of interface

Each icon can have different variants by specification (example: the bicycle icon has bicycle_with_rider and bicycle_without_rider variants in the modes/bicycle directory) and variants by usage:
* Single color (no suffix) (always available)
* Single color, inside a map marker (suffix _\_marker_)
* Single color, inside a circle (suffix _\_round_)
* Multi-color, inside a map marker (suffix _\_color\_marker_)
* Multi-color, inside a circle (suffix _\_color\_round_)

Icon names should be unique within each directory (activities, modes, or interface); otherwise, class names collide and prevent distinct styling.

## CSS and styling

To change the icon main color, use CSS. Each icon svg tag must include three classes: "svg-icon", "svg-icon-DIRECTORY" (such as activities, modes, or interface), and "svg-icon-DIRECTORY-ICON_NAME". For example, for "modes/bicycle/bicycle_with_rider.svg", use: class="svg-icon svg-icon-modes svg-icon-modes-bicycle_with_rider". Nested SVG elements should use directory‑prefixed class names (e.g., svg-icon-modes-bicycle_with_rider-road). Existing "svg-icon-opacity-*" classes are preserved. Always include all three classes for compatibility and styling opportunities (colors, opacity, etc.).

## Credits and Licenses

Credits/sources/modifications are available for each icon in CREDITS.md, including license names matching detailed licenses in LICENSES.md

When modified, the original icon can also be included in the specific icon directory in the sources subdirectory.

## Ornaments

Ornaments are small images that can be added to any app for beautification