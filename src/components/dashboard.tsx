"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  Beer,
  CalendarDays,
  Crown,
  Moon,
  MessageCircle,
  Search,
  Shield,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import type {
  ChatAnalytics,
  CountPoint,
  DayHourPoint,
  DayPoint,
  MetricPoint,
  WordPoint,
} from "@/lib/chatAnalytics";

type DashboardProps = {
  analytics: ChatAnalytics;
};

type Totals = {
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

const COLORS = ["var(--beer)", "var(--mint)", "var(--amber)", "#818cf8", "#f59e0b", "#a78bfa", "#22d3ee"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const TOPIC_NAMES = ["asado", "padel", "futbol", "viaje", "birra", "laburo", "planes", "cumple"];

export function Dashboard({ analytics }: DashboardProps) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";

    try {
      const stored = window.localStorage.getItem("chat-theme");
      return stored === "light" || stored === "dark" ? stored : "dark";
    } catch {
      return "dark";
    }
  });
  const [member, setMember] = useState("todos");
  const [year, setYear] = useState("todos");
  const [month, setMonth] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [topic, setTopic] = useState("asado");

  const scoped = useMemo(
    () => {
      const days = filterRows(analytics.days, member, year, month, dateFrom, dateTo);
      const dayHours = filterRows(analytics.dayHours, member, year, month, dateFrom, dateTo);

      return {
        months: monthsFromDays(days),
        days,
        hours: hoursFromDayHours(dayHours),
        weekdays: weekdaysFromDayHours(dayHours),
        dayHours,
      words: filterRows(analytics.words, member, year, month, dateFrom, dateTo),
      phrases: filterRows(analytics.phrases, member, year, month, dateFrom, dateTo),
      emojis: filterRows(analytics.emojis, member, year, month, dateFrom, dateTo),
        domains: filterRows(analytics.domains, member, year, month, dateFrom, dateTo),
        topics: filterRows(analytics.topics, member, year, month, dateFrom, dateTo),
      };
    },
    [analytics, dateFrom, dateTo, member, month, year],
  );

  const totals = useMemo(() => sumTotals(scoped.months), [scoped.months]);
  const ranking = useMemo(() => rankingByMember(scoped.months), [scoped.months]);
  const timeline = useMemo(() => timelineData(scoped.months), [scoped.months]);
  const cumulative = useMemo(() => cumulativeData(scoped.months), [scoped.months]);
  const dayTimeline = useMemo(() => dailyData(scoped.days), [scoped.days]);
  const weekly = useMemo(() => weeklyData(scoped.days), [scoped.days]);
  const yearly = useMemo(() => yearData(scoped.months), [scoped.months]);
  const hourData = useMemo(() => bucketData(scoped.hours, 24), [scoped.hours]);
  const weekdayData = useMemo(() => bucketData(scoped.weekdays, 7, WEEKDAYS), [scoped.weekdays]);
  const dayHourData = useMemo(() => heatmap(scoped.dayHours), [scoped.dayHours]);
  const wordCloud = useMemo(() => filteredWords(analytics, scoped.words, member, year, month, dateFrom, dateTo), [analytics, dateFrom, dateTo, member, month, scoped.words, year]);
  const wordRanking = wordCloud.slice(0, 12);
  const emojis = useMemo(() => aggregateCount(scoped.emojis, 14), [scoped.emojis]);
  const domains = useMemo(() => aggregateCount(scoped.domains, 12), [scoped.domains]);
  const topics = useMemo(() => aggregateCount(scoped.topics, 12), [scoped.topics]);
  const phrases = useMemo(() => aggregateCount(scoped.phrases, 12), [scoped.phrases]);
  const selectedTopic = useMemo(() => topicEvolution(scoped.topics, topic), [scoped.topics, topic]);
  const memberStats = useMemo(() => memberStatsFromMonths(scoped.months, scoped.days, scoped.dayHours), [scoped.dayHours, scoped.days, scoped.months]);
  const generalStats = useMemo(() => scopedGeneralStats(scoped.days, totals, dateFrom, dateTo), [dateFrom, dateTo, scoped.days, totals]);
  const executive = useMemo(() => executiveSummary(analytics, totals, ranking, hourData, wordCloud, emojis, generalStats), [analytics, emojis, generalStats, hourData, ranking, totals, wordCloud]);
  const nightRanking = rankingMetric(memberStats, "nightMessages");
  const filteredConversations = useMemo(
    () =>
      filterConversations(
        analytics.conversationDetails,
        member,
        year,
        month,
        dateFrom,
        dateTo,
      ),
    [analytics.conversationDetails, dateFrom, dateTo, member, month, year],
  );
  const conversationStats = useMemo(
    () => conversationStatsFromDetails(filteredConversations),
    [filteredConversations],
  );
  const filteredAwards = useMemo(() => buildFilteredAwards(memberStats), [memberStats]);
  const filteredLongestMessages = useMemo(
    () =>
      filterNotableMessages(
        analytics.notableMessages,
        member,
        year,
        month,
        dateFrom,
        dateTo,
      ).slice(0, 8),
    [analytics.notableMessages, dateFrom, dateTo, member, month, year],
  );
  const chartTick = { fontSize: 12, fill: "var(--chart-text)" };
  const smallChartTick = { fontSize: 10, fill: "var(--chart-text)" };
  const tooltipStyle = {
    background: "var(--tooltip-bg)",
    border: "1px solid var(--tooltip-border)",
    color: "var(--foreground)",
    borderRadius: 12,
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";

      try {
        window.localStorage.setItem("chat-theme", next);
      } catch {
        // El cambio visual igual debe funcionar aunque el navegador bloquee storage.
      }

      return next;
    });
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <section className="hero-band">
        <div className="fade-up mx-auto grid w-full max-w-7xl gap-8 px-4 py-7 sm:px-6 lg:grid-cols-[1fr_370px] lg:py-12">
          <div className="flex flex-col justify-between gap-8">
            <nav className="flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--beer)]/30 bg-[var(--beer)]/10 px-3 py-2 text-sm font-bold text-[var(--beer)]">
                <MessageCircle size={17} />
                Chat de amigos
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--beer)]/35 bg-[var(--foreground)]/10 text-[var(--beer)] transition hover:scale-[1.05] hover:bg-[var(--beer)]/20"
                  title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                >
                  {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <Link
                  href="/admin"
                  className="primary-action inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-black transition hover:scale-[1.03]"
                >
                  <Shield size={16} />
                  Admin
                </Link>
              </div>
            </nav>

            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--beer)]/30 bg-[var(--beer)]/10 px-3 py-2 text-sm font-black uppercase tracking-[0.14em] text-[var(--beer)]">
                <Beer size={18} />
                ANALISIS DEL CHAT HISTORICO DE LBB
              </p>
              <h1 className="max-w-4xl text-4xl font-black leading-tight text-[var(--foreground)] sm:text-6xl">
                Métricas del grupo, hábitos, temas y más estadísticas.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                Filtra por integrante, año, mes o período para ver actividad,
                contenido, horarios, rankings y dinámica conversacional del chat.
              </p>
            </div>
          </div>

          <div className="glass-panel grid gap-3 p-5">
            <Stat icon={<CalendarDays size={20} />} label="Período" value={formatDateRange(analytics.firstDate, analytics.lastDate)} />
            <Stat icon={<MessageCircle size={20} />} label="Mensajes" value={analytics.totalMessages.toLocaleString("es-AR")} />
            <Stat icon={<Users size={20} />} label="Participantes" value={analytics.totalMembers.toLocaleString("es-AR")} />
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6">
        <div className="glass-panel grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_160px_160px_auto]">
          <Filter label="Integrante" value={member} onChange={setMember}>
            <option value="todos">Todos</option>
            {analytics.members.map((name) => <option key={name} value={name}>{name}</option>)}
          </Filter>
          <Filter label="Año" value={year} onChange={setYear}>
            <option value="todos">Todos</option>
            {analytics.years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Filter>
          <Filter label="Mes" value={month} onChange={setMonth}>
            <option value="todos">Todos</option>
            {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </Filter>
          <label className="flex flex-col gap-2 text-sm font-bold text-[var(--muted)]">
            Desde
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="field h-11 rounded-xl px-3 font-medium outline-none ring-[var(--beer)]/20 transition focus:ring-4"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-bold text-[var(--muted)]">
            Hasta
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="field h-11 rounded-xl px-3 font-medium outline-none ring-[var(--beer)]/20 transition focus:ring-4"
            />
          </label>
          <button
            onClick={() => {
              setMember("todos");
              setYear("todos");
              setMonth("todos");
              setDateFrom("");
              setDateTo("");
            }}
            className="h-11 self-end rounded-xl border border-[var(--beer)]/30 px-4 text-sm font-black text-[var(--beer)] transition hover:bg-[var(--beer)]/10"
          >
            Limpiar
          </button>
        </div>

        <SectionTitle kicker="Resumen ejecutivo" title="Foto general del grupo" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {executive.map((item) => <Kpi key={item.title} title={item.title} value={item.value} note={item.note} />)}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Métricas generales" subtitle="Volumen, continuidad y estilo">
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Promedio mensajes/día" value={formatNumber(generalStats.avgMessagesPerDay, 1)} />
              <MiniMetric label="Días activos" value={generalStats.activeDays.toLocaleString("es-AR")} />
              <MiniMetric label="Días sin mensajes" value={generalStats.silentDays.toLocaleString("es-AR")} />
              <MiniMetric label="Caracteres por mensaje" value={formatNumber(generalStats.avgCharsPerMessage, 1)} />
              <MiniMetric label="Palabras por mensaje" value={formatNumber(generalStats.avgWordsPerMessage, 1)} />
              <MiniMetric label="Multimedia filtrada" value={totals.media.toLocaleString("es-AR")} />
              <MiniMetric label="Mensajes eliminados" value={totals.deleted.toLocaleString("es-AR")} />
            </div>
          </Panel>

          <Panel title="Días récord y silencios" subtitle="Picos y pausas largas">
            <div className="grid gap-4 sm:grid-cols-2">
              <RankList rows={generalStats.recordDays.slice(0, 5).map((row) => ({ label: formatDate(row.date), value: row.messages }))} />
              <RankList rows={generalStats.longestSilences.slice(0, 5).map((row) => ({ label: `${formatDate(row.start)} - ${formatDate(row.end)}`, value: row.days }))} suffix=" días" />
            </div>
          </Panel>
        </div>

        <SectionTitle kicker="Sección 1" title="Actividad general" />
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Panel title="Mensajes por mes" subtitle="Evolución histórica">
            <ChartBox>
              <AreaChart data={timeline}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={chartTick} />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="messages" stroke="var(--beer)" fill="var(--beer)" fillOpacity={0.26} strokeWidth={3} name="Mensajes" />
              </AreaChart>
            </ChartBox>
          </Panel>
          <Panel title="Mensajes por año" subtitle="Comparación año contra año">
            <ChartBox>
              <BarChart data={yearly}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={chartTick} />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="messages" fill="var(--amber)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBox>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Mensajes por día" subtitle="Picos diarios">
            <ChartBox height="h-64">
              <AreaChart data={dayTimeline}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={smallChartTick} interval="preserveStartEnd" />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="messages" stroke="var(--mint)" fill="var(--mint)" fillOpacity={0.24} />
              </AreaChart>
            </ChartBox>
          </Panel>
          <Panel title="Mensajes por semana" subtitle="Tendencia general">
            <ChartBox height="h-64">
              <LineChart data={weekly}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={smallChartTick} interval="preserveStartEnd" />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="messages" stroke="#c084fc" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartBox>
          </Panel>
          <Panel title="Mensajes acumulados" subtitle="Crecimiento total">
            <ChartBox height="h-64">
              <AreaChart data={cumulative}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={smallChartTick} />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="messages" stroke="var(--beer)" fill="var(--beer)" fillOpacity={0.22} />
              </AreaChart>
            </ChartBox>
          </Panel>
        </div>

        <SectionTitle kicker="Sección 2" title="Participantes" />
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Ranking de mensajes" subtitle="Cantidad y porcentaje de participación">
            <RankList rows={ranking.slice(0, 12).map((row) => ({ label: row.member, value: row.messages, share: row.share }))} />
          </Panel>
          <Panel title="Estilo por participante" subtitle="Promedios, constancia y escritura">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="py-2">Integrante</th>
                    <th>Mensajes</th>
                    <th>%</th>
                    <th>Días activos</th>
                    <th>Msj/día activo</th>
                    <th>Chars/msj</th>
                    <th>Pal/msj</th>
                  </tr>
                </thead>
                <tbody>
                  {memberStats.slice(0, 12).map((row) => (
                    <tr key={row.member} className="border-t border-[var(--line)]/15">
                      <td className="py-3 font-bold text-[var(--beer)]">{row.member}</td>
                      <td>{row.messages.toLocaleString("es-AR")}</td>
                      <td>{formatNumber(row.share, 1)}%</td>
                      <td>{row.activeDays.toLocaleString("es-AR")}</td>
                      <td>{formatNumber(row.messagesPerActiveDay, 1)}</td>
                      <td>{formatNumber(row.avgChars, 1)}</td>
                      <td>{formatNumber(row.avgWords, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Evolución anual por participante" subtitle="Top integrantes en cada año">
            <ChartBox>
              <BarChart data={yearMemberLeaders(scoped.months)}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={chartTick} />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="messages" fill="var(--beer)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBox>
          </Panel>
          <Panel title="Más activo cada mes" subtitle="Líderes mensuales recientes">
            <RankList rows={monthlyLeaders(scoped.months).slice(-12).reverse().map((row) => ({ label: `${row.label}: ${row.member}`, value: row.messages }))} />
          </Panel>
        </div>

        <SectionTitle kicker="Sección 3" title="Horarios y hábitos" />
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Actividad por hora" subtitle="Horarios pico">
            <ChartBox height="h-72">
              <BarChart data={hourData}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--chart-text)" }} interval={2} />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="messages" fill="var(--mint)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBox>
          </Panel>
          <Panel title="Actividad por día" subtitle="Día de semana con más ruido">
            <ChartBox height="h-72">
              <PieChart>
                <Pie
                  data={weekdayData}
                  dataKey="messages"
                  nameKey="label"
                  innerRadius={56}
                  outerRadius={96}
                  paddingAngle={2}
                  label={pieLabel}
                  labelLine={false}
                >
                  {weekdayData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ChartBox>
          </Panel>
          <Panel title="Franjas horarias" subtitle="Madrugada, trabajo y fuera de horario">
            <div className="grid gap-3">
              {timeBlocks(scoped.hours).map((row, index) => (
                <MiniMetric key={row.label} label={row.label} value={row.messages.toLocaleString("es-AR")} accent={COLORS[index % COLORS.length]} />
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Heatmap día/hora" subtitle="Patrón semanal completo">
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[720px] grid-cols-[56px_repeat(24,minmax(24px,1fr))] gap-1 text-xs">
              <span />
              {Array.from({ length: 24 }, (_, hour) => <span key={hour} className="text-center text-[var(--muted)]">{hour}</span>)}
              {dayHourData.map((row) => (
                <HeatRow key={row.day} row={row} />
              ))}
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Noctámbulos" subtitle="Mensajes entre 00:00 y 06:00">
            <RankList rows={nightRanking.slice(0, 10).map((row) => ({ label: row.member, value: row.nightMessages }))} />
          </Panel>
          <Panel title="Actividad laboral vs fuera de horario" subtitle="Lunes a viernes, 09:00-18:00">
            <ChartBox height="h-64">
              <BarChart data={workVsOffHours(memberStats)}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={chartTick} />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="messages" fill="var(--beer)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBox>
          </Panel>
        </div>

        <SectionTitle kicker="Sección 4" title="Contenido: palabras, emojis, links y multimedia" />
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr_0.9fr]">
          <Panel title="Nube de palabras" subtitle="Sin articulos ni conectores">
            <div className="flex min-h-72 flex-wrap content-center items-center justify-center gap-x-4 gap-y-3">
              {wordCloud.slice(0, 70).map((item, index) => (
                <span
                  key={`${item.word}-${index}`}
                  className="font-black leading-none"
                  style={{ color: COLORS[index % COLORS.length], fontSize: `${Math.max(14, Math.min(42, 12 + item.weight * 30))}px` }}
                  title={`${item.count.toLocaleString("es-AR")} menciones`}
                >
                  {item.word}
                </span>
              ))}
            </div>
          </Panel>
          <Panel title="Ranking de palabras" subtitle="Vocabulario dominante">
            <RankList rows={wordRanking.map((row) => ({ label: row.word, value: row.count }))} />
          </Panel>
          <Panel title="Frases repetidas" subtitle="Muletillas y contenido omitido">
            <RankList rows={phrases.map((row) => ({ label: row.value, value: row.count }))} />
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Emojis más usados" subtitle="Tono expresivo">
            <RankList rows={emojis.map((row) => ({ label: row.value, value: row.count }))} />
          </Panel>
          <Panel title="Links por dominio" subtitle="Contenido compartido">
            <RankList rows={domains.map((row) => ({ label: row.value, value: row.count }))} />
          </Panel>
          <Panel title="Multimedia por persona" subtitle="Audios, stickers y omitidos">
            <RankList rows={rankingMetric(memberStats, "media").slice(0, 10).map((row) => ({ label: row.member, value: row.media }))} />
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Temas recurrentes" subtitle="Asado, pádel, fútbol, viaje y más">
            <RankList rows={topics.map((row) => ({ label: row.value, value: row.count }))} />
          </Panel>
          <Panel title="Evolución de palabra/tema" subtitle="Frecuencia mensual">
            <div className="mb-4 max-w-xs">
              <Filter label="Tema" value={topic} onChange={setTopic}>
                {TOPIC_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
              </Filter>
            </div>
            <ChartBox height="h-64">
              <AreaChart data={selectedTopic}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="var(--amber)" fill="var(--amber)" fillOpacity={0.24} />
              </AreaChart>
            </ChartBox>
          </Panel>
        </div>

        <SectionTitle kicker="Sección 5" title="Dinámica social y conversaciones" />
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Conversaciones" subtitle="Bloques separados por 60 minutos">
            <div className="grid gap-3">
              <MiniMetric label="Cantidad" value={conversationStats.total.toLocaleString("es-AR")} />
              <MiniMetric label="Duración promedio" value={`${formatNumber(conversationStats.avgDurationMinutes, 1)} min`} />
              <MiniMetric label="Mensajes por conversación" value={formatNumber(conversationStats.avgMessages, 1)} />
              <MiniMetric label="Respuesta promedio" value={`${formatNumber(conversationStats.avgResponseMinutes, 1)} min`} />
            </div>
          </Panel>
          <Panel title="Quién levanta el grupo" subtitle="Inicia conversaciones">
            <RankList rows={conversationStats.starters.map((row) => ({ label: row.member, value: row.count }))} />
          </Panel>
          <Panel title="Quién cierra" subtitle="Último mensaje antes del silencio">
            <RankList rows={conversationStats.closers.map((row) => ({ label: row.member, value: row.count }))} />
          </Panel>
        </div>

        <Panel title="Conversaciones más largas" subtitle="Momentos de mayor intercambio">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {conversationStats.longest.map((row) => (
              <article key={`${row.start}-${row.messages}`} className="rounded-xl border border-[var(--line)]/15 bg-[var(--foreground)]/[0.06] p-3">
                <p className="text-xs text-[var(--muted)]">{formatDate(row.start)} - {formatDate(row.end)}</p>
                <strong className="mt-1 block text-lg text-[var(--beer)]">{row.messages.toLocaleString("es-AR")} msj</strong>
                <p className="mt-2 text-sm">Abre {row.starter}, cierra {row.closer}</p>
                <p className="text-xs text-[var(--muted)]">{formatNumber(row.durationMinutes, 0)} minutos</p>
              </article>
            ))}
          </div>
        </Panel>

        <SectionTitle kicker="Sección 6" title="Premios del grupo" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredAwards.map((award) => (
            <article
              key={award.title}
              className="award-card panel-card p-5"
              tabIndex={0}
              title={award.description}
            >
              <Award className="mb-4 text-[var(--beer)]" size={24} />
              <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{award.title}</p>
              <h3 className="mt-1 text-xl font-black text-[var(--foreground)]">{award.member}</h3>
              <p className="mt-2 text-sm text-[var(--beer)]">{award.value}</p>
              <p className="award-reason text-sm leading-6 text-[var(--muted)]">
                {award.description}
              </p>
            </article>
          ))}
        </div>

        <Panel title="Mensajes más largos" subtitle="Máxima extensión individual">
          <div className="grid gap-3 md:grid-cols-2">
            {filteredLongestMessages.slice(0, 6).map((item) => (
              <article key={`${item.date}-${item.member}-${item.chars}`} className="rounded-xl border border-[var(--line)]/15 bg-[var(--foreground)]/[0.06] p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                  <strong className="text-[var(--beer)]">{item.member}</strong>
                  <span>{formatDate(item.date)} · {item.chars.toLocaleString("es-AR")} chars</span>
                </div>
                <p className="line-clamp-3 text-sm leading-6 text-[var(--foreground)]">{item.message}</p>
              </article>
            ))}
          </div>
        </Panel>

        <footer className="flex flex-col gap-2 border-t border-[var(--line)]/15 py-6 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>Fuente: {analytics.sourceName}</span>
          <span><Sparkles size={15} className="mr-1 inline" /> Generado {new Date(analytics.generatedAt).toLocaleString("es-AR")}</span>
        </footer>
      </section>
    </main>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="fade-up pt-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--beer)]">{kicker}</p>
      <h2 className="mt-1 text-2xl font-black text-[var(--foreground)] sm:text-3xl">{title}</h2>
    </header>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[var(--foreground)]/10 p-3">
      <span className="text-[var(--beer)]">{icon}</span>
      <p><span className="block text-xs uppercase tracking-wide text-[var(--muted)]">{label}</span><strong className="text-[var(--foreground)]">{value}</strong></p>
    </div>
  );
}

function pieLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  name,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}) {
  if (!percent || percent < 0.045 || cx == null || cy == null || midAngle == null || outerRadius == null) {
    return null;
  }

  const radius = outerRadius + 18;
  const radians = (-midAngle * Math.PI) / 180;
  const x = cx + radius * Math.cos(radians);
  const y = cy + radius * Math.sin(radians);

  return (
    <text className="chart-label" x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
      {name} {Math.round(percent * 100)}%
    </text>
  );
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-bold text-[var(--muted)]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field h-11 rounded-xl px-3 font-medium outline-none ring-[var(--beer)]/20 transition focus:ring-4">
        {children}
      </select>
    </label>
  );
}

function Kpi({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="metric-card p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--muted)]"><Search size={15} />{title}</p>
      <strong className="block text-2xl font-black text-[var(--foreground)]">{value}</strong>
      <span className="mt-1 block text-xs text-[var(--beer)]">{note}</span>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="panel-card p-4 sm:p-5">
      <header className="mb-5">
        <h2 className="text-xl font-black text-[var(--foreground)]">{title}</h2>
        <p className="text-sm text-[var(--muted)]">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

function ChartBox({ children, height = "h-80" }: { children: React.ReactElement; height?: string }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className={`${height} min-w-[520px] sm:min-w-0`}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, accent = "var(--beer)" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--line)]/15 bg-[var(--foreground)]/[0.06] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <strong className="mt-1 block break-words text-xl font-black" style={{ color: accent }}>{value}</strong>
    </div>
  );
}

function RankList({ rows, suffix = "" }: { rows: Array<{ label: string; value: number; share?: number }>; suffix?: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((item, index) => (
        <div key={`${item.label}-${index}`} className="grid gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-bold">
              {index === 0 ? <Crown size={15} className="shrink-0 text-[var(--beer)]" /> : null}
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-[var(--muted)]">
              {item.value.toLocaleString("es-AR")}{suffix}{item.share ? ` · ${formatNumber(item.share, 1)}%` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--foreground)]/10">
            <div className="h-full rounded-full bg-[var(--beer)]" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatRow({ row }: { row: { day: string; hours: Array<{ hour: number; messages: number; intensity: number }> } }) {
  return (
    <>
      <span className="sticky left-0 bg-[var(--tooltip-bg)] pr-2 font-bold text-[var(--muted)]">{row.day}</span>
      {row.hours.map((item) => (
        <span
          key={`${row.day}-${item.hour}`}
          title={`${row.day} ${item.hour}h: ${item.messages.toLocaleString("es-AR")} mensajes`}
          className="h-7 rounded-md border border-[var(--foreground)]/5"
          style={{ background: `rgba(var(--heat-rgb), ${0.16 + item.intensity * 0.84})` }}
        />
      ))}
    </>
  );
}

function filterRows<T extends { member: string; year: number; month: number; date?: string }>(
  rows: T[],
  member: string,
  year: string,
  month: string,
  dateFrom: string,
  dateTo: string,
) {
  return rows.filter((row) => {
    if (member !== "todos" && row.member !== member) return false;
    if (year !== "todos" && row.year !== Number(year)) return false;
    if (month !== "todos" && row.month !== Number(month)) return false;

    if (row.date) {
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
      return true;
    }

    if (!dateFrom && !dateTo) return true;

    const monthStart = `${row.year}-${String(row.month).padStart(2, "0")}-01`;
    const monthEnd = `${row.year}-${String(row.month).padStart(2, "0")}-31`;

    if (dateFrom && monthEnd < dateFrom) return false;
    if (dateTo && monthStart > dateTo) return false;

    return true;
  });
}

function monthsFromDays(days: DayPoint[]) {
  const map = new Map<string, MetricPoint>();

  for (const day of days) {
    const mapKey = `${day.year}-${day.month}-${day.member}`;
    const current =
      map.get(mapKey) ??
      ({
        year: day.year,
        month: day.month,
        member: day.member,
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

    current.messages += day.messages;
    current.words += day.words;
    current.chars += day.chars;
    current.media += day.media;
    current.audios += day.audios;
    current.stickers += day.stickers;
    current.links += day.links;
    current.emojis += day.emojis;
    current.questions += day.questions;
    current.deleted += day.deleted;
    map.set(mapKey, current);
  }

  return [...map.values()];
}

function hoursFromDayHours(rows: DayHourPoint[]) {
  const map = new Map<number, number>();

  for (const row of rows) {
    map.set(row.hour, (map.get(row.hour) ?? 0) + row.messages);
  }

  return [...map.entries()].map(([bucket, messages]) => ({ bucket, messages }));
}

function weekdaysFromDayHours(rows: DayHourPoint[]) {
  const map = new Map<number, number>();

  for (const row of rows) {
    map.set(row.weekday, (map.get(row.weekday) ?? 0) + row.messages);
  }

  return [...map.entries()].map(([bucket, messages]) => ({ bucket, messages }));
}

function sumTotals(rows: MetricPoint[]): Totals {
  return rows.reduce((acc, row) => ({
    messages: acc.messages + row.messages,
    words: acc.words + row.words,
    chars: acc.chars + row.chars,
    media: acc.media + row.media,
    audios: acc.audios + row.audios,
    stickers: acc.stickers + row.stickers,
    links: acc.links + row.links,
    emojis: acc.emojis + row.emojis,
    oneWord: acc.oneWord + row.oneWord,
    questions: acc.questions + row.questions,
    deleted: acc.deleted + row.deleted,
  }), emptyTotals());
}

function emptyTotals(): Totals {
  return { messages: 0, words: 0, chars: 0, media: 0, audios: 0, stickers: 0, links: 0, emojis: 0, oneWord: 0, questions: 0, deleted: 0 };
}

function rankingByMember(rows: MetricPoint[]) {
  const map = new Map<string, Totals>();
  const totalMessages = rows.reduce((sum, row) => sum + row.messages, 0) || 1;

  for (const row of rows) {
    const current = map.get(row.member) ?? emptyTotals();
    current.messages += row.messages;
    current.words += row.words;
    current.chars += row.chars;
    current.media += row.media;
    current.audios += row.audios;
    current.stickers += row.stickers;
    current.links += row.links;
    current.emojis += row.emojis;
    current.oneWord += row.oneWord;
    current.questions += row.questions;
    current.deleted += row.deleted;
    map.set(row.member, current);
  }

  return [...map.entries()].map(([name, totals]) => ({ member: name, ...totals, share: (totals.messages / totalMessages) * 100 })).sort((a, b) => b.messages - a.messages);
}

function timelineData(rows: MetricPoint[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(monthKey(row), (map.get(monthKey(row)) ?? 0) + row.messages);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, messages]) => ({ label: monthLabelFromKey(key), messages }));
}

function cumulativeData(rows: MetricPoint[]) {
  let total = 0;
  return timelineData(rows).map((row) => {
    total += row.messages;
    return { ...row, messages: total };
  });
}

function dailyData(rows: DayPoint[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.date, (map.get(row.date) ?? 0) + row.messages);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, messages]) => ({ label: formatShortDate(date), messages }));
}

function weeklyData(rows: DayPoint[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = weekKey(row.date);
    map.set(key, (map.get(key) ?? 0) + row.messages);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, messages]) => ({ label: key, messages }));
}

function yearData(rows: MetricPoint[]) {
  const map = new Map<number, number>();
  for (const row of rows) map.set(row.year, (map.get(row.year) ?? 0) + row.messages);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, messages]) => ({ label: String(year), messages }));
}

