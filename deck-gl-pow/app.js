import React, {useState, useEffect} from 'react';
import DeckGL from '@deck.gl/react';
import {Map} from 'react-map-gl';
import {TripsLayer} from '@deck.gl/geo-layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import {createRoot} from 'react-dom/client';
import { ScatterplotLayer } from 'deck.gl';
import ScatterplotCustomLayer from './scatter-plot-custom-layer'
import PathLineCustomLayer from './path-line-custom-layer'

deck.log.enable();
deck.log.level = 2;
luma.log.enable();
luma.log.level = 2;

function getTooltip({object}) {
  return object && object.properties.name;
}

function setTimestamps(data) {
  var sum = 0;
  data.properties.data.segments.forEach((value) => {
    sum += value.travelTimeSeconds;
  });
  
  var times = []
  const interval = sum/data.geometry.coordinates.length;
  for(var i = 0; i < data.geometry.coordinates.length; i+=interval) {
    times.push(i);
  }
  return times
}

var routeIndex = -1;
var nodeIndex = -1;

var routeSelected = null; 
var nodeSelected = null;
console.log("Hello");
export default function Counter({routeData, nodeData}) {
  const [time, setTime] = useState(0);
  const [dashStart, setDashStart] = useState(0);

  const [animation] = useState({});

  const animate = () => {
    setTime(t => (t + 1) % 700);
    setDashStart((Date.now() / 100) % 1000);
    animation.id = window.requestAnimationFrame(animate);
  };

  useEffect(() => {
    animation.id = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animation.id);
  }, [animation]);


  const layer = [
    new TripsLayer({
      id: 'trips-layer',
      data: routeData,
      getPath: d => d.geometry.coordinates,
      getTimestamps: d => setTimestamps(d),
      getColor: d => {
        const rgb = d.properties.color
        return [parseInt(rgb.substring(1,3), 16), parseInt(rgb.substring(3,5), 16), parseInt(rgb.substring(5), 16)]
      },
      opacity: 0.8,
      widthMinPixels: 2,
      rounded: true,
      fadeTrail: true,
      trailLength: 400,
      currentTime: 0,
      shadowEnabled: false,
      pickable: true,
      updateTriggers: {
        getWidth: routeIndex
      },
      onHover: (line) => {
        routeIndex = line.index;
      },
      onClick: ({object}) => {
        nodeSelected = null
        routeSelected = [object]
      }
    }),

    new PathLineCustomLayer({
      id: 'trips-layer-selected',
      data: routeSelected,
      getPath: d => d.geometry.coordinates,
      //getTimestamps: d => {setTimestamps(d);},
      //opacity: 0.8,
      //widthMinPixels: 2,
      //rounded: true,
      //fadeTrail: true,
      //trailLength: 400,
      //currentTime: parseFloat(Math.cos(time/20)*100 + 200),
      //shadowEnabled: false,
      pickable: true,
      /*getColor: d => {
        const rgb = d.properties.color
        return [200, 200, 0]
      },*/
      getWidth: (d, i) => {
        if(i.index === routeIndex) {
          return 70;
        }
        return 20;
      },
      getDashArray: [4, 4],
      getOffset: 20,
      dashStart: dashStart,
      extensions: [new PathStyleExtension({highPrecisionDash: true })]
    }),
    
    new ScatterplotLayer({
      id: 'nodes-layer-selected',
      data: nodeSelected,
      filled: true,
      stroked: true,
      getPosition: d => d.geometry.coordinates,
      getFillColor: d => {
        const rgb = d.properties.color
        return [parseInt(rgb.substring(1,3), 16), parseInt(rgb.substring(3,5), 16), parseInt(rgb.substring(5), 16),255]
      },
      getLineColor: [255,255,255,255],
      getRadius: 400,
      extensions: [new ScatterplotCustomLayer()]
    }),

    new ScatterplotLayer({
      id: 'nodes-layer',
      data: nodeData,
      filled: true,
      stroked: true,
      getPosition: d => d.geometry.coordinates,
      getFillColor: d => {
        const rgb = d.properties.color
        return [parseInt(rgb.substring(1,3), 16), parseInt(rgb.substring(3,5), 16), parseInt(rgb.substring(5), 16),255]
      },
      getLineColor: [255,255,255,255],
      getRadius: (d, i) => {
        if(i.index === nodeIndex) {
          return 20;
        }
        return 10;
      },
      updateTriggers: {
        getRadius: nodeIndex
      },
      pickable: true,
      onHover: (node) => {
        nodeIndex = node.index;
      },
      onClick: ({object}) => {
        routeSelected = null
        nodeSelected = [object]
      }
    }),
  ];

  const INITIAL_VIEW_STATE = {
    longitude: -73.463591,
    latitude: 45.533242,
    zoom: 12,
    pitch: 0,
    bearing: 0
  };

  return (
    <DeckGL
      layers={layer}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      getTooltip={getTooltip}
    >
      <Map reuseMaps mapStyle='https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json' preventStyleDiffing={true}/>
    </DeckGL>
  );
}

const root = createRoot(document.getElementById("root"));
fetch('./geojson-route.geojson')
    .then(response => response.json())
    .then((routes) => {
      fetch('./nodes.geojson')
        .then(response => response.json())
        .then((nodes) => {
          root.render(<Counter routeData={routes.features} nodeData={nodes.features} />);
        });
    });