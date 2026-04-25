export type Cabin = "economy" | "premium" | "business" | "first";

export type FlightsArgs = {
  from: string;
  to: string;
  date: string;
  dateEnd: string;
  cabin?: Cabin;
  programs?: string[];
  alliance?: Alliance;
  transferPartners?: TransferPartner[];
  airlines?: string[];
  minSeats?: number;
  maxDuration?: number;
  direct: boolean;
  includeFiltered: boolean;
  trips: boolean;
  debug: boolean;
  json: boolean;
  argWarnings: string[];
};

export type CabinCode = "Y" | "W" | "J" | "F";

export type RawAvailabilitySegment = {
  FlightNumber?: string;
  Distance?: number;
  OriginAirport?: string;
  DestinationAirport?: string;
  DepartsAt?: string;
  ArrivesAt?: string;
  Duration?: number;
  AircraftName?: string;
  AircraftCode?: string;
};

export type RawAvailabilityTrip = {
  Cabin?: string;
  MileageCost?: number;
  FlightNumbers?: string;
  Connections?: string[] | null;
  Stops?: number;
  DepartsAt?: string;
  ArrivesAt?: string;
  TotalDuration?: number;
  Aircraft?: string[] | null;
  RemainingSeats?: number;
  Filtered?: boolean;
  AvailabilitySegments?: RawAvailabilitySegment[];
};

export type AvailabilityRecord = {
  ID?: string;
  Date?: string;
  Source?: string;
  UpdatedAt?: string;
  Route?: {
    OriginAirport?: string;
    DestinationAirport?: string;
    Source?: string;
  };
  YAvailable?: boolean | null;
  WAvailable?: boolean | null;
  JAvailable?: boolean | null;
  FAvailable?: boolean | null;
  YMileageCost?: string | number | null;
  WMileageCost?: string | number | null;
  JMileageCost?: string | number | null;
  FMileageCost?: string | number | null;
  YRemainingSeats?: number | null;
  WRemainingSeats?: number | null;
  JRemainingSeats?: number | null;
  FRemainingSeats?: number | null;
  YAirlines?: string | null;
  WAirlines?: string | null;
  JAirlines?: string | null;
  FAirlines?: string | null;
  YDirect?: boolean | null;
  WDirect?: boolean | null;
  JDirect?: boolean | null;
  FDirect?: boolean | null;
  AvailabilityTrips?: RawAvailabilityTrip[] | null;
};

export type SearchResponse = {
  data?: AvailabilityRecord[];
  count?: number;
  hasMore?: boolean;
  cursor?: number;
};

export type Trip = {
  cabin: Cabin;
  miles: number;
  flights: string;
  connections: string[];
  stops: number;
  departsAt: string;
  arrivesAt: string;
  totalDuration: number;
  aircraft: string[];
  seats: number;
};

export type FlightRow = {
  date: string;
  source: string;
  origin: string;
  destination: string;
  cabin: Cabin;
  miles: number | null;
  seats_available: number | null;
  direct: boolean | null;
  airlines: string[];
  total_duration_minutes: number | null;
  updatedAt: string | null;
  searchUrl: string;
  availabilityId: string;
  trips?: Trip[];
};

export type SearchStats = {
  fetchedPages: number;
  fetchedRecords: number;
  truncated: boolean;
};

export const CABIN_TO_CODE: Record<Cabin, CabinCode> = {
  economy: "Y",
  premium: "W",
  business: "J",
  first: "F"
};

export const CODE_TO_CABIN: Record<CabinCode, Cabin> = {
  Y: "economy",
  W: "premium",
  J: "business",
  F: "first"
};

export const KNOWN_SOURCES = [
  "american",
  "delta",
  "united",
  "alaska",
  "aeroplan",
  "jetblue",
  "aeromexico",
  "connectmiles",
  "azul",
  "smiles",
  "lifemiles",
  "virginatlantic",
  "velocity",
  "qantas",
  "emirates",
  "etihad",
  "qatar",
  "singapore",
  "turkish",
  "flyingblue",
  "eurobonus",
  "lufthansa",
  "finnair",
  "ethiopian",
  "saudia"
] as const;

export type KnownSource = (typeof KNOWN_SOURCES)[number];

export type Alliance = "star" | "oneworld" | "skyteam";
export type TransferPartner = "amex" | "chase" | "citi" | "capitalone" | "bilt";

export const ALLIANCE_SOURCES: Record<Alliance, string[]> = {
  star: ["united", "aeroplan", "connectmiles", "lifemiles", "singapore", "turkish", "lufthansa", "ethiopian"],
  oneworld: ["american", "alaska", "qantas", "qatar", "finnair"],
  skyteam: ["delta", "aeromexico", "flyingblue", "virginatlantic", "eurobonus", "saudia"]
};

