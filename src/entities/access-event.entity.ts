import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiKey } from './api-key.entity';

@Entity('access_events')
@Index(['timestamp'])
@Index(['decision'])
@Index(['ip'])
@Index(['apiKeyId'])
export class AccessEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn()
  timestamp!: Date;

  @Column({
    type: 'enum',
    enum: ['allow', 'deny'],
  })
  decision!: 'allow' | 'deny';

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @Column({ type: 'json', nullable: true })
  ruleMeta?: Record<string, any>;

  @Column({ type: 'varchar', length: 45 })
  @Index()
  ip!: string;

  @Column({ type: 'varchar', length: 17, nullable: true })
  clientMac?: string;

  @Column({ type: 'uuid', nullable: true })
  apiKeyId?: string;

  @ManyToOne(() => ApiKey, { nullable: true })
  @JoinColumn({ name: 'apiKeyId' })
  apiKey?: ApiKey;
}
