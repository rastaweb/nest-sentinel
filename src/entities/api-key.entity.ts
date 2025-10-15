import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import type { OwnerType } from "../interfaces";

@Entity("api_keys")
@Index(["isActive"])
@Index(["ownerType", "ownerId"])
export class ApiKey {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text" })
  @Index()
  key!: string;

  @Column({
    type: "enum",
    enum: ["user", "service"],
  })
  ownerType!: OwnerType;

  @Column({ type: "varchar", length: 255 })
  ownerId!: string;

  @Column({ type: "simple-json" })
  scopes!: string[];

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "datetime", nullable: true })
  expiresAt?: Date;

  @Column({ type: "datetime", nullable: true })
  lastUsedAt?: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