function monthSeason(rows: MetricPoint[]) {
  const map = new Map<number, number>();
  for (const row of rows) map.set(row.month, (map.get(row.month) ?? 0) + row.messages);
  return MONTHS.map((label, index) => ({ label, messages: map.get(index + 1) ?? 0 }));
}

function bucketData(rows: Array<{ bucket: number; messages: number }>, length: number, labels?: string[]) {
  const totals = Array.from({ length }, (_, bucket) => ({ label: labels?.[bucket] ?? `${String(bucket).padStart(2, "0")}h`, bucket, messages: 0 }));
  for (const row of rows) totals[row.bucket].messages += row.messages;
  return totals;
}

function heatmap(rows: DayHourPoint[]) {
  const values = Array.from({ length: 7 }, (_, day) => ({ day: WEEKDAYS[day], hours: Array.from({ length: 24 }, (_, hour) => ({ hour, messages: 0, intensity: 0 })) }));
  for (const row of rows) values[row.weekday].hours[row.hour].messages += row.messages;
  const max = Math.max(...values.flatMap((row) => row.hours.map((hour) => hour.messages)), 1);
  return values.map((row) => ({ ...row, hours: row.hours.map((hour) => ({ ...hour, intensity: hour.messages / max })) }));
}

function filteredWords(
  analytics: ChatAnalytics,
  rows: WordPoint[],
  member: string,
  year: string,
  month: string,
  dateFrom: string,
  dateTo: string,
) {
  const selected =
    member === "todos" &&
    year === "todos" &&
    month === "todos" &&
    !dateFrom &&
    !dateTo
      ? analytics.globalWords
      : aggregateWordRows(rows, 90);
  const max = selected[0]?.count || 1;
  return selected.map((item) => ({ ...item, weight: item.count / max }));
}

