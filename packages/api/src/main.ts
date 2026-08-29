import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const port = process.env.PORT || 3001;
  const allowedOrigins: (string | RegExp)[] = [
    'https://draftpilot-web.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    /^chrome-extension:\/\/[a-z]{32}$/,
  ];

  if (process.env.WEB_ORIGIN) {
    allowedOrigins.push(process.env.WEB_ORIGIN);
  }
  if (process.env.EXTENSION_ORIGIN && process.env.EXTENSION_ORIGIN !== '*') {
    allowedOrigins.push(process.env.EXTENSION_ORIGIN);
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        }
        return allowed.test(origin);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy rejection: Origin ${origin} is not allowed.`));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  const config = new DocumentBuilder()
    .setTitle('DraftPilot API')
    .setDescription('The DraftPilot backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();