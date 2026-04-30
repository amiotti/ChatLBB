import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const XLSX_MODULE = XLSX as unknown as {
  default?: typeof XLSX;
  readFile?: typeof XLSX.readFile;
  utils?: typeof XLSX.utils;
};
const XLSX_LIB = (XLSX_MODULE.readFile
  ? XLSX_MODULE
  : XLSX_MODULE.default ?? XLSX) as typeof XLSX;

export type MetricPoint = {
  year: number;
  month: number;
  member: string;
  messages: number;
  words: number;
  chars: number;
  media: number;
  audios: number;
  stickers: number;
  links: number;
  emojis: number;
  oneWord: number;
  questions: number;
  deleted: number;
};

export type BucketPoint = {
  year: number;
  month: number;
  member: string;
  bucket: number;
  messages: number;
};

export type DayPoint = {
  date: string;
  year: number;
  month: number;
  member: string;
  messages: number;
  words: number;
  chars: number;
  media: number;
  audios: number;
  stickers: number;
  links: number;
  emojis: number;
  questions: number;
  deleted: number;
};

export type DayHourPoint = {
  date: string;
  year: number;
  month: number;
  member: string;
  weekday: number;
  hour: number;
  messages: number;
};

export type WordPoint = {
  date?: string;
  year: number;
  month: number;
  member: string;
  word: string;
  count: number;
};

export type CountPoint = {
  date?: string;
  year: number;
  month: number;
  member: string;
  value: string;
  count: number;
};

export type NotableMessage = {
  date: string;
  year: number;
  month: number;
  member: string;
  message: string;
  chars: number;
};

export type ConversationDetail = {
  date: string;
  year: number;
  month: number;
  start: string;
  end: string;
  starter: string;
  closer: string;
  participants: string[];
  messages: number;
  durationMinutes: number;
  avgResponseMinutes: number;
};

export type MemberSummary = {
  member: string;
  messages: number;
  share: number;
  activeDays: number;
  avgChars: number;
  avgWords: number;
  messagesPerActiveDay: number;
  nightMessages: number;
  workMessages: number;
  links: number;
  media: number;
  audios: number;
  stickers: number;
  emojis: number;
  oneWord: number;
  favoriteHour: number;
  favoriteWeekday: number;
  longestMessageChars: number;
};

export type ConversationSummary = {
  total: number;
  avgDurationMinutes: number;
  avgMessages: number;
  avgResponseMinutes: number;
  starters: Array<{ member: string; count: number }>;
  closers: Array<{ member: string; count: number }>;
  longest: Array<{
    start: string;
    end: string;
    starter: string;
    closer: string;
    messages: number;
    durationMinutes: number;
  }>;
};

export type ChatAnalytics = {
  generatedAt: string;
  sourceName: string;
  totalMessages: number;
  totalWords: number;
  totalMembers: number;
  firstDate: string | null;
  lastDate: string | null;
  members: string[];
  years: number[];
  activeDays: number;
  silentDays: number;
  avgMessagesPerDay: number;
  avgCharsPerMessage: number;
  avgWordsPerMessage: number;
  deletedMessages: number;
  recordDays: Array<{ date: string; messages: number }>;
  longestSilences: Array<{ start: string; end: string; days: number }>;
  memberSummaries: MemberSummary[];
  months: MetricPoint[];
  days: DayPoint[];
  hours: BucketPoint[];
  weekdays: BucketPoint[];
  dayHours: DayHourPoint[];
  yearSummary: Array<{ year: number; messages: number; avgDailyMessages: number }>;
  globalWords: Array<{ word: string; count: number }>;
  words: WordPoint[];
  phrases: CountPoint[];
  emojis: CountPoint[];
  domains: CountPoint[];
  topics: CountPoint[];
  conversations: ConversationSummary;
  conversationDetails: ConversationDetail[];
  awards: Array<{ title: string; member: string; value: string }>;
  longestMessages: NotableMessage[];
  notableMessages: NotableMessage[];
};

const DATA_DIR = path.join(process.cwd(), "data");
export const EXCEL_PATH = path.join(DATA_DIR, "chat-limpio.xlsx");
export const ANALYTICS_PATH = path.join(DATA_DIR, "analytics.json");

