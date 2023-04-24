import { Request } from 'express';
import { StrategyCreatedStatic } from 'passport';
import { IAuthModel, IUserModel } from './authModel';

/**
 * Passport strategy, which creates a user with a random name for the current
 * session. This user will not be able to log in again.
 */
class AnonymousLoginStrategy<A> {
    name = 'anonymousLoginStrategy';
    constructor(private authModel: IAuthModel<IUserModel>) {
        // Nothing to do
    }

    async authenticate(this: StrategyCreatedStatic & AnonymousLoginStrategy<A>, req: Request): Promise<void> {
        console.log('anonymous login');
        try {
            const username = `anonym_${(Math.ceil(Math.random() * 899999) + 100000).toString()}`;
            const newUser = await this.authModel.createAndSave({
                username,
                isTest: false
            });
            if (newUser !== undefined) {
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
