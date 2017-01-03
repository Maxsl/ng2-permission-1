import { Injectable } from '@angular/core'
import { Validator } from '../models/Permission'
import Role from '../models/Role'
import PermissionStore from './PermissionStore'

export default class RoleStore {
    private store: Dictionary<Role> = {}

    constructor(private permissionStore: PermissionStore){}

    defineRole(roleName: string, validateFn: Validator | string[]) {
        this.store[roleName] = new Role(roleName, validateFn, this.permissionStore)
    }

    defineRoles(roleNames: string[], validateFn: Validator) {
        roleNames.forEach(name => this.defineRole(name, validateFn))
    }

    removeRoleDefinition(roleName: string) {
        delete this.store[roleName]
    }

    hasRoleDefinition(roleName: string) {
        return !!this.store[roleName]
    }

    getRoleDefinition(roleName: string) {
        return this.store[roleName]
    }

    getStore() {
        return this.store
    }

    clearStore() {
        this.store = {}
    }
}