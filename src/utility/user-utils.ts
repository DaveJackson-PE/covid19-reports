import { ApiUser } from '../models/api-response';
import { LocalStorageState } from '../reducers/local-storage.reducer';
import { UserState } from '../reducers/user.reducer';

export function getLoggedInState(user: ApiUser, localStorage: LocalStorageState): Partial<UserState> {
  const userRoles = user.userRoles ?? [];
  const restoredActiveRole = userRoles.find(ur => ur.role.org?.id === localStorage.orgId);
  return {
    ...user,
    userRoles,
    activeRole: restoredActiveRole ?? userRoles[0],
    isLoggedIn: true,
  };
}
