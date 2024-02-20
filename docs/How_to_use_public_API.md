# How to use the public Transition API

If you are running Transition locally, you only need to start the `transition-backend` with `yarn start`. From there, you should be able to find the Swagger documentation for all available endpoints from the `/api-docs` path. All public API endpoint paths are prefixed with /api (e.g. /api/paths).

## Authentication
In order to access the API endpoints, you must first authenticate yourself with the server. To do this, a POST request must first be sent to the `/token` endpoint with the following body format:

```
{
    "usernameOrEmail": <your-username-or-email>,
    "password": <your-password>
}
```
In the response body, a token will be received which needs to be provided in the Authorization header of all subsequent requests to the API.