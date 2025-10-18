export interface UserRepository {
  getEmail(userId: string): Promise<string | null>;
  getPhone(userId: string): Promise<string | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
