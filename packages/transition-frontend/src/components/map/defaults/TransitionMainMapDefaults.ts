export const getDefaultViewState = (center: [number, number], zoom: number) => ({
    longitude: center[0],
    latitude: center[1],
    zoom,
    pitch: 0,
    bearing: 0
});

export const viewStateHasChanged = (previousState: any, newState: any) => {
    return (
        previousState.latitude !== newState.latitude ||
        previousState.longitude !== newState.longitude ||
        previousState.zoom !== newState.zoom ||
        previousState.width !== newState.width ||
        previousState.height !== newState.height
    );
};
