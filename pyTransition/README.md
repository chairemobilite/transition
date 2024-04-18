# pyTransition
pyTransition is a Python package designed to interact with the public API of the transit planning application Transition. It allows users to retrieve and request geographic and routing data from the app.\
The documentation for the Transition public API used by this library can be found [here](https://mathildebrosseau.github.io/transition-api/)

## Install and import pyTransition
To install pyTransition, use the following command :
```
pip install pyTransition
```
After installing pyTransition, it may be imported into Python code like :
```python
from pyTransition import Transition
```
## Usage
pyTransition allows users to send HTTP requests. Before requesting data, users must first request a token. This is done using the `request_token` method. Afterwards, users can either set the token and server URL for the current instance using the `set_token` and `set_url` methods. The token and URL will be stored as local variables for the duration of the script only. Alternatively, users can send the token and the URL as parameters directly when calling methods.

To use the library, users first need to instantiate the Transition class with the necessary connection information, by using the class constructor. The following class methods will then be available to use from the Transition instance :

### Transition constructor :
There are 2 ways to use the Transition class constructor.
1) To login with their username/email and password, users need to provide the Transition server URL, their username/email and their password like this :
    ```python
    transition_instance = Transition("http://localhost:8080", "username", "password")
    ```

2) To login with an already known Transition API authentication token, users can provide only the Transition server URL and their token. In this case, users have to set the values for the *username* and *password* parameters to None like this :
    ```python
    transition_instance = Transition("http://localhost:8080", None, None, "token")
    ```

**Parameters :**&emsp;***url***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The Transition server base URL.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***username***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The username (or email) used for login.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***password***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The password used for login.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***token*** (optional, default value None)&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The Transition API authentication token.

**Returns :**&emsp;&emsp;&ensp;***result*** : *Transition*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;An instance of the Transition Python class.

**Raises :**&emsp;**&emsp;**&emsp;***ValueError***\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If the *url* parameter is empty.

### get_paths :
This method allows users to fetch all paths which are currently loaded in the Transition application. In case of a successful request, the paths are returned in JSON format.

**Parameters :**&emsp;***url***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The server URL where the request is sent.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***token***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The token used for user authentication.

**Returns :**&emsp;&emsp;&ensp;***result*** : *GeoJSON*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;All paths currently loaded in the Transition application in GeoJSON format

**Raises :**&emsp;**&emsp;**&emsp;***RequestException***\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If response code is not 200.

### get_nodes :
This method allows users to fetch all nodes which are currently loaded in the Transition application. In case of a successful request, the nodes are returned in JSON format.

**Parameters :**&emsp;***url***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The server URL where the request is sent.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***token***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The token used for user authentication.

**Returns :**&emsp;&emsp;&ensp;***result*** : *GeoJSON*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;All nodes currently loaded in the Transition application in GeoJSON format.

**Raises :**&emsp;**&emsp;**&emsp;***RequestException***\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If response code is not 200.

### get_scenarios :
This method allows users to fetch all scenarios which are currently loaded in the Transition application. In case of a successful request, the scenarios are returned in JSON format. The scenarios are needed in order to request calculations for new routes or accessibility maps.

**Parameters :**&emsp;***url***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The server URL where the request is sent.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***token***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The token used for user authentication.

**Returns :**&emsp;&emsp;&ensp;***result*** : *JSON*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;All scenarios currently loaded in the Transition application in JSON format.

**Raises :**&emsp;**&emsp;**&emsp;***RequestException***\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If response code is not 200.

### get_routing_modes :
This method allows users to fetch all routing modes which are currently loaded in the Transition application. In case of a successful request, a list of routing modes is returned. The routing modes are needed in order to request calculations for new routes.

**Parameters :**&emsp;***url***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The server URL where the request is sent.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***token***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The token used for user authentication.

**Returns :**&emsp;&emsp;&ensp;***result*** : *list*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;All routing modes currently loaded in the Transition application.

**Raises :**&emsp;**&emsp;**&emsp;***RequestException***\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If response code is not 200.

### get_routing_result:
This method allows users to send calculation parameters to the Transition server to request a new route. The request can be made for different transit modes. In case of a successful request, the new route is returned in JSON format.\
**Parameters :**&emsp;***modes*** : *list*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Transit modes for which to calculate the routes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***origin***&ensp;:&ensp;*list* \
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Origin coordinates. Must be sent as [longitude, latitude]\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***destination***&ensp;:&ensp;*list* \
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Destination coordinates. Must be sent as [longitude, latitude]\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***scenario_id***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;ID of the used scenario as loaded in Transition application.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***departure_or_arrival_choice***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Specifies whether the used time is "Departure" or "Arrival".\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***departure_or_arrival_time***&ensp;:&ensp;*Time*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Departure or arrival time of the trip.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***max_travel_time***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Maximum travel time including access, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***min_waiting_time***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Minimum waiting time, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***max_transfer_time***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Maximum transfer time, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***max_access_time***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Maximum access time, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***max_first_waiting_time***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Maximum wait time at first transit stop, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***with_geojson***&ensp;:&ensp;*bool*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If True, the returned JSON file will contain the "pathsGeojson" key for each mode containing the GeoJSON geometry.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***url***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The server URL where the request is sent.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***token***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The token used for user authentication. 

**Returns :**&emsp;&emsp;&ensp;***result*** : *JSON*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Route for each transit mode in JSON format.

**Raises :**&emsp;***RequestException***\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If response code is not 200.

