from test_credentials import username, password
from pyTransition.transition import Transition
from datetime import time
import json

departureOrArrivalChoice = "Departure"
departureOrArrivalTime = time(8,0)
maxParcoursTime = 60
minWaitTime = 15
maxTransferWaitTime = 15
maxAccessTimeOrigDest = 10
maxWaitTimeFirstStopChoice = 5

def get_transition_routes():
    # Create Transition instance from connection credentials
    # The login information can be saved in a file to not have them displayed in the code
    transition_instance = Transition("http://localhost:8080", username, password)

    # Get the scenarios and routing modes. A scenario and at least one routing mode
    # are needed to request an new route
    scenarios = transition_instance.get_scenarios()
    routing_modes = transition_instance.get_routing_modes()

    # Get the ID of the scenario we want to use. Here, we use the first one 
    scenario_id = scenarios[0]['id']
    # Get the modes you want to use. Here, we are using the first two ones
    # You can print the modes to see which are available
    modes = routing_modes[:2]

    # Call the API
    routing_data = transition_instance.request_routing_result(
                modes=modes, 
                origin=[-73.4727, 45.5383], 
                destination=[-73.4499, 45.5176], 
                scenario_id=scenario_id, 
                departure_or_arrival_choice=departureOrArrivalChoice, 
                departure_or_arrival_time=departureOrArrivalTime, 
                max_travel_time_minutes=maxParcoursTime, 
                min_waiting_time_minutes=minWaitTime,
                max_transfer_time_minutes=maxTransferWaitTime, 
                max_access_time_minutes=maxAccessTimeOrigDest, 
                max_first_waiting_time_minutes=maxWaitTimeFirstStopChoice,
                with_geojson=True,
                with_alternatives=True
            )

    # Process the data however you want.
    # For each alternative, get the geojson associated
    for key, value in routing_data['result'].items():  
        # Get the number of alternative paths for the current mode
        geojsonPaths = value["pathsGeojson"]
        mode = key
        # For each alternative, get the geojson associated
        for geojson_data in geojsonPaths:

            # Process however you want. Here we are just printing it.
            print(geojson_data)

    # We can also save it to a json file
    with open("routing.json", 'w') as f:
        f.write(json.dumps(routing_data))

if __name__ == "__main__":
    get_transition_routes()
