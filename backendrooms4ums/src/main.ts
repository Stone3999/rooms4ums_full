import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    
    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT') || 3000;

    // Global Prefix
    app.setGlobalPrefix('api');

    // CORS - Permitir todo para pruebas de producción
    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    // Global Validation
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    // Swagger Documentation
    const config = new DocumentBuilder()
      .setTitle('Rooms4ums API')
      .setDescription('The Rooms4ums API documentation')
      .setVersion('1.0')
      .addTag('rooms4ums')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    await app.listen(port, '0.0.0.0');
    const url = await app.getUrl();
    console.log(`\x1b[32m[BOOTSTRAP] Application is running on: ${url}\x1b[0m`);
    console.log(`\x1b[32m[BOOTSTRAP] API Prefix: /api\x1b[0m`);
    console.log(`\x1b[32m[BOOTSTRAP] Swagger docs: ${url}/docs\x1b[0m`);
  } catch (error) {
    console.error('\x1b[31m[BOOTSTRAP ERROR] Failed to start application:\x1b[0m', error);
    process.exit(1);
  }
}
bootstrap();
