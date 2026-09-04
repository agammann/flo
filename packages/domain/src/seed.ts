import type {
  Asset,
  FloState,
  Customer,
  InventoryItem,
  Part,
  Supplier,
  SupplierPart,
  WorkOrder
} from "./schemas.js";
import type { Actor } from "@flo/shared-types";

const iso = (date: Date): string => date.toISOString();
const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export interface DemoDates {
  today: string;
  tomorrow: string;
  nextWeek: string;
  tomorrowMorningStart: string;
  tomorrowMorningEnd: string;
}

export const createDemoDates = (now = new Date()): DemoDates => {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = addDays(todayStart, 1);
  const tomorrowMorningStart = new Date(tomorrowStart);
  tomorrowMorningStart.setUTCHours(16, 0, 0, 0);
  const tomorrowMorningEnd = new Date(tomorrowMorningStart);
  tomorrowMorningEnd.setUTCHours(18, 0, 0, 0);

  return {
    today: dateOnly(todayStart),
    tomorrow: dateOnly(tomorrowStart),
    nextWeek: dateOnly(addDays(todayStart, 7)),
    tomorrowMorningStart: iso(tomorrowMorningStart),
    tomorrowMorningEnd: iso(tomorrowMorningEnd)
  };
};

const customers: Customer[] = [
  {
    id: "customer-001",
    name: "Jordan Lee",
    phone: "+1-555-010-1842",
    email: "jordan.lee@example.test",
    preferredContactMethod: "sms",
    approvalPreferences: { autoApproveBelowCents: null, requireWrittenApproval: true }
  },
  ...Array.from({ length: 15 }, (_, index): Customer => ({
    id: `customer-${String(index + 2).padStart(3, "0")}`,
    name: `Demo Customer ${index + 2}`,
    phone: `+1-555-020-${String(index + 2).padStart(4, "0")}`,
    email: `customer${index + 2}@example.test`,
    preferredContactMethod: index % 2 === 0 ? "email" : "sms",
    approvalPreferences: { autoApproveBelowCents: null, requireWrittenApproval: true }
  }))
];

const assets: Asset[] = [
  {
    id: "asset-f150-2019",
    type: "vehicle",
    year: 2019,
    make: "Ford",
    model: "F-150",
    trim: "XLT",
    vin: "1FTFW1E50KFA01842",
    engine: "5.0L V8",
    mileage: 87420,
    customerId: "customer-001",
    attributes: { drivetrain: "4WD", fuel: "gasoline" }
  },
  ...Array.from({ length: 15 }, (_, index): Asset => ({
    id: `asset-demo-${index + 2}`,
    type: "vehicle",
    year: 2017 + (index % 8),
    make: ["Toyota", "Honda", "Chevrolet", "Ford", "Subaru"][index % 5] ?? "Demo",
    model: ["Camry", "CR-V", "Silverado", "Transit", "Outback"][index % 5] ?? "Vehicle",
    trim: "Demo",
    vin: `DEMO000000000${String(index + 2).padStart(3, "0")}`,
    engine: index % 2 === 0 ? "2.5L I4" : "3.5L V6",
    mileage: 30000 + index * 4200,
    customerId: `customer-${String(index + 2).padStart(3, "0")}`,
    attributes: { fuel: "gasoline" }
  }))
];

const parts: Part[] = [
  {
    id: "part-alt-oem-289",
    partNumber: "ALT-OE-9019",
    brand: "MotorCrafted",
    description: "OEM-style 220A alternator",
    category: "alternator",
    compatibilityRules: [{ years: [2018, 2019, 2020], makes: ["Ford"], models: ["F-150"], engines: ["5.0L V8"] }],
    warrantyMonths: 36,
    qualityTier: "oem"
  },
  {
    id: "part-alt-premium-219",
    partNumber: "ALT-7842",
    brand: "VoltEdge",
    description: "Premium new 220A alternator",
    category: "alternator",
    compatibilityRules: [{ years: [2019], makes: ["Ford"], models: ["F-150"], trims: ["XLT", "Lariat"], engines: ["5.0L V8"] }],
    warrantyMonths: 36,
    qualityTier: "premium"
  },
  {
    id: "part-alt-budget-159",
    partNumber: "ALT-RM-5410",
    brand: "ReGen",
    description: "Remanufactured 220A alternator",
    category: "alternator",
    compatibilityRules: [{ years: [2015, 2016, 2017, 2018, 2019, 2020], makes: ["Ford"], models: ["F-150"], engines: ["5.0L V8"] }],
    warrantyMonths: 12,
    qualityTier: "budget"
  },
  {
    id: "part-alt-incompatible",
    partNumber: "ALT-GM-220",
    brand: "RoadCurrent",
    description: "Alternator for Chevrolet 5.3L",
    category: "alternator",
    compatibilityRules: [{ years: [2019], makes: ["Chevrolet"], models: ["Silverado"], engines: ["5.3L V8"] }],
    warrantyMonths: 24,
    qualityTier: "standard"
  }
];