function aggregateWordRows(rows: WordPoint[], limit: number) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.word, (map.get(row.word) ?? 0) + row.count);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([word, count]) => ({ word, count }));
}

function aggregateCount(rows: CountPoint[], limit: number) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.value, (map.get(row.value) ?? 0) + row.count);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count }));
}

function topicEvolution(rows: CountPoint[], topic: string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.value !== topic) continue;
    map.set(monthKey(row), (map.get(monthKey(row)) ?? 0) + row.count);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ label: monthLabelFromKey(key), count }));
}

function memberStatsFromMonths(months: MetricPoint[], days: DayPoint[], dayHours: DayHourPoint[]) {
  const ranking = rankingByMember(months);
  const activeDays = new Map<string, Set<string>>();
  const night = new Map<string, number>();
  const work = new Map<string, number>();

  for (const row of days) {
    if (!activeDays.has(row.member)) activeDays.set(row.member, new Set<string>());
    activeDays.get(row.member)?.add(row.date);
  }
  for (const row of dayHours) {
    if (row.hour < 6) {
      night.set(row.member, (night.get(row.member) ?? 0) + row.messages);
    }
    if (row.weekday >= 1 && row.weekday <= 5 && row.hour >= 9 && row.hour < 18) {
      work.set(row.member, (work.get(row.member) ?? 0) + row.messages);
    }
  }

  return ranking.map((row) => {
    const dayCount = activeDays.get(row.member)?.size ?? 0;
    return {
      ...row,
      activeDays: dayCount,
      avgChars: row.messages ? row.chars / row.messages : 0,
      avgWords: row.messages ? row.words / row.messages : 0,
      messagesPerActiveDay: dayCount ? row.messages / dayCount : 0,
      nightMessages: night.get(row.member) ?? 0,
      workMessages: work.get(row.member) ?? 0,
    };
  });
}