export const ALLIANCE_ALIASES: Record<string, Alliance> = {
  star: "star",
  "star-alliance": "star",
  staralliance: "star",
  oneworld: "oneworld",
  "one-world": "oneworld",
  skyteam: "skyteam",
  "sky-team": "skyteam",
  sky: "skyteam"
};

export const TRANSFER_PARTNER_ALIASES: Record<string, TransferPartner> = {
  amex: "amex",
  americanexpress: "amex",
  membershiprewards: "amex",
  chase: "chase",
  ultimaterewards: "chase",
  citi: "citi",
  thankyou: "citi",
  thankyoupoints: "citi",
  capitalone: "capitalone",
  venture: "capitalone",
  bilt: "bilt"
};

export const TRANSFER_PARTNER_SOURCES: Record<TransferPartner, KnownSource[]> = {
  amex: [
    "aeromexico",
    "aeroplan",
    "delta",
    "lifemiles",
    "emirates",
    "etihad",
    "flyingblue",
    "jetblue",
    "qantas",
    "qatar",
    "singapore",
    "virginatlantic"
  ],
  chase: ["aeroplan", "flyingblue", "jetblue", "singapore", "united", "virginatlantic"],
  citi: [
    "aeromexico",
    "american",
    "lifemiles",
    "emirates",
    "etihad",
    "flyingblue",
    "jetblue",
    "qantas",
    "qatar",
    "singapore",
    "turkish",
    "virginatlantic"
  ],
  capitalone: [
    "aeromexico",
    "aeroplan",
    "lifemiles",
    "emirates",
    "etihad",
    "finnair",
    "flyingblue",
    "jetblue",
    "qantas",
    "qatar",
    "singapore",
    "turkish",
    "virginatlantic"
  ],
  bilt: ["alaska", "aeroplan", "emirates", "etihad", "flyingblue", "turkish", "united", "virginatlantic"]
};

export const UNRELIABLE_SEAT_COUNT_SOURCES = new Set(["american"]);

// Normalized token -> IATA carrier code.
export const AIRLINE_ALIASES: Record<string, string> = {
  aa: "AA",
  american: "AA",
  americanairlines: "AA",
  aadvantage: "AA",
  ua: "UA",
  united: "UA",
  unitedairlines: "UA",
  mileageplus: "UA",
  dl: "DL",
  delta: "DL",
  deltaairlines: "DL",
  skymiles: "DL",
  as: "AS",
  alaska: "AS",
  alaskaairlines: "AS",
  b6: "B6",
  jetblue: "B6",
  jetblueairways: "B6",
  ac: "AC",
  aircanada: "AC",
  aeroplan: "AC",
  ba: "BA",
  british: "BA",
  britishairways: "BA",
  ib: "IB",
  iberia: "IB",
  ay: "AY",
  finnair: "AY",
  jl: "JL",
  jal: "JL",
  japanairlines: "JL",
  nh: "NH",
  ana: "NH",
  allnippon: "NH",
  allnipponairways: "NH",
  qr: "QR",
  qatar: "QR",
  qatarairways: "QR",
  ek: "EK",
  emirates: "EK",
  ey: "EY",
  etihad: "EY",
  etihadairways: "EY",
  sq: "SQ",
  singapore: "SQ",
  singaporeairlines: "SQ",
  tk: "TK",
  turkish: "TK",
  turkishairlines: "TK",
  af: "AF",
  airfrance: "AF",
  kl: "KL",
  klm: "KL",
  klmroyaldutch: "KL",
  lh: "LH",
  lufthansa: "LH",
  lx: "LX",
  swiss: "LX",
  swissinternational: "LX",
  os: "OS",
  austrian: "OS",
  austrianairlines: "OS",
  sn: "SN",
  brussels: "SN",
  brusselsairlines: "SN",
  lo: "LO",
  lot: "LO",
  lotpolish: "LO",
  tp: "TP",
  tap: "TP",
  tapairportugal: "TP",
  sk: "SK",
  sas: "SK",
  scandinavian: "SK",
  vs: "VS",
  virginatlantic: "VS",
  am: "AM",
  aeromexico: "AM",
  av: "AV",
  avianca: "AV",
  cm: "CM",
  copa: "CM",
  et: "ET",
  ethiopian: "ET",
  ethiopianairlines: "ET",
  sv: "SV",
  saudia: "SV",
  saudi: "SV",
  saudiarabian: "SV",
  qf: "QF",
  qantas: "QF",
  nz: "NZ",
  airnewzealand: "NZ",
  br: "BR",
  eva: "BR",
  evaair: "BR",
  ci: "CI",
  china: "CI",
  chinaairlines: "CI",
  cx: "CX",
  cathay: "CX",
  cathaypacific: "CX",
  tg: "TG",
  thai: "TG",
  thaiairways: "TG",
  az: "AZ",
  ita: "AZ",
  itaairways: "AZ",
  g3: "G3",
  gol: "G3",
  ad: "AD",
  azul: "AD"
};
