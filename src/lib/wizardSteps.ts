/** The profile wizard's steps, in order. Settings can open the wizard at any of them. */
export const WIZARD_STEPS = [
  { id: 'about', label: 'About you' },
  { id: 'coloring', label: 'Your coloring' },
  { id: 'shape', label: 'Shape and fit' },
  { id: 'days', label: 'Your days' },
  { id: 'style', label: 'Your style' },
  { id: 'colors', label: 'Colors and patterns' },
  { id: 'body', label: 'Body comfort' },
  { id: 'sizes', label: 'Sizes and budget' },
  { id: 'look', label: 'Your look' },
] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]['id']
