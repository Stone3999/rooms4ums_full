"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
let RoomsService = class RoomsService {
    sql;
    constructor(sql) {
        this.sql = sql;
    }
    async findAllActive() {
        return await this.sql `
      SELECT * FROM forums 
      WHERE status != 'ARCHIVED' 
      ORDER BY created_at ASC
    `;
    }
    async findBySlug(slug) {
        const rooms = await this.sql `SELECT * FROM forums WHERE slug = ${slug} LIMIT 1`;
        if (rooms.length === 0)
            throw new common_1.NotFoundException('Room not found');
        return rooms[0];
    }
    async findAll() {
        return await this.sql `SELECT * FROM forums ORDER BY created_at ASC`;
    }
    async create(data) {
        const { name, slug, description, icon, status, is_interactive } = data;
        try {
            const result = await this.sql `
        INSERT INTO forums (name, slug, description, icon, status, is_interactive)
        VALUES (${name}, ${slug}, ${description}, ${icon}, ${status || 'ACTIVE'}, ${is_interactive || false})
        RETURNING *
      `;
            return result[0];
        }
        catch (e) {
            throw new common_1.BadRequestException('Error creating room: ' + e.message);
        }
    }
    async update(id, data) {
        const { name, slug, description, icon, status, is_interactive } = data;
        const result = await this.sql `
      UPDATE forums SET 
        name = ${name}, 
        slug = ${slug}, 
        description = ${description}, 
        icon = ${icon}, 
        status = ${status}, 
        is_interactive = ${is_interactive || false},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
        if (result.length === 0)
            throw new common_1.NotFoundException('Room not found');
        return result[0];
    }
    async delete(id) {
        const result = await this.sql `DELETE FROM forums WHERE id = ${id} RETURNING id`;
        if (result.length === 0)
            throw new common_1.NotFoundException('Room not found');
        return { message: 'Room deleted successfully' };
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('DATABASE_CONNECTION')),
    __metadata("design:paramtypes", [Object])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map