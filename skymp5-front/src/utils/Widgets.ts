type WidgetId = number | string;

interface IdentifiableWidget {
  id: WidgetId;
}

type WidgetsListener<T> = (widgets: T[]) => void;

class Widgets<T extends IdentifiableWidget = IdentifiableWidget> {
  private widgets: T[];
  private listeners: WidgetsListener<T>[];

  constructor(widgets?: T[]) {
    this.widgets = widgets || [];
    this.listeners = [];
  }

  get(): T[] {
    return this.widgets;
  }

  set(widgets: T[]): void {
    this.widgets = widgets;
    this.listeners.forEach((listener) => listener(widgets));
  }

  add(widget: T): void {
    const idx = this.widgets.findIndex((el) => el.id === widget.id);
    const next = idx >= 0
      ? this.widgets.map((el, i) => (i === idx ? widget : el))
      : [...this.widgets, widget];
    this.set(next);
  }

  remove(id: WidgetId): void {
    const next = this.widgets.filter((el) => el.id !== id);
    if (next.length === this.widgets.length) return;
    this.set(next);
  }

  addListener(listener: WidgetsListener<T>): void {
    this.listeners.push(listener);
  }

  removeListener(listener: WidgetsListener<T>): void {
    this.listeners = this.listeners.filter((el) => el != listener);
  }
}

export { Widgets };