const STOP_WORDS = new Set([
  "a",
  "aca",
  "ahi",
  "al",
  "algo",
  "ante",
  "antes",
  "asi",
  "aun",
  "aunque",
  "buen",
  "buena",
  "buenas",
  "bueno",
  "buenos",
  "cada",
  "che",
  "como",
  "con",
  "contra",
  "cual",
  "cuando",
  "de",
  "del",
  "desde",
  "donde",
  "dos",
  "el",
  "ella",
  "ellos",
  "en",
  "entre",
  "era",
  "eran",
  "ese",
  "eso",
  "esta",
  "estan",
  "estar",
  "este",
  "esto",
  "estos",
  "fue",
  "hay",
  "jaja",
  "jajaja",
  "jajajaja",
  "jajaj",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "mas",
  "me",
  "mi",
  "mis",
  "muy",
  "ni",
  "no",
  "nos",
  "o",
  "para",
  "pero",
  "por",
  "porque",
  "q",
  "que",
  "se",
  "ser",
  "si",
  "sin",
  "sobre",
  "son",
  "su",
  "sus",
  "te",
  "tiene",
  "todo",
  "todos",
  "tu",
  "un",
  "una",
  "uno",
  "unos",
  "va",
  "vamos",
  "y",
  "ya",
  "yo",
  "audio",
  "eliminó",
  "eliminado",
  "elimino",
  "imagen",
  "omitida",
  "omitido",
  "sticker",
  "video",
]);

const WORD_BLOCKLIST = new Set([
  "audio",
  "imagen",
  "omitida",
  "omitido",
  "sticker",
  "video",
]);

const MEDIA_OMITTED_LABELS = new Map([
  ["sticker", "sticker"],
  ["audio", "audio"],
  ["imagen", "imagen"],
  ["video", "video"],
]);

const TOPICS = [
  { value: "asado", terms: ["asado", "parrilla", "vacio", "chori", "choripan"] },
  { value: "padel", terms: ["padel", "paddle", "paleta"] },
  { value: "futbol", terms: ["futbol", "fulbo", "cancha", "partido", "gol", "boca", "river"] },
  { value: "viaje", terms: ["viaje", "viajar", "vuelo", "hotel", "playa", "ruta"] },
  { value: "birra", terms: ["birra", "cerveza", "pinta", "bar"] },
  { value: "laburo", terms: ["laburo", "trabajo", "oficina", "reunion"] },
  { value: "planes", terms: ["sabado", "domingo", "juntamos", "junta", "hora", "donde", "vamos"] },
  { value: "cumple", terms: ["cumple", "cumpleanos", "feliz"] },
];

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function monthLabel(month: number) {
  return MONTH_NAMES[month - 1] ?? `${month}`;
}

export function loadAnalytics(): ChatAnalytics | null {
  if (!fs.existsSync(ANALYTICS_PATH)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(ANALYTICS_PATH, "utf8")) as ChatAnalytics;
}

export function saveAnalytics(analytics: ChatAnalytics) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(analytics));
}

export function ensureAnalytics() {
  const existing = loadAnalytics();

  if (existing) {
    return existing;
  }

  const analytics = buildAnalyticsFromExcel(EXCEL_PATH);
  saveAnalytics(analytics);
  return analytics;
}

export function buildAnalyticsFromExcel(filePath: string): ChatAnalytics {
  const workbook = XLSX_LIB.readFile(filePath, {
    cellDates: true,
    raw: false,
    dense: true,
  });

  return buildAnalyticsFromWorkbook(workbook, path.basename(filePath));
}

export function buildAnalyticsFromExcelBuffer(
  buffer: Buffer,
  sourceName: string,
): ChatAnalytics {
  const workbook = XLSX_LIB.read(buffer, {
    cellDates: true,
    raw: false,
    dense: true,
    type: "buffer",
  });

  return buildAnalyticsFromWorkbook(workbook, sourceName);
}

