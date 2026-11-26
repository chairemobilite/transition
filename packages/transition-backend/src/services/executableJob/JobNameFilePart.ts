/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Maximum length of the part of a file name made from a job name.
 * Chosen by us to keep the download names readable: file names are limited to
 * 255 characters on Windows (NTFS), macOS (APFS) and Linux (ext4), and the
 * rest of a job file name is much shorter than that.
 */
const JOB_NAME_FILE_PART_MAX_LENGTH = 20;

/**
 * Convert the name of a job, which is free text typed by a user, to a string
 * that can be part of a file name on Windows, macOS and Linux.
 *
 * The result contains only the unaccented letters `A` to `Z` and `a` to `z`,
 * the digits and `_`. These characters are valid in file names on all
 * operating systems, in URLs and in command lines. The steps are:
 *
 * 1. Accented letters lose their accent: `é` becomes `e`. The case is kept.
 * 2. Each sequence of any other characters (spaces, punctuation, path
 *    separators, control characters, symbols, emojis, letters of non-Latin
 *    alphabets and letters that are not a base letter with an accent, like
 *    `œ` or `ß`) becomes a single `_`.
 * 3. The result is cut to {@link JOB_NAME_FILE_PART_MAX_LENGTH} characters.
 * 4. The `_` at the beginning and at the end are removed.
 *
 * For example, `Réseau été 2026 (v2)` becomes `Reseau_ete_2026_v2`.
 *
 * The result is not a complete file name: alone, it can be a name reserved by
 * Windows, like `CON`. It must be combined with other characters.
 *
 * @param {string} jobName The job name
 * @returns {string} The file name part. It is empty if the name has no Latin
 * letter and no digit.
 */
export const jobNameToFileNamePart = (jobName: string): string =>
    jobName
        // Separate each accented letter into its base letter and its accents
        // (Unicode canonical decomposition), then remove the accents (Unicode
        // category "Mark")
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .substring(0, JOB_NAME_FILE_PART_MAX_LENGTH)
        .replace(/^_+|_+$/g, '');
