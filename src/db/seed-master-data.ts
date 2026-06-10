import { db } from "./index";
import { suppliers } from "./schemas/core-suppliers";
import { chemicals, packagingMaterials } from "./schemas/inventory-schema";
import { wallets } from "./schemas/finance-schema";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Master Data Seed — Suppliers, Chemicals, Packaging Materials, Wallets
// Idempotent: skips records that already exist (matched by name).
// ---------------------------------------------------------------------------

async function seedMasterData() {
  console.log("🌱 Seeding master data...");

  // ── 1. Wallets (Financial Accounts) ───────────────────────────────────────
  // NOTE: wallets.id has NO default — we must generate it manually.
  console.log("Seeding wallets...");
  const walletSeed = [
    { id: createId(), name: "Cash Drawer", type: "cash" as const, balance: "50000" },
    { id: createId(), name: "HBL Business Account", type: "bank" as const, balance: "250000" },
    { id: createId(), name: "MCB Current Account", type: "bank" as const, balance: "100000" },
  ];

  for (const w of walletSeed) {
    const existing = await db.query.wallets.findFirst({
      where: eq(wallets.name, w.name),
    });
    if (existing) {
      console.log(`  ⏭️  Wallet already exists: ${w.name}`);
      continue;
    }
    await db.insert(wallets).values(w);
    console.log(`  ✅ Wallet created: ${w.name} (${w.type}) — PKR ${w.balance}`);
  }

  // ── 2. Suppliers ──────────────────────────────────────────────────────────
  console.log("Seeding suppliers...");
  const supplierSeed = [
    {
      supplierName: "ChemSource Pakistan",
      supplierShopName: "ChemSource Traders",
      email: "info@chemsource.pk",
      phone: "0300-1112233",
      nationalId: "35201-1234567-8",
      address: "Plot 45, Industrial Area",
      city: "Lahore",
      state: "Punjab",
      notes: "Primary supplier for surfactants and specialty chemicals",
    },
    {
      supplierName: "PakPack Solutions",
      supplierShopName: "PakPack Plaza",
      email: "sales@pakpack.pk",
      phone: "0312-4455667",
      nationalId: "42101-2345678-9",
      address: "Sector 7-A, Korangi Industrial Area",
      city: "Karachi",
      state: "Sindh",
      notes: "Bottles, cartons, caps, and shrink-wrap films",
    },
    {
      supplierName: "Alpha Chemicals Ltd",
      supplierShopName: "Alpha Chemical House",
      email: "orders@alphachem.pk",
      phone: "0333-8899001",
      nationalId: "35401-3456789-0",
      address: "G.T. Road, Near Dry Port",
      city: "Gujranwala",
      state: "Punjab",
      notes: "Acids, solvents, and industrial salts",
    },
    {
      supplierName: "Global Packaging Inc",
      supplierShopName: "Global Packaging Hub",
      email: "contact@globalpack.pk",
      phone: "0301-2233445",
      nationalId: "35202-4567890-1",
      address: "Sundar Industrial Estate, Raiwind Road",
      city: "Lahore",
      state: "Punjab",
      notes: "Bulk master cartons and pallet packaging",
    },
  ];

  const insertedSuppliers: (typeof suppliers.$inferSelect)[] = [];
  for (const s of supplierSeed) {
    const existing = await db.query.suppliers.findFirst({
      where: eq(suppliers.supplierName, s.supplierName),
    });
    if (existing) {
      insertedSuppliers.push(existing);
      console.log(`  ⏭️  Supplier already exists: ${s.supplierName}`);
      continue;
    }
    const [inserted] = await db.insert(suppliers).values(s).returning();
    insertedSuppliers.push(inserted);
    console.log(`  ✅ Supplier created: ${s.supplierName}`);
  }

  // Helper to safely grab a supplier id by index
  const supplierId = (idx: number) => insertedSuppliers[idx]?.id ?? null;

  // ── 3. Chemicals ──────────────────────────────────────────────────────────
  console.log("Seeding chemicals...");
  const chemicalSeed = [
    {
      name: "Linear Alkyl Benzene Sulphonic Acid (LABSA)",
      unit: "kg",
      costPerUnit: "185.50",
      minimumStockLevel: "500",
      packagingType: "Drum",
      packagingSize: "200kg",
      lastSupplierId: supplierId(0),
    },
    {
      name: "Sodium Hydroxide (Caustic Soda)",
      unit: "kg",
      costPerUnit: "95.00",
      minimumStockLevel: "300",
      packagingType: "Bag",
      packagingSize: "50kg",
      lastSupplierId: supplierId(2),
    },
    {
      name: "Sodium Laureth Sulfate (SLES 70%)",
      unit: "kg",
      costPerUnit: "210.00",
      minimumStockLevel: "400",
      packagingType: "Drum",
      packagingSize: "170kg",
      lastSupplierId: supplierId(0),
    },
    {
      name: "Coco Diethanolamide (CDEA)",
      unit: "kg",
      costPerUnit: "320.00",
      minimumStockLevel: "200",
      packagingType: "Drum",
      packagingSize: "200kg",
      lastSupplierId: supplierId(0),
    },
    {
      name: "Ethylene Glycol",
      unit: "liters",
      costPerUnit: "145.00",
      minimumStockLevel: "150",
      packagingType: "Can",
      packagingSize: "20L",
      lastSupplierId: supplierId(2),
    },
    {
      name: "Fragrance (Lemon Fresh)",
      unit: "liters",
      costPerUnit: "850.00",
      minimumStockLevel: "50",
      packagingType: "Can",
      packagingSize: "10L",
      lastSupplierId: supplierId(0),
    },
    {
      name: "Colorant (Liquid Blue)",
      unit: "kg",
      costPerUnit: "1200.00",
      minimumStockLevel: "25",
      packagingType: "Jar",
      packagingSize: "5kg",
      lastSupplierId: supplierId(2),
    },
    {
      name: "Salt (Sodium Chloride)",
      unit: "kg",
      costPerUnit: "18.00",
      minimumStockLevel: "1000",
      packagingType: "Bag",
      packagingSize: "50kg",
      lastSupplierId: supplierId(2),
    },
  ];

  for (const c of chemicalSeed) {
    const existing = await db.query.chemicals.findFirst({
      where: eq(chemicals.name, c.name),
    });
    if (existing) {
      console.log(`  ⏭️  Chemical already exists: ${c.name}`);
      continue;
    }
    await db.insert(chemicals).values(c);
    console.log(`  ✅ Chemical created: ${c.name}`);
  }

  // ── 4. Packaging Materials ────────────────────────────────────────────────
  console.log("Seeding packaging materials...");
  const packagingSeed = [
    {
      name: "500ml PET Bottle",
      type: "primary" as const,
      capacity: "500",
      capacityUnit: "ml",
      weightPerPack: "25.000",
      costPerUnit: "12.50",
      minimumStockLevel: 5000,
      lastSupplierId: supplierId(1),
    },
    {
      name: "1000ml PET Bottle",
      type: "primary" as const,
      capacity: "1000",
      capacityUnit: "ml",
      weightPerPack: "38.000",
      costPerUnit: "18.00",
      minimumStockLevel: 3000,
      lastSupplierId: supplierId(1),
    },
    {
      name: "5L Jerry Can",
      type: "primary" as const,
      capacity: "5000",
      capacityUnit: "ml",
      weightPerPack: "120.000",
      costPerUnit: "45.00",
      minimumStockLevel: 1000,
      lastSupplierId: supplierId(1),
    },
    {
      name: "Bottle Cap (28mm)",
      type: "extra" as const,
      weightPerPack: "3.500",
      costPerUnit: "2.00",
      minimumStockLevel: 10000,
      lastSupplierId: supplierId(1),
    },
    {
      name: "Product Label (500ml)",
      type: "extra" as const,
      costPerUnit: "1.50",
      minimumStockLevel: 5000,
      lastSupplierId: supplierId(1),
    },
    {
      name: "Product Label (1L)",
      type: "extra" as const,
      costPerUnit: "1.80",
      minimumStockLevel: 3000,
      lastSupplierId: supplierId(1),
    },
    {
      name: "Carton (24x500ml)",
      type: "master" as const,
      capacity: "24",
      capacityUnit: "units",
      costPerUnit: "15.00",
      minimumStockLevel: 500,
      lastSupplierId: supplierId(3),
    },
    {
      name: "Carton (12x1L)",
      type: "master" as const,
      capacity: "12",
      capacityUnit: "units",
      costPerUnit: "12.00",
      minimumStockLevel: 400,
      lastSupplierId: supplierId(3),
    },
    {
      name: "Shrink Wrap Film (per kg)",
      type: "extra" as const,
      costPerUnit: "5.00",
      minimumStockLevel: 200,
      lastSupplierId: supplierId(3),
    },
    {
      name: "Sachet (30ml) — Laminates",
      type: "primary" as const,
      capacity: "30",
      capacityUnit: "ml",
      weightPerPack: "1.500",
      costPerUnit: "0.80",
      minimumStockLevel: 20000,
      lastSupplierId: supplierId(1),
    },
  ];

  for (const p of packagingSeed) {
    const existing = await db.query.packagingMaterials.findFirst({
      where: eq(packagingMaterials.name, p.name),
    });
    if (existing) {
      console.log(`  ⏭️  Packaging material already exists: ${p.name}`);
      continue;
    }
    await db.insert(packagingMaterials).values(p);
    console.log(`  ✅ Packaging material created: ${p.name}`);
  }

  console.log("✅ Master data seeding completed!");
  process.exit(0);
}

seedMasterData().catch((err) => {
  console.error("❌ Master data seeding failed:", err);
  process.exit(1);
});