function buildAnalyticsFromWorkbook(
  workbook: XLSX.WorkBook,
  sourceName: string,
): ChatAnalytics {
  const sheetName = workbook.SheetNames.includes("TODO")
    ? "TODO"
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rowIterator = iterateChatRows(sheet);

  const monthMap = new Map<string, MetricPoint>();
  const hourMap = new Map<string, BucketPoint>();
  const weekdayMap = new Map<string, BucketPoint>();
  const dayMap = new Map<string, DayPoint>();
  const dayHourMap = new Map<string, DayHourPoint>();
  const wordMaps = new Map<string, Map<string, number>>();
  const globalWordMap = new Map<string, number>();
  const phraseMaps = new Map<string, Map<string, number>>();
  const emojiMaps = new Map<string, Map<string, number>>();
  const domainMaps = new Map<string, Map<string, number>>();
  const topicMaps = new Map<string, Map<string, number>>();
  const activeDateSet = new Set<string>();
  const yearDateSets = new Map<number, Set<string>>();
  const memberAccumulator = new Map<
    string,
    MemberSummary & {
      words: number;
      chars: number;
      activeDateSet: Set<string>;
      hours: Map<number, number>;
      weekdays: Map<number, number>;
    }
  >();
  const conversationStarters = new Map<string, number>();
  const conversationClosers = new Map<string, number>();
  const longestConversations: ConversationSummary["longest"] = [];
  const conversationDetails: ConversationDetail[] = [];
  const notableMessageMaps = new Map<string, NotableMessage[]>();
  const members = new Set<string>();
  const years = new Set<number>();
  const longestMessages: ChatAnalytics["longestMessages"] = [];
  const recordDayMap = new Map<string, number>();

  let totalMessages = 0;
  let totalWords = 0;
  let totalChars = 0;
  let deletedMessages = 0;
  let totalResponseMinutes = 0;
  let totalResponseCount = 0;
  let conversationCount = 0;
  let conversationMessages = 0;
  let conversationDurationMinutes = 0;
  let currentConversation: {
    start: Date;
    end: Date;
    starter: string;
    closer: string;
    participants: Set<string>;
    messages: number;
    responseMinutes: number;
    responseCount: number;
  } | null = null;
  let previousDate: Date | null = null;
  let previousMember: string | null = null;
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;

  for (const row of rowIterator) {
    const member = cleanMember(row.NOMBRE);
    const message = cleanMessage(row.MSJ);
    const date = parseDate(row.FECHA, row.HORA);

    if (!member || !message || !date) {
      continue;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const hour = date.getHours();
    const weekday = date.getDay();
    const day = dateKey(date);
    const words = extractWords(message);
    const isDeletedMessage = isDeletedMessageText(message);
    const linkCount = extractLinks(message).length;
    const emojis = extractEmojis(message);
    const isAudio = /audio|voz|voice/i.test(message);
    const isSticker = /sticker/i.test(message);
    const isMedia = /omitido|omitted|imagen|video|audio|sticker|multimedia/i.test(message);
    const hasQuestion = message.includes("?");
    const isOneWord = words.length === 1;

    totalMessages += 1;
    totalWords += words.length;
    totalChars += message.length;
    if (isDeletedMessage) deletedMessages += 1;
    members.add(member);
    years.add(year);
    activeDateSet.add(day);
    recordDayMap.set(day, (recordDayMap.get(day) ?? 0) + 1);

    let yearDateSet = yearDateSets.get(year);
    if (!yearDateSet) {
      yearDateSet = new Set<string>();
      yearDateSets.set(year, yearDateSet);
    }
    yearDateSet.add(day);

    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;

    addMetric(monthMap, year, month, member, {
      messages: 1,
      words: words.length,
      chars: message.length,
      media: isMedia ? 1 : 0,
      audios: isAudio ? 1 : 0,
      stickers: isSticker ? 1 : 0,
      links: linkCount,
      emojis: emojis.length,
      oneWord: isOneWord ? 1 : 0,
      questions: hasQuestion ? 1 : 0,
      deleted: isDeletedMessage ? 1 : 0,
    });
    addDay(dayMap, day, year, month, member, {
      messages: 1,
      words: words.length,
      chars: message.length,
      media: isMedia ? 1 : 0,
      audios: isAudio ? 1 : 0,
      stickers: isSticker ? 1 : 0,
      links: linkCount,
      emojis: emojis.length,
      questions: hasQuestion ? 1 : 0,
      deleted: isDeletedMessage ? 1 : 0,
    });
    addBucket(hourMap, year, month, member, hour);
    addBucket(weekdayMap, year, month, member, weekday);
    addDayHour(dayHourMap, day, year, month, member, weekday, hour);
    addMember(memberAccumulator, member, {
      messages: 1,
      words: words.length,
      chars: message.length,
      day,
      hour,
      weekday,
      nightMessages: hour < 6 ? 1 : 0,
      workMessages: weekday >= 1 && weekday <= 5 && hour >= 9 && hour < 18 ? 1 : 0,
      links: linkCount,
      media: isMedia ? 1 : 0,
      audios: isAudio ? 1 : 0,
      stickers: isSticker ? 1 : 0,
      emojis: emojis.length,
      oneWord: isOneWord ? 1 : 0,
      longestMessageChars: message.length,
    });

    const metricKey = key(year, month, member);
    const wordKey = `${day}|${metricKey}`;
    let wordMap = wordMaps.get(wordKey);
    const datedMetricKey = `${day}|${metricKey}`;
    let emojiMap = emojiMaps.get(datedMetricKey);
    let domainMap = domainMaps.get(datedMetricKey);
    let topicMap = topicMaps.get(datedMetricKey);
    const phraseKey = `${day}|${metricKey}`;
    let phraseMap = phraseMaps.get(phraseKey);

    if (!wordMap) {
      wordMap = new Map<string, number>();
      wordMaps.set(wordKey, wordMap);
    }
    if (!emojiMap) {
      emojiMap = new Map<string, number>();
      emojiMaps.set(datedMetricKey, emojiMap);
    }
    if (!domainMap) {
      domainMap = new Map<string, number>();
      domainMaps.set(datedMetricKey, domainMap);
    }
    if (!topicMap) {
      topicMap = new Map<string, number>();
      topicMaps.set(datedMetricKey, topicMap);
    }
    if (!phraseMap) {
      phraseMap = new Map<string, number>();
      phraseMaps.set(phraseKey, phraseMap);
    }

    for (const word of words) {
      wordMap.set(word, (wordMap.get(word) ?? 0) + 1);
      globalWordMap.set(word, (globalWordMap.get(word) ?? 0) + 1);
    }
    for (const phrase of extractPhrases(words, message)) {
      phraseMap.set(phrase, (phraseMap.get(phrase) ?? 0) + 1);
    }
    for (const emoji of emojis) {
      emojiMap.set(emoji, (emojiMap.get(emoji) ?? 0) + 1);
    }
    for (const domain of extractDomains(message)) {
      domainMap.set(domain, (domainMap.get(domain) ?? 0) + 1);
    }
    for (const topic of detectTopics(words)) {
      topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
    }

    if (!previousDate || minutesBetween(previousDate, date) > 60) {
      closeConversation(currentConversation);
      currentConversation = {
        start: date,
        end: date,
        starter: member,
        closer: member,
        participants: new Set([member]),
        messages: 1,
        responseMinutes: 0,
        responseCount: 0,
      };
    } else if (currentConversation) {
      currentConversation.end = date;
      currentConversation.closer = member;
      currentConversation.participants.add(member);
      currentConversation.messages += 1;

      if (previousMember && previousMember !== member) {
        const responseMinutes = minutesBetween(previousDate, date);
        totalResponseMinutes += responseMinutes;
        totalResponseCount += 1;
        currentConversation.responseMinutes += responseMinutes;
        currentConversation.responseCount += 1;
      }
    }

    previousDate = date;
    previousMember = member;

    pushLongest(longestMessages, {
      date: date.toISOString(),
      year,
      month,
      member,
      message,
      chars: message.length,
    });
    pushLongestByKey(notableMessageMaps, `${day}|${member}`, {
      date: date.toISOString(),
      year,
      month,
      member,
      message,
      chars: message.length,
    });
  }

  closeConversation(currentConversation);

  const activeDays = activeDateSet.size;
  const periodDays = firstDate && lastDate ? daysBetween(firstDate, lastDate) + 1 : 0;
  const silentDays = Math.max(0, periodDays - activeDays);
  const memberSummaries = [...memberAccumulator.values()]
    .map((item) => ({
      member: item.member,
      messages: item.messages,
      share: totalMessages ? item.messages / totalMessages : 0,
      activeDays: item.activeDateSet.size,
      avgChars: item.messages ? item.chars / item.messages : 0,
      avgWords: item.messages ? item.words / item.messages : 0,
      messagesPerActiveDay: item.activeDateSet.size
        ? item.messages / item.activeDateSet.size
        : 0,
      nightMessages: item.nightMessages,
      workMessages: item.workMessages,
      links: item.links,
      media: item.media,
      audios: item.audios,
      stickers: item.stickers,
      emojis: item.emojis,
      oneWord: item.oneWord,
      favoriteHour: topNumeric(item.hours),
      favoriteWeekday: topNumeric(item.weekdays),
      longestMessageChars: item.longestMessageChars,
    }))
    .sort((a, b) => b.messages - a.messages);

  const recordDays = [...recordDayMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([date, messages]) => ({ date, messages }));
  const longestSilences = getLongestSilences([...activeDateSet].sort());
  const yearSummary = [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const messages = [...dayMap.values()]
        .filter((row) => row.year === year)
        .reduce((sum, row) => sum + row.messages, 0);
      const activeDaysForYear = yearDateSets.get(year)?.size ?? 0;

      return {
        year,
        messages,
        avgDailyMessages: activeDaysForYear ? messages / activeDaysForYear : 0,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    sourceName,
    totalMessages,
    totalWords,
    totalMembers: members.size,
    firstDate: firstDate?.toISOString() ?? null,
    lastDate: lastDate?.toISOString() ?? null,
    members: [...members].sort((a, b) => a.localeCompare(b, "es")),
    years: [...years].sort((a, b) => a - b),
    activeDays,
    silentDays,
    avgMessagesPerDay: periodDays ? totalMessages / periodDays : 0,
    avgCharsPerMessage: totalMessages ? totalChars / totalMessages : 0,
    avgWordsPerMessage: totalMessages ? totalWords / totalMessages : 0,
    deletedMessages,
    recordDays,
    longestSilences,
    memberSummaries,
    months: [...monthMap.values()].sort(sortMetric),
    days: [...dayMap.values()].sort(sortDay),
    hours: [...hourMap.values()].sort(sortBucket),
    weekdays: [...weekdayMap.values()].sort(sortBucket),
    dayHours: [...dayHourMap.values()].sort(sortDayHour),
    yearSummary,
    globalWords: topEntries(globalWordMap, 70).map(([word, count]) => ({
      word,
      count,
    })),
    words: [...wordMaps.entries()].flatMap(([wordKey, wordMap]) => {
      const [date, year, month, member] = wordKey.split("|");

      return topEntries(wordMap, 3).map(([word, count]) => ({
        date,
        year: Number(year),
        month: Number(month),
        member,
        word,
        count,
      }));
    }),
    phrases: expandDatedCountMaps(phraseMaps, 3),
    emojis: expandDatedCountMaps(emojiMaps, 12),
    domains: expandDatedCountMaps(domainMaps, 12),
    topics: expandDatedCountMaps(topicMaps, TOPICS.length),
    conversations: {
      total: conversationCount,
      avgDurationMinutes: conversationCount
        ? conversationDurationMinutes / conversationCount
        : 0,
      avgMessages: conversationCount ? conversationMessages / conversationCount : 0,
      avgResponseMinutes: totalResponseCount
        ? totalResponseMinutes / totalResponseCount
        : 0,
      starters: topMap(conversationStarters, 10, "member"),
      closers: topMap(conversationClosers, 10, "member"),
      longest: longestConversations,
    },
    conversationDetails,
    awards: buildAwards(memberSummaries),
    longestMessages,
    notableMessages: [...notableMessageMaps.values()]
      .flat()
      .sort((a, b) => b.chars - a.chars),
  };

  function closeConversation(
    conversation: {
      start: Date;
      end: Date;
      starter: string;
      closer: string;
      participants: Set<string>;
      messages: number;
      responseMinutes: number;
      responseCount: number;
    } | null,
  ) {
    if (!conversation) {
      return;
    }

    const durationMinutes = minutesBetween(conversation.start, conversation.end);
    conversationCount += 1;
    conversationMessages += conversation.messages;
    conversationDurationMinutes += durationMinutes;
    conversationStarters.set(
      conversation.starter,
      (conversationStarters.get(conversation.starter) ?? 0) + 1,
    );
    conversationClosers.set(
      conversation.closer,
      (conversationClosers.get(conversation.closer) ?? 0) + 1,
    );
    pushConversation(longestConversations, {
      start: conversation.start.toISOString(),
      end: conversation.end.toISOString(),
      starter: conversation.starter,
      closer: conversation.closer,
      messages: conversation.messages,
      durationMinutes,
    });
    conversationDetails.push({
      date: dateKey(conversation.start),
      year: conversation.start.getFullYear(),
      month: conversation.start.getMonth() + 1,
      start: conversation.start.toISOString(),
      end: conversation.end.toISOString(),
      starter: conversation.starter,
      closer: conversation.closer,
      participants: [...conversation.participants].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
      messages: conversation.messages,
      durationMinutes,
      avgResponseMinutes: conversation.responseCount
        ? conversation.responseMinutes / conversation.responseCount
        : 0,
    });
  }
}

function* iterateChatRows(sheet: XLSX.WorkSheet) {
  const ref = sheet["!ref"];

  if (!ref) {
    return;
  }

  const range = XLSX_LIB.utils.decode_range(ref);
  const headers = new Map<string, number>();

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const label = normalizeHeader(readCellAt(sheet, range.s.r, column));

    if (label) {
      headers.set(label, column);
    }
  }

  const nombreColumn = headers.get("NOMBRE");
  const mensajeColumn = headers.get("MSJ") ?? headers.get("MENSAJE");
  const fechaColumn = headers.get("FECHA");
  const horaColumn = headers.get("HORA");

  if (
    nombreColumn === undefined ||
    mensajeColumn === undefined ||
    fechaColumn === undefined ||
    horaColumn === undefined
  ) {
    return;
  }

  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    yield {
      NOMBRE: readCellAt(sheet, row, nombreColumn),
      MSJ: readCellAt(sheet, row, mensajeColumn),
      FECHA: readCellAt(sheet, row, fechaColumn),
      HORA: readCellAt(sheet, row, horaColumn),
    };
  }
}

