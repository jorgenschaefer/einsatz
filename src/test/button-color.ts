/** Die Mantine-Farbe eines gefüllten `Button`; `undefined` bei der Primärfarbe. */
export function buttonColor(button: HTMLElement) {
  return button.style
    .getPropertyValue("--button-bg")
    .match(/^var\(--mantine-color-(\w+)-filled\)$/)?.[1];
}
