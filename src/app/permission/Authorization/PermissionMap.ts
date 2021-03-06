import * as _ from 'lodash'
import RoleStore from '../stores/RoleStore'
import PermissionStore from '../stores/PermissionStore'
import { wrapIntoObservable } from '@angular/router/src/utils/collection'
import { Observable } from 'rxjs'
import 'rxjs/add/operator/first'

interface RedirectRoute {
    path: string
    [prop: string]: any
}

interface RedirectFunc {
    (rejectedPermissionName: string): RedirectRoute
}

type Redirection = RedirectRoute | RedirectFunc | string | {
    [prop: string]: RedirectRoute | RedirectFunc | string
}

type RedirectMap = {
    default: RedirectFunc
    [prop: string]: RedirectFunc
}

export interface RawPermissionMap {
    only?: string[] | string
    except?: string[] | string
    redirectTo?: any
}

export type ValidateResult = [boolean, string]

export default class PermissionMap {
    only: string[]
    except: string[]
    redirectTo: RedirectMap

    constructor(
        permissionMap: RawPermissionMap = {} as any,
        private permissionStore: PermissionStore,
        private roleStore: RoleStore
    ) {
        this.only = normalizeOnlyAndExceptProperty(permissionMap.only);
        this.except = normalizeOnlyAndExceptProperty(permissionMap.except);
        this.redirectTo = normalizeRedirectToProperty(permissionMap.redirectTo);
    }

    resolvePrivilegesValidity(privileges: string[]): Observable<ValidateResult>[] {
        return privileges.map(privilegeName => {
            if (this.roleStore.hasRoleDefinition(privilegeName)) {
                const role = this.roleStore.getRoleDefinition(privilegeName);
                return wrapIntoObservable(role.validate(this.permissionStore))
                    .map(result => [result, privilegeName]);
            }

            if (this.permissionStore.hasPermissionDefinition(privilegeName)) {
                const permission = this.permissionStore.getPermissionDefinition(privilegeName);
                return wrapIntoObservable(permission.validate())
                    .map(result => [result, privilegeName]);
            }

            return wrapIntoObservable(false)
                .map(result => [result, privilegeName]);
        });
    }

    resolveAll(): Observable<ValidateResult> {
        return this.resolveExceptPrivilegeMap()
            .switchMap(result => {
                // 不存在排除的权限
                if (result[0]) {
                    return this.resolveOnlyPrivilegeMap()
                }

                return Observable.of(result)
            })
    }

    resolveRedirect(rejectedPermissionName: string): Observable<RedirectRoute> {
        if (!this.redirectTo) {
            return Observable.throw(new Error('Empty redirect config.'))
        }

        const redirectFunc = this.redirectTo[rejectedPermissionName] || this.redirectTo['default'];

        return wrapIntoObservable(redirectFunc(rejectedPermissionName))
            .map(function (result) {
                if (typeof result === 'string') {
                    return {
                        path: result
                    }
                }

                if (typeof result === 'object') {
                    return result
                }

                throw new Error('Invalid redirect config.')
            })
    }

    resolveExceptPrivilegeMap(): Observable<ValidateResult> {
        if (!this.except.length) {
            return Observable.of([true, null as string])
        }

        const observableArr = this.resolvePrivilegesValidity(this.except);

        return Observable.forkJoin(observableArr)
            .map(function (result) {
                // if user has any permission
                if (!result.every(x => !x[0])) {
                    // take those permission
                    return [false, result.find(x => x[0])[1]]
                }
                return [true, null]
            })
    }

    resolveOnlyPrivilegeMap(): Observable<ValidateResult> {
        if (!this.only.length) {
            return Observable.of([true, null as string])
        }

        const observableArr = this.resolvePrivilegesValidity(this.only);

        return Observable.forkJoin(observableArr)
            .map(function (result) {
                if (!result.every(x => x[0])) {
                    return [false, result.find(x => !x[0])[1]]
                }
                return [true, null as string]
            })
    }
}

function isObjectSingleRedirectionRule(redirectTo: RedirectRoute) {
    return !_.isNil(redirectTo.path);
}

function normalizeOnlyAndExceptProperty(property: string | string[]) {
    if (typeof property === 'string') {
        return [property];
    }

    if (Array.isArray(property)) {
        return property;
    }

    return [];
}

function normalizeRedirectToProperty(redirectTo: Redirection) {
    if (_.isNil(redirectTo)) {
        return null
    }

    if (typeof redirectTo === 'string') {
        return normalizeStringRedirectionRule(redirectTo);
    }

    if (typeof redirectTo === 'object') {
        if (isObjectSingleRedirectionRule(redirectTo as RedirectRoute)) {
            return normalizeObjectSingleRedirectionRule(redirectTo as RedirectRoute);
        }

        return normalizeObjectMultipleRedirectionRule(redirectTo);
    }

    if (_.isFunction(redirectTo)) {
        return normalizeFunctionRedirectionRule(redirectTo);
    }

    throw new TypeError('Property "redirectTo" must be String, Function, Array or Object');
}

function normalizeStringRedirectionRule(redirectTo: string): RedirectMap {
    return {
        default: () => ({
            path: redirectTo
        })
    };
}

function normalizeObjectSingleRedirectionRule(redirectTo: RedirectRoute): RedirectMap {
    return {
        default: () => redirectTo
    };
}

function normalizeObjectMultipleRedirectionRule(redirectTo: Dictionary<Redirection>) {
    const redirectionMap = {} as RedirectMap;

    _.forEach(redirectTo, (redirection: Redirection, permission: string) => {
        if (typeof redirection === 'function') {
            redirectionMap[permission] = redirection;
        }

        if (typeof redirection === 'object') {
            redirectionMap[permission] = () => redirection as RedirectRoute;
        }

        if (typeof redirection === 'string') {
            redirectionMap[permission] = () => ({
                path: redirection
            });
        }
    });

    return redirectionMap;
}

function normalizeFunctionRedirectionRule(redirectTo: RedirectFunc): RedirectMap {
    return {
        default: redirectTo
    };
}