function rankingMetric<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return [...rows].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0));
}

function timeBlocks(rows: Array<{ bucket: number; messages: number }>) {
  const blocks = [
    { label: "Madrugada 00-06", from: 0, to: 5, messages: 0 },
    { label: "Mañana 06-12", from: 6, to: 11, messages: 0 },
    { label: "Tarde 12-18", from: 12, to: 17, messages: 0 },
    { label: "Noche 18-24", from: 18, to: 23, messages: 0 },
  ];
  for (const row of rows) {
    const block = blocks.find((item) => row.bucket >= item.from && row.bucket <= item.to);
    if (block) block.messages += row.messages;
  }
  return blocks;
}

function workVsOffHours(rows: ReturnType<typeof memberStatsFromMonths>) {
  const work = rows.reduce((sum, row) => sum + row.workMessages, 0);
  const total = rows.reduce((sum, row) => sum + row.messages, 0);
  return [{ label: "Laboral", messages: work }, { label: "Fuera", messages: Math.max(0, total - work) }];
}

function filterConversations(
  rows: ChatAnalytics["conversationDetails"],
  member: string,
  year: string,
  month: string,
  dateFrom: string,
  dateTo: string,
) {
  return rows.filter((row) => {
    if (member !== "todos" && !row.participants.includes(member)) return false;
    if (year !== "todos" && row.year !== Number(year)) return false;
    if (month !== "todos" && row.month !== Number(month)) return false;
    if (dateFrom && row.date < dateFrom) return false;
    if (dateTo && row.date > dateTo) return false;

    return true;
  });
}

