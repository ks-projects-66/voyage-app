import {
Bed, Plane, TrainFront, Ticket, BellRing, StickyNote,
UtensilsCrossed, Wine, Camera, Sparkles,
} from "lucide-react";

export const PRODUCT = "Voyage"; // app name — shown on the auth screen and the trips list.
export const TAGLINE = "PLAN ANY TRIP, ANYWHERE"; // (inside a trip, the trip's own name becomes the header brand)

/* ============================== EXPLORE TAXONOMY ============================== */

export const VIBES = ["Fancy dinner","Long lunch","Quick bite","Coffee & cake","Wine bar","Cheap & cheerful","Sweet treat","Must-see","Hidden gem","Golden hour","Browse & buy"];
export const CATS = ["Eat & Drink","See & Do","Shop"];

export const PRIVATE_TYPE_META = {
hotel:    { icon: Bed,         label: "Stay" },
flight:   { icon: Plane,       label: "Flight" },
train:    { icon: TrainFront,  label: "Train" },
ticket:   { icon: Ticket,      label: "Ticket" },
reminder: { icon: BellRing,    label: "Reminder" },
note:     { icon: StickyNote,  label: "Note" },
};
export const PRIVATE_TYPE_ORDER = ["hotel","flight","train","ticket","reminder","note"];
export function privateTypeMeta(t){ return PRIVATE_TYPE_META[t] || PRIVATE_TYPE_META.note; }

export const TYPE_META = {
Meal: { icon: UtensilsCrossed, color: "var(--c-meal)",   bg: "var(--c-meal-bg)" },
Wine: { icon: Wine,            color: "var(--c-wine)",   bg: "var(--c-wine-bg)" },
Sight: { icon: Camera,         color: "var(--c-sight)",  bg: "var(--c-sight-bg)" },
Moment:{ icon: Sparkles,       color: "var(--c-moment)", bg: "var(--c-moment-bg)" },
};
