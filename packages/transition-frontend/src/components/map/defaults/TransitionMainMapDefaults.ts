export const getDefaultViewState = (center: [number, number], zoom: number) => ({
    longitude: center[0],
    latitude: center[1],
    zoom,
    pitch: 0,
    bearing: 0
});