function conversationStatsFromDetails(rows: ChatAnalytics["conversationDetails"]) {
  const starters = new Map<string, number>();
  const closers = new Map<string, number>();
  const total = rows.length;
  const duration = rows.reduce((sum, row) => sum + row.durationMinutes, 0);
  const messages = rows.reduce((sum, row) => sum + row.messages, 0);
  const response = rows.reduce((sum, row) => sum + row.avgResponseMinutes, 0);

  for (const row of rows) {
    starters.set(row.starter, (starters.get(row.starter) ?? 0) + 1);
    closers.set(row.closer, (closers.get(row.closer) ?? 0) + 1);
  }

  return {
    total,
    avgDurationMinutes: total ? duration / total : 0,
    avgMessages: total ? messages / total : 0,
    avgResponseMinutes: total ? response / total : 0,
    starters: topMap(starters, 10, "member"),
    closers: topMap(closers, 10, "member"),
    longest: [...rows]
      .sort((a, b) => b.messages - a.messages || b.durationMinutes - a.durationMinutes)
      .slice(0, 8),
  };
}

function filterNotableMessages(
  rows: ChatAnalytics["notableMessages"],
  member: string,
  year: string,
  month: string,
  dateFrom: string,
  dateTo: string,
) {
  return rows
    .filter((row) => {
      const date = row.date.slice(0, 10);
      if (member !== "todos" && row.member !== member) return false;
      if (year !== "todos" && row.year !== Number(year)) return false;
      if (month !== "todos" && row.month !== Number(month)) return false;
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;

      return true;
    })
    .sort((a, b) => b.chars - a.chars);
}

