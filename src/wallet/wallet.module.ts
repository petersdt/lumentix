import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { UsersModule } from '../users/users.module';
import { StellarModule } from '../stellar/stellar.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule, StellarModule],
  providers: [WalletService],
  controllers: [WalletController],
})
export class WalletModule {}
