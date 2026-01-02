import * as shapefile from 'shapefile'

export interface RoadFeature {
  type: 'Feature'
  properties: {
    [key: string]: any
  }
  geometry: {
    type: 'LineString' | 'MultiLineString'
    coordinates: number[][][] | number[][]
  }
}

export interface RoadFeatureCollection {
  type: 'FeatureCollection'
  features: RoadFeature[]
  metadata: {
    name: string
    type: string
    count: number
    loaded: Date
  }
}

// Cache for loaded shapefiles to improve performance
const shapefileCache = new Map<string, RoadFeatureCollection>()

// Available shapefile datasets
export const SHAPEFILE_DATASETS = {
  PAVED_REGIONAL_ROADS: {
    name: 'Paved Regional Roads',
    file: 'Paved_Regional_Roads.shp',
    type: 'regional',
    color: '#ffaa00',
    weight: 2
  },
  PAVED_TRUNK_ROADS: {
    name: 'Paved Trunk Roads',
    file: 'Paved_Trunk_Roads.shp',
    type: 'trunk',
    color: '#ff6600',
    weight: 3
  },
  PAVED_TRUNK_SHP: {
    name: 'Paved Trunk SHP',
    file: 'Paved_Trunk_SHP.shp',
    type: 'trunk',
    color: '#1a1a1a',
    weight: 3
  },
  INTERNATIONAL_BOUNDARIES: {
    name: 'International Boundaries',
    file: 'International_Bounderies.shp',
    type: 'boundary',
    color: '#0000ff',
    weight: 2
  },
  MAJOR_LAKES: {
    name: 'Major Lakes',
    file: 'Major_Lakes.shp',
    type: 'lake',
    color: '#0099ff',
    weight: 2
  },
  MAJOR_TOWNS: {
    name: 'Major Towns',
    file: 'Major_Towns.shp',
    type: 'town',
    color: '#00cc44',
    weight: 2
  },
  OCEAN: {
    name: 'Ocean',
    file: 'Ocean.shp',
    type: 'ocean',
    color: '#3366ff',
    weight: 2
  },
  OTHER_TOWNS: {
    name: 'Other Towns',
    file: 'Other_Towns.shp',
    type: 'town',
    color: '#66ff66',
    weight: 1
  },
  REGIONAL_BOUNDARIES: {
    name: 'Regional Boundaries',
    file: 'Regional_Bounderies.shp',
    type: 'boundary',
    color: '#ff00ff',
    weight: 2
  }
}

