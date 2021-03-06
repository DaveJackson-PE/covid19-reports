import { Response, NextFunction } from 'express';
import { ApiRequest } from '../../api';
import { User } from '../../api/user/user.model';
import { UserRole } from '../../api/user/user-role.model';
import { Workspace } from '../../api/workspace/workspace.model';
import config from '../../config';

const nJwt = require('njwt');

class ReadOnlyRestController {

  // Redirects user to Kibana login page. By attaching the rorJWT this will effectively log in the user seamlessly,
  // and store rorCookie in the browser.
  login(req: ApiRequest<null, null, LoginQuery>, res: Response) {
    console.log('ror login()');

    const rorJwt = buildJWT(req.appUser, req.appUserRole!, req.appWorkspace!);
    console.log('ror jwt', rorJwt);

    res.cookie('orgId', req.appOrg!.id, { httpOnly: true });

    let url = `${config.kibana.basePath}/login?jwt=${rorJwt}`;
    if (req.query.dashboardUuid) {
      url += `#/dashboard/${req.query.dashboardUuid}`;
    }

    return res.redirect(url);
  }

  // Logs out of a Kibana session by clearing the rorCookie.
  logout(req: ApiRequest, res: Response, next: NextFunction) {
    console.log('ror logout()');

    res.clearCookie('rorCookie');
    res.clearCookie('orgId');
    next();
  }

}

// Builds ReadOnlyRest JWT token.
export function buildJWT(user: User, userRole: UserRole, workspace: Workspace) {
  console.log('ror buildJWT()');

  const claims = {
    sub: user.edipi,
    iss: 'https://statusengine.mysymptoms.mil',
    roles: userRole.getKibanaRoles(),
    firecares_id: `${workspace!.id}`, // TODO: Rename 'firecares_id'.
  };

  console.log('ror claims', claims);

  const jwt = nJwt.create(claims, config.ror.secret);
  jwt.setExpiration(new Date().getTime() + (86400 * 1000 * 30)); // 30d

  return jwt.compact();
}

type LoginQuery = {
  dashboardUuid?: string
};

export default new ReadOnlyRestController();
