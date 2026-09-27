import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { forecastLine, readReminder, REMINDER_DEFAULTS, reminderDue, writeReminder } from './reminderStore'

describe('morning reminder', () => {
  const on = { ...REMINDER_DEFAULTS, enabled: true, hour: 7 }
  it('shows once a day, in the morning, from the chosen hour', () => {
    expect(reminderDue(on, new Date('2026-09-28T06:30:00'))).toBe(false)
    expect(reminderDue(on, new Date('2026-09-28T07:05:00'))).toBe(true)
    expect(reminderDue(on, new Date('2026-09-28T13:00:00'))).toBe(false)
    expect(reminderDue({ ...on, lastShown: '2026-09-28' }, new Date('2026-09-28T08:00:00'))).toBe(false)
    expect(reminderDue({ ...on, enabled: false }, new Date('2026-09-28T08:00:00'))).toBe(false)
  })
  it('says the weather in a few words', () => {
    expect(forecastLine({ temperature_2m_max: [31.6], temperature_2m_min: [24.2], precipitation_probability_max: [70] })).toBe('32° / 24° · rain likely')
    expect(forecastLine({ temperature_2m_max: [20], temperature_2m_min: [12], precipitation_probability_max: [0] })).toBe('20° / 12°')
    expect(forecastLine(undefined)).toBeNull()
  })
  it('keeps its settings on the phone', async () => {
    await writeReminder({ enabled: true, hour: 8, name: 'Maanvi' })
    expect(await readReminder()).toMatchObject({ enabled: true, hour: 8, name: 'Maanvi', lastShown: null })
  })
})
