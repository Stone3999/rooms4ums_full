"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
async function bootstrap() {
    try {
        const app = await core_1.NestFactory.create(app_module_1.AppModule);
        const configService = app.get(config_1.ConfigService);
        const port = configService.get('PORT') || 3000;
        app.setGlobalPrefix('api');
        app.enableCors({
            origin: '*',
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
            credentials: true,
        });
        app.useGlobalPipes(new common_1.ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        const config = new swagger_1.DocumentBuilder()
            .setTitle('Rooms4ums API')
            .setDescription('The Rooms4ums API documentation')
            .setVersion('1.0')
            .addTag('rooms4ums')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('docs', app, document);
        await app.listen(port, '0.0.0.0');
        const url = await app.getUrl();
        console.log(`\x1b[32m[BOOTSTRAP] Application is running on: ${url}\x1b[0m`);
        console.log(`\x1b[32m[BOOTSTRAP] API Prefix: /api\x1b[0m`);
        console.log(`\x1b[32m[BOOTSTRAP] Swagger docs: ${url}/docs\x1b[0m`);
    }
    catch (error) {
        console.error('\x1b[31m[BOOTSTRAP ERROR] Failed to start application:\x1b[0m', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map