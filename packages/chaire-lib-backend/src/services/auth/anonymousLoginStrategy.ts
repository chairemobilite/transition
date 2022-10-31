import { Request } from 'express';
import { StrategyCreatedStatic } from 'passport';

import { saveNewUser } from '../../config/auth/passport.utils';

/**
 * Passport strategy, which creates a user with a random name for the current
 * session. This user will not be able to log in again.
 */
class AnonymousLoginStrategy {
    name = 'anonymousLoginStrategy';

    async authenticate(this: StrategyCreatedStatic & AnonymousLoginStrategy, req: Request): Promise<void> {
        console.log('anonymous login');
        try {
            const username = `anonym_${(Math.ceil(Math.random() * 899999) + 100000).toString()}`;
            const newUser = await saveNewUser({
                username,
                isTest: false
            });
            if (newUser !== null) {
                this.success(newUser.sanitize());
            } else {
                throw 'Cannot save new user';
            }
        } catch (error) {
            console.log('Error signing up new user:', error);
            this.fail('UseAnotherMethod');
        }
    }
}

export default AnonymousLoginStrategy;
