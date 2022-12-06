/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Loader from 'react-spinners/HashLoader';

const LoadingPage = function (props) {
    return (
        <div className="_fill" style={{ flexDirection: 'column' }}>
            {typeof props.message !== 'undefined' && <h1>{props.message}</h1>}

            <Loader size={30} color={'#aaaaaa'} loading={true} />
        </div>
    );
};

export default LoadingPage;
