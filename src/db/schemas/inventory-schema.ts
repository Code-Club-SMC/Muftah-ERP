import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { suppliers } from "./core-suppliers";

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// --- WAREHOUSES ---
export const warehouses = pgTable("warehouses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  type: text("type").notNull().default("storage"), // "storage" | "factory_floor"
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

// --- Chemicals ---
export const chemicals = pgTable("chemicals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("kg"), // "kg", "liters"
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).default(
    "0",
  ),
  minimumStockLevel: decimal("minimum_stock_level", {
    precision: 10,
    scale: 2,
  }).default("0"),

  packagingType: text("packaging_type"), // "Drum", "Bag", "Can"
  packagingSize: text("packaging_size"), // "20kg", "200L"

  lastSupplierId: text("last_supplier_id").references(() => suppliers.id),
  ...timestamps,
});

// --- PACKAGING MATERIALS ---
export const packagingMaterials = pgTable("packaging_materials", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  // Type: Primary (Bottle/Sachet) or Master (Carton) or Extra (Cap/Label)
  type: text("type").notNull().default("primary"),

  // Capacity:
  // For Primary: Max fill amount (e.g. 500 for 500ml)
  // For Master: Units count (e.g. 24 for 24 bottles)
  capacity: decimal("capacity", { precision: 10, scale: 2 }),

  // Unit for the capacity
  capacityUnit: text("capacity_unit"), // "ml", "g", "units"

  // Primary Packaging Specifics
  weightPerPack: decimal("weight_per_pack", { precision: 10, scale: 3 }), // Weight of empty pack in grams? or content weight? User said "weight/pack e.g 6g" for primary.
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }), // Reference price

  // Master Container Specifics
  associatedStickerId: text("associated_sticker_id").references(
    (): any => packagingMaterials.id,
  ),
  stickerCost: decimal("sticker_cost", { precision: 10, scale: 2 }).default(
    "0",
  ),

  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).default(
    "0",
  ),
  minimumStockLevel: integer("minimum_stock_level").default(0),
  lastSupplierId: text("last_supplier_id").references(() => suppliers.id),
  ...timestamps,
});

// --- MATERIAL STOCK ---
export const materialStock = pgTable(
  "material_stock",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    chemicalId: text("chemical_id").references(() => chemicals.id),
    packagingMaterialId: text("packaging_material_id").references(
      () => packagingMaterials.id,
    ),
    quantity: decimal("quantity", { precision: 12, scale: 3 })
      .notNull()
      .default("0"),
    ...timestamps,
  },
  (t) => ({
    warehouseIdx: index("stock_warehouse_idx").on(t.warehouseId),
  }),
);

// --- PRODUCTS ---
export const products = pgTable("products", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // "liquid_detergent", "powder_detergent", "fabric_softener"
  ...timestamps,
});

// --- RECIPES (Core of Production) ---
export const recipes = pgTable("recipes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  name: text("name").notNull(), // e.g., "1L Dishwash Liquid - Premium Formula"

  // Batch Configuration
  batchSize: decimal("batch_size", {
    precision: 10,
    scale: 2,
  }).notNull(), // e.g., 600
  batchUnit: text("batch_unit").notNull().default("liters"), // "kg" | "liters"

  // Production Target
  targetUnitsPerBatch: integer("target_units_per_batch").notNull().default(0), // Target number of containers per batch

  // Packaging Configuration
  containerType: text("container_type").notNull(), // "pack" | "bag"
  containerPackagingId: text("container_packaging_id")
    .notNull()
    .references(() => packagingMaterials.id), // The bottle/sachet/bag to use

  // Container fill specifications
  fillAmount: decimal("fill_amount", { precision: 10, scale: 3 }), // e.g., 450 (for 450ml in a 500ml bottle)
  fillUnit: text("fill_unit"), // "ml", "g", etc.

  containersPerCarton: integer("containers_per_carton").default(0), // 0 means no carton packaging
  cartonPackagingId: text("carton_packaging_id").references(
    () => packagingMaterials.id,
  ), // The carton to use (optional)

  // Calculated fields (computed from ingredients and packaging)
  estimatedCostPerBatch: decimal("estimated_cost_per_batch", {
    precision: 12,
    scale: 2,
  }),
  estimatedCostPerContainer: decimal("estimated_cost_per_container", {
    precision: 10,
    scale: 4,
  }),
  estimatedIngredientsCost: decimal("estimated_ingredients_cost", {
    precision: 12,
    scale: 2,
  }),
  estimatedPackagingCost: decimal("estimated_packaging_cost", {
    precision: 12,
    scale: 2,
  }),

  // Quality control
  minBatchYield: decimal("min_batch_yield", { precision: 5, scale: 2 }), // Minimum acceptable yield %
  targetShelfLife: integer("target_shelf_life"), // Days

  // Inventory
  minimumStockLevel: integer("minimum_stock_level").default(0),

  // Production notes
  notes: text("notes"),
  productionInstructions: text("production_instructions"),

  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

// --- RECIPE INGREDIENTS (BOM for Chemicals) ---
export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    chemicalId: text("chemical_id")
      .notNull()
      .references(() => chemicals.id),
    quantityPerBatch: decimal("quantity_per_batch", {
      precision: 10,
      scale: 3,
    }).notNull(), // e.g., 150.5 kg for 600L batch
    ...timestamps,
  },
  (t) => ({
    recipeIdx: index("ingredients_recipe_idx").on(t.recipeId),
  }),
);

