import { Module } from '@nestjs/common';
import { MappingService } from './mapping.service';
import { DataStore } from './data.store';
@Module({ providers:[DataStore,MappingService], exports:[DataStore,MappingService] })
export class StoreModule {}
