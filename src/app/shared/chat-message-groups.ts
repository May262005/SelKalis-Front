import type { ChatMessage } from '../services/soporte.service';

export interface ChatDayGroup {
  key: string;
  label: string;
  messages: ChatMessage[];
  expanded: boolean;
}

export function groupChatMessagesByDay(messages: ChatMessage[], now = new Date()): ChatDayGroup[] {
  const grouped = new Map<string, { date: Date | null; messages: ChatMessage[] }>();

  for (const message of messages) {
    const date = new Date(message.created_at);
    const validDate = Number.isNaN(date.getTime()) ? null : date;
    const key = validDate
      ? `${validDate.getFullYear()}-${validDate.getMonth()}-${validDate.getDate()}`
      : 'unknown-date';
    const group = grouped.get(key) ?? { date: validDate, messages: [] };
    group.messages.push(message);
    grouped.set(key, group);
  }

  const todayKey = getDateKey(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday);
  const groups = Array.from(grouped.entries());

  return groups.map(([key, group], index) => {
    let label = 'Fecha no disponible';
    if (group.date) {
      const dateKey = getDateKey(group.date);
      if (dateKey === todayKey) {
        label = 'Hoy';
      } else if (dateKey === yesterdayKey) {
        label = 'Ayer';
      } else {
        const formatted = group.date.toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        label = formatted.charAt(0).toUpperCase() + formatted.slice(1);
      }
    }

    return {
      key,
      label,
      messages: group.messages,
      expanded: index === groups.length - 1
    };
  });
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
