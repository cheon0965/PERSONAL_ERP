import { Module } from '@nestjs/common';
import { WorkspaceSettingsController } from './workspace-settings.controller';
import { WorkspaceSettingsService } from './services/workspace-settings.service';

@Module({
  controllers: [WorkspaceSettingsController],
  providers: [WorkspaceSettingsService]
})
export class WorkspaceSettingsModule {}