// --- RECIPE ADDITIONAL PACKAGING (Caps, Stickers, etc.) ---
export const recipePackaging = pgTable(
  "recipe_packaging",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    packagingMaterialId: text("packaging_material_id")
      .notNull()
      .references(() => packagingMaterials.id),
    // Support fractional quantities (e.g., 1.5 caps per bottle)
    quantityPerContainer: decimal("quantity_per_container", {
      precision: 10,
      scale: 6,
    }).notNull(), // e.g., 1 cap per bottle, 0.04175 stickers per unit
    // Optional flag for flexible configurations
    isOptional: boolean("is_optional").default(false),
    ...timestamps,
  },
  (t) => ({
    recipeIdx: index("packaging_recipe_idx").on(t.recipeId),
  }),
);

// --- FINISHED GOODS STOCK ---
export const finishedGoodsStock = pgTable(
  "finished_goods_stock",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    quantityCartons: integer("quantity_cartons").notNull().default(0),
    quantityContainers: integer("quantity_containers").notNull().default(0), // Loose units
    weightedAverageCostPerPack: decimal("weighted_average_cost_per_pack", {
      precision: 10,
      scale: 4,
    }).default("0"),
    weightedAverageCostPerCarton: decimal("weighted_average_cost_per_carton", {
      precision: 12,
      scale: 4,
    }).default("0"),
    totalInventoryValue: decimal("total_inventory_value", {
      precision: 14,
      scale: 2,
    }).default("0"),
    ...timestamps,
  },
  (t) => ({
    warehouseRecipeIdx: index("fg_warehouse_recipe_idx").on(
      t.warehouseId,
      t.recipeId,
    ),
  }),
);

// --- PRODUCTION RUNS ---
export const productionRuns = pgTable(
  "production_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    batchId: text("batch_id").notNull().unique(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id), // Where materials sourced from
    operatorId: text("operator_id")
      .notNull()
      .references(() => user.id),
    initiatorId: text("initiator_id")
      .references(() => user.id),

    // Production Output
    batchesProduced: integer("batches_produced").notNull(), // Number of batches
    cartonsProduced: integer("cartons_produced").default(0),
    containersProduced: integer("containers_produced").notNull(),
    completedUnits: integer("completed_units").default(0), // Track incremental progress
    looseUnitsProduced: integer("loose_units_produced").default(0), // Containers not in cartons

    // Planned output (set at creation, never overwritten)
    plannedCartonsProduced: integer("planned_cartons_produced").default(0),

    // Actual output (set at completion)
    actualCartonsProduced: integer("actual_cartons_produced").default(0),
    actualPacksProduced: integer("actual_packs_produced").default(0),
    actualLooseUnitsProduced: integer("actual_loose_units_produced").default(0),

    // Costing
    totalChemicalCost: decimal("total_chemical_cost", {
      precision: 12,
      scale: 2,
    }).default("0"),
    totalPackagingCost: decimal("total_packaging_cost", {
      precision: 12,
      scale: 2,
    }).default("0"),
    totalProductionCost: decimal("total_production_cost", {
      precision: 12,
      scale: 2,
    }).default("0"), // Sum of chemical + packaging
    costPerContainer: decimal("cost_per_container", {
      precision: 10,
      scale: 4,
    }).default("0"), // Budget/standard cost from recipe estimate

    // Actual costing (set at completion from real production data)
    actualCostPerPack: decimal("actual_cost_per_pack", {
      precision: 10,
      scale: 4,
    }).default("0"),
    actualCostPerCarton: decimal("actual_cost_per_carton", {
      precision: 10,
      scale: 4,
    }).default("0"),

    // Variance / Shortfall Tracking
    shortfallUnits: integer("shortfall_units").default(0),
    shortfallReason: text("shortfall_reason"),
    yieldVarianceCartons: integer("yield_variance_cartons").default(0),

    // Status & Scheduling
    status: text("status").notNull().default("scheduled"), // "scheduled", "in_progress", "completed", "cancelled", "failed"
    scheduledStartDate: timestamp("scheduled_start_date"),
    actualStartDate: timestamp("actual_start_date"),
    actualCompletionDate: timestamp("actual_completion_date"),

    // Batch close / reopen tracking (Scenarios 9 & 10)
    closedBy: text("closed_by").references(() => user.id),
    reopenedAt: timestamp("reopened_at"),
    reopenedBy: text("reopened_by").references(() => user.id),
    reopenReason: text("reopen_reason"),

    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    updatedAtIndex: index("production_runs_updated_at_idx").on(table.updatedAt),
  }),
);

