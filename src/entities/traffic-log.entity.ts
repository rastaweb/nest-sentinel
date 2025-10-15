import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ApiKey } from "./api-key.entity";

@Entity("traffic_logs")
@Index(["timestamp"])
@Index(["ip"])
@Index(["apiKeyId"])
@Index(["statusCode"])
export class TrafficLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  timestamp!: Date;

  @Column({ type: "varchar", length: 10 })
  method!: string;

  @Column({ type: "varchar", length: 1000 })
  path!: string;

  @Column({ type: "int" })
  statusCode!: number;

  @Column({ type: "int" })
  durationMs!: number;

  @Column({ type: "varchar", length: 45 })
  ip!: string;

  @Column({ type: "varchar", length: 10 })
  ipVersion!: "ipv4" | "ipv6";

  @Column({ type: "varchar", length: 17, nullable: true })
  clientMac?: string;

  @Column({ type: "uuid", nullable: true })
  apiKeyId?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  serviceId?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  userId?: string;

  @Column({ type: "json" })
  requestHeaders!: Record<string, any>;

  @Column({ type: "int", nullable: true })
  responseSize?: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  routeName?: string;

  @ManyToOne(() => ApiKey, { nullable: true })
  @JoinColumn({ name: "apiKeyId" })
  apiKey?: ApiKey;
}
