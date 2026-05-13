// Standard Operating Procedures (SOPs) — phased checklists shown in the Guidebook.
// Each SOP follows the same shape as the Breakfast SOP so they all render with <SopView />.

export type SopCalloutVariant = "info" | "warn" | "time";

export type SopCallout = {
  kind: "callout";
  variant: SopCalloutVariant;
  title?: string;
  text: string;
};

export type SopRecipe = {
  kind: "recipe";
  title: string;
  steps: string[];
};

export type SopExtra = SopCallout | SopRecipe;

export type SopItem = { id: string; text: string };

export type SopPhase = {
  id: number;
  time: string;
  title: string;
  items: SopItem[];
  before?: SopExtra[]; // shown above the checklist
  after?: SopExtra[]; // shown below the checklist
};

export type Sop = {
  id: string;
  title: string;
  subtitle: string;
  icon: "coffee" | "broom" | "home" | "utensils" | "wrench" | "shirt" | "sparkles";
  phases: SopPhase[];
  /** Optional GitHub Pages (or other) URL with a richer interactive version of the SOP. */
  embedUrl?: string;
};

export const SOPS: Sop[] = [
  {
    id: "breakfast",
    title: "Breakfast SOP",
    subtitle: "Daily breakfast service checklist",
    icon: "coffee",
    embedUrl: "https://jorgeibanezhostack.github.io/sopbreakfasttorridonia/breakfast-sop-en.html",
    phases: [
      {
        id: 1,
        time: "7:00 - 8:00 AM",
        title: "Preparation phase",
        items: [
          { id: "1-1", text: "Be in kitchen at 7:00 AM" },
          { id: "1-2", text: "Prepare 10 small clay plates for tomato + mozzarella starter" },
          { id: "1-3", text: "Cut 3 cherry tomatoes in half per plate" },
          { id: "1-4", text: "Add 2 mozzarella slices per plate" },
          { id: "1-5", text: "Prepare 10 deeper clay plates for egg dishes" },
          { id: "1-6", text: "Assemble all 10 egg dishes following recipe" },
          { id: "1-7", text: "Prepare 2 large French presses (6 spoons coffee each)" },
          { id: "1-8", text: "Boil water using kettle and fill presses" },
        ],
        before: [
          {
            kind: "recipe",
            title: "Egg dish assembly (per plate)",
            steps: [
              "5 drops olive oil at bottom",
              "Layer of baby spinach from guest fridge",
              "4 cubes of feta cheese on top",
              "1 tablespoon chorizo spread around",
              "Pour beaten eggs (22–24 eggs total in jug for 10 plates)",
              "Sprinkle Italian seasoning to cover surface",
            ],
          },
        ],
        after: [
          {
            kind: "callout",
            variant: "warn",
            title: "Dietary adaptations",
            text: "Vegetarian = remove chorizo. Vegan = notify at check-in that breakfast is not adapted.",
          },
        ],
      },
      {
        id: 2,
        time: "8:00 - 9:00 AM",
        title: "Guest service",
        items: [
          { id: "2-1", text: "Listen for guests arriving in dining area" },
          { id: "2-2", text: "Greet guests and ask if they want coffee" },
          { id: "2-3", text: "Bring French press to table if yes" },
          { id: "2-4", text: "Point out sugar, cream, and tea at hot water station" },
          { id: "2-5", text: "Cook egg plates in batches (4 or 2 depending on guest flow)" },
          { id: "2-6", text: "Prepare white plates with starter + 1 bolillo + 1 sweet roll (or 2 toast slices)" },
          { id: "2-7", text: "Add cooked egg plate to each white plate" },
          { id: "2-8", text: "Deliver complete plates to guests" },
        ],
        after: [
          {
            kind: "recipe",
            title: "Microwave cooking process",
            steps: [
              "Standard batch (4 plates): 5 min max power → stir → 2 min more",
              "Quick batch (2 plates): 3 min max power → stir → 1 min more",
              "Eggs should puff up slightly when ready",
            ],
          },
          {
            kind: "callout",
            variant: "info",
            text: "Use 4-plate batches during peak service (8:15–8:45 AM). Use 2-plate batches for staggered arrivals or late guests.",
          },
        ],
      },
      {
        id: 3,
        time: "9:00 - 10:00 AM",
        title: "Kitchen recovery",
        items: [
          { id: "3-1", text: "Collect used plates with wooden tray" },
          { id: "3-2", text: "Transfer leftovers (milk, juice, coffee, unused prep) to volunteer kitchen" },
          { id: "3-3", text: "Bring all dishes to B&B kitchen" },
          { id: "3-4", text: "Turn on hot water tap and plug drain" },
          { id: "3-5", text: "Fill sink with hot water and dish soap" },
          { id: "3-6", text: "Wash all plates and utensils" },
        ],
        after: [
          {
            kind: "callout",
            variant: "time",
            text: "Complete dish washing by 10:00 AM so kitchen is free for volunteer shift start.",
          },
        ],
      },
      {
        id: 4,
        time: "After 10:00 AM",
        title: "Handover",
        items: [
          { id: "4-1", text: "Empty trash bins" },
          { id: "4-2", text: "Wipe down all surfaces and tables" },
          { id: "4-3", text: "Sweep/mop floor" },
          { id: "4-4", text: "Confirm kitchen is ready for volunteer use" },
        ],
      },
    ],
  },
  {
    id: "housekeeping",
    title: "Housekeeping SOP",
    subtitle: "Turning over guest rooms",
    icon: "broom",
    embedUrl: "https://jorgeibanezhostack.github.io/sopbreakfasttorridonia/housekeeping-sop-en.html",
    phases: [
      {
        id: 1,
        time: "Setup",
        title: "Prepare your trolley",
        items: [
          { id: "1-1", text: "Collect fresh linen set per room (sheets, duvet covers, pillowcases)" },
          { id: "1-2", text: "Stock cleaning caddy: green (surfaces), blue (glass), pink (toilet)" },
          { id: "1-3", text: "Grab vacuum, mop and bin bags" },
          { id: "1-4", text: "Bring amenities: soap, shampoo, tissues, toilet paper" },
        ],
        after: [
          {
            kind: "callout",
            variant: "info",
            title: "Colour code",
            text: "Green cloth = surfaces. Blue cloth = glass & mirrors. Pink cloth = toilets. Never mix.",
          },
        ],
      },
      {
        id: 2,
        time: "Strip & refresh",
        title: "Beds and linen",
        items: [
          { id: "2-1", text: "Strip beds, take linen straight to laundry" },
          { id: "2-2", text: "Check mattress and pillows for stains — report if found" },
          { id: "2-3", text: "Make beds with fresh sheets, hospital corners" },
          { id: "2-4", text: "Fold blanket at foot of bed, plump pillows" },
        ],
      },
      {
        id: 3,
        time: "Clean",
        title: "Bathroom and surfaces",
        items: [
          { id: "3-1", text: "Spray toilet with pink-cloth product, leave to act" },
          { id: "3-2", text: "Clean mirrors and glass with blue cloth" },
          { id: "3-3", text: "Wipe sink, taps and surfaces with green cloth" },
          { id: "3-4", text: "Scrub toilet inside and out with pink cloth" },
          { id: "3-5", text: "Dust all surfaces in the room" },
          { id: "3-6", text: "Vacuum floors, then mop hard floors" },
        ],
      },
      {
        id: 4,
        time: "Finish",
        title: "Restock and check",
        items: [
          { id: "4-1", text: "Refill soap, shampoo, toilet paper and tissues" },
          { id: "4-2", text: "Place clean towels folded on the bed" },
          { id: "4-3", text: "Empty bin, replace bag, open window 5 min to ventilate" },
          { id: "4-4", text: "Final walk-through — close window, lock door" },
        ],
        after: [
          {
            kind: "callout",
            variant: "warn",
            title: "Report immediately",
            text: "Stains, damage, lost property or anything unusual — message the room manager before leaving the room.",
          },
        ],
      },
    ],
  },
  {
    id: "cottages",
    title: "Cottages SOP",
    subtitle: "Full cottage turnover between guests",
    icon: "home",
    phases: [
      {
        id: 1,
        time: "Arrival",
        title: "Strip and start laundry",
        items: [
          { id: "1-1", text: "Open windows for ventilation" },
          { id: "1-2", text: "Strip all beds, gather towels" },
          { id: "1-3", text: "Start washing machine immediately" },
          { id: "1-4", text: "Check inventory list against what's in the cottage" },
        ],
      },
      {
        id: 2,
        time: "Deep clean",
        title: "Kitchen and bathrooms",
        items: [
          { id: "2-1", text: "Empty fridge, wipe inside and out" },
          { id: "2-2", text: "Clean oven, hob, microwave" },
          { id: "2-3", text: "Wash dishes left by guests, restock cupboard" },
          { id: "2-4", text: "Bathroom: pink → toilet, blue → glass, green → surfaces" },
          { id: "2-5", text: "Descale shower and taps if needed" },
        ],
      },
      {
        id: 3,
        time: "Living spaces",
        title: "Floors, dust, restock",
        items: [
          { id: "3-1", text: "Dust shelves, lamps and skirting" },
          { id: "3-2", text: "Vacuum all rooms, mop hard floors" },
          { id: "3-3", text: "Restock tea, coffee, sugar, milk, oil, salt, pepper" },
          { id: "3-4", text: "Refill firewood basket and check fire safety items" },
        ],
      },
      {
        id: 4,
        time: "Handover",
        title: "Make beds and close up",
        items: [
          { id: "4-1", text: "Make beds with fresh linen, hospital corners" },
          { id: "4-2", text: "Place welcome note and Wi-Fi card on the table" },
          { id: "4-3", text: "Final photo of the living room for records" },
          { id: "4-4", text: "Lock up, return keys to reception board" },
        ],
        after: [
          {
            kind: "callout",
            variant: "time",
            text: "Cottages must be ready by 15:00 for check-in.",
          },
        ],
      },
    ],
  },
  {
    id: "dinner",
    title: "Dinner SOP",
    subtitle: "Evening dining service",
    icon: "utensils",
    phases: [
      {
        id: 1,
        time: "From 17:00",
        title: "Set up dining room",
        items: [
          { id: "1-1", text: "Lay tables: cutlery, glassware, napkins, candles" },
          { id: "1-2", text: "Prepare bread baskets and water jugs" },
          { id: "1-3", text: "Check reservation list and dietary notes" },
        ],
      },
      {
        id: 2,
        time: "From 19:00",
        title: "Service",
        items: [
          { id: "2-1", text: "Greet guests, seat them, offer drinks" },
          { id: "2-2", text: "Run food from kitchen — confirm allergies at the pass" },
          { id: "2-3", text: "Clear plates between courses, crumb tables" },
          { id: "2-4", text: "Offer desserts and coffee" },
        ],
      },
      {
        id: 3,
        time: "From 21:30",
        title: "Close down",
        items: [
          { id: "3-1", text: "Clear and reset tables for breakfast" },
          { id: "3-2", text: "Wash up and put service ware away" },
          { id: "3-3", text: "Mop dining room floor, take out rubbish" },
          { id: "3-4", text: "Confirm with kitchen everything is closed and clean" },
        ],
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance SOP",
    subtitle: "Handling repair and upkeep jobs",
    icon: "wrench",
    phases: [
      {
        id: 1,
        time: "Before the job",
        title: "Prep",
        items: [
          { id: "1-1", text: "Read the job brief in the task" },
          { id: "1-2", text: "Take a 'before' photo of the issue" },
          { id: "1-3", text: "Gather tools and parts from the workshop" },
          { id: "1-4", text: "Switch off power/water at source if relevant" },
        ],
        after: [
          {
            kind: "callout",
            variant: "warn",
            title: "Safety first",
            text: "Never work on electrics live. If unsure about gas or structural work, stop and call the manager.",
          },
        ],
      },
      {
        id: 2,
        time: "Doing the job",
        title: "Complete the repair",
        items: [
          { id: "2-1", text: "Test the fix works end to end" },
          { id: "2-2", text: "Clean the area afterwards" },
          { id: "2-3", text: "Take an 'after' photo" },
        ],
      },
      {
        id: 3,
        time: "After",
        title: "Wrap up",
        items: [
          { id: "3-1", text: "Return tools to the workshop in their place" },
          { id: "3-2", text: "Log notes in the task: parts used, time taken" },
          { id: "3-3", text: "Flag any follow-up needed to the manager" },
        ],
      },
    ],
  },
  {
    id: "laundry",
    title: "Laundry SOP",
    subtitle: "Washing, drying and folding house linen",
    icon: "shirt",
    phases: [
      {
        id: 1,
        time: "Sort",
        title: "Sort and load",
        items: [
          { id: "1-1", text: "Separate whites, colours, delicates and towels" },
          { id: "1-2", text: "Check pockets and treat stains before washing" },
          { id: "1-3", text: "Load machine — never above 3/4 full" },
          { id: "1-4", text: "Select correct programme and start" },
        ],
      },
      {
        id: 2,
        time: "Dry",
        title: "Dry safely",
        items: [
          { id: "2-1", text: "Transfer to dryer or hang on rack" },
          { id: "2-2", text: "Clean dryer lint filter every load" },
          { id: "2-3", text: "Check delicates have not shrunk before next cycle" },
        ],
        after: [
          {
            kind: "callout",
            variant: "warn",
            text: "Always clean the lint filter — blocked filters are a fire risk.",
          },
        ],
      },
      {
        id: 3,
        time: "Fold & store",
        title: "Put away",
        items: [
          { id: "3-1", text: "Fold linen by category (sheets, duvet covers, pillowcases, towels)" },
          { id: "3-2", text: "Stack in the linen cupboard, oldest on top" },
          { id: "3-3", text: "Restock each room's linen shelf" },
        ],
      },
    ],
  },
];

export const getSop = (id: string) => SOPS.find((s) => s.id === id);