// Generic shapefile loader with caching
export async function loadShapefile(datasetKey: keyof typeof SHAPEFILE_DATASETS): Promise<RoadFeatureCollection> {
  const dataset = SHAPEFILE_DATASETS[datasetKey]
  
  // Check cache first
  if (shapefileCache.has(datasetKey)) {
    console.log(`Using cached ${dataset.name} data`)
    return shapefileCache.get(datasetKey)!
  }
  
  try {
    console.log(`Loading ${dataset.name} shapefile...`)
    
    // Load the shapefile from the assets folder
    const response = await fetch(`/assets/${dataset.file}`)
    if (!response.ok) {
      throw new Error(`Failed to load shapefile: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const source = await shapefile.open(arrayBuffer)
    
    const features: RoadFeature[] = []
    let result: any
    
    while ((result = await source.read()) && !result.done) {
      features.push(result.value)
    }
    
    const featureCollection: RoadFeatureCollection = {
      type: 'FeatureCollection',
      features: features,
      metadata: {
        name: dataset.name,
        type: dataset.type,
        count: features.length,
        loaded: new Date()
      }
    }
    
    // Cache the result
    shapefileCache.set(datasetKey, featureCollection)
    
    console.log(`Loaded ${features.length} features from ${dataset.name}`)
    
    return featureCollection
  } catch (error) {
    console.error(`Error loading ${dataset.name}:`, error)
    
    // Fallback to sample data if loading fails
    const fallbackData: RoadFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: `Sample ${dataset.name}`,
            type: dataset.type,
            surface: 'Paved'
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [35.7647, -6.2088],
              [36.6821, -3.3731],
              [32.9091, -2.5149]
            ]
          }
        }
      ],
      metadata: {
        name: dataset.name,
        type: dataset.type,
        count: 1,
        loaded: new Date()
      }
    }
    
    // Cache the fallback data
    shapefileCache.set(datasetKey, fallbackData)
    
    return fallbackData
  }
}

// Load all available shapefiles
export async function loadAllShapefiles(): Promise<Record<string, RoadFeatureCollection>> {
  const results: Record<string, RoadFeatureCollection> = {}
  
  const loadPromises = Object.keys(SHAPEFILE_DATASETS).map(async (key) => {
    const datasetKey = key as keyof typeof SHAPEFILE_DATASETS
    try {
      results[datasetKey] = await loadShapefile(datasetKey)
    } catch (error) {
      console.error(`Failed to load ${key}:`, error)
    }
  })
  
  await Promise.all(loadPromises)
  return results
}

// Legacy function for backward compatibility
export async function loadPavedRegionalRoads(): Promise<RoadFeatureCollection> {
  return loadShapefile('PAVED_REGIONAL_ROADS')
}

// Function to get road properties for display
export function getRoadProperties(feature: RoadFeature): string {
  const props = feature.properties
  const name = props.NAME || props.name || props.ROAD_NAME || 'Unnamed Road'
  const type = props.TYPE || props.type || props.ROAD_TYPE || 'Regional'
  const surface = props.SURFACE || props.surface || 'Paved'
  
  return `${name} (${type}, ${surface})`
}

// Enhanced styling function for different road types
export function styleRoad(feature: RoadFeature, datasetType: string, color: string = '#ff4444', opacity: number = 0.7) {
  const props = feature.properties
  const roadType = props.TYPE || props.type || props.ROAD_TYPE || datasetType || 'regional'

  let weight = 2
  let roadColor = color
  let fillColor = color
  let fillOpacity = 0

  switch (roadType.toLowerCase()) {
    case 'boundary':
      weight = 3
      roadColor = '#ff00ff' // magenta border
      fillColor = '#ff00ff33' // semi-transparent magenta fill
      fillOpacity = 0.2
      break
    case 'lake':
      weight = 2
      roadColor = '#0099ff' // blue border
      fillColor = '#0099ff66' // semi-transparent blue fill
      fillOpacity = 0.4
      break
    case 'ocean':
      weight = 2
      roadColor = '#3366ff' // deep blue border
      fillColor = '#3366ff66' // semi-transparent deep blue fill
      fillOpacity = 0.3
      break
    case 'town':
      weight = 1
      roadColor = '#00cc44' // green border
      fillColor = '#00cc4433' // semi-transparent green fill
      fillOpacity = 0.2
      break
    case 'highway':
    case 'primary':
    case 'trunk':
      weight = 4
      roadColor = '#ff0000'
      break
    case 'secondary':
      weight = 3
      roadColor = '#ff6600'
      break
    case 'regional':
    case 'tertiary':
      weight = 2
      roadColor = '#888888' // grey border
      fillColor = '#1a1a1a'
      fillOpacity = 0.25
      break
    case 'local':
    case 'residential':
      weight = 1
      roadColor = '#ffff00'
      break
    default:
      weight = 2
      roadColor = color
  }

  return {
    color: roadColor,
    weight: weight,
    opacity: opacity,
    fillColor: fillColor,
    fillOpacity: fillOpacity,
  }
}

// Clear cache function for memory management
export function clearShapefileCache() {
  shapefileCache.clear()
  console.log('Shapefile cache cleared')
}

// Get cache statistics
export function getCacheStats() {
  return {
    cachedFiles: shapefileCache.size,
    totalFeatures: Array.from(shapefileCache.values()).reduce((sum, collection) => sum + collection.features.length, 0),
    cacheKeys: Array.from(shapefileCache.keys())
  }
} 