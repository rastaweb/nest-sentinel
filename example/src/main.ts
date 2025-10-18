import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for demo purposes
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  Logger.log(`🚀 Application is running on: http://localhost:${port}`);
  Logger.log(`📖 API Documentation available at: http://localhost:${port}/docs`);
}

bootstrap();