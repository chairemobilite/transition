import unittest
import requests
import requests_mock
from datetime import time

from pyTransition import Transition


class TestTransition(unittest.TestCase):
    def setUp(self):
        self.test_url = "https://example.com"
        self.test_token = "test_token"
        self.test_username = "test_username"
        self.test_password = "test_password"
        self.test_accessibility_params = {
            "departureTimeSecondsSinceMidnight": 0,
            "arrivalTimeSecondsSinceMidnight": None,
            "deltaIntervalSeconds": 60,
            "deltaSeconds": 60,
            "numberOfPolygons": 1,
            "minWaitingTimeSeconds": 60,
            "maxTransferTravelTimeSeconds": 60,
            "maxAccessEgressTravelTimeSeconds": 60,
            "maxFirstWaitingTimeSeconds": 60,
            "walkingSpeedMps": (1000 / 3600),
            "maxTotalTravelTimeSeconds": 60,
            "locationGeojson": {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [0, 0]},
            },
            "scenarioId": "scenario-id",
        }
        self.test_route_params = {
            "routingModes": ["mode1", "mode2"],
            "withAlternatives": False,
            "departureTimeSecondsSinceMidnight": 0,
            "arrivalTimeSecondsSinceMidnight": None,
            "minWaitingTimeSeconds": 60,
            "maxTransferTravelTimeSeconds": 60,
            "maxAccessEgressTravelTimeSeconds": 60,
            "maxFirstWaitingTimeSeconds": 60,
            "maxTotalTravelTimeSeconds": 60,
            "scenarioId": "scenario-id",
            "originGeojson": {
                "type": "Feature",
                "id": 1,
                "geometry": {"type": "Point", "coordinates": [0, 0]},
            },
            "destinationGeojson": {
                "type": "Feature",
                "id": 1,
                "geometry": {"type": "Point", "coordinates": [0, 0]},
            },
        }
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/token", text=self.test_token, status_code=200)
            self.test_transition_instance = Transition(
                self.test_url, self.test_username, self.test_password
            )

    def test_creation_username_password(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/token", text=self.test_token, status_code=200)

            transition_instance = Transition(self.test_url, self.test_username, self.test_password)
            self.assertEqual(transition_instance.base_url, self.test_url)
            self.assertEqual(transition_instance.token, self.test_token)

    def test_creation_wrong_username_password(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/token", text=self.test_token, status_code=400)
            self.assertRaises(
                requests.exceptions.HTTPError,
                Transition,
                self.test_url,
                self.test_username,
                self.test_password,
            )

    def test_creation_token(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/token", text=self.test_token, status_code=200)

            transition_instance = Transition(self.test_url, None, None, self.test_token)
            self.assertEqual(transition_instance.base_url, self.test_url)
            self.assertEqual(transition_instance.token, self.test_token)

    def test_creation_username_password_ignore_token(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/token", text=self.test_token, status_code=200)

            transition_instance = Transition(
                self.test_url, self.test_username, self.test_password, "other token"
            )
            self.assertEqual(transition_instance.base_url, self.test_url)
            self.assertEqual(transition_instance.token, self.test_token)

    def test_request_token(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/token", text=self.test_token, status_code=200)
            res = self.test_transition_instance._Transition__request_token(
                self.test_username, self.test_password
            )
            self.assertTrue(m.called)
            self.assertEqual(res, self.test_token)

    def test_request_token_error(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/token", text=self.test_token, status_code=400)
            self.assertRaises(
                requests.exceptions.HTTPError,
                self.test_transition_instance._Transition__request_token,
                self.test_username,
                self.test_password,
            )
            self.assertTrue(m.called_once)

    def test_get_paths(self):
        with requests_mock.Mocker() as m:
            m.get(f"{self.test_url}/api/v1/paths", json={"key": "value"}, status_code=200)
            res = self.test_transition_instance.get_paths()
            self.assertTrue(m.called_once)
            self.assertEqual(res, {"key": "value"})

    def test_get_paths_error(self):
        with requests_mock.Mocker() as m:
            m.get(f"{self.test_url}/api/v1/paths", json={"key": "value"}, status_code=400)
            self.assertRaises(
                requests.exceptions.HTTPError, self.test_transition_instance.get_paths
            )
            self.assertTrue(m.called_once)

    def test_get_nodes(self):
        with requests_mock.Mocker() as m:
            m.get(f"{self.test_url}/api/v1/nodes", json={"key": "value"}, status_code=200)
            res = self.test_transition_instance.get_nodes()
            self.assertTrue(m.called_once)
            self.assertEqual(res, {"key": "value"})

    def test_get_nodes_error(self):
        with requests_mock.Mocker() as m:
            m.get(f"{self.test_url}/api/v1/nodes", json={"key": "value"}, status_code=400)
            self.assertRaises(
                requests.exceptions.HTTPError, self.test_transition_instance.get_nodes
            )
            self.assertTrue(m.called_once)

    def test_get_scenarios(self):
        with requests_mock.Mocker() as m:
            m.get(f"{self.test_url}/api/v1/scenarios", json={"key": "value"}, status_code=200)
            res = self.test_transition_instance.get_scenarios()
            self.assertTrue(m.called_once)
            self.assertEqual(res, {"key": "value"})

    def test_get_scenarios_error(self):
        with requests_mock.Mocker() as m:
            m.get(f"{self.test_url}/api/v1/scenarios", json={"key": "value"}, status_code=400)
            self.assertRaises(
                requests.exceptions.HTTPError, self.test_transition_instance.get_scenarios
            )
            self.assertTrue(m.called_once)

    def test_get_routing_modes(self):
        with requests_mock.Mocker() as m:
            m.get(f"{self.test_url}/api/v1/routing-modes", text='["mode1","mode2"]', status_code=200)
            modes = self.test_transition_instance.get_routing_modes()
            self.assertTrue(m.called_once)
            self.assertEqual(modes, ["mode1", "mode2"])

    def test_get_routing_modes_error(self):
        with requests_mock.Mocker() as m:
            m.get(f"{self.test_url}/api/v1/routing-modes", text='["mode1","mode2"]', status_code=400)
            self.assertRaises(
                requests.exceptions.HTTPError, self.test_transition_instance.get_routing_modes
            )
            self.assertTrue(m.called_once)

    def test_request_accessibility_map(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/api/v1/accessibility", json={"key": "value"}, status_code=200)
            res = self.test_transition_instance.request_accessibility_map(
                coordinates=[0, 0],
                scenario_id="scenario-id",
                departure_or_arrival_choice="Departure",
                departure_or_arrival_time=time(0, 0, 0),
                n_polygons=1,
                delta_minutes=1,
                delta_interval_minutes=1,
                max_total_travel_time_minutes=1,
                min_waiting_time_minutes=1,
                max_access_egress_travel_time_minutes=1,
                max_transfer_travel_time_minutes=1,
                max_first_waiting_time_minutes=1,
                walking_speed_kmh=1,
                with_geojson=True,
            )
            self.assertTrue(m.called_once)
            self.assertEqual(res, {"key": "value"})
            self.assertEqual(m.last_request.json(), self.test_accessibility_params)

    def test_request_accessibility_map_error(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/api/v1/accessibility", json={"key": "value"}, status_code=400)
            self.assertRaises(
                requests.exceptions.HTTPError,
                self.test_transition_instance.request_accessibility_map,
                coordinates=[0, 0],
                scenario_id="scenario-id",
                departure_or_arrival_choice="Departure",
                departure_or_arrival_time=time(0, 0, 0),
                n_polygons=1,
                delta_minutes=1,
                delta_interval_minutes=1,
                max_total_travel_time_minutes=1,
                min_waiting_time_minutes=1,
                max_access_egress_travel_time_minutes=1,
                max_transfer_travel_time_minutes=1,
                max_first_waiting_time_minutes=1,
                walking_speed_kmh=1,
                with_geojson=True,
            )
            self.assertTrue(m.called_once)
            self.assertEqual(m.last_request.json(), self.test_accessibility_params)

    def test_request_routing_result(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/api/v1/route", json={"key": "value"}, status_code=200)
            res = self.test_transition_instance.request_routing_result(
                modes=["mode1", "mode2"],
                origin=[0, 0],
                destination=[0, 0],
                scenario_id="scenario-id",
                departure_or_arrival_choice="Departure",
                departure_or_arrival_time=time(0, 0, 0),
                max_travel_time_minutes=1,
                min_waiting_time_minutes=1,
                max_transfer_time_minutes=1,
                max_access_time_minutes=1,
                max_first_waiting_time_minutes=1,
                with_geojson=True,
                with_alternatives=False,
            )
            self.assertTrue(m.called_once)
            self.assertEqual(res, {"key": "value"})
            self.assertEqual(m.last_request.json(), self.test_route_params)

    def test_request_routing_result_error(self):
        with requests_mock.Mocker() as m:
            m.post(f"{self.test_url}/api/v1/route", json={"key": "value"}, status_code=400)
            self.assertRaises(
                requests.exceptions.HTTPError,
                self.test_transition_instance.request_routing_result,
                modes=["mode1", "mode2"],
                origin=[0, 0],
                destination=[0, 0],
                scenario_id="scenario-id",
                departure_or_arrival_choice="Departure",
                departure_or_arrival_time=time(0, 0, 0),
                max_travel_time_minutes=1,
                min_waiting_time_minutes=1,
                max_transfer_time_minutes=1,
                max_access_time_minutes=1,
                max_first_waiting_time_minutes=1,
                with_geojson=True,
                with_alternatives=False,
            )
            self.assertTrue(m.called_once)
            self.assertEqual(m.last_request.json(), self.test_route_params)


if __name__ == "__main__":
    unittest.main()
