/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Make sure configuration is set TODO mock
import '../../../config/loadConfig';
import fs from 'fs-extra';
import path from 'path';

import { fileManager } from '../fileManager';

const projectDirectoryPath = path.normalize(`${__dirname}/../../../../../../tests/runtime/`);
const projectRelativeDirectoryTestPath = 'test/recursive/directory';
const projectRelativeFileDirectoryTestPath = 'test/recursive/directory/foo';
const projectRelativeFileTestPath = 'test/recursive/directory/foo/bar.txt';
const copyFromFileTestPath = 'test/copyFrom/fileCopyFrom.txt';
const copyToFileTestPath = 'test/copyTo/fileCopyTo.txt';
const copyFromDirectoryTestPath = 'test/copyFrom/copyFromDirectory';
const copyToDirectoryTestPath = 'test/copyTo/copyToDirectory';
const projectRelativeNonExistingPath = 'i/dont/exist';
const projectRelativeNonExistingFilePath = 'i/dont/exist/file';
const absoluteDirectoryTestPath = path.normalize(`${projectDirectoryPath}/${projectRelativeDirectoryTestPath}`);
const absoluteFileTestPath = path.normalize(`${projectDirectoryPath}/${projectRelativeFileTestPath}`);
const absoluteFileDirectoryTestPath = path.normalize(`${projectDirectoryPath}/${projectRelativeFileDirectoryTestPath}`);
const absoluteTestDirectory = path.normalize(`${projectDirectoryPath}/test`);
const absoluteNonExistingPath = path.normalize(`${projectDirectoryPath}/i/dont/exist`);


/* Test both the fileManager.directoryManager and fileManager as file some file operations are required before some directory operations */

beforeAll(function (done) {
    if (fs.existsSync(absoluteTestDirectory)) {
        fs.removeSync(absoluteTestDirectory);
    }
    done();
});

afterAll(function (done) {
    if (fs.existsSync(absoluteTestDirectory)) {
        fs.removeSync(absoluteTestDirectory);
    }
    done();
});

