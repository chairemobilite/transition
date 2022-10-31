-- Foot profile

api_version = 4

Set = require('lib/set')
Sequence = require('lib/sequence')
Handlers = require("lib/way_handlers")
find_access_tag = require("lib/access").find_access_tag

function setup()
  local walking_speed = 5
  return {
    properties = {
      weight_name                   = 'routability',
      max_speed_for_map_matching    = 40/3.6, -- kmph -> m/s
      call_tagless_node_function    = false,
      traffic_light_penalty         = 15,
      u_turn_penalty                = 2,
      continue_straight_at_waypoint = false,
      use_turn_restrictions         = false,
    },

    default_mode            = mode.walking,
    default_speed           = walking_speed,
    oneway_handling         = 'specific',     -- respect 'oneway:foot' but not 'oneway'

    barrier_blacklist = Set {
      'yes',
      'wall',
      'fence'
    },

    access_tag_whitelist = Set {
      'yes',
      'foot',
      'routing:foot',
      'permissive',
      'designated'
    },

    service_access_tag_blacklist = Set {
      --'private' -- default value in osrm default profile
    },

    access_tag_blacklist = Set {
      'no',
      'agricultural',
      'forestry',
      'customers',
      'private',
      'delivery',
      'use_sidepath'
    },

    restricted_access_tag_list = Set {
      'private',
      'customers',
      'delivery',
      'agricultural',
      'forestry',
      'destination'
    },

    restricted_highway_whitelist = Set {
      'trunk',
      'trunk_link',
      'primary',
      'primary_link',
      'secondary',
      'secondary_link',
      'tertiary',
      'tertiary_link',
      'residential',
      'living_street',
      'unclassified',
      'service',
      'footway',
      'bridleway',
      'track',
      'path',
      'cycleway',
      'pedestrian',
      'steps',
      'pier',
      'corridor',
      'platform'
    },

    construction_whitelist = Set {},

    service_tag_forbidden = Set {
      'emergency_access'
    },

    service_penalties = {},

    access_tags_hierarchy = Sequence {
      'routing:foot',
      'foot',
      'access'
    },

    restrictions = Sequence {
      'foot'
    },

    -- list of suffixes to suppress in name change instructions
    suffix_list = Set {
      'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'North', 'South', 'West', 'East'
    },

    avoid = Set {
      'impassable'
    },

    speeds = Sequence {
      highway = {
        primary         = walking_speed*0.98,
        primary_link    = walking_speed*0.98,
        secondary       = walking_speed*0.98,
        secondary_link  = walking_speed*0.98,
        tertiary        = walking_speed*0.98,
        tertiary_link   = walking_speed*0.98,
        unclassified    = walking_speed*0.98,
        residential     = walking_speed*0.98,
        road            = walking_speed*0.98,
        living_street   = walking_speed*1.02,
        service         = walking_speed*0.98,
        track           = walking_speed*0.9,
        path            = walking_speed*0.9,
        steps           = walking_speed*0.5,
        pedestrian      = walking_speed*1.02,
        footway         = walking_speed*1.02,
        cycleway        = walking_speed*1.0,
        bridleway       = walking_speed*1.0,
        pier            = walking_speed*0.8,
        corridor        = walking_speed*1.0,
      },

      railway = {
        platform        = walking_speed
      },

      amenity = {
        parking         = walking_speed,
        parking_entrance= walking_speed
      },

      man_made = {
        pier            = walking_speed*0.8
      },

      leisure = {
        track           = walking_speed
      }
    },

    route_speeds = {
      ferry = walking_speed
    },

    bridge_speeds = {
    },

    surface_speeds = {
      fine_gravel =   walking_speed,
      gravel =        walking_speed,
      pebblestone =   walking_speed,
      mud =           walking_speed*0.6,
      sand =          walking_speed*0.6
    },

    tracktype_speeds = {
    },

    smoothness_speeds = {
    },

    --highway_turn_classification = {
    --},

    -- classify access tags when necessary for turn weights
    --access_turn_classification = {
    --}
  }
end