// --- PRODUCTION RUN MATERIALS USED (Audit) ---
export const productionMaterialsUsed = pgTable("production_materials_used", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  productionRunId: text("production_run_id")
    .notNull()
    .references(() => productionRuns.id, { onDelete: "cascade" }),
  materialType: text("material_type").notNull(), // "chemical" | "packaging"
  materialId: text("material_id").notNull(),
  quantityUsed: decimal("quantity_used", { precision: 12, scale: 3 }).notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  ...timestamps,
});

// --- STOCK TRANSFERS ---
export const stockTransfers = pgTable("stock_transfers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  fromWarehouseId: text("from_warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  toWarehouseId: text("to_warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  materialType: text("material_type").notNull(), // "chemical", "packaging", "finished"
  materialId: text("material_id").notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  performedById: text("performed_by_id")
    .notNull()
    .references(() => user.id),
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
  ...timestamps,
});

// --- INVENTORY AUDIT LOG ---
export const inventoryAuditLog = pgTable(
  "inventory_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    materialType: text("material_type").notNull(),
    materialId: text("material_id").notNull(),
    type: text("type").notNull(), // "credit" | "debit"
    amount: decimal("amount", { precision: 12, scale: 3 }).notNull(),
    reason: text("reason").notNull(),
    performedById: text("performed_by_id")
      .notNull()
      .references(() => user.id),
    referenceId: text("reference_id"),
    ...timestamps,
  },
  (t) => ({
    warehouseIdx: index("audit_warehouse_idx").on(t.warehouseId),
    dateIdx: index("audit_date_idx").on(t.createdAt),
  }),
);

// --- CHEMICAL LAB REPORTS (Certificate of Analysis) ---
export const chemicalLabReports = pgTable(
  "chemical_lab_reports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    chemicalId: text("chemical_id")
      .notNull()
      .references(() => chemicals.id, { onDelete: "cascade" }),

    // Certificate Details
    productName: text("product_name").notNull(),
    stockNumber: text("stock_number"),
    lotNumber: text("lot_number"),

    // Analysis items as JSONB array
    // [{item: "Appearance", requirement: "Liquid", result: "Accept", passed: true}]
    analysisItems: jsonb("analysis_items")
      .notNull()
      .$type<
        Array<{
          item: string;
          requirement: string;
          result: string;
          passed: boolean;
        }>
      >(),

    // Certification
    certifiedBy: text("certified_by").notNull(),
    certifierTitle: text("certifier_title"),
    reportDate: timestamp("report_date").notNull(),

    // Standard reference
    standardReference: text("standard_reference"), // e.g., "ISO 9001:2015"

    notes: text("notes"),

    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    ...timestamps,
  },
  (t) => ({
    chemicalIdx: index("lab_report_chemical_idx").on(t.chemicalId),
    dateIdx: index("lab_report_date_idx").on(t.reportDate),
  }),
);

// --- RELATIONS ---
export const warehousesRelations = relations(warehouses, ({ many }) => ({
  materialStock: many(materialStock),
  finishedGoodsStock: many(finishedGoodsStock),
  productionRuns: many(productionRuns),
}));

export const chemicalsRelations = relations(chemicals, ({ many, one }) => ({
  stock: many(materialStock),
  recipeIngredients: many(recipeIngredients),
  labReports: many(chemicalLabReports),
  lastSupplier: one(suppliers, {
    fields: [chemicals.lastSupplierId],
    references: [suppliers.id],
  }),
}));

export const chemicalLabReportsRelations = relations(
  chemicalLabReports,
  ({ one }) => ({
    chemical: one(chemicals, {
      fields: [chemicalLabReports.chemicalId],
      references: [chemicals.id],
    }),
    createdBy: one(user, {
      fields: [chemicalLabReports.createdById],
      references: [user.id],
    }),
  }),
);

export const packagingMaterialsRelations = relations(
  packagingMaterials,
  ({ many, one }) => ({
    stock: many(materialStock),
    recipesAsContainer: many(recipes, { relationName: "containerPackaging" }),
    recipesAsCarton: many(recipes, { relationName: "cartonPackaging" }),
    recipePackaging: many(recipePackaging),
    lastSupplier: one(suppliers, {
      fields: [packagingMaterials.lastSupplierId],
      references: [suppliers.id],
    }),
  }),
);

