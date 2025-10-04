[out:json][timeout:240];
(
    {{polyboundary="BOUNDARY"}}

    way(poly:{{polyboundary}});
    relation(poly:{{polyboundary}});
);
out geom;