function readCellAt(sheet: XLSX.WorkSheet, row: number, column: number) {
  const denseCell = (sheet as unknown as Array<Array<XLSX.CellObject | undefined>>)[
    row
  ]?.[column];

  if (denseCell) {
    return XLSX_LIB.utils.format_cell(denseCell);
  }

  return readCell(sheet, XLSX_LIB.utils.encode_cell({ r: row, c: column }));
}

function readCell(sheet: XLSX.WorkSheet, address: string) {
  const cell = sheet[address];

  if (!cell) {
    return "";
  }

  return XLSX_LIB.utils.format_cell(cell);
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function addMetric(
  map: Map<string, MetricPoint>,
  year: number,
  month: number,
  member: string,
  values: Omit<MetricPoint, "year" | "month" | "member">,
) {
  const mapKey = key(year, month, member);
  const current =
    map.get(mapKey) ??
    ({
      year,
      month,
      member,
      messages: 0,
      words: 0,
      chars: 0,
      media: 0,
      audios: 0,
      stickers: 0,
      links: 0,
      emojis: 0,
      oneWord: 0,
      questions: 0,
      deleted: 0,
    } satisfies MetricPoint);

  current.messages += values.messages;
  current.words += values.words;
  current.chars += values.chars;
  current.media += values.media;
  current.audios += values.audios;
  current.stickers += values.stickers;
  current.links += values.links;
  current.emojis += values.emojis;
  current.oneWord += values.oneWord;
  current.questions += values.questions;
  current.deleted += values.deleted;
  map.set(mapKey, current);
}

function addDay(
  map: Map<string, DayPoint>,
  date: string,
  year: number,
  month: number,
  member: string,
  values: Omit<DayPoint, "date" | "year" | "month" | "member">,
) {
  const mapKey = `${date}|${member}`;
  const current =
    map.get(mapKey) ??
    ({
      date,
      year,
      month,
      member,
      messages: 0,
      words: 0,
      chars: 0,
      media: 0,
      audios: 0,
      stickers: 0,
      links: 0,
      emojis: 0,
      questions: 0,
      deleted: 0,
    } satisfies DayPoint);

  current.messages += values.messages;
  current.words += values.words;
  current.chars += values.chars;
  current.media += values.media;
  current.audios += values.audios;
  current.stickers += values.stickers;
  current.links += values.links;
  current.emojis += values.emojis;
  current.questions += values.questions;
  current.deleted += values.deleted;
  map.set(mapKey, current);
}

function addBucket(
  map: Map<string, BucketPoint>,
  year: number,
  month: number,
  member: string,
  bucket: number,
) {
  const mapKey = `${key(year, month, member)}|${bucket}`;
  const current =
    map.get(mapKey) ??
    ({
      year,
      month,
      member,
      bucket,
      messages: 0,
    } satisfies BucketPoint);

  current.messages += 1;
  map.set(mapKey, current);
}

function addDayHour(
  map: Map<string, DayHourPoint>,
  date: string,
  year: number,
  month: number,
  member: string,
  weekday: number,
  hour: number,
) {
  const mapKey = `${date}|${member}|${weekday}|${hour}`;
  const current =
    map.get(mapKey) ??
    ({
      date,
      year,
      month,
      member,
      weekday,
      hour,
      messages: 0,
    } satisfies DayHourPoint);

  current.messages += 1;
  map.set(mapKey, current);
}

function addMember(
  map: Map<
    string,
    MemberSummary & {
      words: number;
      chars: number;
      activeDateSet: Set<string>;
      hours: Map<number, number>;
      weekdays: Map<number, number>;
    }
  >,
  member: string,
  values: {
    messages: number;
    words: number;
    chars: number;
    day: string;
    hour: number;
    weekday: number;
    nightMessages: number;
    workMessages: number;
    links: number;
    media: number;
    audios: number;
    stickers: number;
    emojis: number;
    oneWord: number;
    longestMessageChars: number;
  },
) {
  const current =
    map.get(member) ??
    ({
      member,
      messages: 0,
      share: 0,
      activeDays: 0,
      avgChars: 0,
      avgWords: 0,
      messagesPerActiveDay: 0,
      nightMessages: 0,
      workMessages: 0,
      links: 0,
      media: 0,
      audios: 0,
      stickers: 0,
      emojis: 0,
      oneWord: 0,
      favoriteHour: 0,
      favoriteWeekday: 0,
      longestMessageChars: 0,
      words: 0,
      chars: 0,
      activeDateSet: new Set<string>(),
      hours: new Map<number, number>(),
      weekdays: new Map<number, number>(),
    } satisfies MemberSummary & {
      words: number;
      chars: number;
      activeDateSet: Set<string>;
      hours: Map<number, number>;
      weekdays: Map<number, number>;
    });

  current.messages += values.messages;
  current.words += values.words;
  current.chars += values.chars;
  current.activeDateSet.add(values.day);
  current.nightMessages += values.nightMessages;
  current.workMessages += values.workMessages;
  current.links += values.links;
  current.media += values.media;
  current.audios += values.audios;
  current.stickers += values.stickers;
  current.emojis += values.emojis;
  current.oneWord += values.oneWord;
  current.longestMessageChars = Math.max(
    current.longestMessageChars,
    values.longestMessageChars,
  );
  current.hours.set(values.hour, (current.hours.get(values.hour) ?? 0) + 1);
  current.weekdays.set(
    values.weekday,
    (current.weekdays.get(values.weekday) ?? 0) + 1,
  );
  map.set(member, current);
}

function key(year: number, month: number, member: string) {
  return `${year}|${month}|${member}`;
}

function cleanMember(value: unknown) {
  return String(value ?? "")
    .replace(/^~\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMessage(value: unknown) {
  return String(value ?? "")
    .replace(/[\u200e\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(fecha: unknown, hora: unknown) {
  const dateText = String(fecha ?? "").trim();
  const timeText = String(hora ?? "00:00:00").trim();
  const [first, second, yearPart] = dateText.split(/[/-]/).map(Number);

  if (!first || !second || !yearPart) {
    return null;
  }

  const year = yearPart < 100 ? 2000 + yearPart : yearPart;
  const month = first;
  const day = second;
  const [hours = 0, minutes = 0, seconds = 0] = timeText.split(":").map(Number);
  const parsed = new Date(year, month - 1, day, hours, minutes, seconds);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractWords(message: string) {
  const normalized = message
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");

  return normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => {
      const comparable = normalizeForFilter(word);

      return (
        word.length >= 4 &&
        !STOP_WORDS.has(word) &&
        !STOP_WORDS.has(comparable) &&
        !WORD_BLOCKLIST.has(word) &&
        !WORD_BLOCKLIST.has(comparable)
      );
    });
}

function extractPhrases(words: string[], message: string) {
  if (isDeletedMessageText(message)) {
    return [];
  }

  const mediaLabel = mediaOmittedLabel(message);

  if (mediaLabel) {
    return [];
  }

  const phrases: string[] = [];

  for (let index = 0; index < words.length - 1; index += 1) {
    const phrase = `${words[index]} ${words[index + 1]}`;
    const comparable = normalizeForFilter(phrase);

    if (comparable === "elimino mensaje" || comparable === "eliminó mensaje") {
      continue;
    }

    phrases.push(phrase);
  }

  return phrases;
}

function isDeletedMessageText(message: string) {
  return /elimin[oó]\s+(este\s+)?mensaje|mensaje\s+eliminado/i.test(message);
}

function mediaOmittedLabel(message: string) {
  const comparable = normalizeForFilter(message);

  for (const [needle, label] of MEDIA_OMITTED_LABELS) {
    if (comparable.includes(needle) && comparable.includes("omitid")) {
      return label;
    }
  }

  return null;
}

function normalizeForFilter(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractEmojis(message: string) {
  return message.match(/\p{Extended_Pictographic}/gu) ?? [];
}

function extractLinks(message: string) {
  return message.match(/https?:\/\/[^\s]+/gi) ?? [];
}

function extractDomains(message: string) {
  return extractLinks(message)
    .map((link) => {
      try {
        return new URL(link).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })
    .filter((domain): domain is string => Boolean(domain));
}

function detectTopics(words: string[]) {
  const wordSet = new Set(words);

  return TOPICS.filter((topic) => topic.terms.some((term) => wordSet.has(term))).map(
    (topic) => topic.value,
  );
}

function topEntries(map: Map<string, number>, limit: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function topMap<TKey extends string>(
  map: Map<string, number>,
  limit: number,
  keyName: TKey,
) {
  return topEntries(map, limit).map(([value, count]) => ({
    [keyName]: value,
    count,
  })) as Array<Record<TKey, string> & { count: number }>;
}

function expandDatedCountMaps(maps: Map<string, Map<string, number>>, limit: number) {
  return [...maps.entries()].flatMap(([mapKey, map]) => {
    const [date, year, month, member] = mapKey.split("|");

    return topEntries(map, limit).map(([value, count]) => ({
      date,
      year: Number(year),
      month: Number(month),
      member,
      value,
      count,
    }));
  });
}

function pushLongest(
  list: ChatAnalytics["longestMessages"],
  item: ChatAnalytics["longestMessages"][number],
) {
  list.push(item);
  list.sort((a, b) => b.chars - a.chars);

  if (list.length > 8) {
    list.pop();
  }
}

function pushLongestByKey(
  map: Map<string, NotableMessage[]>,
  key: string,
  item: NotableMessage,
) {
  const list = map.get(key) ?? [];
  list.push(item);
  list.sort((a, b) => b.chars - a.chars);

  if (list.length > 1) {
    list.pop();
  }

  map.set(key, list);
}

function pushConversation(
  list: ConversationSummary["longest"],
  item: ConversationSummary["longest"][number],
) {
  list.push(item);
  list.sort((a, b) => b.messages - a.messages || b.durationMinutes - a.durationMinutes);

  if (list.length > 8) {
    list.pop();
  }
}

function buildAwards(memberSummaries: MemberSummary[]) {
  const awards = [
    topAward("El más manija", memberSummaries, (item) => item.messagesPerActiveDay, "msj/día activo"),
    topAward("El noctámbulo", memberSummaries, (item) => item.nightMessages, "msj de 00 a 06"),
    topAward("El fantasma", memberSummaries, (item) => -item.messages, "menos mensajes"),
    topAward("El que manda audios", memberSummaries, (item) => item.audios, "audios"),
    topAward("El sticker-man", memberSummaries, (item) => item.stickers, "stickers"),
    topAward("El político", memberSummaries, (item) => item.avgChars, "caracteres promedio"),
    topAward("El monosílabo", memberSummaries, (item) => item.oneWord, "mensajes de 1 palabra"),
    topAward("El influencer", memberSummaries, (item) => item.links, "links"),
  ];

  return awards.filter((award): award is { title: string; member: string; value: string } =>
    Boolean(award),
  );
}

function topAward(
  title: string,
  memberSummaries: MemberSummary[],
  metric: (item: MemberSummary) => number,
  suffix: string,
) {
  const winner = [...memberSummaries].sort((a, b) => metric(b) - metric(a))[0];

  if (!winner) {
    return null;
  }

  return {
    title,
    member: winner.member,
    value: `${Math.abs(metric(winner)).toLocaleString("es-AR", {
      maximumFractionDigits: 1,
    })} ${suffix}`,
  };
}

function topNumeric(map: Map<number, number>) {
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function daysBetween(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function getLongestSilences(sortedDates: string[]) {
  const silences: Array<{ start: string; end: string; days: number }> = [];

  for (let index = 1; index < sortedDates.length; index += 1) {
    const previous = new Date(`${sortedDates[index - 1]}T00:00:00`);
    const current = new Date(`${sortedDates[index]}T00:00:00`);
    const gap = daysBetween(previous, current) - 1;

    if (gap > 0) {
      const start = new Date(previous);
      start.setDate(start.getDate() + 1);
      const end = new Date(current);
      end.setDate(end.getDate() - 1);
      silences.push({
        start: dateKey(start),
        end: dateKey(end),
        days: gap,
      });
    }
  }

  return silences.sort((a, b) => b.days - a.days).slice(0, 8);
}

function sortMetric(a: MetricPoint, b: MetricPoint) {
  return (
    a.year - b.year ||
    a.month - b.month ||
    a.member.localeCompare(b.member, "es")
  );
}

function sortDay(a: DayPoint, b: DayPoint) {
  return a.date.localeCompare(b.date) || a.member.localeCompare(b.member, "es");
}

function sortBucket(a: BucketPoint, b: BucketPoint) {
  return (
    a.year - b.year ||
    a.month - b.month ||
    a.bucket - b.bucket ||
    a.member.localeCompare(b.member, "es")
  );
}

function sortDayHour(a: DayHourPoint, b: DayHourPoint) {
  return (
    a.date.localeCompare(b.date) ||
    a.year - b.year ||
    a.month - b.month ||
    a.weekday - b.weekday ||
    a.hour - b.hour ||
    a.member.localeCompare(b.member, "es")
  );
}
