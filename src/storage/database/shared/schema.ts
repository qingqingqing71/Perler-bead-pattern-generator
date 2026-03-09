import { pgTable, serial, timestamp, varchar, boolean, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// 系统健康检查表（保留）
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表 - 存储用户信息和 API Key
export const users = pgTable(
	"users",
	{
		id: serial().notNull().primaryKey(),
		name: varchar("name", { length: 100 }).notNull(),
		email: varchar("email", { length: 255 }),
		apiKey: varchar("api_key", { length: 64 }).notNull().unique(),
		isActive: boolean("is_active").default(true).notNull(),
		usageLimit: integer("usage_limit").default(100).notNull(), // 每日使用次数限制
		usageCount: integer("usage_count").default(0).notNull(), // 今日已使用次数
		lastUsageDate: varchar("last_usage_date", { length: 10 }), // 最后使用日期 YYYY-MM-DD
		expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }), // 过期时间
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	},
	(table) => [
		index("users_api_key_idx").on(table.apiKey),
		index("users_is_active_idx").on(table.isActive),
	]
);

// 使用记录表 - 详细的使用日志
export const usageLogs = pgTable(
	"usage_logs",
	{
		id: serial().notNull().primaryKey(),
		userId: integer("user_id").notNull(),
		action: varchar("action", { length: 50 }).notNull(), // 动作类型：pixelate, bead_pattern, etc.
		gridSize: integer("grid_size"), // 网格大小
		upscaleFactor: integer("upscale_factor"), // 放大倍数
		ipAddress: varchar("ip_address", { length: 45 }), // 用户 IP
		userAgent: varchar("user_agent", { length: 500 }), // 浏览器信息
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("usage_logs_user_id_idx").on(table.userId),
		index("usage_logs_created_at_idx").on(table.createdAt),
	]
);

// 管理员表
export const admins = pgTable(
	"admins",
	{
		id: serial().notNull().primaryKey(),
		name: varchar("name", { length: 100 }).notNull(),
		adminKey: varchar("admin_key", { length: 64 }).notNull().unique(),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("admins_admin_key_idx").on(table.adminKey),
	]
);

// TypeScript 类型导出
export type User = typeof users.$inferSelect;
export type UsageLog = typeof usageLogs.$inferSelect;
export type Admin = typeof admins.$inferSelect;
