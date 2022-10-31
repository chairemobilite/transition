/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/********************************
 * 0. Configuration of the simulation
 *
 * 0.1 Either through the user interface or the task (simulation)
 *
 * 0.2 Parameterize data to use for testing (% odTrip, departure times or origin
 * locations range (polygon))
 *
 *
 * 1. Prepare the data
 *
 * 1.1 Specify the agencies that contains the lines to reproduce, as well as the
 *    fixed services (other networks)
 *
 * 1.2 For each line to reproduce, generate various levels of services with a
 *    certain number of vehicles (to make it easier later), and create schedules
 *    for those services with a randomized departure time according to
 *    frequency. TODO: Later at a TTS so lines can be synchronized at terminals
 *    and train stations.
 *
 * 1.3 Save the capnp cache to a different directory.
 *
 *
 * 2. First generation
 *
 * 2.1 For each candidate, randomly select the lines who will be part of it.
 *    There may be a pre-selected list of candidates coming from other
 *    simulations
 *
 *
 * 3. For each generation
 *
 * 3.1 For each candidate, prepare a scenario: select the service for each line
 *    according to vehicle count and weight of each line
 *
 * 3.2 Save the scenarios to capnp
 *
 * 3.3 Start trRouting instances
 *
 * 3.4 For each candidate, simulate: with parameters of 0.2 and a random
 *    selection for each type of data to simulate
 *
 * 3.5 Apply cost function to each candidate with the results obtained
 *
 * 3.6 Reproduction: Keep X elite candidates for the next iteration and for each
 *    remaining candidate, randomly pick 2 parents according to their result and
 *    produce a child: cut the line vector at a random position and take the
 *    left of one and the right of the other. Repeat the cut until the number of
 *    enabled lines is within a certain configured range. After Y tries, if no
 *    children can be generated, abandon
 *
 * 3.7 Continue to 3.1 until X iteration or some other condition
 **********************************************************/

export { evolutionaryAlgorithmFactory, EvolutionaryAlgorithm } from './EvolutionaryAlgorithm';
