import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../services/soporte.service';
import { groupChatMessagesByDay } from './chat-message-groups';

describe('groupChatMessagesByDay', () => {
  it('agrupa por fecha y deja expandido solo el día más reciente', () => {
    const today = new Date(2026, 10, 25, 12);
    const messages: ChatMessage[] = [
      {
        id: '1',
        conversation_id: 'c1',
        sender_id: 'u1',
        sender_role: 'user',
        mensaje: 'Ayer',
        created_at: new Date(2026, 10, 24, 10).toISOString()
      },
      {
        id: '2',
        conversation_id: 'c1',
        sender_id: 'u1',
        sender_role: 'user',
        mensaje: 'Hoy',
        created_at: new Date(2026, 10, 25, 9).toISOString()
      },
      {
        id: '3',
        conversation_id: 'c1',
        sender_id: 'u1',
        sender_role: 'user',
        mensaje: 'Hoy también',
        created_at: new Date(2026, 10, 25, 11).toISOString()
      }
    ];

    const groups = groupChatMessagesByDay(messages, today);

    expect(groups.map(group => [group.label, group.messages.length, group.expanded])).toEqual([
      ['Ayer', 1, false],
      ['Hoy', 2, true]
    ]);
  });
});