function buildFilteredAwards(rows: ReturnType<typeof memberStatsFromMonths>) {
  const eligibleRows = rows.filter((row) => normalizeName(row.member) !== "meta ai");
  const awards = [
    filteredAward("El más manija", eligibleRows, (item) => item.messagesPerActiveDay, "msj/día activo", "Se otorga a quien tiene mayor promedio de mensajes por día activo en el filtro actual."),
    filteredAward("El noctámbulo", eligibleRows, (item) => item.nightMessages, "msj de 00 a 06", "Se otorga a quien más mensajes mandó entre la medianoche y las seis de la mañana."),
    filteredAward("El fantasma", eligibleRows, (item) => -item.messages, "menos mensajes", "Se otorga a quien aparece con menos mensajes dentro del período filtrado."),
    filteredAward("El que manda audios", eligibleRows, (item) => item.audios, "audios", "Se otorga a quien más mensajes de audio tiene detectados en el historial filtrado."),
    filteredAward("El sticker-man", eligibleRows, (item) => item.stickers, "stickers", "Se otorga a quien más stickers mandó en el filtro seleccionado."),
    filteredAward("El político", eligibleRows, (item) => item.avgChars, "caracteres promedio", "Se otorga a quien tiene el promedio más alto de caracteres por mensaje."),
    filteredAward("El monosílabo", eligibleRows, (item) => item.oneWord, "mensajes de 1 palabra", "Se otorga a quien más mensajes de una sola palabra acumuló."),
    filteredAward("El influencer", eligibleRows, (item) => item.links, "links", "Se otorga a quien más enlaces compartió en el filtro actual."),
  ];

  return awards.filter((award): award is { title: string; member: string; value: string; description: string } =>
    Boolean(award),
  );
}

