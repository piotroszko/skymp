type WidgetsListener<T> = (widgets: T[]) => void;

class Widgets<T = any> {
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

  addListener(listener: WidgetsListener<T>): void {
    this.listeners.push(listener);
  }

  removeListener(listener: WidgetsListener<T>): void {
    this.listeners = this.listeners.filter((el) => el != listener);
  }
}

export { Widgets };
