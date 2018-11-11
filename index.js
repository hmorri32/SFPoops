import { CREDENTIALS } from './credentials';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

mapboxgl.accessToken = CREDENTIALS.mapboxgl;

const map = new mapboxgl.Map({
  container: 'map',
  // style: 'mapbox://styles/mapbox/outdoors-v9',
  style: 'mapbox://styles/mapbox/dark-v9',
  // style: 'mapbox://styles/concept3d/cjkvhp2eu2na72sqque0frweq',
  center: [-122.42347, 37.75846],
  zoom: 12.47,
  hash: true
});

const formatGeoJson = collection => {
  collection.features.forEach(feature => {
    feature.geometry = {
      type: 'Point',
      coordinates: [feature.properties.longitude, feature.properties.latitude]
    };
    feature.properties['marker-color'] = '#0000ff';
    feature.properties.line = 'blue';
  });
  return collection;
};

const loadMap = () => {
  controls();
  hillRgb();
  extrusions();
  fetchPooAndRenderMarkers();
};

map.on('load', () => loadMap());
map.on('zoom', () => ease());

const controls = () => {
  map.addControl(
    new MapboxGeocoder({ accessToken: mapboxgl.accessToken }),
    'top-right'
  );
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
};

const hillRgb = () => {
  map.addSource('dem', {
    type: 'raster-dem',
    url: 'mapbox://mapbox.terrain-rgb'
  });

  map.addLayer(
    {
      id: 'hillshading',
      source: 'dem',
      type: 'hillshade'
    }
    // 'waterway-river-canal-shadow'
  );
};

const extrusions = () => {
  const la = map.getStyle().layers;
  const layers = la.filter(l => l.type === 'symbol' && l.layout['text-field']);
  const layerId = layers[0].id;

  map.addLayer(
    {
      id: '3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: 12,
      paint: {
        'fill-extrusion-color': '#FFFFFF',
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          0,
          15.05,
          ['get', 'height']
        ],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          0,
          15.05,
          ['get', 'min_height']
        ],
        'fill-extrusion-opacity': 0.6
      }
    },
    layerId
  );
};

const ease = () => {
  map.getZoom() > 16
    ? map.easeTo({ pitch: 40, bearing: -17 })
    : map.easeTo({ pitch: 0, bearing: 0 });
};

async function fetchPooAndRenderMarkers() {
  const turdData = await fetch(
    'https://data.sfgov.org/resource/aqnm-j7pg.geojson?$where=_251_feces_needles_condoms_y_n_where_y_none >= 0&$limit=10000'
  );
  let jason = await turdData.json();
  let newnew = formatGeoJson(jason);

  map.addSource('poops', {
    type: 'geojson',
    data: newnew,
    cluster: true,
    clusterMaxZoom: 13, // Max zoom to cluster points on
    clusterRadius: 20 // Radius of each cluster when clustering points (defaults to 50)
  });

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'poops',
    filter: ['has', 'point_count'],
    paint: {
      // * Blue, 20px circles when point count is less than 100
      // * Yellow, 30px circles when point count is between 100 and 750
      // * Pink, 40px circles when point count is greater than or equal to 750
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6',
        50,
        '#f1f075',
        200,
        '#f28cb1'
      ],
      'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40]
    }
  });

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'poops',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12
    }
  });

  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'poops',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#11b4da',
      'circle-radius': 4,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    }
  });

  map.on('click', 'clusters', function(e) {
    var features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    var clusterId = features[0].properties.cluster_id;

    map
      .getSource('poops')
      .getClusterExpansionZoom(clusterId, function(err, zoom) {
        if (err) return;

        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom
        });
      });
  });

  map.on('mouseenter', 'clusters', function() {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'clusters', function() {
    map.getCanvas().style.cursor = '';
  });
}
