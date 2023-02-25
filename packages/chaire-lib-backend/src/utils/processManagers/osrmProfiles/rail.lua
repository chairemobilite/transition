-- Copyright 2017-2019 Railnova SA <support@railnova.eu>, Nikita Marchant <nikita.marchant@gmail.com>
-- Code under the 2-clause BSD license

api_version = 4

function setup()
  return {
    properties = {
      max_speed_for_map_matching     = 220/3.6, -- speed conversion to m/s
      weight_name                    = 'routability',
      left_hand_driving              = true,
      u_turn_penalty                 = 60 * 2, -- 2 minutes to change cabin
      turn_duration                  = 20,
      continue_straight_at_waypoint  = false,
      max_angle                      = 30,

      secondary_speed                = 30,
      speed                          = 90,
    },

    default_mode              = mode.train,
    default_speed             = 90,
}

end


function ternary ( cond , T , F )
    if cond then return T else return F end
end


function process_node(profile, node, result, relations)
    local railway = node:get_value_by_key("railway")

    -- refuse railway nodes that we cannot go through
    result.barrier = (
        railway == "buffer_stop" or
        railway == "derail"
    )
    result.traffic_lights = false
end

function process_way(profile, way, result, relations)
    local data = {
        railway = way:get_value_by_key("railway"),
        service = way:get_value_by_key("service"),
        usage = way:get_value_by_key("usage"),
        maxspeed = way:get_value_by_key("maxspeed"),
        gauge = way:get_value_by_key("gauge"),
    }

    -- Remove everything that is not railway
    if not data.railway then
        return
    -- Remove everything that is not a rail, a turntable, a traverser
    elseif (
        data.railway ~= 'rail' and
        data.railway ~= 'turntable' and
        data.railway ~= 'traverser' and
        data.railway  ~= 'ferry'
    ) then
        return
    -- Remove military and tourism rails
    elseif (
        data.usage == "military" or
        data.usage == "tourism"
    ) then
        return
    -- Keep only most common gauges (and undefined)
    -- uses .find() as some gauges are specified like "1668;1435"
    elseif (
        data.gauge ~= nil and
        data.gauge ~= 1000 and not string.find(data.gauge, "1000") and
        data.gauge ~= 1435 and not string.find(data.gauge, "1435") and
        data.gauge ~= 1520 and not string.find(data.gauge, "1520") and
        data.gauge ~= 1524 and not string.find(data.gauge, "1524") and
        data.gauge ~= 1600 and not string.find(data.gauge, "1600") and
        data.gauge ~= 1668 and not string.find(data.gauge, "1668")
   ) then
        return
    end

    local is_secondary = (
        data.service == "siding" or
        data.service == "spur" or
        data.service == "yard" or
        data.usage == "industrial"
    )

    -- by default, use 30km/h for secondary rails, else 160
    local default_speed = ternary(is_secondary, profile.properties.secondary_speed, profile.properties.speed)
    -- but is OSM specifies a maxspeed, use the one from OSM
    local speed = ternary(data.maxspeed, data.maxspeed, default_speed)

   -- fix speed for mph issue
    speed = tostring(speed)
    if speed:find(" mph") or speed:find("mph") then
      speed = speed:gsub(" mph", "")
      speed = speed:gsub("mph", "")
        speed = tonumber (speed)
        if speed == nil then speed = 20 end
	speed = speed * 1.609344
    else
     speed = tonumber (speed)
    end
    -- fix speed for mph issue end


    result.forward_speed = speed
    result.backward_speed = speed
    --
    result.forward_mode = mode.train
    result.backward_mode = mode.train
    --
    result.forward_rate = 1
    result.backward_rate = 1

end

function process_turn(profile, turn)
    -- Refuse truns that have a big angle
    if math.abs(turn.angle) >  profile.properties.max_angle then
        return
    end

    -- If we go backwards, add the penalty to change cabs
    if turn.is_u_turn then
      turn.duration = turn.duration + profile.properties.u_turn_penalty
    end
end

return {
    setup = setup,
    process_way = process_way,
    process_node = process_node,
    process_turn = process_turn
}
