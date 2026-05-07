import type { TaskType } from "./constants";

export const CHECKLIST_PRESETS: Record<TaskType, string[]> = {
  housekeeping: [
    "Beds & linen: change sheets and pillowcases; fold blankets",
    "Surfaces: vacuum floors, dust, clean bathrooms (green=surfaces, blue=glass, pink=toilets)",
    "Amenities: refill soap, paper, tissues; place clean towels",
    "Bins: empty, replace bags, open windows to ventilate",
  ],
  breakfast: [
    "Set tables (cutlery, napkins, jams, butter)",
    "Prepare hot drinks station (coffee, tea, milk)",
    "Lay out cereals, fruit, yoghurts, pastries",
    "Take guest orders for cooked items",
    "Clear and reset dining room when service ends",
  ],
  dinner: [
    "Set tables for service (glassware, cutlery, candles)",
    "Prepare bread baskets and water jugs",
    "Support kitchen with plating and running food",
    "Clear tables between courses",
    "Wash up and reset for breakfast",
  ],
  cottages: [
    "Strip beds and start laundry",
    "Clean bathrooms (green=surfaces, blue=glass, pink=toilets)",
    "Vacuum and mop all floors",
    "Restock kitchen basics (tea, coffee, sugar, milk)",
    "Make beds with fresh linen, place welcome note",
    "Lock up and return keys",
  ],
  maintenance: [
    "Check requested job and gather tools",
    "Take before photo if relevant",
    "Complete the repair safely",
    "Take after photo and log notes",
    "Return tools to workshop",
  ],
  laundry: [
    "Sort whites, colours and delicates",
    "Run washing machines",
    "Transfer to dryer / hang to dry",
    "Fold and store linen by category",
    "Restock cupboards in each room",
  ],
  special: [
    "Read the brief from the lead",
    "Confirm timing and location",
    "Complete the task",
    "Report back when done",
  ],
};
