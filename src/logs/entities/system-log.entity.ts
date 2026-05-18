import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('system_logs')
@Index('IDX_system_logs_created_at', ['createdAt'])
@Index('IDX_system_logs_service_action', ['serviceName', 'action'])
export class SystemLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 120, name: 'service_name' })
  serviceName!: string;

  @Column({ type: 'varchar', length: 120 })
  action!: string;

  @Column({ type: 'jsonb', name: 'request_data', nullable: true })
  requestData!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'response_data', nullable: true })
  responseData!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 40 })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
