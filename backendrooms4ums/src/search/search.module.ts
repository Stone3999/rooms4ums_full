import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ForumModule } from '../forum/forum.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    ForumModule,
    RoomsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