### get_accessibility_map
This method allows users to send accessibility map parameters to the Transition server to request a new accessibility map. In case of a successful request, the accessibility map is returned in JSON format.\
**Parameters :**&emsp;***coordinates*** : *list*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Coordinates of the starting point of the accessibility map. Must be sent as [longitude, latitude]\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***scenario_id***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;ID of the used scenario as loaded in Transition application.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***departure_or_arrival_choice***&ensp;:&ensp;*string* \
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Specifies whether the used time is "Departure" or "Arrival".\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***departure_or_arrival_time***&ensp;:&ensp;*Time* \
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Departure or arrival time of the trip.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***n_polygons***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Number of polygons to be calculated\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***delta_minutes***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Baseline delta used for average accessibility map calculations.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***delta_interval_minutes***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Interval used between each calculation.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***max_total_travel_time_minutes***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Maximum travel time, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***min_waiting_time_minutes***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Minimum waiting time, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***max_access_egress_travel_time_minutes***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Maximum access time, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***max_transfer_travel_time_minutes***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Maximum transfer time, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***max_first_waiting_time_minutes***&ensp;:&ensp;*bool*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Maximum wait time at first transit stop, in minutes.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***walking_speed_kmh***&ensp;:&ensp;*int*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Walking speed, in km/h\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***with_geojson***&ensp;:&ensp;*bool*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If True, the returned JSON file will contain geometry information for the strokes and polygons of the accessibility map.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***url***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The server URL where the request is sent.\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;***token***&ensp;:&ensp;*string*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;The token used for user authentication.

**Returns :**&emsp;&emsp;&ensp;***result*** : *JSON*\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;Accessibility map information in JSON format.

**Raises :**&emsp;**&emsp;**&emsp;***RequestException***\
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;If response code is not 200.

## Example
Users can fetch the nodes which are currently loaded in the Transition application using pyTransition as follows :
```python
from pyTransition.transition import Transition

def get_transition_nodes():
    # Create Transition instance from connection credentials
    # The login information can be saved in a file to not have them displayed in the code
    transition_instance = Transition("http://localhost:8080", username, password)

    # Call the API
    nodes = transition_instance.get_nodes()

    # Process nodes however you want. Here, we are just printing the result
    print(nodes)
```
Fetching the paths can be done in the same way, by replacing *get_nodes()* with *get_paths()*.

Alternatively, if the user already knows their Transition API authentication token, they can create the instance with it directly, as follows :
```python
from pyTransition.transition import Transition

def get_transition_nodes():
    # Create Transition instance from authentication token
    # The login information can be saved in a file to not have them displayed in the code
    transition_instance = Transition("http://localhost:8080", None, None, token)

    # Call the API
    nodes = Transition.get_nodes()

    # Process nodes however you want. Here, we are just printing the result
    print(nodes)
```

Another example using pyTransition to get a new accessibility map :
```python
from pyTransition.transition import Transition
from datetime import time
import json

def get_transition_acessibility_map():
    # Create Transition instance from connection credentials
    transition_instance = Transition("http://localhost:8080", username, password)

    # Get the scenarios. A scenario is needed to request an accessibility map
    scenarios = transition_instance.get_scenarios()

    # Get the ID of the scenario we want to use. Here, we use the first one 
    scenario_id = scenarios['collection'][0]['id']

    # Call the API
    accessibility_map_data = transition_instance.request_accessibility_map(
                coordinates=[45.5383, -73.4727],
                departure_or_arrival_choice="Departure",
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

```

Another example using pyTransition to get a new routes :
```python
from pyTransition.transition import Transition
from datetime import time
import json

def get_transition_routes():
    # Create Transition instance from connection credentials
    # The login information can be saved in a file to not have them displayed in the code
    transition_instance = Transition("http://localhost:8080", username, password)

    # Get the scenarios and routing modes. A scenario and at least one routing mode
    # are needed to request an new route
    scenarios = transition_instance.get_scenarios()
    routing_modes = transition_instance.get_routing_modes()

    # Get the ID of the scenario we want to use. Here, we use the first one 
    scenario_id = scenarios['collection'][0]['id']
    # Get the modes you want to use. Here, we are usisng the first two ones
    # You can print the modes to see which are available
    modes = routing_modes[:2]
    

    # Call the API
    routing_data = transition_instance.request_routing_result(
                modes=modes, 
                origin=[-73.4727, 45.5383], 
                destination=[-73.4499, 45.5176], 
                scenario_id=scenarioId, 
                departure_or_arrival_choice=departureOrArrivalChoice, 
                departure_or_arrival_time=departureOrArrivalTime, 
                max_travel_time_minutes=maxParcoursTime, 
                min_waiting_time_minutes=minWaitTime,
                max_transfer_time_minutes=maxTransferWaitTime, 
                max_access_time_minutes=maxAccessTimeOrigDest, 
                max_first_waiting_time_minutes=maxWaitTimeFisrstStopChoice,
                with_geojson=True,
                with_alternatives=True
            )

    # Process the data however you want.
    # For example, we can get the geojson paths of each transit mode in a loop
    for key, value in routing_data.items():  
        # Get the number of alternative paths for the current mode
        geojsonPaths = value["pathsGeojson"]
        mode = key
        # For each alternative, get the geojson associated
        for i in range(len(geojsonPath)):
            geojson_data = geojsonPath[i]
            # Process however you want. Here we are just printing it.
            print(geojson_data)

    # We can also save it to a json file
    with open("routing.json", 'w') as f:
        f.write(json.dumps(routing_data))


```
