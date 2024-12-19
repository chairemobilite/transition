from test_credentials import username, password

from pyTransition.transition import Transition

def get_transition_nodes():
    # Create Transition instance from connection credentials
    # The login information can be saved in a file to not have them displayed in the code
    transition_instance = Transition("http://localhost:8080", username, password)

    # Call the API
    nodes = transition_instance.get_nodes()

    # Process nodes however you want. Here, we are just printing the result
    print(nodes)

if __name__ == "__main__":
    get_transition_nodes()
