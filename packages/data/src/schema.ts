/**
 * Postgres-first schema (Drizzle). Not wired to a database yet — the M0
 * spike reads versioned TS seeds directly (blueprint § 9 allows SQLite/
 * seed-file operation for the first spike). This file is the contract the
 * seed data will migrate into.
 */
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const alloys = pgTable("alloys", {
  uns: text("uns").primaryKey(),
  names: jsonb("names").$type<string[]>().notNull(),
  family: jsonb("family").$type<string[]>().notNull(),
  standards: jsonb("standards").$type<string[]>().notNull(),
  notes: text("notes"),
});

export const compositionRanges = pgTable("composition_ranges", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  alloyUns: text("alloy_uns").references(() => alloys.uns).notNull(),
  element: text("element").notNull(),
  min: real("min"),
  max: real("max"),
  balance: boolean("balance").default(false).notNull(),
  note: text("note"),
});

export const conditions = pgTable("conditions", {
  id: text("id").primaryKey(),
  alloyUns: text("alloy_uns").references(() => alloys.uns).notNull(),
  name: text("name").notNull(),
  form: text("form").notNull(),
  note: text("note"),
});

export const propertyRecords = pgTable("property_records", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conditionId: text("condition_id").references(() => conditions.id).notNull(),
  property: text("property").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  testTempC: real("test_temp_c").notNull(),
  provenance: text("provenance", {
    enum: ["measured", "spec-min", "computed", "estimated"],
  }).notNull(),
  source: text("source").notNull(),
  note: text("note"),
});

export const dutyProfiles = pgTable("duty_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: integer("version").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
