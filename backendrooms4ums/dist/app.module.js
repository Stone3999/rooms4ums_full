"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const database_module_1 = require("./database/database.module");
const redis_module_1 = require("./database/redis.module");
const auth_module_1 = require("./auth/auth.module");
const storage_module_1 = require("./storage/storage.module");
const env_validation_1 = require("./config/env.validation");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const diagnostic_controller_1 = require("./diagnostic/diagnostic.controller");
const voice_module_1 = require("./voice/voice.module");
const rooms_module_1 = require("./rooms/rooms.module");
const forum_module_1 = require("./forum/forum.module");
const search_module_1 = require("./search/search.module");
const admin_module_1 = require("./admin/admin.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                validationSchema: env_validation_1.envValidationSchema,
            }),
            database_module_1.DatabaseModule,
            redis_module_1.RedisModule,
            auth_module_1.AuthModule,
            storage_module_1.StorageModule,
            mongoose_1.MongooseModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    uri: configService.get('MONGO_URI'),
                }),
            }),
            voice_module_1.VoiceModule,
            rooms_module_1.RoomsModule,
            forum_module_1.ForumModule,
            search_module_1.SearchModule,
            admin_module_1.AdminModule,
        ],
        controllers: [app_controller_1.AppController, diagnostic_controller_1.DiagnosticController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map