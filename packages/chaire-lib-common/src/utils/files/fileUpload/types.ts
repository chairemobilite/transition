/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

export type FileUploadOptions = {
    uploadType: string;
    data: {
        objects: string;
        filename: string;
    };
};

export type FileUploadStatus =
    | {
          status: 'notUploaded';
      }
    | {
          status: 'uploading';
          progress: number;
      }
    | {
          status: 'error';
          error: string | Error;
      }
    | {
          status: 'completed';
      }
    | {
          status: 'aborted';
      };
