"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabaseConnection = void 0;
const postgres_1 = __importDefault(require("postgres"));
const createDatabaseConnection = (configService) => {
    const connectionString = configService.get('DATABASE_URL') || '';
    const sql = (0, postgres_1.default)(connectionString, {
        ssl: { rejectUnauthorized: false },
        idle_timeout: 20,
        connect_timeout: 30,
    });
    return sql;
};
exports.createDatabaseConnection = createDatabaseConnection;
//# sourceMappingURL=database.js.map