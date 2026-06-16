import { Module } from '@nestjs/common';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './services/navigation.service';

@Module({
  controllers: [NavigationController],
  providers: [NavigationService],
  exports: [NavigationService]
})
export class NavigationModule {}
