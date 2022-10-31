/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
const generateJsonDownloadUrl = function(json) {
    if (JSON && URL && Blob) {
        const jsonStr = JSON.stringify(json);
        const blob = new Blob([jsonStr], { type: 'text/json;charset=utf-8' });
        return URL.createObjectURL(blob);
    } else {
        return null;
    }
};

const generateCsvDownloadUrl = function(csv, withBom = false) {
    if (URL && Blob) {
        const blobContent = withBom ? ['\ufeff', csv] : [csv];
        const blob = new Blob(blobContent, { type: 'text/csv;charset=utf-8' });
        return URL.createObjectURL(blob);
    } else {
        return null;
    }
};

const downloadUrl = function(url, filename) {
    if (url && typeof window !== 'undefined' && window.document) {
        // must use the dom
        const link = window.document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename || 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

export default {
    generateJsonDownloadUrl,
    generateCsvDownloadUrl,

    downloadJson: function(json, filename) {
        downloadUrl(generateJsonDownloadUrl(json), filename);
    },

    downloadJsonFromBlob: function(jsonBlobUrl, filename) {
        downloadUrl(jsonBlobUrl, filename);
    },

    downloadCsv: function(csv, filename, withBom = false) {
        downloadUrl(generateCsvDownloadUrl(csv, withBom), filename);
    },

    downloadCsvFromBlob: function(csvBlobUrl, filename) {
        downloadUrl(csvBlobUrl, filename);
    }
};
