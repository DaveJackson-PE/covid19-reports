import { Response } from 'express';
import { getConnection, getManager } from 'typeorm';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../util/error-types';
import { ApiRequest, OrgParam } from '../index';
import { Org } from '../org/org.model';
import { Role } from '../role/role.model';
import { User } from '../user/user.model';
import { AccessRequest, AccessRequestStatus } from './access-request.model';

class AccessRequestController {

  async getAccessRequests(req: ApiRequest, res: Response) {
    if (!req.appOrg) {
      throw new NotFoundError('Organization was not found');
    }

    const requests = await AccessRequest.find({
      relations: ['user', 'org'],
      where: {
        org: req.appOrg.id,
        status: AccessRequestStatus.Pending,
      },
    });

    res.json(requests);
  }

  async issueAccessRequest(req: ApiRequest<OrgParam>, res: Response) {
    if (!req.appUser.isRegistered) {
      throw new BadRequestError('User is not registered');
    }

    const orgId = parseInt(req.params.orgId);
    if (Number.isNaN(orgId) || orgId < 0) {
      throw new BadRequestError(`Invalid organization id: ${orgId}`);
    }

    const org = await Org.findOne({
      where: {
        id: orgId,
      },
      relations: ['contact'],
    });

    if (!org) {
      throw new NotFoundError('Organization was not found.');
    }

    let request = await AccessRequest.findOne({
      where: {
        user: req.appUser.edipi,
        org: org.id,
      },
    });

    let newRequest: AccessRequest | null = null;
    await getConnection().transaction(async manager => {
      if (request) {
        if (request.status === AccessRequestStatus.Denied) {
          // Remove the denied request so that we can issue a new one.
          await manager.remove(request);
        } else {
          throw new BadRequestError('The access request has already been issued.');
        }
      }

      request = new AccessRequest();
      request.user = req.appUser;
      request.org = org;
      request.requestDate = new Date();
      newRequest = await manager.save(request);
    });

    res.status(201);
    res.json(newRequest);
  }

  async cancelAccessRequest(req: ApiRequest<OrgParam>, res: Response) {
    if (!req.appUser.isRegistered) {
      throw new BadRequestError('User is not registered');
    }

    const orgId = parseInt(req.params.orgId);
    if (Number.isNaN(orgId) || orgId < 0) {
      throw new BadRequestError(`Invalid organization id: ${orgId}`);
    }

    const org = await Org.findOne({
      where: {
        id: orgId,
      },
    });

    if (!org) {
      throw new NotFoundError('Organization was not found.');
    }

    const request = await AccessRequest.findOne({
      where: {
        user: req.appUser.edipi,
        org: org.id,
      },
    });

    if (!request) {
      throw new NotFoundError('Access request was not found.');
    }

    await request.remove();

    res.status(204).send();
  }

  async approveAccessRequest(req: ApiRequest<OrgParam, ApproveAccessRequestBody>, res: Response) {
    if (!req.appOrg) {
      throw new NotFoundError('Organization was not found');
    }

    const orgId = req.appOrg.id;

    if (!req.body.requestId) {
      throw new BadRequestError('Missing access request id');
    }

    if (!req.body.roleId) {
      throw new BadRequestError('Missing role for approved access request');
    }

    let processedRequest: AccessRequest | null = null;

    await getManager().transaction(async manager => {
      const accessRequest = await manager.findOne(AccessRequest, {
        relations: ['user'],
        where: {
          id: req.body.requestId,
          org: orgId,
        },
      });

      if (!accessRequest) {
        throw new NotFoundError('Access request was not found');
      }

      const role = await manager.findOne(Role, {
        where: {
          id: req.body.roleId,
          org: orgId,
        },
      });

      if (!role) {
        throw new NotFoundError('Role was not found');
      }

      if (!req.appRole || !req.appRole.isSupersetOf(role)) {
        throw new UnauthorizedError('Unable to assign a role with greater permissions than your current role.');
      }

      const user = await manager.findOne(User, {
        relations: ['userRoles', 'userRoles.role', 'userRoles.role.org'],
        where: {
          edipi: accessRequest.user!.edipi,
        },
      });

      if (!user) {
        throw new NotFoundError('User was not found');
      }

      const userRole = user.userRoles.find(ur => ur.role.org!.id === orgId);
      if (userRole?.role) {
        await manager.remove(accessRequest);
        throw new BadRequestError('User already has a role in the organization');
      }

      await user.addRole(manager, role);

      await manager.save(user);

      processedRequest = await manager.remove(accessRequest);
    });

    res.json({
      success: true,
      request: processedRequest,
    });
  }

  async denyAccessRequest(req: ApiRequest<OrgParam, AccessRequestBody>, res: Response) {
    if (!req.appOrg) {
      throw new NotFoundError('Organization was not found');
    }

    if (!req.body.requestId) {
      throw new BadRequestError('Missing access request id');
    }

    const request = await AccessRequest.findOne({
      where: {
        id: req.body.requestId,
        org: req.appOrg.id,
      },
    });

    if (!request) {
      throw new NotFoundError('Access request was not found.');
    }

    request.status = AccessRequestStatus.Denied;
    const deniedRequest = request.save();

    res.json(deniedRequest);
  }
}

type AccessRequestBody = {
  requestId: number,
};

type ApproveAccessRequestBody = {
  roleId: number,
} & AccessRequestBody;

export default new AccessRequestController();
