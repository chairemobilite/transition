# Open-source Icons

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

## CSS and styling

To change the icon main color, use CSS. Each icon svg tag has the class "svg-icon" and the id equal to "svg-icon-ICON_NAME". For example, for an icon file named "bicycle_with_rider.svg", the ID would be "svg-icon-bicycle_with_rider". When creating/adding a new icon, the id and class should be added for compatibility and styling opportunities (changing colors, opacity, etc.)

## Credits and Licenses

Credits/sources/modifications are available for each icon in CREDITS.md, including license names matching detailed licenses in LICENSES.md

When modified, the original icon can also be included in the specific icon directory in the sources subdirectory.