const suppliers: Supplier[] = [
  { id: "supplier-a", name: "ValueLine Parts", reliabilityScore: 0.88, description: "Lower pricing with slower delivery and limited warranty." },
  { id: "supplier-b", name: "ProMotion Supply", reliabilityScore: 0.97, description: "Balanced price, next-day delivery, and strong warranty." },
  { id: "supplier-c", name: "Premier Auto Source", reliabilityScore: 0.99, description: "Premium inventory with same-day fulfillment at a higher price." }
];

const makeWorkOrders = (createdAt: string): WorkOrder[] => [
  {
    id: "wo-1842",
    workOrderNumber: "1842",
    customerId: "customer-001",
    assetId: "asset-f150-2019",
    status: "diagnosis",
    priority: "high",
    complaint: "Battery warning light and intermittent no start",
    diagnosis: "",
    recommendedWork: [],
    assignedTechnicianId: "tech-demo",
    estimateId: null,
    scheduledStart: null,
    scheduledEnd: null,
    bayId: null,
    notes: [],
    createdAt,
    updatedAt: createdAt
  },
  ...Array.from({ length: 15 }, (_, index): WorkOrder => ({
    id: `wo-${1843 + index}`,
    workOrderNumber: String(1843 + index),
    customerId: `customer-${String(index + 2).padStart(3, "0")}`,
    assetId: `asset-demo-${index + 2}`,
    status: index % 4 === 0 ? "awaiting_approval" : index % 4 === 1 ? "scheduled" : index % 4 === 2 ? "diagnosis" : "in_progress",
    priority: index % 5 === 0 ? "high" : "normal",
    complaint: ["Brake noise", "Scheduled maintenance", "Cooling concern", "Electrical fault"][index % 4] ?? "Inspection",
    diagnosis: index % 3 === 0 ? "Inspection in progress" : "",
    recommendedWork: [],
    assignedTechnicianId: index % 3 === 0 ? "tech-demo" : `tech-${(index % 3) + 1}`,
    estimateId: null,
    scheduledStart: null,
    scheduledEnd: null,
    bayId: null,
    notes: [],
    createdAt,
    updatedAt: createdAt
  }))
];

export const createDemoState = (now = new Date()): FloState => {
  const dates = createDemoDates(now);
  const createdAt = iso(now);
  const supplierParts: SupplierPart[] = [
    { supplierId: "supplier-a", partId: "part-alt-budget-159", supplierSku: "VL-ALT-5410", priceCents: 15900, inventory: 6, deliveryDate: dates.today, warrantyMonths: 12, shippingCostCents: 1200 },
    { supplierId: "supplier-a", partId: "part-alt-incompatible", supplierSku: "VL-ALT-GM220", priceCents: 14200, inventory: 4, deliveryDate: dates.tomorrow, warrantyMonths: 12, shippingCostCents: 900 },
    { supplierId: "supplier-b", partId: "part-alt-premium-219", supplierSku: "PM-ALT-7842", priceCents: 21900, inventory: 8, deliveryDate: dates.tomorrow, warrantyMonths: 36, shippingCostCents: 0 },
    { supplierId: "supplier-c", partId: "part-alt-oem-289", supplierSku: "PA-OE-9019", priceCents: 28900, inventory: 3, deliveryDate: dates.tomorrow, warrantyMonths: 36, shippingCostCents: 0 },
    { supplierId: "supplier-c", partId: "part-alt-premium-219", supplierSku: "PA-ALT-7842", priceCents: 24900, inventory: 2, deliveryDate: dates.today, warrantyMonths: 36, shippingCostCents: 1500 }
  ];
  const inventory: InventoryItem[] = parts.map((part, index) => ({
    id: `inventory-${part.id}`,
    partId: part.id,
    quantityOnHand: index === 2 ? 1 : 0,
    quantityReserved: 0,
    location: index === 2 ? "Aisle A / Bin 4" : "Unstocked",
    updatedAt: createdAt
  }));

  return {
    workOrders: makeWorkOrders(createdAt),
    assets: structuredClone(assets),
    customers: structuredClone(customers),
    diagnostics: [],
    parts: structuredClone(parts),
    suppliers: structuredClone(suppliers),
    supplierParts,
    inventory,
    estimates: [],
    approvals: [],
    purchaseOrders: [],
    schedule: [
      {
        id: "slot-existing-bay-1",
        bayId: "bay-1",
        start: dates.tomorrowMorningStart,
        end: dates.tomorrowMorningEnd,
        workOrderId: "wo-1845",
        technicianId: "tech-2"
      }
    ],
    auditLogs: [],
    contextMemories: [],
    pendingActions: []
  };
};

export const demoActors: Record<"technician" | "serviceAdvisor" | "manager" | "administrator", Actor> = {
  technician: {
    id: "tech-demo",
    displayName: "Demo Technician",
    role: "technician",
    assignedWorkOrderIds: ["wo-1842", "wo-1843", "wo-1846", "wo-1849", "wo-1852", "wo-1855"]
  },
  serviceAdvisor: {
    id: "advisor-demo",
    displayName: "Demo Service Advisor",
    role: "service_advisor",
    assignedWorkOrderIds: []
  },
  manager: {
    id: "manager-demo",
    displayName: "Demo Manager",
    role: "manager",
    assignedWorkOrderIds: []
  },
  administrator: {
    id: "admin-demo",
    displayName: "Demo Administrator",
    role: "administrator",
    assignedWorkOrderIds: []
  }
};
