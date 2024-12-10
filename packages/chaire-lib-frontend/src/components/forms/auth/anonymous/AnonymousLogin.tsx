import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useDispatch } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';
import { RootState } from '../../../../store/configureStore';
import { startAnonymousLogin } from '../../../../actions/Auth';

type AnonymousLoginProps = {
    login?: boolean;
};

const AnonymousLogin: React.FC<AnonymousLoginProps> = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();

    //const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    //const login = useSelector((state: RootState) => state.auth.login);

    React.useEffect(() => {
        dispatch(startAnonymousLogin(location, navigate));
    }, [dispatch, navigate]);

    return null;
};

export default AnonymousLogin;
