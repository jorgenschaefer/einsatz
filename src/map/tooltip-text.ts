/**
 * Ein Tooltip-Inhalt, der `label` als Text zeigt. Einen String setzt Leaflet
 * per `innerHTML` – eine Bezeichnung oder Beschriftung mit HTML würde sonst zu
 * Elementen. Je Bindung ein neuer Knoten, denn ein Knoten steht nur an einer
 * Stelle.
 */
export function tooltipText(label: string): HTMLElement {
  const span = document.createElement("span");
  span.textContent = label;
  return span;
}