function filteredAward(
  title: string,
  rows: ReturnType<typeof memberStatsFromMonths>,
  metric: (item: ReturnType<typeof memberStatsFromMonths>[number]) => number,
  suffix: string,
  description: string,
) {
  const winner = [...rows].sort((a, b) => metric(b) - metric(a))[0];

  if (!winner) return null;

  return {
    title,
    member: winner.member,
    value: `${Math.abs(metric(winner)).toLocaleString("es-AR", {
      maximumFractionDigits: 1,
    })} ${suffix}`,
    description,
  };
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function topMap<TKey extends string>(
  map: Map<string, number>,
  limit: number,
  keyName: TKey,
) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({
      [keyName]: value,
      count,
    })) as Array<Record<TKey, string> & { count: number }>;
}

function scopedGeneralStats(
  days: DayPoint[],
  totals: Totals,
  dateFrom: string,
  dateTo: string,
) {
  const byDate = new Map<string, number>();

  for (const day of days) {
    byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.messages);
  }

  const sortedDates = [...byDate.keys()].sort();
  const firstDate = dateFrom || sortedDates[0] || "";
  const lastDate = dateTo || sortedDates.at(-1) || firstDate;
  const periodDays = firstDate && lastDate ? daysBetween(firstDate, lastDate) + 1 : 0;
  const activeDays = byDate.size;

  return {
    activeDays,
    silentDays: Math.max(0, periodDays - activeDays),
    avgMessagesPerDay: periodDays ? totals.messages / periodDays : 0,
    avgCharsPerMessage: totals.messages ? totals.chars / totals.messages : 0,
    avgWordsPerMessage: totals.messages ? totals.words / totals.messages : 0,
    recordDays: [...byDate.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([date, messages]) => ({ date, messages })),
    longestSilences: longestSilencesBetween(sortedDates, firstDate, lastDate),
  };
}