function process_node(profile, node, result)
  -- parse access and barrier tags
  local access = find_access_tag(node, profile.access_tags_hierarchy)
  local is_crossing = highway and highway == "crossing"
  if access then
    if profile.access_tag_blacklist[access] and not profile.restricted_access_tag_list[access] and not is_crossing then
      result.barrier = true
    end
  else
    local barrier = node:get_value_by_key("barrier")
    if barrier then
      --  make an exception for rising bollard barriers
      local bollard = node:get_value_by_key("bollard")
      local rising_bollard = bollard and "rising" == bollard

      if profile.barrier_blacklist[barrier] and not rising_bollard then
        result.barrier = true
      end
    end
  end

  -- check if node is a traffic light
  local tag = node:get_value_by_key("highway")
  if "traffic_signals" == tag then
    result.traffic_lights = true
  end
end

-- main entry point for processsing a way
function process_way(profile, way, result)
  -- the intial filtering of ways based on presence of tags
  -- affects processing times significantly, because all ways
  -- have to be checked.
  -- to increase performance, prefetching and intial tag check
  -- is done in directly instead of via a handler.

  -- in general we should  try to abort as soon as
  -- possible if the way is not routable, to avoid doing
  -- unnecessary work. this implies we should check things that
  -- commonly forbids access early, and handle edge cases later.

  -- data table for storing intermediate values during processing
  local data = {
    -- prefetch tags
    highway = way:get_value_by_key('highway'),
    bridge = way:get_value_by_key('bridge'),
    route = way:get_value_by_key('route'),
    leisure = way:get_value_by_key('leisure'),
    man_made = way:get_value_by_key('man_made'),
    railway = way:get_value_by_key('railway'),
    platform = way:get_value_by_key('platform'),
    amenity = way:get_value_by_key('amenity'),
    public_transport = way:get_value_by_key('public_transport'),
    foot_routing = way:get_value_by_key('routing:foot')
  }

  -- perform an quick initial check and abort if the way is
  -- obviously not routable. here we require at least one
  -- of the prefetched tags to be present, ie. the data table
  -- cannot be empty
  if next(data) == nil then     -- is the data table empty?
    return
  end

  local handlers = Sequence {
    -- set the default mode for this profile. if can be changed later
    -- in case it turns we're e.g. on a ferry
    WayHandlers.default_mode,

    -- check various tags that could indicate that the way is not
    -- routable. this includes things like status=impassable,
    -- toll=yes and oneway=reversible
    WayHandlers.blocked_ways,
    WayHandlers.avoid_ways,
    -- determine access status by checking our hierarchy of
    -- access tags, e.g: motorcar, motor_vehicle, vehicle
    WayHandlers.access,

    -- check whether forward/backward directons are routable
    WayHandlers.oneway,

    -- check whether forward/backward directons are routable
    WayHandlers.destinations,

    -- check whether we're using a special transport mode
    WayHandlers.ferries,
    WayHandlers.movables,

    --WayHandlers.service,

    -- compute speed taking into account way type, maxspeed tags, etc.
    WayHandlers.speed,
    WayHandlers.surface,
    WayHandlers.penalties,

    WayHandlers.classes,

    -- handle turn lanes and road classification, used for guidance
    --WayHandlers.classification,

    -- handle various other flags
    WayHandlers.roundabouts,
    WayHandlers.startpoint,

    -- set name, ref and pronunciation
    WayHandlers.names,

    -- set weight properties of the way
    WayHandlers.weights,

    --WayHandlers.way_classification_for_turn
  }

  WayHandlers.run(profile, way, result, data, handlers)
end

function process_turn (profile, turn)
  turn.duration = profile.turn_penalty

  --if turn.direction_modifier == direction_modifier.u_turn then
    -- turn.duration = turn.duration + profile.properties.u_turn_penalty
  --end

  if turn.is_u_turn then
    turn.duration = turn.duration + profile.properties.u_turn_penalty
  end

  if turn.has_traffic_light then
     turn.duration = profile.properties.traffic_light_penalty
  end
  if profile.properties.weight_name == 'routability' then--
      -- penalize turns from non-local access only segments onto local access only tags
      if not turn.source_restricted and turn.target_restricted then
          turn.weight = turn.weight + 3000
      end
  end
end

return {
  setup = setup,
  process_way =  process_way,
  process_node = process_node,
  process_turn = process_turn
}
