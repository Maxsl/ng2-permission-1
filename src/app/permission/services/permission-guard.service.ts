import { Injectable } from '@angular/core'
import Authorization from '../Authorization/Authorization'
import { Router, ActivatedRouteSnapshot, CanActivate } from '@angular/router'
import { Observable } from 'rxjs'
import { RawPermissionMap } from '../Authorization/PermissionMap'

@Injectable()
export class PermissionGuard implements CanActivate {

    constructor(private authorize: Authorization, private router: Router) { }

    canActivate(
        route: ActivatedRouteSnapshot
    ): Observable<boolean> | Promise<boolean> | boolean {
        let data: any = route.data;

        if(!data.permission) {
            return true
        }

        return this.checkPermission(data.permission);
    }

    checkPermission(perm: RawPermissionMap) {
        const permMap = this.authorize.genPermMap(perm)
        return this.authorize.resolve(permMap)
            .do(result => {
                if (!result[0]) {
                    permMap.resolveRedirect(result[1])
                        .subscribe(redirect => {
                            this.router.navigate([redirect.path])
                        }, () => {})
                }
            })
            .map(function (result) {
                return result[0]
            })
    }
}
