const toggleClass = (el: Element, name: string): Element => {
  if (el.classList.contains(name)) el.classList.remove(name);
  else el.classList.add(name);
  return el;
};

export { toggleClass };
