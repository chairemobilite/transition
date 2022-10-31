import React from 'react';
import { connect } from 'react-redux';
import { withTranslation, WithTranslation } from 'react-i18next';
import { History, Location } from 'history';

import FormErrors from '../../../pageParts/FormErrors';
import { startAnonymousLogin } from '../../../../actions/Auth';

export interface AnonymousLoginProps {
    isAuthenticated?: boolean;
    history: History;
    location: Location;
    startAnonymousLogin: (callback?: () => void) => void;
    login?: boolean;
}

export const AnonymousLogin: React.FunctionComponent<AnonymousLoginProps & WithTranslation> = (
    props: AnonymousLoginProps & WithTranslation
) => {
    React.useEffect(() => {
        props.startAnonymousLogin();
    }, []);
    return null;
};

const mapStateToProps = (state) => {
    return { isAuthenticated: state.auth.isAuthenticated, login: state.auth.login };
};

const mapDispatchToProps = (dispatch, props: Omit<AnonymousLoginProps, 'startAnonymousLogin'>) => ({
    startAnonymousLogin: (callback?: () => void) =>
        dispatch(startAnonymousLogin(props.history, props.location, callback))
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation('auth')(AnonymousLogin));