describe('Utils:Filesystem', function () {

    // directories:

    test('Base directories', function () {
        expect(fileManager.directoryManager.projectDirectory).toEqual(projectDirectoryPath);
        expect(fileManager.directoryManager.gtfsDirectory).toEqual(path.normalize(projectDirectoryPath + '/gtfs'));
        expect(fileManager.directoryManager.cacheDirectory).toEqual(path.normalize(projectDirectoryPath + '/cache'));
        expect(fileManager.directoryManager.osrmDirectory).toEqual(path.normalize(projectDirectoryPath + '/osrm'));
        expect(fileManager.directoryManager.transitCacheDirectory).toEqual(path.normalize(projectDirectoryPath + '/cache/transit/test'));
    });

    test('directory manager should create the test project directory and return the absolute path', function () {
        expect(fileManager.directoryManager.createDirectoryIfNotExists(projectRelativeDirectoryTestPath)).toBe(absoluteDirectoryTestPath);
        fileManager.directoryManager.deleteDirectory(projectRelativeDirectoryTestPath);
        expect(fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(absoluteDirectoryTestPath)).toBe(absoluteDirectoryTestPath);
    });

    test('directory manager should return null when trying to create an existing directory', function () {
        expect(fileManager.directoryManager.createDirectoryIfNotExists(projectRelativeDirectoryTestPath)).toBe(null);
        expect(fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(absoluteDirectoryTestPath)).toBe(null);
    });

    test('directory manager should correctly return that a directory exists', function () {
        expect(fileManager.directoryManager.directoryExists(projectRelativeDirectoryTestPath)).toBe(true);
        expect(fileManager.directoryManager.directoryExistsAbsolute(absoluteDirectoryTestPath)).toBe(true);
    });

    test('directory manager should correctly return that a directory does not exist', function () {
        expect(fileManager.directoryManager.directoryExists(projectRelativeNonExistingPath)).toBe(false);
        expect(fileManager.directoryManager.directoryExistsAbsolute(absoluteNonExistingPath)).toBe(false);
    });

    test('directory manager should have created the test project directory in the project directory', function () {
        expect(fs.existsSync(absoluteDirectoryTestPath)).toBe(true);
    });

    test('directory manager should return the absolute path of a relative project directory path', function () {
        expect(fileManager.directoryManager.getAbsolutePath(projectRelativeDirectoryTestPath)).toBe(absoluteDirectoryTestPath);
    });

    test('directory manager should correctly return if a directory is empty when it is', function () {
        expect(fileManager.directoryManager.isEmpty(projectRelativeDirectoryTestPath)).toBe(true);
        expect(fileManager.directoryManager.isEmptyAbsolute(absoluteDirectoryTestPath)).toBe(true);
    });

    test('directory manager should return null when checking if a non-existing directory is empty', function () {
        expect(fileManager.directoryManager.isEmpty(projectRelativeNonExistingPath)).toBe(null);
        expect(fileManager.directoryManager.isEmptyAbsolute(absoluteNonExistingPath)).toBe(null);
    });

    test('directory manager should correctly return if a directory is not empty when it is', function () {
        expect(fileManager.directoryManager.isNotEmpty(projectRelativeDirectoryTestPath)).toBe(false);
        expect(fileManager.directoryManager.isNotEmptyAbsolute(absoluteDirectoryTestPath)).toBe(false);
    });

    test('directory manager should return null when checking if a non-existing directory is not empty', function () {
        expect(fileManager.directoryManager.isNotEmpty(projectRelativeNonExistingPath)).toBe(null);
        expect(fileManager.directoryManager.isNotEmptyAbsolute(absoluteNonExistingPath)).toBe(null);
    });

    test('directory manager should return null when trying to read content of a non-existing directory', function () {
        expect(fileManager.directoryManager.getFiles(projectRelativeNonExistingPath)).toBe(null);
        expect(fileManager.directoryManager.getFilesAbsolute(absoluteNonExistingPath)).toBe(null);
    });

    test('directory manager should return an empty array when trying to read the content of an empty directory', function () {
        expect(fileManager.directoryManager.getFiles(projectRelativeDirectoryTestPath)).toEqual([]);
        expect(fileManager.directoryManager.getFilesAbsolute(absoluteDirectoryTestPath)).toEqual([]);
    });


    // files:

    test('file manager should prepare the test project file and return the absolute path', function () {
        expect(fileManager.setupFile(projectRelativeFileTestPath)).toBe(absoluteFileTestPath);
    });

    test('file manager should return null when trying to setup a file in an existing directory', function () {
        expect(fileManager.setupFile(projectRelativeFileTestPath)).toBe(null);
    });

    test('file manager should return file name from project relative path', function () {
        expect(fileManager.getFileName(projectRelativeFileTestPath)).toBe('bar.txt');
    });

    test('file manager should return file name from absolute path', function () {
        expect(fileManager.getFileName(absoluteFileTestPath)).toBe('bar.txt');
    });

    test('directory manager should return the absolute path of a relative project file path', function () {
        expect(fileManager.directoryManager.getAbsolutePath(projectRelativeFileTestPath)).toBe(absoluteFileTestPath);
    });

    test('file manager should create (write to) the test project file and return the absolute path', function () {
        expect(fileManager.writeFile(projectRelativeFileTestPath, "foo")).toBe(absoluteFileTestPath);
        expect(fileManager.writeFileAbsolute(absoluteFileTestPath, "foo")).toBe(absoluteFileTestPath);
    });

    test('file manager should have created the test project file', function () {
        expect(fs.existsSync(absoluteFileTestPath)).toBe(true);
    });

    test('file manager should return null when trying to create or write to a file in a non-existing directory', function () {
        expect(fileManager.writeFile(projectRelativeNonExistingFilePath, "foo")).toBe(null);
    });

    test('directory manager should correctly return if a directory is empty when it is not', function () {
        expect(fileManager.directoryManager.isEmpty(projectRelativeFileDirectoryTestPath)).toBe(false);
        expect(fileManager.directoryManager.isEmptyAbsolute(absoluteFileDirectoryTestPath)).toBe(false);
    });

    test('directory manager should correctly return if a directory is not empty when it is not', function () {
        expect(fileManager.directoryManager.isNotEmpty(projectRelativeFileDirectoryTestPath)).toBe(true);
        expect(fileManager.directoryManager.isNotEmptyAbsolute(absoluteFileDirectoryTestPath)).toBe(true);
    });

    test('file manager should have written the correct content to the test project file', function () {
        expect(fs.readFileSync(absoluteFileTestPath).toString()).toBe("foo");
    });

    test('file manager should read the correct content from the test project file', function () {
        fs.writeFileSync(absoluteFileTestPath, "bar", { flag: 'a' });
        expect(fileManager.readFile(projectRelativeFileTestPath)).toBe("foobar");
        expect(fileManager.readFileAbsolute(absoluteFileTestPath)).toBe("foobar");
    });

    test('file manager should append to a project file and return the absolute path', function () {
        expect(fileManager.appendFile(projectRelativeFileTestPath, "bar")).toEqual(absoluteFileTestPath);
        expect(fileManager.appendFileAbsolute(absoluteFileTestPath, "bar")).toEqual(absoluteFileTestPath);
    });

    test('file manager should have appended the correct content to the test project file', function () {
        expect(fs.readFileSync(absoluteFileTestPath).toString()).toBe("foobarbarbar");
    });

    test('file manager should return null when trying to append to a non-existing file', function () {
        expect(fileManager.appendFile(projectRelativeNonExistingFilePath, "bar")).toEqual(null);
    });

    test('file manager should truncate a project file and return the absolute path', function () {
        expect(fileManager.truncateFile(projectRelativeFileTestPath)).toEqual(absoluteFileTestPath);
        fileManager.writeFile(projectRelativeFileTestPath, "foo");
        expect(fileManager.truncateFileAbsolute(absoluteFileTestPath)).toEqual(absoluteFileTestPath);
    });

    test('file manager should return null when trying to truncate a non-existing file', function () {
        expect(fileManager.truncateFile(projectRelativeNonExistingFilePath)).toEqual(null);
    });

    test('file manager should have truncated the project file', function () {
        expect(fs.readFileSync(absoluteFileTestPath).toString()).toBe("");
    });

    test('file manager should correctly return that a file exists', function () {
        expect(fileManager.fileExists(projectRelativeFileTestPath)).toBe(true);
        expect(fileManager.fileExistsAbsolute(absoluteFileTestPath)).toBe(true);
    });

    test('file manager should correctly return that a file does not exist', function () {
        expect(fileManager.fileExists(projectRelativeNonExistingFilePath)).toBe(false);
    });

    test('directory manager should list files in directory', function () {
        expect(fileManager.directoryManager.getFiles(projectRelativeFileDirectoryTestPath)).toEqual(["bar.txt"]);
        expect(fileManager.directoryManager.getFilesAbsolute(absoluteFileDirectoryTestPath)).toEqual(["bar.txt"]);
        expect(fileManager.directoryManager.getFilesAbsolute(absoluteFileDirectoryTestPath, true)).toEqual([absoluteFileDirectoryTestPath + "/bar.txt"]);
    });

    test('list files with extension', async () => {
        // Default parameter
        expect(await fileManager.directoryManager.getFilesWithExtension(projectRelativeFileDirectoryTestPath)).toEqual([]);
        expect(await fileManager.directoryManager.getFilesWithExtensionAbsolute(absoluteFileDirectoryTestPath)).toEqual([]);

        // txt extension
        expect(await fileManager.directoryManager.getFilesWithExtension(projectRelativeFileDirectoryTestPath, 'txt')).toEqual([absoluteFileDirectoryTestPath + "/bar.txt"]);
        expect(await fileManager.directoryManager.getFilesWithExtensionAbsolute(absoluteFileDirectoryTestPath, 'txt')).toEqual([absoluteFileDirectoryTestPath + "/bar.txt"]);

        // other extension
        expect(await fileManager.directoryManager.getFilesWithExtension(projectRelativeFileDirectoryTestPath, 'ts')).toEqual([]);
        expect(await fileManager.directoryManager.getFilesWithExtensionAbsolute(absoluteFileDirectoryTestPath, 'ts')).toEqual([]);
    });

    test('file manager should delete a project file and return the absolute path', function () {
        expect(fileManager.deleteFile(projectRelativeFileTestPath)).toEqual(absoluteFileTestPath);
        fileManager.writeFile(projectRelativeFileTestPath, "foo");
        expect(fileManager.deleteFileAbsolute(absoluteFileTestPath)).toEqual(absoluteFileTestPath);
    });

    test('directory manager should empty a directory and return the absolute path', function () {
        fileManager.writeFile(projectRelativeFileTestPath, "foo");
        // Relative path, should not be empty, then empty
        expect(fileManager.directoryManager.isEmpty(projectRelativeFileDirectoryTestPath)).toEqual(false);
        expect(fileManager.directoryManager.emptyDirectory(projectRelativeFileDirectoryTestPath)).toEqual(absoluteFileDirectoryTestPath);
        expect(fileManager.directoryManager.isEmpty(projectRelativeFileDirectoryTestPath)).toEqual(true);
        fileManager.writeFile(projectRelativeFileTestPath, "foo");

        // Absolute path, should not be empty, then empty
        expect(fileManager.directoryManager.isEmptyAbsolute(absoluteFileDirectoryTestPath)).toEqual(false);
        expect(fileManager.directoryManager.emptyDirectoryAbsolute(absoluteFileDirectoryTestPath)).toEqual(absoluteFileDirectoryTestPath);
        expect(fileManager.directoryManager.isEmptyAbsolute(absoluteFileDirectoryTestPath)).toEqual(true);
        fileManager.writeFile(projectRelativeFileTestPath, "foo");

        expect(fileManager.directoryManager.emptyDirectory(projectRelativeNonExistingFilePath)).toEqual(null);
        expect(fileManager.directoryManager.emptyDirectoryAbsolute(absoluteNonExistingPath)).toEqual(null);

    });

    test('file manager should return null when trying to delete a non-existing file', function () {
        expect(fileManager.deleteFile(projectRelativeNonExistingFilePath)).toEqual(null);
    });

    test('file manager should return null when reading a non-existing file', function () {
        expect(fileManager.readFileAbsolute(absoluteNonExistingPath)).toEqual(null);
    });

    // directory deletion:

    test('directory manager should delete project test directory and return the absolute path', function () {
        expect(fileManager.directoryManager.deleteDirectory(projectRelativeDirectoryTestPath)).toEqual(absoluteDirectoryTestPath);
        fileManager.directoryManager.createDirectoryIfNotExists(projectRelativeDirectoryTestPath);
        expect(fileManager.directoryManager.deleteDirectoryAbsolute(absoluteDirectoryTestPath)).toEqual(absoluteDirectoryTestPath);
    });

    test('directory manager should return null when trying to delete a non-existing directory', function () {
        expect(fileManager.directoryManager.deleteDirectory(projectRelativeNonExistingPath)).toEqual(null);
        expect(fileManager.directoryManager.deleteDirectoryAbsolute(absoluteNonExistingPath)).toEqual(null);
    });

    test('fileManager should setup files', function() {
        expect(fileManager.setupFile(copyFromFileTestPath)).toEqual(fileManager.getAbsolutePath(copyFromFileTestPath));
        expect(fileManager.setupFileAbsolute(fileManager.getAbsolutePath(copyToFileTestPath))).toEqual(fileManager.getAbsolutePath(copyToFileTestPath));
    });

    test('fileManager should setup and copy files', function () {
        fileManager.writeFile(copyFromFileTestPath, 'test');

        // copy should fail if the from file does not exist or the to directory does not exist:
        expect(fileManager.copyFile('test/foo/doesNotExist.txt', copyToFileTestPath)).toBe(false);
        expect(fileManager.copyFile('test/foo/doesNotExist.txt', copyToFileTestPath, false)).toBe(false);
        expect(fileManager.copyFile(copyFromFileTestPath, 'test/foo/doesNotExist/bar.txt', false)).toBe(false);

        fileManager.copyFile(copyFromFileTestPath, copyToFileTestPath, true);
        expect(fileManager.fileExists(copyFromFileTestPath)).toBe(true);
        expect(fileManager.fileExists(copyToFileTestPath)).toBe(true);
        expect(fileManager.readFile(copyToFileTestPath)).toEqual('test');
        fileManager.writeFileAbsolute(fileManager.getAbsolutePath(copyFromFileTestPath), 'testAbsolute');
        fileManager.copyFileAbsolute(fileManager.getAbsolutePath(copyFromFileTestPath), fileManager.getAbsolutePath(copyToFileTestPath));
        expect(fileManager.readFileAbsolute(fileManager.getAbsolutePath(copyToFileTestPath))).toEqual('testAbsolute');
    });

    test('directoryManager should copy directories', function () {
        fileManager.setupFile(`${copyFromDirectoryTestPath}/foo.txt`);
        fileManager.writeFile(`${copyFromDirectoryTestPath}/foo.txt`, 'foo');
        fileManager.setupFile(`${copyFromDirectoryTestPath}/nested/bar.txt`);
        fileManager.writeFile(`${copyFromDirectoryTestPath}/nested/bar.txt`, 'bar');
        
        // it should fail if one directory does not exist.
        expect(fileManager.directoryManager.copyDirectory(copyFromDirectoryTestPath, 'test/foo/doesNotExist', false)).toBe(false);
        expect(fileManager.directoryManager.copyDirectory('test/foo/doesNotExist', copyToDirectoryTestPath, false)).toBe(false);
        expect(fileManager.directoryManager.copyDirectory('test/foo/doesNotExist', 'test/foo/doesNotExist3', false)).toBe(false);
        expect(fileManager.directoryManager.copyDirectory(copyFromDirectoryTestPath, 'test/foo/doesNotExist')).toBe(false);
        expect(fileManager.directoryManager.copyDirectory('test/foo/doesNotExist', copyToDirectoryTestPath)).toBe(false);
        expect(fileManager.directoryManager.copyDirectory('test/foo/doesNotExist', 'test/foo/doesNotExist3')).toBe(false);

        fileManager.directoryManager.copyDirectory(copyFromDirectoryTestPath, copyToDirectoryTestPath, true);
        expect(fileManager.fileExists(`${copyToDirectoryTestPath}/foo.txt`)).toBe(true);
        expect(fileManager.fileExists(`${copyToDirectoryTestPath}/nested/bar.txt`)).toBe(true);
        expect(fileManager.readFile(`${copyToDirectoryTestPath}/foo.txt`)).toEqual('foo');
        expect(fileManager.readFile(`${copyToDirectoryTestPath}/nested/bar.txt`)).toEqual('bar');

        fileManager.setupFileAbsolute(fileManager.getAbsolutePath(`${copyFromDirectoryTestPath}Absolute/fooAbsolute.txt`));
        fileManager.writeFileAbsolute(fileManager.getAbsolutePath(`${copyFromDirectoryTestPath}Absolute/fooAbsolute.txt`), 'foo');
        fileManager.setupFileAbsolute(fileManager.getAbsolutePath(`${copyFromDirectoryTestPath}Absolute/nested/barAbsolute.txt`));
        fileManager.writeFileAbsolute(fileManager.getAbsolutePath(`${copyFromDirectoryTestPath}Absolute/nested/barAbsolute.txt`), 'bar');
        fileManager.directoryManager.copyDirectoryAbsolute(fileManager.directoryManager.getAbsolutePath(copyFromDirectoryTestPath + 'Absolute'), fileManager.directoryManager.getAbsolutePath(copyToDirectoryTestPath + 'Absolute'), true);
        expect(fileManager.fileExistsAbsolute(fileManager.getAbsolutePath(`${copyToDirectoryTestPath}Absolute/fooAbsolute.txt`))).toBe(true);
        expect(fileManager.fileExistsAbsolute(fileManager.getAbsolutePath(`${copyToDirectoryTestPath}Absolute/nested/barAbsolute.txt`))).toBe(true);
        expect(fileManager.readFileAbsolute(fileManager.getAbsolutePath(`${copyToDirectoryTestPath}Absolute/fooAbsolute.txt`))).toEqual('foo');
        expect(fileManager.readFileAbsolute(fileManager.getAbsolutePath(`${copyToDirectoryTestPath}Absolute/nested/barAbsolute.txt`))).toEqual('bar');
    });

});


