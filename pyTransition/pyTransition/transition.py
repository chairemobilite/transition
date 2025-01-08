# MIT License

# Copyright (c) 2024 Polytechnique Montréal

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import requests
from datetime import time
import json
from urllib.parse import urlparse, urlunparse, urlencode, parse_qs
from enum import Enum

class TripTimeChoice(Enum):
    """Type for trip time
    """
    DEPARTURE = "Departure"
    ARRIVAL = "Arrival"

class Transition:
    def __init__(self, url, username, password, token=None):
        if url is None or url == "":
            raise ValueError("URL cannot be empty.")

        # Parse and normalize the URL
        self.base_url = self.__normalize_url(url)

        # To instantiate Transition instance from token only
        if username is None and password is None and token is not None:
            self.token = token

        # To instantiate Transition instance from username and password authentication
        else:
            self.token = self.__request_token(username, password)

    @staticmethod
    def __normalize_url(url):
        """Normalize the URL.

        Remove extra characters from the URL
        """
        parsed_url = urlparse(url)
        netloc = parsed_url.netloc.lower()

        # Remove port number if we use the standard ones
        if netloc.endswith(':80') and parsed_url.scheme == 'http':
            netloc = netloc[:-3]
        elif netloc.endswith(':443') and parsed_url.scheme == 'https':
            netloc = netloc[:-4]

        # Remove extra "/"
        path = parsed_url.path.rstrip('/')
        normalized_url = urlunparse((parsed_url.scheme, netloc, path, parsed_url.params, parsed_url.query, parsed_url.fragment))
        return normalized_url

    def build_url(self, path='', params=None):
        """Construct the full URL with path and params

        Args:
            path (string): path to add the base url
            params (dict): parameters to add to the request

        Returns:
            string: Full url to use in the request
        """
        if params is None:
            params = {}

        parsed_base_url = urlparse(self.base_url)
        combined_path = parsed_base_url.path.rstrip('/') + '/' + path.lstrip('/')
        query_params = parse_qs(parsed_base_url.query)
        query_params.update(params)
        query_string = urlencode(query_params, doseq=True)

        new_url = urlunparse((parsed_base_url.scheme, parsed_base_url.netloc, combined_path, parsed_base_url.params, query_string, parsed_base_url.fragment))
        return new_url

    def __build_authentication_body(self, username, password):
        """Builds the body for the token request.

        Args:
            username (string): user's username
            password (string): user's password

        Raises:
            ValueError: When username or password is empty

        Returns:
            dict: A dict representing the body of the token request
        """
        if username is None or password is None:
            raise ValueError("Username or password empty.")

        body = {"usernameOrEmail": username, "password": password}

        return body

    def __build_headers(self):
        """Build the headers with required authorizations for all Transition api requests.

        Raises:
            ValueError: When the user's token is not defined or empty

        Returns:
            dict: A dict containing the headers for all api requests.
        """
        if self.token is None or self.token == "":
            raise ValueError("Token not set.")

        headers = {"Authorization": f"Bearer {self.token}"}

        return headers

    def __check_response_status(response, is_error_json = False):
        """ Wrapper around Response.raise_for_status to add the return content to the
        exception error message
        """
        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            details = ""
            if is_error_json:
                details = str(e.response.json())
            else:
                details = e.response.text
            e.response.reason = f"{e.response.reason}: {details}"
            raise

    def __request_token(self, username, password):
        """Authenticates the user with the Transition api to obtain an API authentication token.

        Args:
            username (string): user's username or email
            password (string): user's password

        Returns:
            string: the user's authentication token
        """
        body = self.__build_authentication_body(username, password)
        response = requests.post(self.build_url('/token'), json=body)
        Transition.__check_response_status(response)
        return response.text

    def is_token_valid(self):
        """Check if we can connect to the server with the currently stored access information.

        Returns:
            boolean: Can we access the server with the current token

        """
        try:
            # Currently use the simplest call which is get_routing_modes
            # Could be changed to something simpler is we add one
            self.get_routing_modes()
        except:
            # Return false if we got an exception why doing the query
            return False
        return True

    def get_paths(self):
        """Gets all paths currently loaded in the Transition application

        Returns:
            geojson: Transition paths as a GeoJSON LineString FeatureCollection object
        """
        headers = self.__build_headers()
        response = requests.get(self.build_url('/api/v1/paths'), headers=headers)
        Transition.__check_response_status(response)
        return response.json()

    def get_nodes(self):
        """Gets all nodes currently loaded in the Transition application

        Returns:
            geojson: Transition nodes as a GeoJSON Point FeatureCollection object
        """
        headers = self.__build_headers()
        response = requests.get(self.build_url('/api/v1/nodes'), headers=headers)
        Transition.__check_response_status(response)
        return response.json()

    def get_scenarios(self):
        """Gets all scenarios currently loaded in the Transition application

        Returns:
            List: List of Transition scenarios with their parameters
        """
        headers = self.__build_headers()
        response = requests.get(self.build_url('/api/v1/scenarios'), headers=headers)
        Transition.__check_response_status(response)
        return response.json()

    def get_routing_modes(self):
        """Gets all routing modes currently available in the Transition application

        Returns:
            List: List of routing modes as a list of strings
        """
        headers = self.__build_headers()
        response = requests.get(self.build_url('/api/v1/routing-modes'), headers=headers)
        Transition.__check_response_status(response)
        return json.loads(response.text)

    def request_routing_result(
        self,
        modes,
        origin,
        destination,
        scenario_id,
        departure_or_arrival_choice: TripTimeChoice,
        departure_or_arrival_time,
        max_travel_time_minutes,
        min_waiting_time_minutes,
        max_transfer_time_minutes,
        max_access_time_minutes,
        max_first_waiting_time_minutes,
        with_geojson,
        with_alternatives,
    ):
        """Calculates a route between a given origin and destination with the provided modes of transport

        Args:
            modes (List[string]): List of all modes of transport for which to do the routing calculation.
            origin (List[float]): Coordinates of the route origin as [longitude, latitude]
            destination (List[float]): Coordinates of the route destination as [longitude, latitude]
            scenario_id (string): ID of the used scenario as loaded in Transition application.
            departure_or_arrival_choice (TripTimeChoice): Specifies whether the used time is "Departure" or "Arrival". Possible values are DEPARTURE or ARRIVAL.
            departure_or_arrival_time (time): Departure or arrival time of the trip
            max_travel_time_minutes (int): Maximum travel time including access, in minutes
            min_waiting_time_minutes (int): Minimum waiting time, in minutes
            max_transfer_time_minutes (int): Maximum transfer time, in minutes
            max_access_time_minutes (int): Maximum access time, in minutes
            max_first_waiting_time_minutes (int): Maximum wait time at first transit stop, in minutes
            with_geojson (bool): If True, the returned JSON file will contain the "pathsGeojson" key for each mode
            with_alternatives (bool): Indicates if the calculation must include alternative routes or not

        Returns:
            JSON: Route for each transit mode in JSON format
        """
        departure_or_arrival_time = (
            departure_or_arrival_time.hour * 3600
            + departure_or_arrival_time.minute * 60
            + departure_or_arrival_time.second
        )
        # Insure we have the right type for departure_or_arrival_choice
        departure_or_arrival_choice = TripTimeChoice(departure_or_arrival_choice)

        departure_time = (
            departure_or_arrival_time if departure_or_arrival_choice == TripTimeChoice.DEPARTURE else None
        )
        arrival_time = (
            departure_or_arrival_time if departure_or_arrival_choice == TripTimeChoice.ARRIVAL else None
        )

        body = {
            "routingModes": modes,
            "withAlternatives": with_alternatives,
            "departureTimeSecondsSinceMidnight": departure_time,
            "arrivalTimeSecondsSinceMidnight": arrival_time,
            "minWaitingTimeSeconds": min_waiting_time_minutes * 60,
            "maxTransferTravelTimeSeconds": max_transfer_time_minutes * 60,
            "maxAccessEgressTravelTimeSeconds": max_access_time_minutes * 60,
            "maxFirstWaitingTimeSeconds": max_first_waiting_time_minutes * 60,
            "maxTotalTravelTimeSeconds": max_travel_time_minutes * 60,
            "scenarioId": scenario_id,
            "originGeojson": {
                "type": "Feature",
                "id": 1,
                "geometry": {"type": "Point", "coordinates": origin},
            },
            "destinationGeojson": {
                "type": "Feature",
                "id": 1,
                "geometry": {"type": "Point", "coordinates": destination},
            },
        }

        headers = self.__build_headers()
        params = {"withGeojson": "true" if with_geojson else "false"}
        response = requests.post(
            self.build_url('/api/v1/route', params=params), headers=headers, json=body
        )

        Transition.__check_response_status(response)
        return response.json()

    def request_accessibility_map(
        self,
        coordinates,
        scenario_id,
        departure_or_arrival_choice: TripTimeChoice,
        departure_or_arrival_time,
        n_polygons,
        delta_minutes,
        delta_interval_minutes,
        max_total_travel_time_minutes,
        min_waiting_time_minutes,
        max_access_egress_travel_time_minutes,
        max_transfer_travel_time_minutes,
        max_first_waiting_time_minutes,
        walking_speed_kmh,
        with_geojson,
    ):
        """Calculates an accessibility map from a given origin

        Args:
            coordinates (List[float]): Coordinates of the map origin as [longitude, latitude]
            scenario_id (string): ID of the used scenario as loaded in Transition application.
            departure_or_arrival_choice (TripTimeChoice): Specifies whether the used time is "Departure" or "Arrival". Possible values are DEPARTURE or ARRIVAL.
            departure_or_arrival_time (time): Departure or arrival time of the trip
            n_polygons (int): Number of polygons to be calculated
            delta_minutes (int): Baseline delta used for average accessibility map calculations
            delta_interval_minutes (int): Interval used between each calculation
            max_total_travel_time_minutes (int): Maximum travel time, in minutes
            min_waiting_time_minutes (int): Minimum waiting time, in minutes
            max_access_egress_travel_time_minutes (int): Maximum access time, in minutes
            max_transfer_travel_time_minutes (int): Maximum transfer time, in minutes
            max_first_waiting_time_minutes (int): Maximum wait time at first transit stop, in minutes
            walking_speed_kmh (float): Walking speed, in km/h
            with_geojson (true): If True, the returned JSON file will contain the "pathsGeojson" key for each mode

        Returns:
            JSON: Accessibility map information in JSON format
        """
        departure_or_arrival_time_seconds_from_midnight = (
            departure_or_arrival_time.hour * 3600
            + departure_or_arrival_time.minute * 60
            + departure_or_arrival_time.second
        )

        # Insure we have the right type for departure_or_arrival_choice
        departure_or_arrival_choice = TripTimeChoice(departure_or_arrival_choice)

        departure_time_seconds = (
            departure_or_arrival_time_seconds_from_midnight
            if departure_or_arrival_choice == TripTimeChoice.DEPARTURE
            else None
        )
        arrival_time_seconds = (
            departure_or_arrival_time_seconds_from_midnight
            if departure_or_arrival_choice == TripTimeChoice.ARRIVAL
            else None
        )

        body = {
            "departureTimeSecondsSinceMidnight": departure_time_seconds,
            "arrivalTimeSecondsSinceMidnight": arrival_time_seconds,
            "deltaIntervalSeconds": delta_interval_minutes * 60,
            "deltaSeconds": delta_minutes * 60,
            "numberOfPolygons": n_polygons,
            "minWaitingTimeSeconds": min_waiting_time_minutes * 60,
            "maxTransferTravelTimeSeconds": max_transfer_travel_time_minutes * 60,
            "maxAccessEgressTravelTimeSeconds": max_access_egress_travel_time_minutes * 60,
            "maxFirstWaitingTimeSeconds": (
                max_first_waiting_time_minutes * 60 if max_first_waiting_time_minutes else None
            ),
            "walkingSpeedMps": walking_speed_kmh * (1000 / 3600),
            "maxTotalTravelTimeSeconds": max_total_travel_time_minutes * 60,
            "locationGeojson": {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": coordinates},
            },
            "scenarioId": scenario_id,
        }

        headers = self.__build_headers()
        params = {"withGeojson": "true" if with_geojson else "false"}
        response = requests.post(
            self.build_url('/api/v1/accessibility', params=params), headers=headers, json=body
        )
        Transition.__check_response_status(response)
        return response.json()
