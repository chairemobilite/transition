
[out:json][timeout:10];
(
    {{polyboundary="BOUNDARY"}} 
    way['highway'~"^(residential|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|service|motorway|motorway_link|pedestrian|living_street|unclassified|bus_guideway|busway)$"](poly:{{polyboundary}});
);
out geom;

