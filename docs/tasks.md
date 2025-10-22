Transition provides a number of tasks that can be run from the command prompt without having to build the application and open the UI.

To run them, you must first compile the transition source code, and run a command at the root of the Transition repo of the form:

```shell
yarn node [filepath] [parameters]
```

Where [filepath] is the relative file path of the task wrapper with the task.ts extension (except with `/src/` replaced by `/lib/` and `.ts` replaced with `.js`) and [parameters] is the parameters of the command, varying from task to task.

You can also run the command `yarn list-tasks` to receive a list of tasks to run, as well as the commands necessary to run them.

Below is a list of the tasks currently implemented, the path to run them, what they do, their parameters, and an example.


## Import dissemination blocks Canada

### File path

```text
packages/transition-backend/lib/scripts/disseminationBlocks/importDisseminationBlocksCanada.task.js
```

### Description

Imports data from Statistics Canada relating to dissemination blocks (the smallest division level used by the Canadian census) in the database. Though it is meant to work with two specific files (found at <https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21> and <https://www150.statcan.gc.ca/n1/pub/17-26-0002/172600022023001-eng.htm>), it should in theory work with other levels of census divisions, as long as the corresponding files use the same format and structure.

First, the task parses a GML file containing the geographic boundaries of all the blocks, importing it and adding new entries to the `zones` table, as well as converting the boundaries from the coordinate system used in the file to WGS84, the system used by Transition.

Next, it parses a CSV file that contains the population of each block, as well as proximity indices, giving a measure of how accessible various types of services are in each block. The population is written to new rows in the `census` table, and the indices are added to the previously written rows of the `zones` table, in the `data` column.

### Parameters

`--boundaries-file`: (Optional) The path of the GML file with the blocks' geographic boundaries. If omitted, an interactive prompt will allow you to select the file inside of the Transition repo.

`--proximity-file`: (Optional) The path of the CSV file with the blocks' population and proximity indices. If omitted, an interactive prompt will allow you to select the file inside of the Transition repo.

### Example

```shell
yarn node packages/transition-backend/lib/scripts/disseminationBlocks/importDisseminationBlocksCanada.task.js --boundaries-file /home/user/path/to/file/ldb_000b21g_e.gml --proximity-file /home/user/path/to/file/PMD-en.csv
```
