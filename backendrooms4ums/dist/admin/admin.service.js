"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
let AdminService = class AdminService {
    sql;
    constructor(sql) {
        this.sql = sql;
    }
    async getAllUsers() {
        return this.sql `
      SELECT u.id, u.username, u.email, u.is_active, u.created_at, r.name as role_name 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `;
    }
    async createUser(data, adminId, ip) {
        const { username, email, password, role_id } = data;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await this.sql `
      INSERT INTO users (username, email, password, role_id, is_active)
      VALUES (${username}, ${email}, ${hashedPassword}, ${role_id}, true)
      RETURNING id, username, email
    `;
        await this.logAudit(adminId, 'CREATE_USER', ip, { createdUser: newUser[0].id });
        return newUser[0];
    }
    async updateUser(id, data, adminId, ip) {
        const { username, email, role_id } = data;
        const updated = await this.sql `
      UPDATE users SET username = ${username}, email = ${email}, role_id = ${role_id}
      WHERE id = ${id}
      RETURNING id, username, email
    `;
        if (updated.length === 0)
            throw new common_1.NotFoundException('User not found');
        await this.logAudit(adminId, 'UPDATE_USER', ip, { targetUser: id });
        return updated[0];
    }
    async toggleUserActive(id, isActive, adminId, ip) {
        const updated = await this.sql `
      UPDATE users SET is_active = ${isActive} WHERE id = ${id}
      RETURNING id, is_active
    `;
        if (updated.length === 0)
            throw new common_1.NotFoundException('User not found');
        await this.logAudit(adminId, isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', ip, { targetUser: id });
        return updated[0];
    }
    async getAllRoles() {
        return this.sql `SELECT * FROM roles ORDER BY id ASC`;
    }
    async getAuditLogs() {
        return this.sql `
      SELECT a.*, u.username as admin_username 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `;
    }
    async logAudit(userId, action, ip, details = {}) {
        try {
            await this.sql `
        INSERT INTO audit_logs (user_id, action, ip_address, details)
        VALUES (${userId}, ${action}, ${ip}, ${details})
      `;
        }
        catch (e) {
            console.error('Failed to write audit log', e);
        }
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('DATABASE_CONNECTION')),
    __metadata("design:paramtypes", [Object])
], AdminService);
//# sourceMappingURL=admin.service.js.map