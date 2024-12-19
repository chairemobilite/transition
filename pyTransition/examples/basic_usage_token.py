from test_credentials import username, password

from pyTransition.transition import Transition

# Get a token for later testing
transition_instance_token = Transition("http://localhost:8080", username, password)
token = transition_instance_token.token

# Alternative version with token
def get_transition_nodes_with_token():
    # Create Transition instance from authentication token
    # The login information can be saved in a file to not have them displayed in the code
    transition_instance = Transition("http://localhost:8080", None, None, token)

    # Call the API
    nodes = transition_instance.get_nodes()

    # Process nodes however you want. Here, we are just printing the result
    print(nodes)

if __name__ == "__main__":
    get_transition_nodes_with_token()