export const productsRelations = relations(products, ({ many }) => ({
  recipes: many(recipes),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  product: one(products, {
    fields: [recipes.productId],
    references: [products.id],
  }),
  containerPackaging: one(packagingMaterials, {
    fields: [recipes.containerPackagingId],
    references: [packagingMaterials.id],
    relationName: "containerPackaging",
  }),
  cartonPackaging: one(packagingMaterials, {
    fields: [recipes.cartonPackagingId],
    references: [packagingMaterials.id],
    relationName: "cartonPackaging",
  }),
  ingredients: many(recipeIngredients),
  packaging: many(recipePackaging),
  productionRuns: many(productionRuns),
  finishedGoods: many(finishedGoodsStock),
}));

export const recipeIngredientsRelations = relations(
  recipeIngredients,
  ({ one }) => ({
    recipe: one(recipes, {
      fields: [recipeIngredients.recipeId],
      references: [recipes.id],
    }),
    chemical: one(chemicals, {
      fields: [recipeIngredients.chemicalId],
      references: [chemicals.id],
    }),
  }),
);

export const recipePackagingRelations = relations(
  recipePackaging,
  ({ one }) => ({
    recipe: one(recipes, {
      fields: [recipePackaging.recipeId],
      references: [recipes.id],
    }),
    packagingMaterial: one(packagingMaterials, {
      fields: [recipePackaging.packagingMaterialId],
      references: [packagingMaterials.id],
    }),
  }),
);

export const productionRunsRelations = relations(
  productionRuns,
  ({ one, many }) => ({
    recipe: one(recipes, {
      fields: [productionRuns.recipeId],
      references: [recipes.id],
    }),
    warehouse: one(warehouses, {
      fields: [productionRuns.warehouseId],
      references: [warehouses.id],
    }),
    operator: one(user, {
      fields: [productionRuns.operatorId],
      references: [user.id],
      relationName: "operator",
    }),
    initiator: one(user, {
      fields: [productionRuns.initiatorId],
      references: [user.id],
      relationName: "initiator",
    }),
    closedByUser: one(user, {
      fields: [productionRuns.closedBy],
      references: [user.id],
      relationName: "productionClosedBy",
    }),
    reopenedByUser: one(user, {
      fields: [productionRuns.reopenedBy],
      references: [user.id],
      relationName: "productionReopenedBy",
    }),
    materialsUsed: many(productionMaterialsUsed),
  }),
);

export const materialStockRelations = relations(materialStock, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [materialStock.warehouseId],
    references: [warehouses.id],
  }),
  chemical: one(chemicals, {
    fields: [materialStock.chemicalId],
    references: [chemicals.id],
  }),
  packagingMaterial: one(packagingMaterials, {
    fields: [materialStock.packagingMaterialId],
    references: [packagingMaterials.id],
  }),
}));

export const finishedGoodsStockRelations = relations(
  finishedGoodsStock,
  ({ one }) => ({
    warehouse: one(warehouses, {
      fields: [finishedGoodsStock.warehouseId],
      references: [warehouses.id],
    }),
    recipe: one(recipes, {
      fields: [finishedGoodsStock.recipeId],
      references: [recipes.id],
    }),
  }),
);

export const productionMaterialsUsedRelations = relations(
  productionMaterialsUsed,
  ({ one }) => ({
    productionRun: one(productionRuns, {
      fields: [productionMaterialsUsed.productionRunId],
      references: [productionRuns.id],
    }),
    chemical: one(chemicals, {
      fields: [productionMaterialsUsed.materialId],
      references: [chemicals.id],
    }),
    packagingMaterial: one(packagingMaterials, {
      fields: [productionMaterialsUsed.materialId],
      references: [packagingMaterials.id],
    }),
  }),
);

export const stockTransfersRelations = relations(stockTransfers, ({ one }) => ({
  fromWarehouse: one(warehouses, {
    fields: [stockTransfers.fromWarehouseId],
    references: [warehouses.id],
  }),
  toWarehouse: one(warehouses, {
    fields: [stockTransfers.toWarehouseId],
    references: [warehouses.id],
  }),
  performedBy: one(user, {
    fields: [stockTransfers.performedById],
    references: [user.id],
  }),
}));

export const inventoryAuditLogRelations = relations(
  inventoryAuditLog,
  ({ one }) => ({
    warehouse: one(warehouses, {
      fields: [inventoryAuditLog.warehouseId],
      references: [warehouses.id],
    }),
    performedBy: one(user, {
      fields: [inventoryAuditLog.performedById],
      references: [user.id],
    }),
  }),
);
