import { v4 as uuidV4 } from 'uuid';
import { Request } from 'express';
import { StrategyCreatedStatic } from 'passport';
import { IAuthModel, IUserModel } from './authModel';

const anonymousPrefix = 'anonym_';

/**
 * Passport strategy, which creates a user with a random name for the current
 * session. This user will not be able to log in again.
 */
class AnonymousLoginStrategy<A> {
    name = 'anonymousLoginStrategy';
    constructor(private authModel: IAuthModel<IUserModel>) {
        // Nothing to do
    }

    //TODO: The req parameter is unused. Either remove it or implement a use for it.
    async authenticate(this: StrategyCreatedStatic & AnonymousLoginStrategy<A>, _req: Request): Promise<void> {
        console.log('anonymous login');
        try {
            let randomId: string | undefined = undefined;
            let user: IUserModel | undefined = undefined;
            let i = 0;
            do {
                randomId = uuidV4().slice(-10);
                user = await this.authModel.find({ usernameOrEmail: `${anonymousPrefix}${randomId}` });
                i++;
            } while (user !== undefined && i < 10);
            if (user !== undefined) {
                throw 'Cannot find a unique username for new user, quitting';
            }
            const username = `${anonymousPrefix}${randomId}`;
            const newUser = await this.authModel.createAndSave({
                username,
                isTest: false
            });
            if (newUser !== undefined) {
                // Record new user login information
                newUser.recordLogin();
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
