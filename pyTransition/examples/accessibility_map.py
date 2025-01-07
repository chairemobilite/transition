from test_credentials import username, password
from pyTransition.transition import Transition, TripTimeChoice
from datetime import time
import json

def get_transition_acessibility_map():
    # Create Transition instance from connection credentials
    transition_instance = Transition("http://localhost:8080", username, password)

    # Get the scenarios. A scenario is needed to request an accessibility map
    scenarios = transition_instance.get_scenarios()

    # Get the ID of the scenario we want to use. Here, we use the first one 
    scenario_id = scenarios[0]['id']

    # Call the API
    accessibility_map_data = transition_instance.request_accessibility_map(
                coordinates=[-73.4727, 45.5383],
                departure_or_arrival_choice=TripTimeChoice.DEPARTURE,
                departure_or_arrival_time=time(8,0), # Create a new time object representing 8:00
                n_polygons=3,
                delta_minutes=15,
                delta_interval_minutes=5,
                scenario_id=scenario_id,
                max_total_travel_time_minutes=30,
                min_waiting_time_minutes=3,
                max_access_egress_travel_time_minutes=15,
                max_transfer_travel_time_minutes=10,
                max_first_waiting_time_minutes=0,
                walking_speed_kmh=5,
                with_geojson=True,
            )

    # Process the map however you want. Here, we are saving it to a json file
    with open("accessibility.json", 'w') as f:
        f.write(json.dumps(accessibility_map_data))

if __name__ == "__main__":
    get_transition_acessibility_map()
