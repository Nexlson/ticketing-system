import { UserEntity } from './user.entity';

export abstract class UserRepository {
  abstract findById(id: string): Promise<UserEntity | null>;
  abstract findByUsername(username: string): Promise<UserEntity | null>;
  abstract create(data: Pick<UserEntity, 'username' | 'passwordHash'>): Promise<UserEntity>;
}