function yearMemberLeaders(rows: MetricPoint[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(`${row.year}|${row.member}`, (map.get(`${row.year}|${row.member}`) ?? 0) + row.messages);
  const byYear = new Map<number, { member: string; messages: number }>();
  for (const [key, messages] of map) {
    const [yearText, member] = key.split("|");
    const year = Number(yearText);
    if (!byYear.get(year) || messages > byYear.get(year)!.messages) byYear.set(year, { member, messages });
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, row]) => ({ label: `${year} · ${row.member}`, messages: row.messages }));
}

function monthlyLeaders(rows: MetricPoint[]) {
  const map = new Map<string, { member: string; messages: number }>();
  for (const row of rows) {
    const key = monthKey(row);
    const current = map.get(key);
    if (!current || row.messages > current.messages) map.set(key, { member: row.member, messages: row.messages });
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => ({ label: monthLabelFromKey(key), ...row }));
}

function executiveSummary(
  analytics: ChatAnalytics,
  totals: Totals,
  ranking: ReturnType<typeof rankingByMember>,
  hours: Array<{ label: string; messages: number }>,
  words: Array<{ word: string; count: number }>,
  emojis: Array<{ value: string; count: number }>,
  generalStats: ReturnType<typeof scopedGeneralStats>,
) {
  const peakHour = [...hours].sort((a, b) => b.messages - a.messages)[0];
  const topMonth = monthSeason(analytics.months).sort((a, b) => b.messages - a.messages)[0];
  const recordDay = generalStats.recordDays[0];

  return [
    { title: "Persona más activa", value: ranking[0]?.member ?? "-", note: `${ranking[0]?.messages.toLocaleString("es-AR") ?? 0} mensajes filtrados` },
    { title: "Día récord", value: formatDate(recordDay?.date), note: `${recordDay?.messages.toLocaleString("es-AR") ?? 0} mensajes filtrados` },
    { title: "Hora pico", value: peakHour?.label ?? "-", note: `${peakHour?.messages.toLocaleString("es-AR") ?? 0} mensajes filtrados` },
    { title: "Palabra top", value: words[0]?.word ?? "-", note: `${words[0]?.count.toLocaleString("es-AR") ?? 0} menciones` },
    { title: "Emoji top", value: emojis[0]?.value ?? "-", note: `${emojis[0]?.count.toLocaleString("es-AR") ?? 0} usos` },
    { title: "Mes más activo", value: topMonth?.label ?? "-", note: `${topMonth?.messages.toLocaleString("es-AR") ?? 0} mensajes históricos` },
    { title: "Links", value: totals.links.toLocaleString("es-AR"), note: "en el filtro actual" },
    { title: "Audios/stickers", value: (totals.audios + totals.stickers).toLocaleString("es-AR"), note: "contenido no textual detectado" },
  ];
}

function monthKey(row: { year: number; month: number }) {
  return `${row.year}-${String(row.month).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1]} ${year.slice(2)}`;
}

function weekKey(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  const start = new Date(parsed);
  start.setDate(parsed.getDate() - parsed.getDay());
  return formatShortDate(start.toISOString());
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function addDays(date: string, amount: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + amount);

  return parsed.toISOString().slice(0, 10);
}

function longestSilencesBetween(
  sortedActiveDates: string[],
  firstDate: string,
  lastDate: string,
) {
  if (!firstDate || !lastDate) {
    return [];
  }

  const silences: Array<{ start: string; end: string; days: number }> = [];
  let previous = firstDate;

  for (const activeDate of sortedActiveDates) {
    const gap = daysBetween(previous, activeDate);

    if (gap > 0) {
      silences.push({
        start: previous,
        end: addDays(activeDate, -1),
        days: gap,
      });
    }

    previous = addDays(activeDate, 1);
  }

  if (previous <= lastDate) {
    silences.push({
      start: previous,
      end: lastDate,
      days: daysBetween(previous, lastDate) + 1,
    });
  }

  return silences.sort((a, b) => b.days - a.days).slice(0, 8);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDateRange(first: string | null, last: string | null) {
  if (!first || !last) return "Sin fechas";
  return `${formatDate(first)} - ${formatDate(last)}`;
}

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: digits });
}
